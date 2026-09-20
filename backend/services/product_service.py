import logging
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from backend.database import get_supabase_client
from backend.models.product import (
    ProductCategory,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)

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
        "description": "Cemento de uso general para hormigón y mampostería.",
    },
    {
        "code": "CAL-25",
        "name": "Cal Hidratada Milagro 25 kg",
        "category": "Aglomerantes",
        "unit": "bolsa 25kg",
        "unit_price": 4200.00,
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
        "description": "Acero ADN 420 para armaduras principales y vigas.",
    },
    {
        "code": "HIE-12",
        "name": "Hierro Aletado Ø 12 mm (Barra 12 m)",
        "category": "Hierros y Aceros",
        "unit": "barra 12m",
        "unit_price": 17800.00,
        "description": "Acero ADN 420 estructural.",
    },
    {
        "code": "LAD-12",
        "name": "Ladrillo Hueco 12x18x33 (6 tubos)",
        "category": "Mampostería",
        "unit": "unidad",
        "unit_price": 720.00,
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
                "description": p["description"],
                "is_active": True,
                "is_deleted": False,
                "created_at": now,
                "updated_at": now,
            }


_init_mock_products()


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
                return [ProductResponse(**item) for item in res.data]
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
                return ProductResponse(**res.data[0])
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
    def create_product(cls, data: ProductCreate) -> ProductResponse:
        """Agrega un nuevo material al catálogo."""
        now = datetime.now(timezone.utc)
        product_id = uuid4()
        payload = {
            "id": str(product_id),
            "code": data.code.upper().strip(),
            "name": data.name.strip(),
            "category": data.category.value,
            "unit": data.unit.strip(),
            "unit_price": float(data.unit_price),
            "description": data.description,
            "is_active": data.is_active,
            "is_deleted": False,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        try:
            client = get_supabase_client()
            res = client.table("crm_products").insert(payload).execute()
            if res.data and len(res.data) > 0:
                created_record = res.data[0]
                _mock_products[str(product_id)] = created_record
                return ProductResponse(**created_record)
        except Exception as e:
            logger.warning(f"Error insertando material en Supabase: {e}")

        _mock_products[str(product_id)] = payload
        return ProductResponse(**payload)

    @classmethod
    def update_product(cls, product_id: UUID, data: ProductUpdate) -> ProductResponse:
        """Actualiza atributos o precio de un material."""
        existing = cls.get_product_by_id(product_id)

        update_payload = data.model_dump(exclude_unset=True)
        if not update_payload:
            return existing

        now = datetime.now(timezone.utc)
        update_payload["updated_at"] = now.isoformat()
        if "category" in update_payload and isinstance(update_payload["category"], ProductCategory):
            update_payload["category"] = update_payload["category"].value
        if "unit_price" in update_payload and isinstance(update_payload["unit_price"], Decimal):
            update_payload["unit_price"] = float(update_payload["unit_price"])
        if "code" in update_payload and update_payload["code"]:
            update_payload["code"] = update_payload["code"].upper().strip()

        try:
            client = get_supabase_client()
            res = client.table("crm_products").update(update_payload).eq("id", str(product_id)).execute()
            if res.data and len(res.data) > 0:
                updated_record = res.data[0]
                _mock_products[str(product_id)] = updated_record
                return ProductResponse(**updated_record)
        except Exception as e:
            logger.warning(f"Error actualizando material en Supabase: {e}")

        current_data = _mock_products.get(str(product_id), existing.model_dump())
        current_data.update(update_payload)
        _mock_products[str(product_id)] = current_data
        return ProductResponse(**current_data)

    @classmethod
    def delete_product(cls, product_id: UUID) -> bool:
        """Baja lógica de un producto del catálogo."""
        cls.get_product_by_id(product_id)
        now = datetime.now(timezone.utc).isoformat()
        soft_delete_payload = {
            "is_deleted": True,
            "updated_at": now,
        }

        try:
            client = get_supabase_client()
            res = client.table("crm_products").update(soft_delete_payload).eq("id", str(product_id)).execute()
            if res.data is not None:
                if str(product_id) in _mock_products:
                    _mock_products[str(product_id)].update(soft_delete_payload)
                return True
        except Exception as e:
            logger.warning(f"Error en baja lógica de material en Supabase: {e}")

        if str(product_id) in _mock_products:
            _mock_products[str(product_id)].update(soft_delete_payload)
        return True
