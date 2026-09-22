import logging
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from backend.database import get_supabase_client
from backend.models.product import (
    CatalogAuditAction,
    ProductCategory,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    wholesale_error,
)
from backend.services.catalog_audit_service import CatalogAuditService, diff_fields

logger = logging.getLogger("crm.services.product")

_mock_products: dict[str, dict] = {}

# Inicializar productos por defecto en memoria para pruebas y modo offline
_DEFAULT_MATERIALS = [
    {
        "code": "CEM-50",
        "name": "Cemento Portland Loma Negra 50 kg",
        "category": "Aglomerantes",
        "unit": "bolsa 50kg",
        "unit_price": 9800.00,
        "wholesale_price": 8900.00,
        "wholesale_min_qty": 50,
        "description": "Cemento de uso general para hormigón y mampostería.",
    },
    {
        "code": "CAL-25",
        "name": "Cal Hidratada Milagro 25 kg",
        "category": "Aglomerantes",
        "unit": "bolsa 25kg",
        "unit_price": 4200.00,
        "wholesale_price": 3850.00,
        "wholesale_min_qty": 40,
        "description": "Cal aérea hidratada en polvo para revoques y mezclas de asiento.",
    },
    {
        "code": "ARE-M3",
        "name": "Arena Gruesa Limpia por m³",
        "category": "Áridos",
        "unit": "m3",
        "unit_price": 28000.00,
        "description": "Arena lavada de río para hormigón y mezclas.",
    },
    {
        "code": "PIE-620",
        "name": "Piedra Partida Granítica 6-20 por m³",
        "category": "Áridos",
        "unit": "m3",
        "unit_price": 38500.00,
        "description": "Agregado grueso para hormigón armado de alta resistencia.",
    },
    {
        "code": "HIE-08",
        "name": "Hierro Aletado Ø 8 mm (Barra 12 m)",
        "category": "Hierros y Aceros",
        "unit": "barra 12m",
        "unit_price": 7900.00,
        "wholesale_price": 7250.00,
        "wholesale_min_qty": 20,
        "description": "Acero ADN 420 para armaduras principales y vigas.",
    },
    {
        "code": "HIE-12",
        "name": "Hierro Aletado Ø 12 mm (Barra 12 m)",
        "category": "Hierros y Aceros",
        "unit": "barra 12m",
        "unit_price": 17800.00,
        "wholesale_price": 16400.00,
        "wholesale_min_qty": 20,
        "description": "Acero ADN 420 estructural.",
    },
    {
        "code": "LAD-12",
        "name": "Ladrillo Hueco 12x18x33 (6 tubos)",
        "category": "Mampostería",
        "unit": "unidad",
        "unit_price": 720.00,
        "wholesale_price": 640.00,
        "wholesale_min_qty": 1000,
        "description": "Ladrillo cerámico hueco para tabiques exteriores e interiores.",
    },
    {
        "code": "FLE-HID",
        "name": "Servicio de Flete y Descarga con Hidrogrúa en Obra",
        "category": "Servicios",
        "unit": "viaje",
        "unit_price": 65000.00,
        "description": "Transporte y descarga mecanizada al pie de obra (hasta 10 km).",
    },
]


def _init_mock_products():
    if not _mock_products:
        now = datetime.now(timezone.utc).isoformat()
        for p in _DEFAULT_MATERIALS:
            pid = str(uuid4())
            _mock_products[pid] = {
                "id": pid,
                "code": p["code"],
                "name": p["name"],
                "category": p["category"],
                "unit": p["unit"],
                "unit_price": str(p["unit_price"]),
                "wholesale_price": str(p["wholesale_price"]) if p.get("wholesale_price") else None,
                "wholesale_min_qty": str(p["wholesale_min_qty"]) if p.get("wholesale_min_qty") else None,
                "description": p["description"],
                "is_active": True,
                "is_deleted": False,
                "created_at": now,
                "updated_at": now,
            }


_init_mock_products()

