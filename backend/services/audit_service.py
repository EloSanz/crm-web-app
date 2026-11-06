"""Auditoría general de cambios (regla 15 de negocio: identificar al usuario que hizo cada cambio).

La alimenta el middleware de backend/audit_middleware.py con cada POST/PUT/PATCH/DELETE exitoso.
Sigue el patrón del resto de los servicios: intenta Supabase (tabla crm_audit_log de la migración 13)
y, si la base no responde o la tabla todavía no existe, guarda en memoria.
"""

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from backend.database import get_supabase_client
from backend.models.audit import AuditEntry, AuditPage

logger = logging.getLogger("crm.services.audit")

TABLE = "crm_audit_log"

# Respaldo en memoria cuando Supabase no responde o la migración 13 no se aplicó.
_mock_audit: list[dict] = []


def _as_uuid(value: Any) -> str | None:
    """El user_id de la tabla es UUID: un sub de sesión que no lo sea se guarda como null (queda el nombre)."""
    if not value:
        return None
    try:
        return str(UUID(str(value)))
    except ValueError:
        return None


def _parse_dt(value: Any) -> datetime:
    if isinstance(value, datetime):
        dt = value
    else:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _matches(
    row: dict,
    entity: str | None,
    entity_id: str | None,
    user_id: str | None,
    desde: datetime | None,
    hasta: datetime | None,
) -> bool:
    if entity and row.get("entity") != entity:
        return False
    if entity_id and str(row.get("entity_id")) != entity_id:
        return False
    if user_id and str(row.get("user_id")) != user_id:
        return False
    if desde or hasta:
        at = _parse_dt(row["created_at"])
        if desde and at < _parse_dt(desde):
            return False
        if hasta and at > _parse_dt(hasta):
            return False
    return True


class AuditService:
    """Registro inmutable: sólo se agregan filas y se consultan; nunca se editan ni se borran."""

    @classmethod
    def record(
        cls,
        *,
        action: str,
        method: str,
        path: str,
        entity: str,
        entity_id: str | None = None,
        summary: str | None = None,
        changes: Any = None,
        status_code: int | None = None,
        user_id: str | None = None,
        user_name: str | None = None,
        user_role: str | None = None,
    ) -> AuditEntry | None:
        """Registra un cambio. Nunca corta el pedido auditado: ante cualquier error sólo lo loguea."""
        try:
            entry = {
                "id": str(uuid4()),
                "user_id": _as_uuid(user_id),
                "user_name": user_name or "Usuario",
                "user_role": user_role,
                "action": action,
                "method": method,
                "path": path,
                "entity": entity,
                "entity_id": str(entity_id) if entity_id else None,
                "summary": summary,
                "changes": changes if changes is not None else {},
                "status_code": status_code,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:  # pragma: no cover - defensa
            logger.error(f"No se pudo armar la fila de auditoría: {e}")
            return None

        try:
            res = get_supabase_client().table(TABLE).insert(entry).execute()
            if res.data:
                return AuditEntry(**res.data[0])
        except Exception as e:
            logger.warning(f"Error insertando en {TABLE}: {e}")

        _mock_audit.append(entry)
        try:
            return AuditEntry(**entry)
        except Exception as e:  # pragma: no cover - defensa
            logger.error(f"Fila de auditoría inválida: {e}")
            return None

    @classmethod
    def list(
        cls,
        entity: str | None = None,
        entity_id: str | None = None,
        user_id: UUID | str | None = None,
        desde: datetime | None = None,
        hasta: datetime | None = None,
        limit: int = 10,
        offset: int = 0,
    ) -> AuditPage:
        """Cambios del más nuevo al más viejo, con filtros opcionales y paginación (limit/offset/total)."""
        uid = str(user_id) if user_id else None
        local = sorted(
            (r for r in _mock_audit if _matches(r, entity, entity_id, uid, desde, hasta)),
            key=lambda r: _parse_dt(r["created_at"]),
            reverse=True,
        )

        try:
            query = get_supabase_client().table(TABLE).select("*", count="exact")
            if entity:
                query = query.eq("entity", entity)
            if entity_id:
                query = query.eq("entity_id", entity_id)
            if uid:
                query = query.eq("user_id", uid)
            if desde:
                query = query.gte("created_at", desde.isoformat())
            if hasta:
                query = query.lte("created_at", hasta.isoformat())
            # Si quedaron filas en memoria, se trae desde el principio para intercalarlas bien.
            start = 0 if local else offset
            res = query.order("created_at", desc=True).range(start, offset + limit - 1).execute()
            if res.data is not None:
                rows = res.data
                total = (res.count if res.count is not None else len(rows)) + len(local)
                if local:
                    rows = sorted([*rows, *local], key=lambda r: _parse_dt(r["created_at"]), reverse=True)
                    rows = rows[offset : offset + limit]
                return AuditPage(items=[cls._to_entry(r) for r in rows], total=total, limit=limit, offset=offset)
        except Exception as e:
            logger.warning(f"Error consultando {TABLE} en Supabase: {e}")

        page = local[offset : offset + limit]
        return AuditPage(items=[cls._to_entry(r) for r in page], total=len(local), limit=limit, offset=offset)

    @staticmethod
    def _to_entry(row: dict) -> AuditEntry:
        return AuditEntry(
            **{
                **row,
                "id": str(row["id"]),
                "user_id": str(row["user_id"]) if row.get("user_id") else None,
                "changes": row.get("changes") if row.get("changes") is not None else {},
            }
        )
