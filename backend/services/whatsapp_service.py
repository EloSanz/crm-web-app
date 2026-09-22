import hashlib
import hmac
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from backend.config import settings
from backend.models.message import MessageStatus

logger = logging.getLogger("crm.services.whatsapp")

GRAPH_URL = "https://graph.facebook.com"
WINDOW_HOURS = 24

# Errores de la WhatsApp Cloud API traducidos para el vendedor.
_ERRORS: dict[int, str] = {
    131047: (
        "Pasaron más de 24 h desde el último mensaje del cliente. "
        "WhatsApp sólo permite retomar la conversación con una plantilla aprobada."
    ),
    470: (
        "Pasaron más de 24 h desde el último mensaje del cliente. "
        "WhatsApp sólo permite retomar la conversación con una plantilla aprobada."
    ),
    131026: "No se pudo entregar: el número no tiene WhatsApp o todavía no aceptó las condiciones.",
    131030: "Ese número no está en la lista de destinatarios permitidos de la app de prueba de Meta.",
    131021: "No podés enviarle mensajes al mismo número de la empresa.",
    131031: "La cuenta de WhatsApp Business está bloqueada. Revisala en Meta.",
    131042: "Hay un problema con el medio de pago de la cuenta de WhatsApp Business.",
    131048: "Meta limitó los envíos por calidad. Esperá antes de volver a intentar.",
    131056: "Demasiados mensajes seguidos a este número. Esperá unos minutos.",
    130429: "Se alcanzó el límite de envíos de WhatsApp. Probá de nuevo en unos minutos.",
    131051: "WhatsApp no admite este tipo de mensaje.",
    132000: "La plantilla no coincide con los parámetros enviados.",
    132001: "La plantilla no existe o no está aprobada en ese idioma.",
    190: "El token de WhatsApp venció o es inválido. Pedile al administrador que lo renueve.",
    100: "WhatsApp rechazó el pedido por parámetros inválidos. Revisá el número del cliente.",
    10: "La app de Meta no tiene permiso para enviar mensajes con este número.",
    200: "La app de Meta no tiene permiso para enviar mensajes con este número.",
}
WINDOW_CLOSED_CODES = {131047, 470}
# Rechazos por datos del pedido (no por caída del proveedor): se devuelven como 422.
_CLIENT_ERROR_CODES = {131047, 470, 131026, 131030, 131021, 131051, 132000, 132001, 100}

_STATUS_MAP = {
    "sent": MessageStatus.ENVIADO,
    "delivered": MessageStatus.ENTREGADO,
    "read": MessageStatus.LEIDO,
    "failed": MessageStatus.FALLIDO,
}


class WhatsAppError(Exception):
    def __init__(self, message: str, code: int | None = None, http_status: int = 502):
        super().__init__(message)
        self.message = message
        self.code = code
        self.http_status = http_status


def error_message(code: int | None, fallback: str | None = None) -> str:
    if code is not None and code in _ERRORS:
        return _ERRORS[code]
    return f"WhatsApp rechazó el mensaje{f': {fallback}' if fallback else '.'}"


def is_configured() -> bool:
    return bool(settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID)


def template_available() -> bool:
    return is_configured() and bool(settings.WHATSAPP_TEMPLATE_NAME)


# ---------------------------------------------------------------------------
# Teléfonos
# ---------------------------------------------------------------------------


def _strip_ar_mobile_prefix(national: str) -> str:
    """Saca el 0 de larga distancia y el 15 de celular: 011 15 2233-4455 → 1122334455."""
    national = national.lstrip("0")
    if len(national) == 12:
        for area_len in (2, 3, 4):
            if national[area_len : area_len + 2] == "15":
                return national[:area_len] + national[area_len + 2 :]
    return national


def normalize_phone(raw: str | None) -> str | None:
    """Número en formato internacional sólo con dígitos, como lo usa WhatsApp (ej. 5491122334455).

    Los números argentinos se llevan a 549 + característica + número; sin prefijo de país se
    asume WHATSAPP_DEFAULT_COUNTRY_CODE.
    """
    if not raw:
        return None
    text = raw.strip()
    digits = re.sub(r"\D", "", text)
    if not digits:
        return None
    international = text.startswith("+")
    if digits.startswith("00"):
        digits = digits[2:]
        international = True
    country = re.sub(r"\D", "", settings.WHATSAPP_DEFAULT_COUNTRY_CODE or "54") or "54"

    if not international and not (digits.startswith(country) and len(digits) > 10):
        national = digits
        if country == "54":
            national = _strip_ar_mobile_prefix(national)
            return f"549{national}" if len(national) == 10 else None
        national = national.lstrip("0")
        return f"{country}{national}" if len(national) >= 6 else None

    if digits.startswith("54"):
        national = digits[2:]
        if national.startswith("9"):
            national = national[1:]
        national = _strip_ar_mobile_prefix(national)
        return f"549{national}" if len(national) == 10 else digits
    return digits if len(digits) >= 8 else None


# ---------------------------------------------------------------------------
# Envío
# ---------------------------------------------------------------------------


