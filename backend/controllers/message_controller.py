import hmac
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse
from starlette.concurrency import run_in_threadpool

from backend.config import settings
from backend.controllers.permissions import MANAGER_ROLES, session_from_header, session_user_id
from backend.database import get_supabase_client
from backend.models.activity import ActivityCreate, ActivityResponse, ActivityType
from backend.models.contact import ContactResponse
from backend.models.message import (
    CallLogRequest,
    EmailSendRequest,
    MessageChannel,
    MessageDirection,
    MessageResponse,
    MessageStatus,
    WhatsAppConversation,
    WhatsAppLogRequest,
    WhatsAppSendRequest,
    WhatsAppStatusResponse,
)
from backend.models.opportunity import OpportunityResponse, OpportunityStatus
from backend.services import email_service, whatsapp_service
from backend.services.activity_service import ActivityService
from backend.services.company_service import CompanyService
from backend.services.contact_service import ContactService
from backend.services.message_service import MessageService
from backend.services.opportunity_service import OpportunityService

logger = logging.getLogger("crm.controllers.messages")

router = APIRouter(tags=["Contacto con clientes (correo, WhatsApp y llamadas)"])

# Varios mensajes seguidos de WhatsApp cuentan como una sola conversación en el seguimiento.
WHATSAPP_ACTIVITY_GAP = timedelta(minutes=30)


@dataclass
class _Context:
    opportunity: OpportunityResponse | None
    contact: ContactResponse | None
    company_id: UUID | None
    user_id: UUID | None
    session: dict

    @property
    def opportunity_id(self) -> UUID | None:
        return self.opportunity.id if self.opportunity else None

    @property
    def contact_id(self) -> UUID | None:
        return self.contact.id if self.contact else None


def _authorize_opportunity(session: dict, opp: OpportunityResponse) -> None:
    """El vendedor sólo contacta clientes de los presupuestos que tiene asignados."""
    if session.get("role") == "ejecutivo_ventas" and str(opp.assigned_to) != str(session.get("sub")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sólo podés contactar clientes de presupuestos asignados a vos",
        )


def _resolve(
    authorization: str | None,
    opportunity_id: UUID | None,
    contact_id: UUID | None,
    company_id: UUID | None,
) -> _Context:
    session = session_from_header(authorization)
    opp = None
    if opportunity_id:
        opp = OpportunityService.get_opportunity_by_id(opportunity_id)
        _authorize_opportunity(session, opp)

    contact = None
    if contact_id:
        contact = ContactService.get_contact_by_id(contact_id)
    elif opp and opp.contact_id:
        try:
            contact = ContactService.get_contact_by_id(opp.contact_id)
        except HTTPException:
            contact = None

    company = company_id or (opp.company_id if opp else None) or (contact.company_id if contact else None)
    return _Context(opp, contact, company, session_user_id(authorization), session)


def _contact_name(contact: ContactResponse | None) -> str | None:
    return f"{contact.first_name} {contact.last_name}".strip() if contact else None


def _display_name(ctx: _Context, phone: str | None) -> str:
    name = _contact_name(ctx.contact)
    if name:
        return name
    if ctx.company_id:
        try:
            return CompanyService.get_company_by_id(ctx.company_id).name
        except HTTPException:
            pass
    return f"+{phone}" if phone else "el cliente"


def _preview(text: str, limit: int = 90) -> str:
    flat = " ".join((text or "").split())
    return flat if len(flat) <= limit else flat[: limit - 1].rstrip() + "…"


def _summary(prefix: str, text: str) -> str:
    return f"{prefix}{_preview(text, 255 - len(prefix))}"


def _dedupe(values) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for v in values:
        key = str(v).strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(str(v).strip())
    return out


def _require_phone(raw: str | None) -> str:
    number = whatsapp_service.normalize_phone(raw)
    if not number:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No hay un celular válido cargado para este cliente",
        )
    return number


