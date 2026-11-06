from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, status

from backend.controllers.auth_controller import decode_simple_token
from backend.controllers.pagination import LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT
from backend.controllers.permissions import (
    authorize_company,
    client_scope,
    ensure_can_reassign,
    ensure_client_owner,
    owner_scope,
)
from backend.models.company import CompanyCreate, CompanyResponse, CompanyStatus, CompanyUpdate
from backend.models.contact import ContactResponse
from backend.services.company_service import CompanyService
from backend.services.contact_service import ContactService

router = APIRouter(prefix="/api/companies", tags=["Empresas"])


def _extract_user_id(authorization: str | None) -> UUID | None:
    if not authorization:
        return None
    try:
        data = decode_simple_token(authorization)
        sub = data.get("sub")
        return UUID(sub) if sub else None
    except Exception:
        return None


@router.get(
    "",
    response_model=list[CompanyResponse],
    summary="Listar empresas contratistas activas",
)
def list_companies(
    q: str | None = Query(None, description="Búsqueda por nombre o CUIT"),
    status: CompanyStatus | None = Query(None, description="Filtrar por estado comercial"),
    limit: int = Query(LIST_DEFAULT_LIMIT, ge=1, le=LIST_MAX_LIMIT),
    offset: int = Query(0, ge=0),
    authorization: str | None = Header(None),
) -> list[CompanyResponse]:
    """Retorna las empresas no eliminadas. Un vendedor sólo ve sus clientes y la cartera libre."""
    companies = CompanyService.get_companies(q=q, status_filter=status, limit=limit, offset=offset)
    scope = client_scope(authorization)
    return companies if scope is None else [c for c in companies if scope.sees_company(c)]


@router.post(
    "",
    response_model=CompanyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar una nueva empresa contratista",
)
def create_company(
    data: CompanyCreate,
    authorization: str | None = Header(None),
) -> CompanyResponse:
    """Crea una empresa. Si la carga un vendedor, queda asignada a él; admin y responsable comercial
    pueden elegir el responsable o dejarla sin asignar."""
    user_id = _extract_user_id(authorization)
    seller = owner_scope(authorization)
    if seller is not None:
        data = data.model_copy(update={"assigned_to": seller})
    return CompanyService.create_company(data, created_by=user_id)


@router.get(
    "/{company_id}",
    response_model=CompanyResponse,
    summary="Detalle de una empresa",
)
def get_company(company_id: UUID, authorization: str | None = Header(None)) -> CompanyResponse:
    """Obtiene los datos de una empresa específica por su ID."""
    return authorize_company(authorization, company_id)


@router.put(
    "/{company_id}",
    response_model=CompanyResponse,
    summary="Actualizar datos de una empresa",
)
def update_company(
    company_id: UUID,
    data: CompanyUpdate,
    authorization: str | None = Header(None),
) -> CompanyResponse:
    """Modifica los campos provistos de una empresa. Reasignar el responsable es de los managers."""
    company = authorize_company(authorization, company_id)
    if company.assigned_to is not None:
        ensure_client_owner(authorization, company.assigned_to)
    if "assigned_to" in data.model_fields_set:
        ensure_can_reassign(authorization, company.assigned_to, data.assigned_to)
    return CompanyService.update_company(company_id, data)


@router.delete(
    "/{company_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Baja lógica de una empresa",
)
def delete_company(company_id: UUID, authorization: str | None = Header(None)):
    """Aplica baja lógica (Invariante 2: nunca borrado físico). Sólo el responsable o los managers."""
    company = authorize_company(authorization, company_id)
    ensure_client_owner(authorization, company.assigned_to)
    success = CompanyService.delete_company(company_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se pudo dar de baja la empresa")


@router.get(
    "/{company_id}/contacts",
    response_model=list[ContactResponse],
    summary="Listar contactos vinculados a la empresa",
)
def list_company_contacts(company_id: UUID, authorization: str | None = Header(None)) -> list[ContactResponse]:
    """Retorna todos los contactos asociados a esta empresa contratista."""
    authorize_company(authorization, company_id)
    return ContactService.get_contacts(company_id=company_id)
