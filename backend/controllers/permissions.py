from uuid import UUID

from fastapi import HTTPException, status

from backend.controllers.auth_controller import decode_simple_token

MANAGER_ROLES = {"admin", "gerente_comercial"}


def session_from_header(authorization: str | None) -> dict:
    """Datos de la sesión (sub, role, name) a partir del header Authorization."""
    if not authorization:
        return {}
    try:
        return decode_simple_token(authorization)
    except HTTPException:
        return {}


def session_user_id(authorization: str | None) -> UUID | None:
    sub = session_from_header(authorization).get("sub")
    try:
        return UUID(sub) if sub else None
    except ValueError:
        return None


def require_roles(authorization: str | None, roles: set[str]) -> dict:
    """Corta con 403 si el rol de la sesión no está habilitado para la acción."""
    session = session_from_header(authorization)
    if session.get("role") not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu rol no tiene permiso para esta acción",
        )
    return session


SELLER_ROLE = "ejecutivo_ventas"


def owner_scope(authorization: str | None) -> UUID | None:
    """Para un vendedor devuelve su id (sólo ve lo propio); para admin y responsable comercial, None (ve todo)."""
    session = session_from_header(authorization)
    if session.get("role") != SELLER_ROLE:
        return None
    return session_user_id(authorization)


def ensure_owner(authorization: str | None, assigned_to: UUID | str | None) -> None:
    """Corta con 403 si un vendedor intenta ver o tocar un presupuesto de otro."""
    scope = owner_scope(authorization)
    if scope is not None and str(scope) != str(assigned_to):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este presupuesto está asignado a otro vendedor",
        )


# ---------------------------------------------------------------------------
# Acceso a un cliente (historial comercial y «Ponete al día»)
# ---------------------------------------------------------------------------

_CLIENT_FORBIDDEN = "Sólo podés consultar clientes asignados a vos o con presupuestos tuyos"


def authorize_company(authorization: str | None, company_id: UUID):
    """Admin y responsable comercial ven cualquier cliente. Un vendedor, los clientes asignados a él
    o con algún presupuesto suyo (el caso típico: heredó la constructora). 404 si no existe, 403 si no."""
    from backend.services.company_service import CompanyService
    from backend.services.opportunity_service import OpportunityService

    session = session_from_header(authorization)
    company = CompanyService.get_company_by_id(company_id)
    if session.get("role") in MANAGER_ROLES:
        return company
    me = session_user_id(authorization)
    if me and str(company.assigned_to) == str(me):
        return company
    if me and OpportunityService.get_opportunities(company_id=company_id, assigned_to=me, limit=1):
        return company
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_CLIENT_FORBIDDEN)


def authorize_contact(authorization: str | None, contact_id: UUID):
    """Mismo criterio para un contacto: asignado al vendedor, o su empresa, o algún presupuesto suyo."""
    from backend.services.company_service import CompanyService
    from backend.services.contact_service import ContactService
    from backend.services.opportunity_service import OpportunityService

    session = session_from_header(authorization)
    contact = ContactService.get_contact_by_id(contact_id)
    if session.get("role") in MANAGER_ROLES:
        return contact
    me = session_user_id(authorization)
    if me and str(contact.assigned_to) == str(me):
        return contact
    if me and contact.company_id:
        try:
            if str(CompanyService.get_company_by_id(contact.company_id).assigned_to) == str(me):
                return contact
        except HTTPException:
            pass
    if me and OpportunityService.get_opportunities(contact_id=contact_id, assigned_to=me, limit=1):
        return contact
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_CLIENT_FORBIDDEN)
