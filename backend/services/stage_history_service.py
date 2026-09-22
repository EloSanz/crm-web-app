import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from backend.database import get_supabase_client

logger = logging.getLogger("crm.services.stage_history")

# Historial inmutable de cambios de etapa en modo local (sin Supabase).
_mock_stage_history: dict[str, dict] = {}


class StageHistoryService:
    """Hitos del presupuesto: cada paso de una etapa a otra, con fecha, hora y quién lo movió (Invariante 1)."""

    @classmethod
    def record(
        cls,
        opportunity_id: UUID | str,
        from_stage_id: UUID | str | None,
        to_stage_id: UUID | str,
        changed_by: UUID | str,
        notes: str | None = None,
        at: datetime | None = None,
    ) -> dict:
        entry = {
            "id": str(uuid4()),
            "opportunity_id": str(opportunity_id),
            "from_stage_id": str(from_stage_id) if from_stage_id else None,
            "to_stage_id": str(to_stage_id),
            "changed_by": str(changed_by),
            "notes": notes,
            "created_at": (at or datetime.now(timezone.utc)).isoformat(),
        }
        try:
            client = get_supabase_client()
            res = client.table("crm_stage_history").insert(entry).execute()
            if res.data:
                entry = res.data[0]
        except Exception as e:
            logger.warning(f"Error registrando historial de etapa en Supabase: {e}")
        _mock_stage_history[str(entry["id"])] = entry
        return entry

    @classmethod
    def _enrich(cls, rows: list[dict]) -> list[dict]:
        from backend.controllers.opportunity_controller import list_stages
        from backend.services.user_service import UserService

        stage_names = {str(s["id"]): s["name"] for s in list_stages()}
        users = UserService.name_map()
        out = []
        for r in rows:
            item = dict(r)
            item["from_stage_name"] = (
                stage_names.get(str(item.get("from_stage_id"))) if item.get("from_stage_id") else None
            )
            item["to_stage_name"] = stage_names.get(str(item.get("to_stage_id")))
            item["changed_by_name"] = users.get(str(item.get("changed_by")))
            out.append(item)
        return out

    @classmethod
    def list_by_opportunity(cls, opportunity_id: UUID | str) -> list[dict]:
        """Hitos de un presupuesto, del más nuevo al más viejo."""
        opp = str(opportunity_id)
        rows: list[dict] | None = None
        try:
            client = get_supabase_client()
            res = (
                client.table("crm_stage_history")
                .select("*")
                .eq("opportunity_id", opp)
                .order("created_at", desc=True)
                .execute()
            )
            if res.data:
                rows = res.data
        except Exception as e:
            logger.warning(f"Error consultando crm_stage_history en Supabase: {e}")
        if rows is None:
            rows = [r for r in _mock_stage_history.values() if str(r["opportunity_id"]) == opp]
            rows.sort(key=lambda r: r["created_at"], reverse=True)
        return cls._enrich(rows)

    @classmethod
    def list_all(cls, since: datetime | None = None) -> list[dict]:
        """Todo el historial (para indicadores de tiempo por etapa), del más viejo al más nuevo."""
        rows: list[dict] | None = None
        try:
            client = get_supabase_client()
            query = client.table("crm_stage_history").select("*").order("created_at")
            if since:
                query = query.gte("created_at", since.isoformat())
            res = query.execute()
            if res.data:
                rows = res.data
        except Exception as e:
            logger.warning(f"Error consultando crm_stage_history en Supabase: {e}")
        if rows is None:
            rows = sorted(_mock_stage_history.values(), key=lambda r: r["created_at"])
            if since:
                rows = [r for r in rows if r["created_at"] >= since.isoformat()]
        return cls._enrich(rows)
