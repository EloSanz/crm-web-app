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
_RESULT_MARK = "Resultado:"
_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "pdf": "application/pdf"}


def _recover_result(item: dict) -> None:
    """Base sin la columna result (migración 12): el resultado quedó al final del detalle como «Resultado: …»."""
    if "result" in item:
        return
    item["result"] = None
    # Se antepone el separador por si el detalle era sólo el resultado.
    description = "\n\n" + (item.get("description") or "")
    mark = f"\n\n{_RESULT_MARK} "
    if mark not in description:
        return
    head, _, tail = description.rpartition(mark)
    result, _, attachments = tail.partition(f"\n\n{_LEGACY_MARK}")
    item["result"] = result.strip() or None
    rest = f"\n\n{_LEGACY_MARK}{attachments}" if attachments else ""
    item["description"] = (head.strip() + rest).strip() or None


def _with_attachments(item: dict) -> dict:
    """Normaliza adjuntos. Las bases sin la columna guardaban «Adjuntos:\nnombre: url» en el detalle: se recuperan."""
    _recover_result(item)
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


_NEW_COLUMNS = ("result", "attachments")


def _without(activity: dict, data: ActivityCreate, missing: set[str]) -> dict:
    """Respaldo para bases viejas: lo que no tiene columna (resultado, enlaces de adjuntos) va al detalle."""
    fallback = {k: v for k, v in activity.items() if k not in missing}
    description = fallback.get("description") or ""
    if "result" in missing and activity.get("result"):
        description = f"{description}\n\n{_RESULT_MARK} {activity['result']}".strip()
    if "attachments" in missing and data.attachments:
        links = "\n".join(f"{a.name}: {a.url}" for a in data.attachments)
        description = f"{description}\n\n{_LEGACY_MARK}\n{links}".strip()
    fallback["description"] = description or None
    return fallback


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
    def _list_by(cls, column: str, value: UUID) -> list[ActivityResponse]:
        """Actividades con `column` = value (con o sin presupuesto), del más nuevo al más viejo."""
        try:
            client = get_supabase_client()
            res = (
                client.table("crm_activities")
                .select("*")
                .eq(column, str(value))
                .order("activity_date", desc=True)
                .limit(500)
                .execute()
            )
            if res.data:
                users = UserService.name_map()
                out = []
                for item in res.data:
                    item["user_name"] = users.get(str(item.get("user_id")))
                    out.append(ActivityResponse(**_with_attachments(item)))
                return out
        except Exception as e:
            logger.warning(f"Error consultando crm_activities por {column} en Supabase: {e}")
        acts = [ActivityResponse(**a) for a in _mock_activities.values() if str(a.get(column)) == str(value)]
        acts.sort(key=lambda a: (_aware(a.activity_date), _aware(a.created_at)), reverse=True)
        return acts

    @classmethod
    def list_by_company(cls, company_id: UUID) -> list[ActivityResponse]:
        """Actividades registradas con la empresa (con o sin presupuesto), del más nuevo al más viejo."""
        return cls._list_by("company_id", company_id)

    @classmethod
    def list_by_contact(cls, contact_id: UUID) -> list[ActivityResponse]:
        """Actividades registradas con el contacto (con o sin presupuesto), del más nuevo al más viejo."""
        return cls._list_by("contact_id", contact_id)

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
            "activity_type": data.activity_type,
            "summary": data.summary.strip(),
            "description": (data.description or "").strip() or None,
            "result": (data.result or "").strip() or None,
            "activity_date": _aware(data.activity_date).isoformat(),
            "attachments": [a.model_dump() for a in data.attachments],
            "created_at": now.isoformat(),
        }
        user_name = UserService.name_map().get(str(actual_user_id), "Usuario")

        try:
            client = get_supabase_client()
            # Bases sin la migración 04 (attachments) o 12 (result): se reintenta sin esas columnas.
            missing: set[str] = set()
            while True:
                try:
                    payload = _without(activity_dict, data, missing) if missing else activity_dict
                    res = client.table("crm_activities").insert(payload).execute()
                    break
                except Exception as col_err:
                    new = {c for c in _NEW_COLUMNS if c in str(col_err)} - missing
                    if not new:
                        raise
                    missing |= new
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
