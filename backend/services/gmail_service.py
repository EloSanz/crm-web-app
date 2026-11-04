"""Correo con la casilla de Gmail del vendedor (OAuth de Google + API de Gmail).

- El vendedor conecta su cuenta una vez; los tokens quedan cifrados (Fernet) en crm_gmail_accounts.
- Los correos que manda desde el CRM salen de su dirección y quedan con el threadId de Gmail.
- Las respuestas se consultan cada tanto (al abrir el presupuesto, con el botón y con un cron):
  sólo entran las de hilos iniciados desde el CRM; el resto de la casilla no se toca.
- Quien no conecta su cuenta sigue enviando con EMAIL_PROVIDER (Resend, SMTP o simulado).
"""

import base64
import hashlib
import json
import logging
import re
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import getaddresses, parseaddr
from urllib.parse import urlencode
from uuid import UUID, uuid4

import httpx
from cryptography.fernet import Fernet, InvalidToken

from backend.config import settings
from backend.database import get_supabase_client
from backend.models.activity import ActivityAttachment, ActivityCreate, ActivityType
from backend.models.message import MessageChannel, MessageDirection, MessageResponse, MessageStatus
from backend.services import email_service

logger = logging.getLogger("crm.services.gmail")

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
API = "https://gmail.googleapis.com/gmail/v1/users/me"
# gmail.send para enviar; gmail.readonly para leer las respuestas de los hilos del CRM.
SCOPES = ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly"]
STATE_TTL_SECONDS = 600
SYNC_DAYS = 60
SYNC_MAX_THREADS = 25
SYNC_MIN_INTERVAL = timedelta(seconds=60)
PROVIDER = "gmail"

# Respaldo en memoria: desarrollo local, tests y bases sin la migración 08.
_mock_accounts: dict[str, dict] = {}


class GmailError(Exception):
    def __init__(self, message: str, http_status: int = 502):
        super().__init__(message)
        self.message = message
        self.http_status = http_status


def is_configured() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID.strip() and settings.GOOGLE_CLIENT_SECRET.strip())


# ---------------------------------------------------------------------------
# Cifrado de tokens
# ---------------------------------------------------------------------------


def _fernet() -> Fernet:
    raw = settings.TOKEN_ENCRYPTION_KEY.strip()
    if raw:
        try:
            return Fernet(raw.encode())
        except ValueError:
            pass  # no es una clave Fernet: se deriva de ese texto
    seed = raw or settings.JWT_SECRET_KEY
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(f"gmail-tokens:{seed}".encode()).digest()))


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken:
        logger.warning("No se pudo descifrar un token de Gmail (¿cambió TOKEN_ENCRYPTION_KEY?)")
        return None


# ---------------------------------------------------------------------------
# Cuentas conectadas
# ---------------------------------------------------------------------------


@dataclass
class Account:
    user_id: str
    email: str
    refresh_token_enc: str
    access_token_enc: str | None = None
    access_token_expires_at: datetime | None = None
    last_sync_at: datetime | None = None
    last_error: str | None = None
    id: str | None = None


def _parse_dt(value) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _account(row: dict) -> Account:
    return Account(
        id=str(row.get("id")) if row.get("id") else None,
        user_id=str(row["user_id"]),
        email=row["email"],
        refresh_token_enc=row["refresh_token_enc"],
        access_token_enc=row.get("access_token_enc"),
        access_token_expires_at=_parse_dt(row.get("access_token_expires_at")),
        last_sync_at=_parse_dt(row.get("last_sync_at")),
        last_error=row.get("last_error"),
    )


def get_account(user_id: UUID | str | None) -> Account | None:
    if not user_id:
        return None
    try:
        res = get_supabase_client().table("crm_gmail_accounts").select("*").eq("user_id", str(user_id)).execute()
        if res.data:
            return _account(res.data[0])
    except Exception as e:
        logger.debug(f"Sin crm_gmail_accounts en Supabase: {e}")
    row = _mock_accounts.get(str(user_id))
    return _account(row) if row else None


