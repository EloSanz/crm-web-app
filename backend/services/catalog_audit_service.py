import logging
import re
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from backend.database import get_supabase_client
from backend.models.product import CatalogAuditAction, CatalogAuditEntry
from backend.services.user_service import UserService

logger = logging.getLogger("crm.services.catalog_audit")

TABLE = "crm_catalog_audit"

# Campos del material que quedan en el historial (updated_at y banderas internas no cuentan).
TRACKED_FIELDS = (
    "code",
    "name",
    "category",
    "unit",
    "unit_price",
    "wholesale_price",
    "wholesale_min_qty",
    "description",
    "is_active",
)
NUMERIC_FIELDS = {"unit_price", "wholesale_price", "wholesale_min_qty"}

# Respaldo en memoria cuando Supabase no responde o la tabla de la migración 06 todavía no existe.
_mock_audit: list[dict] = []


def _normalize(field: str, value: Any) -> Any:
    """Valor comparable y serializable a JSON: montos como número, textos vacíos como null."""
    if isinstance(value, Enum):
        value = value.value
    if value is None:
        return None
    if field in NUMERIC_FIELDS:
        try:
            number = float(Decimal(str(value)))
        except (ArithmeticError, ValueError):
            return None
        return int(number) if number.is_integer() else number
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def diff_fields(before: dict | None, after: dict) -> dict[str, dict[str, Any]]:
    """{campo: {"antes", "despues"}} con sólo lo que cambió. Sin `before` es un alta: vuelca lo cargado."""
    changes: dict[str, dict[str, Any]] = {}
    for field in TRACKED_FIELDS:
        new = _normalize(field, after.get(field))
        if before is None:
            if new is not None:
                changes[field] = {"antes": None, "despues": new}
            continue
        if field not in after:
            continue
        old = _normalize(field, before.get(field))
        if old != new:
            changes[field] = {"antes": old, "despues": new}
    return changes


def _clean_query(q: str) -> str:
    """Saca los caracteres que rompen el filtro `or` de PostgREST."""
    return re.sub(r"[,()%*\\]", " ", q).strip()


def _matches(entry: dict, product_id: UUID | None, user_id: UUID | None, q: str | None) -> bool:
    if product_id and str(entry.get("product_id")) != str(product_id):
        return False
    if user_id and str(entry.get("user_id")) != str(user_id):
        return False
    if q:
        haystack = " ".join(str(entry.get(k) or "") for k in ("product_name", "product_code", "user_name")).lower()
        if q.lower() not in haystack:
            return False
    return True


class CatalogAuditService:
    """Historial inmutable de altas, ediciones y bajas del catálogo: quién, cuándo y qué cambió."""

    @classmethod
    def record(
        cls,
        action: CatalogAuditAction,
        product: dict,
        changes: dict[str, dict[str, Any]] | None = None,
        user_id: UUID | None = None,
        user_name: str | None = None,
    ) -> CatalogAuditEntry | None:
        """Registra un cambio. Nunca corta la operación del catálogo: ante cualquier error sólo lo loguea."""
        try:
            return cls._record(action, product, changes or {}, user_id, user_name)
        except Exception as e:  # pragma: no cover - defensa: el historial no puede tumbar un alta/edición
            logger.error(f"No se pudo registrar el historial del catálogo: {e}")
            return None

    @classmethod
    def _record(
        cls,
        action: CatalogAuditAction,
        product: dict,
        changes: dict[str, dict[str, Any]],
        user_id: UUID | None,
        user_name: str | None,
    ) -> CatalogAuditEntry:
        uid = str(user_id) if user_id else None
        name = (UserService.name_map().get(uid) if uid else None) or user_name or "Usuario"
        entry = {
            "id": str(uuid4()),
            "product_id": str(product["id"]) if product.get("id") else None,
            "product_code": product.get("code"),
            "product_name": product.get("name"),
            "action": action.value,
            "changes": changes,
            "user_id": uid,
            "user_name": name,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            client = get_supabase_client()
            try:
                res = client.table(TABLE).insert(entry).execute()
            except Exception as fk_err:
                # Usuario de sesión que no existe en crm_users (FK): se guarda igual con el nombre.
                if not uid or ("user_id" not in str(fk_err) and "23503" not in str(fk_err)):
                    raise
                res = client.table(TABLE).insert({**entry, "user_id": None}).execute()
            if res.data:
                return CatalogAuditEntry(**res.data[0])
        except Exception as e:
            logger.warning(f"Error insertando en {TABLE}: {e}")

        _mock_audit.append(entry)
        return CatalogAuditEntry(**entry)

    @classmethod
    def list_entries(
        cls,
        product_id: UUID | None = None,
        user_id: UUID | None = None,
        q: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[CatalogAuditEntry]:
        """Cambios del más nuevo al más viejo, con filtros opcionales por material, usuario o texto."""
        q = _clean_query(q) if q else None
        local = sorted(
            (e for e in _mock_audit if _matches(e, product_id, user_id, q)),
            key=lambda e: e["created_at"],
            reverse=True,
        )

        try:
            client = get_supabase_client()
            query = client.table(TABLE).select("*")
            if product_id:
                query = query.eq("product_id", str(product_id))
            if user_id:
                query = query.eq("user_id", str(user_id))
            if q:
                query = query.or_(f"product_name.ilike.%{q}%,product_code.ilike.%{q}%,user_name.ilike.%{q}%")
            # Si hay cambios que quedaron en memoria, se trae desde el principio para intercalarlos bien.
            start = 0 if local else offset
            res = query.order("created_at", desc=True).range(start, offset + limit - 1).execute()
            if res.data is not None:
                rows = res.data
                if local:
                    rows = sorted([*rows, *local], key=lambda e: str(e["created_at"]), reverse=True)
                    rows = rows[offset : offset + limit]
                return [cls._to_entry(r) for r in rows]
        except Exception as e:
            logger.warning(f"Error consultando {TABLE} en Supabase: {e}")

        return [cls._to_entry(e) for e in local[offset : offset + limit]]

    @staticmethod
    def _to_entry(row: dict) -> CatalogAuditEntry:
        if not row.get("user_name") and row.get("user_id"):
            row = {**row, "user_name": UserService.name_map().get(str(row["user_id"]))}
        return CatalogAuditEntry(**{**row, "changes": row.get("changes") or {}})
