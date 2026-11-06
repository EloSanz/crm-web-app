from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, status

from backend.controllers.pagination import LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT
from backend.controllers.permissions import (
    authorize_company,
    authorize_contact,
    authorize_project,
    client_scope,
    ensure_client_owner,
    project_client_owner,
)
from backend.models.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectStatus,
    ProjectType,
    ProjectUpdate,
)
from backend.services.project_service import ProjectService

router = APIRouter(prefix="/api/projects", tags=["Obras y Proyectos"])

_CLIENT_REQUIRED = "Toda obra pertenece a un cliente: elegí una empresa o un contacto"


def _ensure_has_client(company_id: UUID | None, contact_id: UUID | None) -> None:
    """Regla del proyecto: toda obra pertenece a un cliente (empresa o contacto)."""
    if not company_id and not contact_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=_CLIENT_REQUIRED)


def _authorize_clients(authorization: str | None, company_id: UUID | None, contact_id: UUID | None) -> None:
    """El cliente elegido tiene que existir y, para un vendedor, ser uno que él ve."""
    if company_id:
        authorize_company(authorization, company_id)
    if contact_id:
        authorize_contact(authorization, contact_id)


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
    limit: int = Query(LIST_DEFAULT_LIMIT, ge=1, le=LIST_MAX_LIMIT),
    offset: int = Query(0, ge=0),
    authorization: str | None = Header(None),
) -> list[ProjectResponse]:
    """Retorna las obras en curso, pausadas o planificadas con su locación de entrega.
    Un vendedor sólo ve las obras de sus clientes, de la cartera libre y las que tienen presupuestos suyos."""
    filters = dict(company_id=company_id, contact_id=contact_id, status_filter=status, project_type=project_type, q=q)
    scope = client_scope(authorization)
    if scope is None:
        return ProjectService.get_projects(**filters, limit=limit, offset=offset)
    # Se filtra sobre el total y recién después se pagina, para que la página no quede corta.
    visible = [p for p in ProjectService.get_projects(**filters, limit=LIST_MAX_LIMIT) if scope.sees_project(p)]
    return visible[offset : offset + limit]


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar una nueva obra",
)
def create_project(data: ProjectCreate, authorization: str | None = Header(None)) -> ProjectResponse:
    """Registra una obra o locación de entrega para un cliente. Un vendedor sólo puede cargarla para
    un cliente que ve."""
    _ensure_has_client(data.company_id, data.contact_id)
    _authorize_clients(authorization, data.company_id, data.contact_id)
    return ProjectService.create_project(data)


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Detalle de una obra",
)
def get_project(project_id: UUID, authorization: str | None = Header(None)) -> ProjectResponse:
    """Consulta el detalle de una obra por su ID (403 si es de un cliente que el vendedor no ve)."""
    return authorize_project(authorization, project_id)


@router.put(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Actualizar datos o estado de una obra",
)
def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    authorization: str | None = Header(None),
) -> ProjectResponse:
    """Modifica el estado, dirección o datos de una obra. Si el cliente tiene responsable, sólo ese
    vendedor o los managers la editan; moverla de cliente sólo hacia uno que el vendedor ve."""
    project = authorize_project(authorization, project_id)
    owner = project_client_owner(project.company_id, project.contact_id)
    if owner is not None:
        ensure_client_owner(authorization, owner)
    fields = data.model_fields_set
    company_id = data.company_id if "company_id" in fields else project.company_id
    contact_id = data.contact_id if "contact_id" in fields else project.contact_id
    _ensure_has_client(company_id, contact_id)
    _authorize_clients(
        authorization,
        company_id if company_id != project.company_id else None,
        contact_id if contact_id != project.contact_id else None,
    )
    return ProjectService.update_project(project_id, data)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Baja lógica de una obra",
)
def delete_project(project_id: UUID, authorization: str | None = Header(None)):
    """Aplica baja lógica a una obra. Sólo el responsable del cliente o los managers."""
    project = authorize_project(authorization, project_id)
    ensure_client_owner(authorization, project_client_owner(project.company_id, project.contact_id))
    success = ProjectService.delete_project(project_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo dar de baja la obra",
        )