def list_accounts() -> list[Account]:
    rows: list[dict] = []
    try:
        rows = list(get_supabase_client().table("crm_gmail_accounts").select("*").execute().data or [])
    except Exception as e:
        logger.debug(f"Sin crm_gmail_accounts en Supabase: {e}")
    seen = {str(r["user_id"]) for r in rows}
    rows += [r for uid, r in _mock_accounts.items() if uid not in seen]
    return [_account(r) for r in rows]


def _save(user_id: str, fields: dict) -> None:
    now = datetime.now(timezone.utc).isoformat()
    fields = {**fields, "updated_at": now}
    client = None
    try:
        client = get_supabase_client()
        existing = client.table("crm_gmail_accounts").select("id").eq("user_id", user_id).execute()
        if existing.data:
            client.table("crm_gmail_accounts").update(fields).eq("user_id", user_id).execute()
        else:
            client.table("crm_gmail_accounts").insert({"id": str(uuid4()), "user_id": user_id, **fields}).execute()
        _mock_accounts.pop(user_id, None)
        return
    except Exception as e:
        logger.warning(f"No se pudo guardar la cuenta de Gmail en Supabase (queda en memoria): {e}")
    row = _mock_accounts.setdefault(user_id, {"id": str(uuid4()), "user_id": user_id, "created_at": now})
    row.update(fields)


def _update(account: Account, **fields) -> None:
    for key, value in fields.items():
        setattr(account, key, value)
    _save(account.user_id, {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in fields.items()})


def _delete(user_id: str) -> None:
    try:
        get_supabase_client().table("crm_gmail_accounts").delete().eq("user_id", user_id).execute()
    except Exception as e:
        logger.debug(f"No se pudo borrar la cuenta de Gmail en Supabase: {e}")
    _mock_accounts.pop(user_id, None)


# ---------------------------------------------------------------------------
# OAuth
# ---------------------------------------------------------------------------


def _sign(payload_b64: str) -> str:
    from backend.controllers.auth_controller import _sign as sign

    return sign(payload_b64)


def make_state(user_id: str) -> str:
    payload = {"u": user_id, "exp": int(time.time()) + STATE_TTL_SECONDS, "n": secrets.token_urlsafe(8)}
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    return f"{encoded}.{_sign(encoded)}"


def read_state(state: str) -> str:
    """Devuelve el usuario que pidió conectar la cuenta; corta si el «state» fue alterado o venció."""
    import hmac

    encoded, _, signature = (state or "").partition(".")
    if not encoded or not signature or not hmac.compare_digest(signature, _sign(encoded)):
        raise GmailError("El enlace de conexión no es válido. Volvé a intentarlo desde el CRM.", 400)
    try:
        data = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)).decode())
    except ValueError:
        raise GmailError("El enlace de conexión no es válido. Volvé a intentarlo desde el CRM.", 400)
    if int(data.get("exp") or 0) < time.time():
        raise GmailError("Pasó demasiado tiempo. Volvé a conectar la cuenta desde el CRM.", 400)
    return str(data["u"])


def authorization_url(user_id: str, login_hint: str | None = None) -> str:
    if not is_configured():
        raise GmailError("La conexión con Gmail no está configurada en este CRM.", 409)
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        # Sin «consent» Google no vuelve a mandar el refresh token si la cuenta ya se había conectado.
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": make_state(user_id),
    }
    if login_hint:
        params["login_hint"] = login_hint
    return f"{AUTH_URL}?{urlencode(params)}"


