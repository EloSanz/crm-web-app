import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from backend.database import get_supabase_client
from backend.models.activity import ActivityCreate, ActivityResponse
from backend.services.user_service import UserService

logger = logging.getLogger("crm.services.activity")

_mock_activities: dict[str, dict] = {}


def _aware(dt: datetime) -> datetime:
    """Fechas sin zona se toman como UTC: todas se guardan y comparan con zona."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


_LEGACY_MARK = "Adjuntos:"
_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "pdf": "application/pdf"}


def _with_attachments(item: dict) -> dict:
    """Normaliza adjuntos. Las bases sin la columna guardaban «Adjuntos:\nnombre: url» en el detalle: se recuperan."""
    item["attachments"] = item.get("attachments") or []
    description = item.get("description") or ""
    if item["attachments"] or _LEGACY_MARK not in description:
        return item
    head, _, block = description.rpartition(_LEGACY_MARK)
    found = []
    for line in block.strip().splitlines():
        cut = line.rfind(": http")
        if cut <= 0:
            continue
        name, url = line[:cut].strip(), line[cut + 2 :].strip()
        ext = url.rsplit(".", 1)[-1].lower() if "." in url.rsplit("/", 1)[-1] else ""
        found.append({"url": url, "name": name, "content_type": _TYPES.get(ext), "size_bytes": None})
    if found:
        item["attachments"] = found
        item["description"] = head.strip() or None
    return item


class ActivityService:
    """Servicio para registrar y consultar actividades comerciales (Invariante 1: hechos históricos)."""

    @classmethod
    def get_activities_by_opportunity(cls, opportunity_id: UUID) -> list[ActivityResponse]:
        """Retorna las actividades de una oportunidad ordenadas cronológicamente inverso."""
        try:
            client = get_supabase_client()
            res = (
                client.table("crm_activities")
                .select("*, crm_users(full_name)")
                .eq("opportunity_id", str(opportunity_id))
                .order("activity_date", desc=True)
                .execute()
            )
            if res.data:
                results = []
                for item in res.data:
                    user_info = item.pop("crm_users", None) or {}
                    item["user_name"] = user_info.get("full_name")
                    results.append(ActivityResponse(**_with_attachments(item)))
                return results
        except Exception as e:
            logger.warning(f"Error consultando crm_activities en Supabase: {e}")

        # Fallback local
        opp_str = str(opportunity_id)
        local_acts = [
            ActivityResponse(**act) for act in _mock_activities.values() if str(act.get("opportunity_id")) == opp_str
        ]
        local_acts.sort(key=lambda a: (_aware(a.activity_date), _aware(a.created_at)), reverse=True)
        return local_acts

    @classmethod
    def list_all(cls, since: datetime | None = None) -> list[ActivityResponse]:
        """Todas las actividades (para indicadores), del más nuevo al más viejo."""
        try:
            client = get_supabase_client()
            query = client.table("crm_activities").select("*").order("activity_date", desc=True)
            if since:
                query = query.gte("activity_date", since.isoformat())
            res = query.execute()
            if res.data:
                users = UserService.name_map()
                out = []
                for item in res.data:
                    item["user_name"] = users.get(str(item.get("user_id")))
                    out.append(ActivityResponse(**_with_attachments(item)))
                return out
        except Exception as e:
            logger.warning(f"Error consultando crm_activities en Supabase: {e}")
        acts = [ActivityResponse(**a) for a in _mock_activities.values()]
        if since:
            acts = [a for a in acts if _aware(a.activity_date) >= _aware(since)]
        acts.sort(key=lambda a: (_aware(a.activity_date), _aware(a.created_at)), reverse=True)
        return acts

    @classmethod
    def create_activity(cls, data: ActivityCreate, user_id: UUID | None = None) -> ActivityResponse:
        """Registra un hecho comercial inmutable."""
        actual_user_id = user_id or UUID("00000000-0000-0000-0000-000000000001")
        activity_id = uuid4()
        now = datetime.now(timezone.utc)

        activity_dict = {
            "id": str(activity_id),
            "opportunity_id": str(data.opportunity_id) if data.opportunity_id else None,
            "contact_id": str(data.contact_id) if data.contact_id else None,
            "company_id": str(data.company_id) if data.company_id else None,
            "user_id": str(actual_user_id),
            "activity_type": data.activity_type.value,
            "summary": data.summary.strip(),
            "description": data.description.strip() if data.description else None,
            "activity_date": _aware(data.activity_date).isoformat(),
            "attachments": [a.model_dump() for a in data.attachments],
            "created_at": now.isoformat(),
        }
        user_name = UserService.name_map().get(str(actual_user_id), "Usuario")

        try:
            client = get_supabase_client()
            try:
                res = client.table("crm_activities").insert(activity_dict).execute()
            except Exception as col_err:
                # Base sin la migración 04 (columna attachments): se guardan los enlaces en el detalle.
                if "attachments" not in str(col_err):
                    raise
                fallback = {k: v for k, v in activity_dict.items() if k != "attachments"}
                if data.attachments:
                    links = "\n".join(f"{a.name}: {a.url}" for a in data.attachments)
                    fallback["description"] = f"{fallback.get('description') or ''}\n\nAdjuntos:\n{links}".strip()
                res = client.table("crm_activities").insert(fallback).execute()
            if res.data and len(res.data) > 0:
                inserted = _with_attachments(res.data[0])
                inserted["user_name"] = user_name
                inserted["attachments"] = inserted.get("attachments") or activity_dict["attachments"]
                return ActivityResponse(**inserted)
        except Exception as e:
            logger.warning(f"Error insertando en crm_activities: {e}")

        # Guardar en mock
        activity_dict["user_name"] = user_name
        _mock_activities[str(activity_id)] = activity_dict
        return ActivityResponse(**activity_dict)
