from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, status

from backend.controllers.permissions import require_roles, session_from_header, session_user_id
from backend.models.product import (
    CatalogAuditEntry,
    ProductCategory,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)
from backend.services.catalog_audit_service import CatalogAuditService
from backend.services.product_service import ProductService

router = APIRouter(prefix="/api/products", tags=["Catálogo de Materiales"])


def _actor(authorization: str | None) -> dict:
    """Quién hace el cambio, para el historial del catálogo."""
    return {
        "user_id": session_user_id(authorization),
        "user_name": session_from_header(authorization).get("name"),
    }


@router.get(
    "",
    response_model=list[ProductResponse],
    summary="Listar materiales de construcción en catálogo",
)
def list_products(
    category: ProductCategory | None = Query(None, description="Filtrar por rubro de materiales"),
    q: str | None = Query(None, description="Búsqueda por código o descripción"),
    is_active: bool | None = Query(True, description="Solo materiales habilitados"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[ProductResponse]:
    """Retorna los materiales del catálogo disponibles para presupuestar."""
    return ProductService.get_products(
        category=category,
        q=q,
        is_active=is_active,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Agregar material al catálogo",
)
def create_product(data: ProductCreate, authorization: str | None = Header(None)) -> ProductResponse:
    """Registra un nuevo material o servicio."""
    return ProductService.create_product(data, **_actor(authorization))


# Declarada antes de /{product_id} para que "audit" no se tome como un ID.
@router.get(
    "/audit",
    response_model=list[CatalogAuditEntry],
    summary="Historial de cambios del catálogo (sólo administrador)",
)
def list_catalog_audit(
    product_id: UUID | None = Query(None, description="Sólo los cambios de un material"),
    user_id: UUID | None = Query(None, description="Sólo los cambios hechos por un usuario"),
    q: str | None = Query(None, description="Búsqueda por material, código o usuario"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    authorization: str | None = Header(None),
) -> list[CatalogAuditEntry]:
    """Altas, ediciones y bajas del catálogo, del más nuevo al más viejo."""
    require_roles(authorization, {"admin"})
    return CatalogAuditService.list_entries(product_id=product_id, user_id=user_id, q=q, limit=limit, offset=offset)


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Detalle de un material",
)
def get_product(product_id: UUID) -> ProductResponse:
    """Consulta los datos de un material por su ID."""
    return ProductService.get_product_by_id(product_id)


@router.put(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Modificar precio o datos de un material",
)
def update_product(product_id: UUID, data: ProductUpdate, authorization: str | None = Header(None)) -> ProductResponse:
    """Actualiza datos comerciales o precios (minorista y mayorista)."""
    return ProductService.update_product(product_id, data, **_actor(authorization))


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Baja lógica de un material",
)
def delete_product(product_id: UUID, authorization: str | None = Header(None)):
    """Aplica baja lógica a un material."""
    success = ProductService.delete_product(product_id, **_actor(authorization))
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo dar de baja el material",
        )