def _token_request(data: dict) -> dict:
    try:
        res = httpx.post(TOKEN_URL, data=data, timeout=20)
    except httpx.HTTPError as e:
        logger.warning(f"Google no respondió al pedir el token: {e}")
        raise GmailError("Google no respondió. Probá de nuevo.")
    try:
        body = res.json()
    except ValueError:
        body = {}
    if res.status_code >= 400:
        if body.get("error") == "invalid_grant":
            raise GmailError("La conexión con Gmail venció o fue revocada. Volvé a conectar tu cuenta.", 401)
        logger.warning(f"Error de token de Google {res.status_code}: {body}")
        raise GmailError("Google rechazó la conexión. Revisá la configuración de OAuth.", 502)
    return body


def _api(method: str, path: str, token: str, **kwargs) -> dict:
    try:
        res = httpx.request(method, f"{API}{path}", headers={"Authorization": f"Bearer {token}"}, timeout=30, **kwargs)
    except httpx.HTTPError as e:
        logger.warning(f"Gmail no respondió: {e}")
        raise GmailError("Gmail no respondió. Probá de nuevo en un momento.")
    try:
        body = res.json()
    except ValueError:
        body = {}
    if res.status_code >= 400:
        msg = ((body.get("error") or {}).get("message") if isinstance(body, dict) else None) or res.text[:200]
        logger.warning(f"Error de Gmail {res.status_code} en {path}: {msg}")
        if res.status_code == 401:
            raise GmailError("La conexión con Gmail venció. Volvé a conectar tu cuenta.", 401)
        if res.status_code == 403:
            raise GmailError(
                "Gmail no dio permiso para esta acción. Volvé a conectar tu cuenta aceptando los permisos.", 403
            )
        if res.status_code == 429:
            raise GmailError("Gmail limitó los envíos por un rato. Probá en unos minutos.", 429)
        raise GmailError(f"Gmail rechazó la operación: {msg}")
    return body


def connect(user_id: str, code: str) -> Account:
    tokens = _token_request(
        {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        }
    )
    refresh = tokens.get("refresh_token")
    access = tokens.get("access_token")
    if not refresh or not access:
        raise GmailError("Google no devolvió el permiso para seguir conectado. Volvé a intentarlo.", 400)
    granted = set((tokens.get("scope") or "").split())
    if not set(SCOPES) <= granted:
        raise GmailError("Hace falta aceptar los permisos de enviar y leer correos para conectar la cuenta.", 400)
    profile = _api("GET", "/profile", access)
    email = profile.get("emailAddress")
    if not email:
        raise GmailError("No pudimos leer la dirección de la cuenta de Gmail.", 502)
    expires = datetime.now(timezone.utc) + timedelta(seconds=int(tokens.get("expires_in") or 3600))
    _save(
        user_id,
        {
            "email": email,
            "refresh_token_enc": encrypt(refresh),
            "access_token_enc": encrypt(access),
            "access_token_expires_at": expires.isoformat(),
            "scopes": " ".join(sorted(granted)),
            "last_error": None,
        },
    )
    account = get_account(user_id)
    assert account is not None
    return account


def disconnect(user_id: str) -> None:
    account = get_account(user_id)
    if not account:
        return
    token = decrypt(account.refresh_token_enc)
    if token:
        try:
            httpx.post(REVOKE_URL, data={"token": token}, timeout=10)
        except httpx.HTTPError as e:
            logger.info(f"No se pudo revocar el token de Gmail (se borra igual): {e}")
    _delete(user_id)


def access_token(account: Account) -> str:
    current = decrypt(account.access_token_enc)
    expires = account.access_token_expires_at
    if current and expires and expires - timedelta(seconds=60) > datetime.now(timezone.utc):
        return current
    refresh = decrypt(account.refresh_token_enc)
    if not refresh:
        raise GmailError("La conexión con Gmail venció. Volvé a conectar tu cuenta.", 401)
    try:
        tokens = _token_request(
            {
                "refresh_token": refresh,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "grant_type": "refresh_token",
            }
        )
    except GmailError as err:
        _update(account, last_error=err.message)
        raise
    access = tokens["access_token"]
    _update(
        account,
        access_token_enc=encrypt(access),
        access_token_expires_at=datetime.now(timezone.utc) + timedelta(seconds=int(tokens.get("expires_in") or 3600)),
        last_error=None,
    )
    return access