def _continues_conversation(new_msg: MessageResponse) -> bool:
    """True si el mensaje anterior en la misma dirección fue hace menos de 30 minutos."""
    recent = MessageService.list_messages(
        phone=new_msg.phone, channel=MessageChannel.WHATSAPP, direction=new_msg.direction, limit=3
    )
    for prev in recent:
        if prev.id == new_msg.id or prev.status == MessageStatus.FALLIDO:
            continue
        return abs(new_msg.created_at - prev.created_at) < WHATSAPP_ACTIVITY_GAP
    return False


# ---------------------------------------------------------------------------
# Correo
# ---------------------------------------------------------------------------


@router.post(
    "/api/email/send",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enviar un correo al cliente y registrarlo en el seguimiento",
)
def send_email(data: EmailSendRequest, authorization: str | None = Header(None)) -> MessageResponse:
    ctx = _resolve(authorization, data.opportunity_id, data.contact_id, data.company_id)
    to = _dedupe(data.to)
    cc = [c for c in _dedupe(data.cc) if c.lower() not in {t.lower() for t in to}]
    subject = " ".join(data.subject.split())
    body = email_service.sanitize_html(data.html)
    text = email_service.html_to_text(body)
    if not subject:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Escribí un asunto")
    if not text and not data.attachments:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Escribí el mensaje o adjuntá un archivo"
        )

    full_html = email_service.render_email_template(email_service.sanitize_html(body, email_styles=True), subject)
    common = {
        "channel": MessageChannel.EMAIL,
        "direction": MessageDirection.SALIENTE,
        "opportunity_id": ctx.opportunity_id,
        "contact_id": ctx.contact_id,
        "company_id": ctx.company_id,
        "user_id": ctx.user_id,
        "to_addresses": to,
        "cc": cc,
        "subject": subject,
        "body_html": body,
        "body_text": text,
        "attachments": data.attachments,
    }
    try:
        result = email_service.send_email(
            to=to, cc=cc, subject=subject, html=full_html, text=text, attachments=data.attachments
        )
    except email_service.EmailSendError as err:
        MessageService.create(**common, status=MessageStatus.FALLIDO, provider=err.provider, error=err.message)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=err.message)

    simulated = result.status == "simulado"
    message = MessageService.create(
        **common,
        status=MessageStatus.SIMULADO if simulated else MessageStatus.ENVIADO,
        provider=result.provider,
        provider_message_id=result.provider_message_id,
    )

    lines = [f"Para: {', '.join(to)}"]
    if cc:
        lines.append(f"CC: {', '.join(cc)}")
    if simulated:
        lines.append("Envío simulado: no hay un proveedor de correo configurado.")
    lines += result.warnings
    if text:
        lines += ["", text[:2000]]
    ActivityService.create_activity(
        ActivityCreate(
            opportunity_id=ctx.opportunity_id,
            contact_id=ctx.contact_id,
            company_id=ctx.company_id,
            activity_type=ActivityType.EMAIL,
            summary=_summary("Correo enviado: ", subject),
            description="\n".join(lines),
            attachments=data.attachments,
        ),
        user_id=ctx.user_id,
    )
    return message.model_copy(update={"warnings": result.warnings})


@router.get(
    "/api/messages",
    response_model=list[MessageResponse],
    summary="Mensajes con clientes (correo y WhatsApp), del más nuevo al más viejo",
)
def list_messages(
    opportunity_id: UUID | None = Query(None),
    contact_id: UUID | None = Query(None),
    channel: MessageChannel | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    authorization: str | None = Header(None),
) -> list[MessageResponse]:
    session = session_from_header(authorization)
    user_filter = None
    if opportunity_id:
        _authorize_opportunity(session, OpportunityService.get_opportunity_by_id(opportunity_id))
    elif not contact_id and session.get("role") not in MANAGER_ROLES:
        user_filter = session_user_id(authorization)
    return MessageService.list_messages(
        opportunity_id=opportunity_id, contact_id=contact_id, channel=channel, user_id=user_filter, limit=limit
    )