_WHOLESALE_KEYS = ("wholesale_price", "wholesale_min_qty")
_NUMERIC_KEYS = ("unit_price", *_WHOLESALE_KEYS)
# Campos que no admiten null: si llegan vacíos en una edición se ignoran.
_REQUIRED_KEYS = ("code", "name", "category", "unit", "unit_price", "is_active")


def _missing_wholesale_columns(err: Exception) -> bool:
    """La base todavía no tiene la migración 06 (columnas del precio mayorista)."""
    return any(k in str(err) for k in _WHOLESALE_KEYS)


def _write(op, payload: dict):
    """Ejecuta insert/update; si faltan las columnas mayoristas reintenta sin ellas."""
    try:
        return op(payload).execute()
    except Exception as err:
        if not _missing_wholesale_columns(err):
            raise
        logger.warning("crm_products sin columnas de precio mayorista (migración 06): se guardan en memoria")
        return op({k: v for k, v in payload.items() if k not in _WHOLESALE_KEYS}).execute()


def _overlay(row: dict) -> dict:
    """Completa el precio mayorista guardado en memoria cuando la fila de Supabase no lo trae."""
    if all(k in row for k in _WHOLESALE_KEYS):
        return row
    cached = _mock_products.get(str(row.get("id"))) or {}
    return {**row, **{k: cached.get(k) for k in _WHOLESALE_KEYS}}


def _to_float(value) -> float | None:
    return float(value) if value is not None else None


def _check_wholesale(unit_price, wholesale_price, wholesale_min_qty) -> None:
    error = wholesale_error(unit_price, wholesale_price, wholesale_min_qty)
    if error:
        raise HTTPException(status_code=422, detail=error)


