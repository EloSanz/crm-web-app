from uuid import UUID

from fastapi import APIRouter, Header, Query, status

from backend.controllers.permissions import require_roles
from backend.models.catalog import StageCreate, StageReorder, StageUpdate
from backend.services.stage_service import StageService

router = APIRouter(prefix="/api/stages", tags=["Etapas del Embudo"])

ADMIN_ROLES = {"admin"}


def list_stages(include_inactive: bool = False) -> list[dict]:
    """Etapas del embudo ordenadas por posición (sólo activas salvo que se pidan todas).

    Función común: la usan el historial de etapas, el legajo de la IA, los indicadores y el seed demo.
    """
    return StageService.list_stages(include_inactive=include_inactive)


@router.get("", summary="Listar etapas del embudo comercial del corralón")
def get_stages(
    include_inactive: bool = Query(False, description="Incluir etapas desactivadas (pantalla de configuración)"),
) -> list[dict]:
    """Etapas activas ordenadas por posición; con include_inactive también las desactivadas."""
    return list_stages(include_inactive=include_inactive)


@router.post("", status_code=status.HTTP_201_CREATED, summary="Crear una etapa del embudo (administrador)")
def create_stage(data: StageCreate, authorization: str | None = Header(None)) -> dict:
    require_roles(authorization, ADMIN_ROLES)
    return StageService.create_stage(data)


@router.put("/reorder", summary="Reordenar las etapas del embudo (administrador)")
def reorder_stages(data: StageReorder, authorization: str | None = Header(None)) -> list[dict]:
    require_roles(authorization, ADMIN_ROLES)
    return StageService.reorder(data.ids)


@router.put("/{stage_id}", summary="Editar, activar o desactivar una etapa (administrador)")
def update_stage(stage_id: UUID, data: StageUpdate, authorization: str | None = Header(None)) -> dict:
    """Renombra, cambia color o tipo, o da de baja lógica. Una etapa con presupuestos abiertos no se desactiva."""
    require_roles(authorization, ADMIN_ROLES)
    return StageService.update_stage(stage_id, data)
