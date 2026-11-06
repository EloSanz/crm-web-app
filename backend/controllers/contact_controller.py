from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, status

from backend.controllers.auth_controller import decode_simple_token
from backend.controllers.pagination import LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT
from backend.controllers.permissions import (
    authorize_contact,
    client_scope,
    ensure_can_reassign,
    ensure_client_owner,
    owner_scope,
)
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
    limit: int = Query(LIST_DEFAULT_LIMIT, ge=1, le=LIST_MAX_LIMIT),
    offset: int = Query(0, ge=0),
    authorization: str | None = Header(None),
) -> list[ContactResponse]:
    """Retorna los contactos activos. Un vendedor sólo ve sus clientes y la cartera libre."""
    contacts = ContactService.get_contacts(
        company_id=company_id,
        status_filter=status,
        q=q,
        limit=limit,
        offset=offset,
    )
    scope = client_scope(authorization)
    if scope is None:
        return contacts
    from backend.services.company_service import CompanyService

    companies = {str(c.id): c for c in CompanyService.get_companies(limit=1000)}
    return [c for c in contacts if scope.sees_contact(c, companies.get(str(c.company_id)))]


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
    """Crea un contacto (puede pertenecer a una empresa o ser independiente). Si lo carga un vendedor,
    queda asignado a él."""
    user_id = _extract_user_id(authorization)
    seller = owner_scope(authorization)
    if seller is not None:
        data = data.model_copy(update={"assigned_to": seller})
    return ContactService.create_contact(data, created_by=user_id)


@router.get(
    "/{contact_id}",
    response_model=ContactResponse,
    summary="Detalle de un contacto",
)
def get_contact(contact_id: UUID, authorization: str | None = Header(None)) -> ContactResponse:
    """Obtiene el detalle de un contacto específico."""
    return authorize_contact(authorization, contact_id)


@router.put(
    "/{contact_id}",
    response_model=ContactResponse,
    summary="Actualizar datos de un contacto",
)
def update_contact(
    contact_id: UUID,
    data: ContactUpdate,
    authorization: str | None = Header(None),
) -> ContactResponse:
    """Modifica los campos provistos de un contacto. Reasignar el responsable es de los managers."""
    contact = authorize_contact(authorization, contact_id)
    if contact.assigned_to is not None:
        ensure_client_owner(authorization, contact.assigned_to)
    if "assigned_to" in data.model_fields_set:
        ensure_can_reassign(authorization, contact.assigned_to, data.assigned_to)
    return ContactService.update_contact(contact_id, data)


@router.delete(
    "/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Baja lógica de un contacto",
)
def delete_contact(contact_id: UUID, authorization: str | None = Header(None)):
    """Aplica baja lógica (Invariante 2: nunca borrado físico). Sólo el responsable o los managers."""
    contact = authorize_contact(authorization, contact_id)
    ensure_client_owner(authorization, contact.assigned_to)
    success = ContactService.delete_contact(contact_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se pudo dar de baja el contacto")