class ProductService:
    """Servicio para el catálogo de materiales de construcción y servicios."""

    @classmethod
    def get_products(
        cls,
        category: ProductCategory | None = None,
        q: str | None = None,
        is_active: bool | None = True,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ProductResponse]:
        """Consulta el catálogo de materiales de construcción."""
        try:
            client = get_supabase_client()
            query = client.table("crm_products").select("*").eq("is_deleted", False)

            if category:
                query = query.eq("category", category.value)
            if is_active is not None:
                query = query.eq("is_active", is_active)
            if q:
                query = query.or_(f"name.ilike.%{q}%,code.ilike.%{q}%")

            query = query.order("category").order("name").range(offset, offset + limit - 1)
            res = query.execute()

            if res.data is not None and len(res.data) > 0:
                return [ProductResponse(**_overlay(item)) for item in res.data]
        except Exception as e:
            logger.warning(f"Error consultando crm_products en Supabase: {e}")

        # Fallback local
        results = [ProductResponse(**item) for item in _mock_products.values() if not item.get("is_deleted", False)]
        if category:
            results = [p for p in results if p.category == category]
        if is_active is not None:
            results = [p for p in results if p.is_active == is_active]
        if q:
            q_lower = q.lower()
            results = [p for p in results if q_lower in p.name.lower() or q_lower in p.code.lower()]
        results.sort(key=lambda p: (p.category, p.name))
        return results[offset : offset + limit]

    @classmethod
    def get_product_by_id(cls, product_id: UUID) -> ProductResponse:
        """Obtiene un producto por su ID."""
        try:
            client = get_supabase_client()
            res = client.table("crm_products").select("*").eq("id", str(product_id)).eq("is_deleted", False).execute()
            if res.data and len(res.data) > 0:
                return ProductResponse(**_overlay(res.data[0]))
        except Exception as e:
            logger.warning(f"Error buscando producto en Supabase: {e}")

        mock_data = _mock_products.get(str(product_id))
        if mock_data and not mock_data.get("is_deleted", False):
            return ProductResponse(**mock_data)

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Material con ID {product_id} no encontrado en el catálogo",
        )

    @classmethod
    def create_product(
        cls, data: ProductCreate, user_id: UUID | None = None, user_name: str | None = None
    ) -> ProductResponse:
        """Agrega un nuevo material al catálogo y deja el alta en el historial."""
        _check_wholesale(data.unit_price, data.wholesale_price, data.wholesale_min_qty)
        now = datetime.now(timezone.utc)
        product_id = uuid4()
        payload = {
            "id": str(product_id),
            "code": data.code.upper().strip(),
            "name": data.name.strip(),
            "category": data.category.value,
            "unit": data.unit.strip(),
            "unit_price": float(data.unit_price),
            "wholesale_price": _to_float(data.wholesale_price),
            "wholesale_min_qty": _to_float(data.wholesale_min_qty),
            "description": data.description,
            "is_active": data.is_active,
            "is_deleted": False,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        created: dict = payload
        try:
            client = get_supabase_client()
            res = _write(lambda p: client.table("crm_products").insert(p), payload)
            if res.data and len(res.data) > 0:
                created = {**{k: payload[k] for k in _WHOLESALE_KEYS}, **res.data[0]}
        except Exception as e:
            logger.warning(f"Error insertando material en Supabase: {e}")

        _mock_products[str(product_id)] = created
        CatalogAuditService.record(
            CatalogAuditAction.ALTA, created, diff_fields(None, payload), user_id=user_id, user_name=user_name
        )
        return ProductResponse(**created)

    @classmethod
    def update_product(
        cls, product_id: UUID, data: ProductUpdate, user_id: UUID | None = None, user_name: str | None = None
    ) -> ProductResponse:
        """Actualiza atributos o precios de un material; el historial guarda sólo lo que cambió."""
        existing = cls.get_product_by_id(product_id)

        update_payload = {
            k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None or k not in _REQUIRED_KEYS
        }
        if not update_payload:
            return existing

        _check_wholesale(
            update_payload.get("unit_price", existing.unit_price),
            update_payload.get("wholesale_price", existing.wholesale_price),
            update_payload.get("wholesale_min_qty", existing.wholesale_min_qty),
        )

        if isinstance(update_payload.get("category"), ProductCategory):
            update_payload["category"] = update_payload["category"].value
        for key in _NUMERIC_KEYS:
            if isinstance(update_payload.get(key), Decimal):
                update_payload[key] = float(update_payload[key])
        if update_payload.get("code"):
            update_payload["code"] = update_payload["code"].upper().strip()

        changes = diff_fields(existing.model_dump(), update_payload)
        update_payload["updated_at"] = datetime.now(timezone.utc).isoformat()

        updated: dict | None = None
        try:
            client = get_supabase_client()
            res = _write(lambda p: client.table("crm_products").update(p).eq("id", str(product_id)), update_payload)
            if res.data and len(res.data) > 0:
                previous = _mock_products.get(str(product_id)) or existing.model_dump()
                kept = {k: update_payload.get(k, previous.get(k)) for k in _WHOLESALE_KEYS}
                updated = {**kept, **res.data[0]}
        except Exception as e:
            logger.warning(f"Error actualizando material en Supabase: {e}")

        if updated is None:
            updated = {**(_mock_products.get(str(product_id)) or existing.model_dump()), **update_payload}
        _mock_products[str(product_id)] = updated

        if changes:
            CatalogAuditService.record(
                CatalogAuditAction.EDICION, updated, changes, user_id=user_id, user_name=user_name
            )
        return ProductResponse(**updated)

    @classmethod
    def delete_product(cls, product_id: UUID, user_id: UUID | None = None, user_name: str | None = None) -> bool:
        """Baja lógica de un producto del catálogo, registrada en el historial."""
        existing = cls.get_product_by_id(product_id)
        now = datetime.now(timezone.utc).isoformat()
        soft_delete_payload = {
            "is_deleted": True,
            "updated_at": now,
        }

        try:
            client = get_supabase_client()
            client.table("crm_products").update(soft_delete_payload).eq("id", str(product_id)).execute()
        except Exception as e:
            logger.warning(f"Error en baja lógica de material en Supabase: {e}")

        if str(product_id) in _mock_products:
            _mock_products[str(product_id)].update(soft_delete_payload)
        CatalogAuditService.record(
            CatalogAuditAction.BAJA, existing.model_dump(), {}, user_id=user_id, user_name=user_name
        )
        return True