# ---------------------------------------------------------------------------
# Envío
# ---------------------------------------------------------------------------


@dataclass
class SentMail:
    message_id: str
    thread_id: str
    rfc_message_id: str
    sender: str
    warnings: list[str]


def send(
    account: Account,
    *,
    to: list[str],
    cc: list[str],
    subject: str,
    html: str,
    text: str,
    attachments: list[ActivityAttachment],
    thread_id: str | None = None,
    in_reply_to: str | None = None,
    sender_name: str | None = None,
) -> SentMail:
    token = access_token(account)
    sender = f"{sender_name} <{account.email}>" if sender_name else account.email
    msg, rfc_id, warnings = email_service.build_mime(
        sender=sender,
        to=to,
        cc=cc,
        subject=subject,
        html=html,
        text=text,
        attachments=attachments,
        in_reply_to=in_reply_to,
    )
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    payload: dict = {"raw": raw}
    if thread_id:
        payload["threadId"] = thread_id
    sent = _api("POST", "/messages/send", token, json=payload)
    # Gmail puede reescribir el Message-ID: se lee el que quedó para responder en hilo después.
    try:
        meta = _api(
            "GET", f"/messages/{sent['id']}", token, params={"format": "metadata", "metadataHeaders": "Message-ID"}
        )
        rfc_id = _header(meta.get("payload") or {}, "Message-ID") or rfc_id
    except GmailError:
        pass
    return SentMail(sent["id"], sent.get("threadId") or sent["id"], rfc_id, account.email, warnings)


# ---------------------------------------------------------------------------
# Lectura de respuestas
# ---------------------------------------------------------------------------


def _header(payload: dict, name: str) -> str | None:
    for h in payload.get("headers") or []:
        if str(h.get("name", "")).lower() == name.lower():
            return h.get("value")
    return None


def _b64(data: str | None) -> str:
    if not data:
        return ""
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)).decode("utf-8", errors="replace")


def _find_part(payload: dict, mime: str) -> str | None:
    if payload.get("mimeType") == mime and (payload.get("body") or {}).get("data"):
        return _b64(payload["body"]["data"])
    for part in payload.get("parts") or []:
        found = _find_part(part, mime)
        if found:
            return found
    return None


_QUOTE_MARKERS = [
    re.compile(r"^\s*El .{3,160} escribió:\s*$", re.IGNORECASE),
    re.compile(r"^\s*On .{3,160} wrote:\s*$", re.IGNORECASE),
    re.compile(r"^-{2,}\s*(Mensaje original|Original Message)\s*-{2,}", re.IGNORECASE),
    re.compile(r"^\s*De:\s.+", re.IGNORECASE),
    re.compile(r"^\s*From:\s.+", re.IGNORECASE),
]


def strip_quoted(text: str) -> str:
    """Se queda con lo nuevo que escribió el cliente (sin el correo citado debajo)."""
    out: list[str] = []
    for line in text.replace("\r\n", "\n").split("\n"):
        if any(m.match(line) for m in _QUOTE_MARKERS):
            break
        if line.lstrip().startswith(">"):
            continue
        out.append(line)
    cleaned = "\n".join(out).strip()
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned or text.strip()


def message_text(payload: dict) -> str:
    plain = _find_part(payload, "text/plain")
    if plain:
        return strip_quoted(plain)
    rich = _find_part(payload, "text/html")
    return strip_quoted(email_service.html_to_text(rich)) if rich else ""