# ---------------------------------------------------------------------------
# WhatsApp
# ---------------------------------------------------------------------------


@router.get("/api/whatsapp/status", response_model=WhatsAppStatusResponse, summary="¿Está conectado WhatsApp?")
def whatsapp_status() -> WhatsAppStatusResponse:
    configured = whatsapp_service.is_configured()
    return WhatsAppStatusResponse(
        configured=configured,
        template_available=whatsapp_service.template_available(),
        provider="meta" if configured else None,
    )


@router.get(
    "/api/whatsapp/conversation",
    response_model=WhatsAppConversation,
    summary="Conversación de WhatsApp con un contacto o teléfono (del más viejo al más nuevo)",
)
def whatsapp_conversation(
    contact_id: UUID | None = Query(None),
    phone: str | None = Query(None, max_length=50),
    opportunity_id: UUID | None = Query(None),
    authorization: str | None = Header(None),
) -> WhatsAppConversation:
    if not contact_id and not phone:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Indicá un contacto o un teléfono")
    ctx = _resolve(authorization, opportunity_id, contact_id, None)
    number = _require_phone(phone or (ctx.contact.phone if ctx.contact else None))

    messages = MessageService.list_messages(phone=number, channel=MessageChannel.WHATSAPP, limit=200)
    messages.reverse()
    last_inbound = next((m.created_at for m in reversed(messages) if m.direction == MessageDirection.ENTRANTE), None)
    if last_inbound is None and len(messages) >= 200:
        last_inbound = MessageService.last_inbound_at(number)
    expires = last_inbound + timedelta(hours=whatsapp_service.WINDOW_HOURS) if last_inbound else None
    return WhatsAppConversation(
        configured=whatsapp_service.is_configured(),
        phone=number,
        contact_id=ctx.contact_id,
        contact_name=_contact_name(ctx.contact),
        window_open=bool(expires and expires > datetime.now(timezone.utc)),
        window_expires_at=expires,
        last_inbound_at=last_inbound,
        template_available=whatsapp_service.template_available(),
        messages=messages,
    )


@router.post(
    "/api/whatsapp/send",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enviar un WhatsApp al cliente desde el CRM",
)
def whatsapp_send(data: WhatsAppSendRequest, authorization: str | None = Header(None)) -> MessageResponse:
    if not whatsapp_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="WhatsApp todavía no está conectado. Abrí la conversación en WhatsApp.",
        )
    ctx = _resolve(authorization, data.opportunity_id, data.contact_id, data.company_id)
    number = _require_phone(data.phone or (ctx.contact.phone if ctx.contact else None))
    if data.template and not whatsapp_service.template_available():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No hay una plantilla de WhatsApp configurada"
        )
    text = f"Plantilla: {settings.WHATSAPP_TEMPLATE_NAME}" if data.template else data.text.strip()
    common = {
        "channel": MessageChannel.WHATSAPP,
        "direction": MessageDirection.SALIENTE,
        "opportunity_id": ctx.opportunity_id,
        "contact_id": ctx.contact_id,
        "company_id": ctx.company_id,
        "user_id": ctx.user_id,
        "to_addresses": [number],
        "body_text": text,
        "phone": number,
        "provider": "meta",
    }
    try:
        wamid = whatsapp_service.send_template(number) if data.template else whatsapp_service.send_text(number, text)
    except whatsapp_service.WhatsAppError as err:
        MessageService.create(**common, status=MessageStatus.FALLIDO, error=err.message)
        raise HTTPException(status_code=err.http_status, detail=err.message)

    message = MessageService.create(**common, status=MessageStatus.ENVIADO, provider_message_id=wamid)
    if not _continues_conversation(message):
        ActivityService.create_activity(
            ActivityCreate(
                opportunity_id=ctx.opportunity_id,
                contact_id=ctx.contact_id,
                company_id=ctx.company_id,
                activity_type=ActivityType.WHATSAPP,
                summary=_summary("WhatsApp: ", text),
                description=text if len(text) > 90 else None,
            ),
            user_id=ctx.user_id,
        )
    return message


