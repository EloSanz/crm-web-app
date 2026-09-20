from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, status

from backend.controllers.auth_controller import decode_simple_token
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
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[CompanyResponse]:
    """Retorna las empresas no eliminadas ordenadas cronológicamente."""
    return CompanyService.get_companies(q=q, status_filter=status, limit=limit, offset=offset)


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
    """Crea una empresa y asocia el usuario creador si está autenticado."""
    user_id = _extract_user_id(authorization)
    return CompanyService.create_company(data, created_by=user_id)


@router.get(
    "/{company_id}",
    response_model=CompanyResponse,
    summary="Detalle de una empresa",
)
def get_company(company_id: UUID) -> CompanyResponse:
    """Obtiene los datos de una empresa específica por su ID."""
    return CompanyService.get_company_by_id(company_id)


@router.put(
    "/{company_id}",
    response_model=CompanyResponse,
    summary="Actualizar datos de una empresa",
)
def update_company(
    company_id: UUID,
    data: CompanyUpdate,
) -> CompanyResponse:
    """Modifica los campos provistos de una empresa existente."""
    return CompanyService.update_company(company_id, data)


@router.delete(
    "/{company_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Baja lógica de una empresa",
)
def delete_company(company_id: UUID):
    """Aplica baja lógica (Invariante 2: nunca borrado físico)."""
    success = CompanyService.delete_company(company_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se pudo dar de baja la empresa")


@router.get(
    "/{company_id}/contacts",
    response_model=list[ContactResponse],
    summary="Listar contactos vinculados a la empresa",
)
def list_company_contacts(company_id: UUID) -> list[ContactResponse]:
    """Retorna todos los contactos asociados a esta empresa contratista."""
    # Verificar existencia
    CompanyService.get_company_by_id(company_id)
    return ContactService.get_contacts(company_id=company_id)
