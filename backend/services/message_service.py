import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from backend.database import get_supabase_client
from backend.models.activity import ActivityAttachment
from backend.models.message import MessageChannel, MessageDirection, MessageResponse, MessageStatus
from backend.services.user_service import UserService

logger = logging.getLogger("crm.services.message")

# Respaldo en memoria: desarrollo local, tests y bases sin la migración 07 (tabla crm_messages).
_mock_messages: dict[str, dict] = {}

# Un estado de entrega nunca retrocede (un "entregado" tardío no pisa un "leído").
_STATUS_RANK = {
    MessageStatus.SIMULADO.value: 0,
    MessageStatus.ENVIADO.value: 1,
    MessageStatus.ENTREGADO.value: 2,
    MessageStatus.LEIDO.value: 3,
}


def _str(value) -> str | None:
    return str(value) if value else None


class MessageService:
    """Bitácora de mensajes con clientes (correos enviados y conversación de WhatsApp)."""

    @staticmethod
    def _to_response(row: dict, users: dict[str, str] | None = None) -> MessageResponse:
        item = dict(row)
        item["to_addresses"] = item.get("to_addresses") or []
        item["cc"] = item.get("cc") or []
        item["attachments"] = item.get("attachments") or []
        item.pop("warnings", None)
        uid = item.get("user_id")
        if users is not None:
            item["user_name"] = users.get(str(uid)) if uid else None
        return MessageResponse(**item)

    @classmethod
    def create(
        cls,
        *,
        channel: MessageChannel,
        direction: MessageDirection,
        status: MessageStatus,
        opportunity_id: UUID | None = None,
        contact_id: UUID | None = None,
        company_id: UUID | None = None,
        user_id: UUID | None = None,
        to_addresses: list[str] | None = None,
        cc: list[str] | None = None,
        subject: str | None = None,
        body_html: str | None = None,
        body_text: str | None = None,
        attachments: list[ActivityAttachment] | None = None,
        phone: str | None = None,
        provider: str | None = None,
        provider_message_id: str | None = None,
        error: str | None = None,
        created_at: datetime | None = None,
    ) -> MessageResponse:
        record = {
            "id": str(uuid4()),
            "channel": channel.value,
            "direction": direction.value,
            "status": status.value,
            "opportunity_id": _str(opportunity_id),
            "contact_id": _str(contact_id),
            "company_id": _str(company_id),
            "user_id": _str(user_id),
            "to_addresses": list(to_addresses or []),
            "cc": list(cc or []),
            "subject": subject[:255] if subject else None,
            "body_html": body_html,
            "body_text": body_text,
            "attachments": [a.model_dump() for a in (attachments or [])],
            "phone": phone,
            "provider": provider,
            "provider_message_id": provider_message_id,
            "error": error,
            "created_at": (created_at or datetime.now(timezone.utc)).isoformat(),
        }
        users = UserService.name_map()

        try:
            client = get_supabase_client()
            res = client.table("crm_messages").insert(record).execute()
            if res.data:
                return cls._to_response(res.data[0], users)
        except Exception as e:
            logger.warning(f"Error insertando en crm_messages (se guarda en memoria): {e}")

        _mock_messages[record["id"]] = record
        return cls._to_response(record, users)

    @staticmethod
    def _matches(
        row: dict,
        opportunity_id: UUID | None,
        contact_id: UUID | None,
        channel: MessageChannel | None,
        phone: str | None,
        direction: MessageDirection | None,
        user_id: UUID | None,
    ) -> bool:
        if opportunity_id and str(row.get("opportunity_id")) != str(opportunity_id):
            return False
        if contact_id and str(row.get("contact_id")) != str(contact_id):
            return False
        if channel and row.get("channel") != channel.value:
            return False
        if phone and row.get("phone") != phone:
            return False
        if direction and row.get("direction") != direction.value:
            return False
        if user_id and str(row.get("user_id")) != str(user_id):
            return False
        return True

    @classmethod
    def list_messages(
        cls,
        *,
        opportunity_id: UUID | None = None,
        contact_id: UUID | None = None,
        channel: MessageChannel | None = None,
        phone: str | None = None,
        direction: MessageDirection | None = None,
        user_id: UUID | None = None,
        limit: int = 200,
    ) -> list[MessageResponse]:
        """Mensajes filtrados, del más nuevo al más viejo."""
        users = UserService.name_map()
        rows: list[dict] = []
        try:
            client = get_supabase_client()
            query = client.table("crm_messages").select("*")
            if opportunity_id:
                query = query.eq("opportunity_id", str(opportunity_id))
            if contact_id:
                query = query.eq("contact_id", str(contact_id))
            if channel:
                query = query.eq("channel", channel.value)
            if phone:
                query = query.eq("phone", phone)
            if direction:
                query = query.eq("direction", direction.value)
            if user_id:
                query = query.eq("user_id", str(user_id))
            res = query.order("created_at", desc=True).limit(limit).execute()
            rows = list(res.data or [])
        except Exception as e:
            logger.warning(f"Error consultando crm_messages en Supabase: {e}")

        # Se suman los que sólo quedaron en memoria (base sin la migración o inserción fallida).
        seen = {str(r.get("id")) for r in rows}
        rows += [
            r
            for r in _mock_messages.values()
            if r["id"] not in seen and cls._matches(r, opportunity_id, contact_id, channel, phone, direction, user_id)
        ]
        out = [cls._to_response(r, users) for r in rows]
        out.sort(key=lambda m: m.created_at, reverse=True)
        return out[:limit]

    @classmethod
    def find_by_provider_id(cls, provider_message_id: str) -> MessageResponse | None:
        if not provider_message_id:
            return None
        try:
            client = get_supabase_client()
            res = client.table("crm_messages").select("*").eq("provider_message_id", provider_message_id).execute()
            if res.data:
                return cls._to_response(res.data[0])
        except Exception as e:
            logger.warning(f"Error buscando mensaje por provider_message_id: {e}")
        for row in _mock_messages.values():
            if row.get("provider_message_id") == provider_message_id:
                return cls._to_response(row)
        return None

    @classmethod
    def update_status(
        cls, provider_message_id: str, status: MessageStatus, error: str | None = None
    ) -> MessageResponse | None:
        """Actualiza el estado de entrega informado por el proveedor (sin retroceder)."""
        existing = cls.find_by_provider_id(provider_message_id)
        if not existing:
            return None
        if status != MessageStatus.FALLIDO:
            if existing.status == MessageStatus.FALLIDO:
                return existing
            if _STATUS_RANK.get(status.value, 0) <= _STATUS_RANK.get(existing.status.value, 0):
                return existing

        payload: dict = {"status": status.value}
        if error:
            payload["error"] = error
        try:
            client = get_supabase_client()
            client.table("crm_messages").update(payload).eq("provider_message_id", provider_message_id).execute()
        except Exception as e:
            logger.warning(f"Error actualizando estado en crm_messages: {e}")

        row = _mock_messages.get(str(existing.id))
        if row:
            row.update(payload)
        return existing.model_copy(update={"status": status, "error": error or existing.error})

    @classmethod
    def last_inbound_at(cls, phone: str) -> datetime | None:
        """Último mensaje del cliente: abre la ventana de 24 h de WhatsApp."""
        found = cls.list_messages(
            phone=phone, channel=MessageChannel.WHATSAPP, direction=MessageDirection.ENTRANTE, limit=1
        )
        return found[0].created_at if found else None
