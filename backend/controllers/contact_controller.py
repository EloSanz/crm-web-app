from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, status

from backend.controllers.auth_controller import decode_simple_token
from backend.models.contact import ContactCreate, ContactResponse, ContactStatus, ContactUpdate
from backend.services.contact_service import ContactService

router = APIRouter(prefix="/api/contacts", tags=["Contactos"])


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
    response_model=list[ContactResponse],
    summary="Listar contactos / contratistas activos",
)
def list_contacts(
    company_id: UUID | None = Query(None, description="Filtrar por empresa vinculada"),
    status: ContactStatus | None = Query(None, description="Filtrar por estado comercial"),
    q: str | None = Query(None, description="Búsqueda por nombre, apellido o email"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[ContactResponse]:
    """Retorna los contactos activos excluyendo baja lógica."""
    return ContactService.get_contacts(
        company_id=company_id,
        status_filter=status,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=ContactResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un nuevo contacto comercial",
)
def create_contact(
    data: ContactCreate,
    authorization: str | None = Header(None),
) -> ContactResponse:
    """Crea un contacto (puede pertenecer a una empresa o ser independiente)."""
    user_id = _extract_user_id(authorization)
    return ContactService.create_contact(data, created_by=user_id)


@router.get(
    "/{contact_id}",
    response_model=ContactResponse,
    summary="Detalle de un contacto",
)
def get_contact(contact_id: UUID) -> ContactResponse:
    """Obtiene el detalle de un contacto específico."""
    return ContactService.get_contact_by_id(contact_id)


@router.put(
    "/{contact_id}",
    response_model=ContactResponse,
    summary="Actualizar datos de un contacto",
)
def update_contact(
    contact_id: UUID,
    data: ContactUpdate,
) -> ContactResponse:
    """Modifica los campos provistos de un contacto existente."""
    return ContactService.update_contact(contact_id, data)


@router.delete(
    "/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Baja lógica de un contacto",
)
def delete_contact(contact_id: UUID):
    """Aplica baja lógica (Invariante 2: nunca borrado físico)."""
    success = ContactService.delete_contact(contact_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se pudo dar de baja el contacto")
