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


class ClientScope:
    """Qué clientes ve un vendedor: los asignados a él, los que tienen presupuestos suyos y los que
    todavía no tienen responsable (cartera libre). Admin y responsable comercial ven todo (scope None)."""

    def __init__(self, me: UUID):
        from backend.services.opportunity_service import OpportunityService

        self.me = str(me)
        self.company_ids: set[str] = set()
        self.contact_ids: set[str] = set()
        # Clientes que ya trabaja otro vendedor (tienen presupuestos suyos): no son cartera libre.
        self.taken_companies: set[str] = set()
        self.taken_contacts: set[str] = set()
        # Obras con presupuestos del vendedor (las ve siempre) y obras que trabaja otro vendedor.
        self.project_ids: set[str] = set()
        self.taken_projects: set[str] = set()
        # Caché de clientes consultados al decidir qué obras ve (evita repetir lecturas en el listado).
        self._companies: dict[str, object] = {}
        self._contacts: dict[str, object] = {}
        for o in OpportunityService.get_opportunities(limit=1000):
            mine = str(o.assigned_to) == self.me
            if o.company_id:
                (self.company_ids if mine else self.taken_companies).add(str(o.company_id))
            if o.contact_id:
                (self.contact_ids if mine else self.taken_contacts).add(str(o.contact_id))
            if getattr(o, "project_id", None):
                (self.project_ids if mine else self.taken_projects).add(str(o.project_id))

    def sees_company(self, company) -> bool:
        if str(company.id) in self.company_ids or str(company.assigned_to) == self.me:
            return True
        return company.assigned_to is None and str(company.id) not in self.taken_companies

    def sees_contact(self, contact, company=None) -> bool:
        if str(contact.id) in self.contact_ids or str(contact.assigned_to) == self.me:
            return True
        if contact.company_id and str(contact.company_id) in self.company_ids:
            return True
        if contact.assigned_to or str(contact.id) in self.taken_contacts:
            return False
        # Contacto sin responsable: se ve si su empresa también es visible (o no tiene empresa).
        return company is None or self.sees_company(company)

    def company(self, company_id):
        """Empresa por id (None si no existe o está dada de baja), con caché."""
        from backend.services.company_service import CompanyService

        key = str(company_id)
        if key not in self._companies:
            try:
                self._companies[key] = CompanyService.get_company_by_id(company_id)
            except HTTPException:
                self._companies[key] = None
        return self._companies[key]

    def contact(self, contact_id):
        """Contacto por id (None si no existe o está dado de baja), con caché."""
        from backend.services.contact_service import ContactService

        key = str(contact_id)
        if key not in self._contacts:
            try:
                self._contacts[key] = ContactService.get_contact_by_id(contact_id)
            except HTTPException:
                self._contacts[key] = None
        return self._contacts[key]

    def sees_project(self, project) -> bool:
        """Una obra se ve si tiene presupuestos del vendedor o si su cliente (empresa o contacto) le es
        visible. Una obra sin cliente (datos viejos) es cartera libre, salvo que la trabaje otro vendedor."""
        if str(project.id) in self.project_ids:
            return True
        if not project.company_id and not project.contact_id:
            return str(project.id) not in self.taken_projects
        if project.company_id:
            company = self.company(project.company_id)
            if company is not None and self.sees_company(company):
                return True
        if project.contact_id:
            contact = self.contact(project.contact_id)
            if contact is not None:
                company = self.company(contact.company_id) if contact.company_id else None
                if self.sees_contact(contact, company):
                    return True
        return False


def client_scope(authorization: str | None) -> ClientScope | None:
    session = session_from_header(authorization)
    if session.get("role") in MANAGER_ROLES:
        return None
    me = session_user_id(authorization)
    if not me:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Iniciá sesión nuevamente")
    return ClientScope(me)


def ensure_can_reassign(authorization: str | None, current, new) -> None:
    """Asignar, reasignar o quitar el responsable de un cliente: sólo admin y responsable comercial."""
    if (str(new) if new else None) == (str(current) if current else None):
        return
    require_roles(authorization, MANAGER_ROLES)


def authorize_company(authorization: str | None, company_id: UUID):
    """Admin y responsable comercial ven cualquier cliente. Un vendedor, los asignados a él, los que
    tienen presupuestos suyos (el caso típico: heredó la constructora) y los que no tienen responsable.
    404 si no existe, 403 si no."""
    from backend.services.company_service import CompanyService

    company = CompanyService.get_company_by_id(company_id)
    scope = client_scope(authorization)
    if scope is None or scope.sees_company(company):
        return company
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_CLIENT_FORBIDDEN)


def authorize_contact(authorization: str | None, contact_id: UUID):
    """Mismo criterio para un contacto: asignado al vendedor, de una empresa visible, con algún
    presupuesto suyo, o sin responsable."""
    from backend.services.company_service import CompanyService
    from backend.services.contact_service import ContactService

    contact = ContactService.get_contact_by_id(contact_id)
    scope = client_scope(authorization)
    if scope is None:
        return contact
    company = None
    if contact.company_id:
        try:
            company = CompanyService.get_company_by_id(contact.company_id)
        except HTTPException:
            company = None
    if scope.sees_contact(contact, company):
        return contact
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_CLIENT_FORBIDDEN)


def ensure_client_owner(authorization: str | None, assigned_to) -> None:
    """Editar o dar de baja un cliente: su responsable, o admin / responsable comercial.
    Un cliente sin responsable lo edita cualquiera que lo vea, pero la baja es sólo de los managers."""
    if session_from_header(authorization).get("role") in MANAGER_ROLES:
        return
    if assigned_to is None or str(assigned_to) != str(session_user_id(authorization)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sólo el responsable del cliente, el administrador o el responsable comercial pueden hacer esto",
        )


# ---------------------------------------------------------------------------
# Acceso a una obra (pertenece a un cliente: empresa y/o contacto)
# ---------------------------------------------------------------------------

_PROJECT_FORBIDDEN = "Sólo podés consultar obras de clientes asignados a vos o con presupuestos tuyos"


def authorize_project(authorization: str | None, project_id: UUID):
    """Admin y responsable comercial ven cualquier obra. Un vendedor, las de clientes que ve (asignados
    a él, con presupuestos suyos o de la cartera libre) y las que tienen presupuestos suyos.
    404 si no existe, 403 si no."""
    from backend.services.project_service import ProjectService

    project = ProjectService.get_project_by_id(project_id)
    scope = client_scope(authorization)
    if scope is None or scope.sees_project(project):
        return project
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_PROJECT_FORBIDDEN)


def project_client_owner(company_id, contact_id):
    """Responsable del cliente de una obra: el de la empresa; si la empresa no tiene, el del contacto.
    None si el cliente no tiene responsable (o la obra no tiene cliente)."""
    from backend.services.company_service import CompanyService
    from backend.services.contact_service import ContactService

    for get, client_id in (
        (CompanyService.get_company_by_id, company_id),
        (ContactService.get_contact_by_id, contact_id),
    ):
        if not client_id:
            continue
        try:
            owner = get(client_id).assigned_to
        except HTTPException:
            continue
        if owner:
            return owner
    return None
