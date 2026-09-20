from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from backend.models.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectStatus,
    ProjectType,
    ProjectUpdate,
)
from backend.services.project_service import ProjectService

router = APIRouter(prefix="/api/projects", tags=["Obras y Proyectos"])


@router.get(
    "",
    response_model=list[ProjectResponse],
    summary="Listar obras y proyectos del corralón",
)
def list_projects(
    company_id: UUID | None = Query(None, description="Filtrar por empresa contratista"),
    contact_id: UUID | None = Query(None, description="Filtrar por maestro mayor de obra"),
    status: ProjectStatus | None = Query(None, description="Filtrar por estado operativo de la obra"),
    project_type: ProjectType | None = Query(None, description="Filtrar por tipo de obra"),
    q: str | None = Query(None, description="Buscar por nombre o dirección de la obra"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[ProjectResponse]:
    """Retorna las obras en curso, pausadas o planificadas con su locación de entrega."""
    return ProjectService.get_projects(
        company_id=company_id,
        contact_id=contact_id,
        status_filter=status,
        project_type=project_type,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar una nueva obra",
)
def create_project(data: ProjectCreate) -> ProjectResponse:
    """Registra una obra o locación de entrega para un cliente contratista."""
    return ProjectService.create_project(data)


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Detalle de una obra",
)
def get_project(project_id: UUID) -> ProjectResponse:
    """Consulta el detalle de una obra por su ID."""
    return ProjectService.get_project_by_id(project_id)


@router.put(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Actualizar datos o estado de una obra",
)
def update_project(project_id: UUID, data: ProjectUpdate) -> ProjectResponse:
    """Modifica el estado, dirección o datos de una obra."""
    return ProjectService.update_project(project_id, data)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Baja lógica de una obra",
)
def delete_project(project_id: UUID):
    """Aplica baja lógica a una obra."""
    success = ProjectService.delete_project(project_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo dar de baja la obra",
        )
