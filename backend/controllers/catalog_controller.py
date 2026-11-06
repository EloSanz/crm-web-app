from uuid import UUID

from fastapi import APIRouter, Header, Query, status

from backend.controllers.permissions import require_roles
from backend.models.catalog import (
    CatalogItemCreate,
    CatalogItemResponse,
    CatalogItemUpdate,
    CatalogKind,
    CatalogReorder,
)
from backend.services.catalog_service import CatalogService

router = APIRouter(prefix="/api/catalogs", tags=["Configuración de catálogos"])

ADMIN_ROLES = {"admin"}


@router.get("", response_model=list[CatalogItemResponse], summary="Listar un catálogo configurable")
def list_catalog(
    kind: CatalogKind = Query(..., description="activity_type, origin o loss_reason"),
    include_inactive: bool = Query(False, description="Incluir valores desactivados (pantalla de configuración)"),
) -> list[CatalogItemResponse]:
    """Todos los roles leen los valores activos, ordenados como los dejó el administrador."""
    return CatalogService.list_items(kind, include_inactive=include_inactive)


@router.post(
    "",
    response_model=CatalogItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Agregar un valor a un catálogo (administrador)",
)
def create_catalog_item(data: CatalogItemCreate, authorization: str | None = Header(None)) -> CatalogItemResponse:
    require_roles(authorization, ADMIN_ROLES)
    return CatalogService.create_item(data)


@router.put(
    "/reorder",
    response_model=list[CatalogItemResponse],
    summary="Reordenar un catálogo (administrador)",
)
def reorder_catalog(data: CatalogReorder, authorization: str | None = Header(None)) -> list[CatalogItemResponse]:
    require_roles(authorization, ADMIN_ROLES)
    return CatalogService.reorder(data.kind, data.ids)


@router.put(
    "/{item_id}",
    response_model=CatalogItemResponse,
    summary="Renombrar, mover, activar o desactivar un valor (administrador)",
)
def update_catalog_item(
    item_id: UUID, data: CatalogItemUpdate, authorization: str | None = Header(None)
) -> CatalogItemResponse:
    """Renombrar no reescribe los registros viejos; desactivar lo saca sólo de las opciones nuevas."""
    require_roles(authorization, ADMIN_ROLES)
    return CatalogService.update_item(item_id, data)