def _post(payload: dict) -> str:
    url = f"{GRAPH_URL}/{settings.WHATSAPP_API_VERSION}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    try:
        res = httpx.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"},
            timeout=15,
        )
    except httpx.HTTPError as e:
        logger.warning(f"WhatsApp Cloud API no respondió: {e}")
        raise WhatsAppError("No pudimos conectarnos con WhatsApp. Probá de nuevo en unos segundos.")
    try:
        data = res.json()
    except ValueError:
        data = {}
    if not isinstance(data, dict):
        data = {}
    if res.status_code >= 400 or data.get("error"):
        err = data.get("error") or {}
        code = err.get("code")
        details = (err.get("error_data") or {}).get("details") or err.get("message")
        logger.warning(f"WhatsApp Cloud API rechazó el envío ({code}): {details}")
        raise WhatsAppError(
            error_message(code, details),
            code=code,
            http_status=422 if code in _CLIENT_ERROR_CODES else 502,
        )
    messages = data.get("messages") or []
    if not messages or not messages[0].get("id"):
        raise WhatsAppError("WhatsApp no confirmó el envío. Probá de nuevo.")
    return messages[0]["id"]


def send_text(to: str, text: str) -> str:
    """Envía texto libre (sólo dentro de la ventana de 24 h). Devuelve el id del mensaje (wamid)."""
    return _post(
        {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {"preview_url": True, "body": text},
        }
    )


def send_template(to: str) -> str:
    """Envía la plantilla aprobada configurada, para abrir o retomar la conversación."""
    return _post(
        {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "template",
            "template": {
                "name": settings.WHATSAPP_TEMPLATE_NAME,
                "language": {"code": settings.WHATSAPP_TEMPLATE_LANG or "es_AR"},
            },
        }
    )


# ---------------------------------------------------------------------------
# Webhook
# ---------------------------------------------------------------------------


def verify_signature(raw_body: bytes, header: str | None) -> bool:
    """Valida X-Hub-Signature-256 con el secreto de la app. Sin secreto configurado, no se valida."""
    secret = settings.WHATSAPP_APP_SECRET
    if not secret:
        return True
    if not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header.split("=", 1)[1].strip())


@dataclass
class InboundMessage:
    phone: str
    message_id: str
    text: str
    timestamp: datetime
    profile_name: str | None = None


@dataclass
class StatusEvent:
    message_id: str
    status: MessageStatus
    error: str | None = None


def _timestamp(value) -> datetime:
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return datetime.now(timezone.utc)


def _inbound_text(msg: dict) -> str | None:
    kind = msg.get("type")
    if kind == "text":
        return (msg.get("text") or {}).get("body")
    if kind in ("image", "video", "document", "audio", "sticker"):
        media = msg.get(kind) or {}
        label = {"image": "Foto", "video": "Video", "document": "Documento", "audio": "Audio", "sticker": "Sticker"}[
            kind
        ]
        if kind == "document" and media.get("filename"):
            label = f"Documento: {media['filename']}"
        caption = media.get("caption")
        return f"[{label}] {caption}" if caption else f"[{label}]"
    if kind == "location":
        loc = msg.get("location") or {}
        place = " · ".join(p for p in (loc.get("name"), loc.get("address")) if p)
        link = (
            f"https://maps.google.com/?q={loc.get('latitude')},{loc.get('longitude')}"
            if loc.get("latitude") is not None
            else ""
        )
        return " ".join(p for p in ("[Ubicación]", place, link) if p)
    if kind == "button":
        return (msg.get("button") or {}).get("text")
    if kind == "interactive":
        inter = msg.get("interactive") or {}
        reply = inter.get("button_reply") or inter.get("list_reply") or {}
        return reply.get("title")
    if kind == "contacts":
        return "[Contacto compartido]"
    if kind == "reaction":
        return None
    return "[Mensaje no admitido]"


def parse_webhook(payload: dict) -> tuple[list[InboundMessage], list[StatusEvent]]:
    """Extrae mensajes entrantes y cambios de estado del cuerpo que envía Meta."""
    inbound: list[InboundMessage] = []
    statuses: list[StatusEvent] = []
    own_number = settings.WHATSAPP_PHONE_NUMBER_ID
    for entry in payload.get("entry") or []:
        for change in entry.get("changes") or []:
            if change.get("field") != "messages":
                continue
            value = change.get("value") or {}
            number_id = (value.get("metadata") or {}).get("phone_number_id")
            if own_number and number_id and str(number_id) != str(own_number):
                continue
            names = {c.get("wa_id"): (c.get("profile") or {}).get("name") for c in value.get("contacts") or [] if c}
            for msg in value.get("messages") or []:
                text = _inbound_text(msg)
                phone = normalize_phone(f"+{msg.get('from', '')}") if msg.get("from") else None
                if not text or not phone or not msg.get("id"):
                    continue
                inbound.append(
                    InboundMessage(
                        phone=phone,
                        message_id=msg["id"],
                        text=text,
                        timestamp=_timestamp(msg.get("timestamp")),
                        profile_name=names.get(msg.get("from")),
                    )
                )
            for st in value.get("statuses") or []:
                mapped = _STATUS_MAP.get(st.get("status"))
                if not mapped or not st.get("id"):
                    continue
                error = None
                if mapped == MessageStatus.FALLIDO:
                    errs = st.get("errors") or [{}]
                    code = errs[0].get("code")
                    error = error_message(code, errs[0].get("title") or errs[0].get("message"))
                statuses.append(StatusEvent(message_id=st["id"], status=mapped, error=error))
    return inbound, statuses