@router.post(
    "/api/whatsapp/log",
    response_model=ActivityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar que se abrió WhatsApp (wa.me) con el cliente",
)
def whatsapp_log(data: WhatsAppLogRequest, authorization: str | None = Header(None)) -> ActivityResponse:
    ctx = _resolve(authorization, data.opportunity_id, data.contact_id, data.company_id)
    number = whatsapp_service.normalize_phone(data.phone or (ctx.contact.phone if ctx.contact else None))
    text = (data.text or "").strip()
    return ActivityService.create_activity(
        ActivityCreate(
            opportunity_id=ctx.opportunity_id,
            contact_id=ctx.contact_id,
            company_id=ctx.company_id,
            activity_type=ActivityType.WHATSAPP,
            summary=_summary("Se abrió WhatsApp con ", _display_name(ctx, number)),
            description=text or None,
        ),
        user_id=ctx.user_id,
    )


@router.post(
    "/api/calls/log",
    response_model=ActivityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar una llamada saliente al cliente",
)
def call_log(data: CallLogRequest, authorization: str | None = Header(None)) -> ActivityResponse:
    ctx = _resolve(authorization, data.opportunity_id, data.contact_id, data.company_id)
    raw_phone = (data.phone or (ctx.contact.phone if ctx.contact else None) or "").strip()
    number = whatsapp_service.normalize_phone(raw_phone)
    return ActivityService.create_activity(
        ActivityCreate(
            opportunity_id=ctx.opportunity_id,
            contact_id=ctx.contact_id,
            company_id=ctx.company_id,
            activity_type=ActivityType.LLAMADA,
            summary=_summary("Llamada saliente a ", _display_name(ctx, number)),
            description=f"Número: {raw_phone}" if raw_phone else None,
        ),
        user_id=ctx.user_id,
    )


# ---------------------------------------------------------------------------
# Webhook de Meta (público: lo llama WhatsApp, no el CRM)
# ---------------------------------------------------------------------------


@router.get("/api/whatsapp/webhook", response_class=PlainTextResponse, include_in_schema=False)
def whatsapp_webhook_verify(request: Request) -> PlainTextResponse:
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token") or ""
    expected = settings.WHATSAPP_VERIFY_TOKEN
    if mode == "subscribe" and expected and hmac.compare_digest(token.encode(), expected.encode()):
        return PlainTextResponse(params.get("hub.challenge", ""))
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token de verificación inválido")


@router.post("/api/whatsapp/webhook", include_in_schema=False)
async def whatsapp_webhook_receive(request: Request) -> dict:
    raw = await request.body()
    if not whatsapp_service.verify_signature(raw, request.headers.get("x-hub-signature-256")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Firma inválida")
    try:
        payload = json.loads(raw or b"{}")
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cuerpo inválido")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cuerpo inválido")
    return await run_in_threadpool(_process_webhook, payload)


def _process_webhook(payload: dict) -> dict:
    inbound, statuses = whatsapp_service.parse_webhook(payload)
    stored = 0
    for msg in inbound:
        try:
            if _store_inbound(msg):
                stored += 1
        except Exception:
            logger.exception("No se pudo registrar un WhatsApp entrante")
    for st in statuses:
        try:
            MessageService.update_status(st.message_id, st.status, st.error)
        except Exception:
            logger.exception("No se pudo actualizar el estado de un WhatsApp")
    # Meta reintenta si no recibe 200: siempre se confirma la recepción.
    return {"received": stored, "statuses": len(statuses)}


def _rows(table: str, columns: str) -> list[dict]:
    try:
        client = get_supabase_client()
        res = client.table(table).select(columns).eq("is_deleted", False).execute()
        return list(res.data or [])
    except Exception as e:
        logger.warning(f"Error consultando {table} para identificar un WhatsApp: {e}")
        return []