def _crm_threads(user_id: str) -> dict[str, MessageResponse]:
    """Hilos iniciados desde el CRM por este vendedor (último correo enviado de cada uno)."""
    from backend.services.message_service import MessageService

    since = datetime.now(timezone.utc) - timedelta(days=SYNC_DAYS)
    threads: dict[str, MessageResponse] = {}
    for m in MessageService.list_messages(
        user_id=UUID(user_id),
        channel=MessageChannel.EMAIL,
        provider=PROVIDER,
        direction=MessageDirection.SALIENTE,
        limit=300,
    ):
        if m.thread_id and m.created_at >= since and m.thread_id not in threads:
            threads[m.thread_id] = m
        if len(threads) >= SYNC_MAX_THREADS:
            break
    return threads


def sync_account(account: Account, force: bool = False) -> int:
    """Trae las respuestas nuevas de los hilos del CRM. Devuelve cuántas entraron."""
    from backend.services.activity_service import ActivityService
    from backend.services.message_service import MessageService
    from backend.services.opportunity_service import OpportunityService

    now = datetime.now(timezone.utc)
    if not force and account.last_sync_at and now - account.last_sync_at < SYNC_MIN_INTERVAL:
        return 0
    threads = _crm_threads(account.user_id)
    if not threads:
        _update(account, last_sync_at=now)
        return 0
    token = access_token(account)
    own = account.email.lower()
    stored = 0
    for thread_id, origin in threads.items():
        try:
            thread = _api("GET", f"/threads/{thread_id}", token, params={"format": "full"})
        except GmailError as err:
            if err.http_status in (401, 403):
                _update(account, last_error=err.message)
                raise
            logger.warning(f"No se pudo leer el hilo {thread_id}: {err.message}")
            continue
        for gm in thread.get("messages") or []:
            labels = set(gm.get("labelIds") or [])
            payload = gm.get("payload") or {}
            sender = _header(payload, "From") or ""
            sender_email = parseaddr(sender)[1].lower()
            if "SENT" in labels or "DRAFT" in labels or sender_email == own:
                continue  # lo mandó el vendedor (desde el CRM o desde Gmail): no es una respuesta del cliente
            if MessageService.find_by_provider_id(gm["id"]):
                continue
            body = message_text(payload)
            subject = _header(payload, "Subject") or origin.subject or "(sin asunto)"
            received = datetime.fromtimestamp(int(gm.get("internalDate") or time.time() * 1000) / 1000, tz=timezone.utc)
            to_list = [a for _, a in getaddresses([_header(payload, "To") or ""]) if a]
            MessageService.create(
                channel=MessageChannel.EMAIL,
                direction=MessageDirection.ENTRANTE,
                status=MessageStatus.RECIBIDO,
                opportunity_id=origin.opportunity_id,
                contact_id=origin.contact_id,
                company_id=origin.company_id,
                to_addresses=to_list,
                subject=subject,
                body_text=body,
                provider=PROVIDER,
                provider_message_id=gm["id"],
                thread_id=thread_id,
                from_address=sender[:255],
                rfc_message_id=_header(payload, "Message-ID"),
                created_at=received,
                # Casilla en la que entró: sólo esa cuenta puede responder dentro del hilo.
                user_id=UUID(account.user_id),
            )
            responsible = UUID(account.user_id)
            if origin.opportunity_id:
                try:
                    responsible = OpportunityService.get_opportunity_by_id(origin.opportunity_id).assigned_to
                except Exception:
                    pass
            ActivityService.create_activity(
                ActivityCreate(
                    opportunity_id=origin.opportunity_id,
                    contact_id=origin.contact_id,
                    company_id=origin.company_id,
                    activity_type=ActivityType.EMAIL,
                    summary=f"Correo recibido: {subject}"[:255],
                    description="\n".join([f"De: {sender}", "", body[:2000]]).strip(),
                    activity_date=received.replace(tzinfo=None),
                ),
                user_id=responsible,
            )
            stored += 1
    _update(account, last_sync_at=now, last_error=None)
    return stored
