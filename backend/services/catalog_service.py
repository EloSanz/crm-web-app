"""Catálogos configurables por el administrador: tipos de actividad, orígenes y motivos de pérdida.

Fuente de verdad: tabla crm_catalog_items (migración 11). Si Supabase no responde o la tabla no
existe, se trabaja con un respaldo en memoria sembrado con los valores iniciales del corralón.
"""

import logging
import re
import unicodedata
from datetime import datetime, timezone
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from fastapi import HTTPException, status

from backend.database import get_supabase_client
from backend.models.activity import SYSTEM_ACTIVITY_TYPES
from backend.models.catalog import CatalogItemCreate, CatalogItemResponse, CatalogItemUpdate, CatalogKind

logger = logging.getLogger("crm.services.catalog")

TABLE = "crm_catalog_items"

# Valores iniciales: (código, nombre visible, es de sistema). Mismo contenido que el seed de la migración 11.
DEFAULT_ITEMS: dict[CatalogKind, list[tuple[str, str, bool]]] = {
    CatalogKind.ACTIVITY_TYPE: [
        ("llamada", "Llamada", True),
        ("whatsapp", "WhatsApp / mensaje", True),
        ("visita_obra", "Visita a la obra", True),
        ("mostrador", "Atención en el local", True),
        ("email", "Correo", True),
        ("presupuesto", "Envío de presupuesto", True),
        ("reunion", "Reunión", True),
        ("nota", "Nota interna", True),
    ],
    CatalogKind.ORIGIN: [
        ("vino-al-local-mostrador", "Vino al local (mostrador)", False),
        ("recomendacion-de-otro-contratista", "Recomendación de otro contratista", False),
        ("cliente-existente-recompra", "Cliente existente / recompra", False),
        ("prospeccion-propia", "Prospección propia", False),
        ("redes-sociales", "Redes sociales", False),
        ("publicidad", "Publicidad", False),
        ("pagina-web", "Página web", False),
    ],
    CatalogKind.LOSS_REASON: [
        ("precio-presupuesto-mas-caro", "Precio / Presupuesto más caro", False),
        ("plazo-de-entrega-prolongado", "Plazo de entrega prolongado", False),
        ("eligio-otro-corralon-competidor", "Eligió otro corralón competidor", False),
        ("obra-frenada-o-postergada", "Obra frenada o postergada", False),
        (
            "no-hubo-acuerdo-en-condiciones-de-financiacion",
            "No hubo acuerdo en condiciones de financiación",
            False,
        ),
        ("falta-de-respuesta-del-contratista", "Falta de respuesta del contratista", False),
        ("faltante-o-quiebre-de-stock-de-materiales", "Faltante o quiebre de stock de materiales", False),
        ("otro-motivo-particular", "Otro motivo particular", False),
    ],
}

KIND_NOUN = {
    CatalogKind.ACTIVITY_TYPE: "tipo de actividad",
    CatalogKind.ORIGIN: "origen",
    CatalogKind.LOSS_REASON: "motivo de pérdida",
}


def _seed() -> dict[str, dict]:
    rows: dict[str, dict] = {}
    epoch = datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat()
    for kind, items in DEFAULT_ITEMS.items():
        for pos, (code, label, is_system) in enumerate(items, start=1):
            item_id = str(uuid5(NAMESPACE_URL, f"crm-catalog/{kind.value}/{code}"))
            rows[item_id] = {
                "id": item_id,
                "kind": kind.value,
                "code": code,
                "label": label,
                "position": pos,
                "is_active": True,
                "is_system": is_system,
                "created_at": epoch,
                "updated_at": epoch,
            }
    return rows


_mock_catalog: dict[str, dict] = _seed()