def _match_contact(phone: str) -> dict | None:
    """Contacto cuyo celular normalizado coincide con el número que escribió."""
    from backend.services.contact_service import _mock_contacts

    rows = _rows("crm_contacts", "id, phone, company_id, assigned_to, first_name, last_name")
    seen = {str(r.get("id")) for r in rows}
    rows += [r for r in _mock_contacts.values() if not r.get("is_deleted") and str(r.get("id")) not in seen]
    return next((r for r in rows if whatsapp_service.normalize_phone(r.get("phone")) == phone), None)


def _match_company(phone: str) -> dict | None:
    from backend.services.company_service import _mock_companies

    rows = _rows("crm_companies", "id, phone, assigned_to")
    seen = {str(r.get("id")) for r in rows}
    rows += [r for r in _mock_companies.values() if not r.get("is_deleted") and str(r.get("id")) not in seen]
    return next((r for r in rows if whatsapp_service.normalize_phone(r.get("phone")) == phone), None)


def _pick_opportunity(phone: str, contact: dict | None, company: dict | None) -> OpportunityResponse | None:
    """El presupuesto desde el que se le escribió por última vez; si no, el abierto más reciente del cliente."""
    since = datetime.now(timezone.utc) - timedelta(days=30)
    for m in MessageService.list_messages(phone=phone, channel=MessageChannel.WHATSAPP, limit=50):
        if m.created_at < since:
            break
        if m.opportunity_id:
            try:
                opp = OpportunityService.get_opportunity_by_id(m.opportunity_id)
            except HTTPException:
                continue
            if opp.status == OpportunityStatus.ABIERTA:
                return opp
    filters: dict = {}
    if contact:
        filters["contact_id"] = UUID(str(contact["id"]))
    elif company:
        filters["company_id"] = UUID(str(company["id"]))
    else:
        return None
    opps = OpportunityService.get_opportunities(status_filter=OpportunityStatus.ABIERTA, limit=20, **filters)
    return opps[0] if opps else None


def _store_inbound(msg: whatsapp_service.InboundMessage) -> bool:
    if MessageService.find_by_provider_id(msg.message_id):
        return False  # reintento de Meta: ya estaba registrado
    contact = _match_contact(msg.phone)
    company = None if contact else _match_company(msg.phone)
    opp = _pick_opportunity(msg.phone, contact, company)

    def _uuid(value) -> UUID | None:
        return UUID(str(value)) if value else None

    contact_id = _uuid(contact.get("id")) if contact else None
    company_id = _uuid(contact.get("company_id")) if contact else _uuid(company.get("id")) if company else None
    if opp:
        company_id = company_id or opp.company_id
        contact_id = contact_id or opp.contact_id

    stored = MessageService.create(
        channel=MessageChannel.WHATSAPP,
        direction=MessageDirection.ENTRANTE,
        status=MessageStatus.RECIBIDO,
        opportunity_id=opp.id if opp else None,
        contact_id=contact_id,
        company_id=company_id,
        body_text=msg.text,
        phone=msg.phone,
        provider="meta",
        provider_message_id=msg.message_id,
        created_at=msg.timestamp,
    )
    # Un número desconocido queda en la bandeja por teléfono, pero no ensucia el seguimiento.
    if not (contact_id or company_id) or _continues_conversation(stored):
        return True
    responsible = opp.assigned_to if opp else _uuid((contact or company or {}).get("assigned_to"))
    ActivityService.create_activity(
        ActivityCreate(
            opportunity_id=opp.id if opp else None,
            contact_id=contact_id,
            company_id=company_id,
            activity_type=ActivityType.WHATSAPP,
            summary=_summary("WhatsApp recibido: ", msg.text),
            description=msg.text if len(msg.text) > 90 else None,
            # UTC sin zona, como el resto de las actividades (evita mezclar fechas con y sin zona).
            activity_date=msg.timestamp.astimezone(timezone.utc).replace(tzinfo=None),
        ),
        user_id=responsible,
    )
    return True