def slugify(text: str, sep: str = "-") -> str:
    """«Visita técnica» -> «visita-tecnica» (o con guion bajo para los tipos de actividad)."""
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", sep, plain).strip(sep)[:60] or "item"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class CatalogService:
    @staticmethod
    def _rows(kind: CatalogKind) -> list[dict]:
        """Todas las filas de un catálogo (activas e inactivas), ordenadas por posición."""
        rows: list[dict] = []
        try:
            res = get_supabase_client().table(TABLE).select("*").eq("kind", kind.value).order("position").execute()
            rows = list(res.data or [])
        except Exception as e:
            logger.warning(f"Error consultando {TABLE} en Supabase: {e}")
        if not rows:
            rows = [dict(r) for r in _mock_catalog.values() if r["kind"] == kind.value]
        rows.sort(key=lambda r: (r.get("position") or 0, r.get("label") or ""))
        return rows

    @classmethod
    def list_items(cls, kind: CatalogKind, include_inactive: bool = False) -> list[CatalogItemResponse]:
        items = [CatalogItemResponse(**r) for r in cls._rows(kind)]
        return items if include_inactive else [i for i in items if i.is_active]

    @classmethod
    def _find(cls, item_id: UUID) -> dict:
        try:
            res = get_supabase_client().table(TABLE).select("*").eq("id", str(item_id)).limit(1).execute()
            if res.data:
                return dict(res.data[0])
        except Exception as e:
            logger.warning(f"Error buscando ítem de catálogo en Supabase: {e}")
        row = _mock_catalog.get(str(item_id))
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontramos ese valor del catálogo")
        return dict(row)

    @staticmethod
    def _save(item_id: str, changes: dict) -> dict | None:
        """Actualiza en Supabase; si no hay base (o la fila no está), en el respaldo en memoria."""
        try:
            res = get_supabase_client().table(TABLE).update(changes).eq("id", item_id).execute()
            if res.data:
                return dict(res.data[0])
        except Exception as e:
            logger.warning(f"Error actualizando {TABLE} en Supabase: {e}")
        if item_id in _mock_catalog:
            _mock_catalog[item_id].update(changes)
            return dict(_mock_catalog[item_id])
        return None

    @classmethod
    def create_item(cls, data: CatalogItemCreate) -> CatalogItemResponse:
        rows = cls._rows(data.kind)
        noun = KIND_NOUN[data.kind]
        sep = "_" if data.kind == CatalogKind.ACTIVITY_TYPE else "-"
        code = data.code or slugify(data.label, sep)
        if any(r["label"].strip().lower() == data.label.lower() for r in rows):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un {noun} llamado «{data.label}». Si está desactivado, activalo.",
            )
        taken = {r["code"] for r in rows}
        if data.code and code in taken:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=f"Ya existe un {noun} con el código «{code}»"
            )
        base, n = code, 2
        while code in taken:
            code = f"{base}{sep}{n}"
            n += 1

        now = _now()
        row = {
            "id": str(uuid4()),
            "kind": data.kind.value,
            "code": code,
            "label": data.label,
            "position": max((r.get("position") or 0 for r in rows), default=0) + 1,
            "is_active": True,
            "is_system": False,
            "created_at": now,
            "updated_at": now,
        }
        try:
            res = get_supabase_client().table(TABLE).insert(row).execute()
            if res.data:
                return CatalogItemResponse(**res.data[0])
        except Exception as e:
            logger.warning(f"Error insertando en {TABLE}: {e}")
        _mock_catalog[row["id"]] = row
        return CatalogItemResponse(**row)

    @classmethod
    def update_item(cls, item_id: UUID, data: CatalogItemUpdate) -> CatalogItemResponse:
        current = cls._find(item_id)
        kind = CatalogKind(current["kind"])
        changes = data.model_dump(exclude_unset=True, exclude_none=True)

        if changes.get("is_active") is False and current.get("is_system"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"«{current['label']}» lo usa el sistema: podés renombrarlo o reordenarlo, pero no desactivarlo.",
            )
        if "label" in changes:
            clash = next(
                (
                    r
                    for r in cls._rows(kind)
                    if r["id"] != current["id"] and r["label"].strip().lower() == changes["label"].lower()
                ),
                None,
            )
            if clash:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Ya existe un {KIND_NOUN[kind]} llamado «{changes['label']}»",
                )
        position = changes.pop("position", None)
        if changes:
            changes["updated_at"] = _now()
            cls._save(current["id"], changes)
        if position is not None:
            ids = [UUID(r["id"]) for r in cls._rows(kind) if r["id"] != current["id"]]
            ids.insert(min(position, len(ids) + 1) - 1, UUID(current["id"]))
            cls.reorder(kind, ids)
        return CatalogItemResponse(**cls._find(item_id))

    @classmethod
    def reorder(cls, kind: CatalogKind, ids: list[UUID]) -> list[CatalogItemResponse]:
        rows = cls._rows(kind)
        by_id = {r["id"]: r for r in rows}
        wanted = [str(i) for i in dict.fromkeys(ids)]
        unknown = [i for i in wanted if i not in by_id]
        if unknown:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Hay valores que no pertenecen al catálogo de {KIND_NOUN[kind]}",
            )
        ordered = wanted + [r["id"] for r in rows if r["id"] not in wanted]
        now = _now()
        for pos, item_id in enumerate(ordered, start=1):
            if by_id[item_id].get("position") != pos:
                cls._save(item_id, {"position": pos, "updated_at": now})
        return cls.list_items(kind, include_inactive=True)

    @classmethod
    def ensure_activity_type(cls, code: str) -> None:
        """422 si el tipo de actividad no existe o está desactivado. Los tipos de sistema siempre valen."""
        if code in SYSTEM_ACTIVITY_TYPES:
            return
        row = next((r for r in cls._rows(CatalogKind.ACTIVITY_TYPE) if r["code"] == code), None)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El tipo de actividad «{code}» no existe. Elegí uno de la lista.",
            )
        if not row.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El tipo de actividad «{row['label']}» está desactivado. Elegí otro.",
            )

    @classmethod
    def ensure_value(cls, kind: CatalogKind, value: str | None, keep: list[str | None] | None = None) -> str | None:
        """Valida un origen o motivo de pérdida contra el catálogo activo y devuelve el texto a guardar.

        Se acepta el nombre visible o el código (sin distinguir mayúsculas ni espacios de más). Los valores
        de `keep` (lo que ya tenía el registro) valen aunque hoy estén desactivados o no estén en el
        catálogo, para no trabar la edición de datos viejos. 422 si no existe o está desactivado."""
        text = " ".join((value or "").split())
        if not text:
            return None

        def norm(v: str | None) -> str:
            return " ".join((v or "").split()).casefold()

        if any(norm(k) == norm(text) for k in keep or [] if k):
            return text
        row = next(
            (r for r in cls._rows(kind) if norm(r.get("label")) == norm(text) or norm(r.get("code")) == norm(text)),
            None,
        )
        noun = KIND_NOUN[kind]
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El {noun} «{text}» no está en el catálogo. Elegí uno de la lista.",
            )
        if not row.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"El {noun} «{row['label']}» está desactivado. Elegí otro.",
            )
        return row["label"]
