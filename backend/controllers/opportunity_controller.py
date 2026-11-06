from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, status

from backend.controllers.auth_controller import decode_simple_token
from backend.controllers.pagination import LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT
from backend.controllers.permissions import (
    MANAGER_ROLES,
    authorize_company,
    authorize_contact,
    ensure_owner,
    owner_scope,
    require_roles,
    session_from_header,
)

# Las etapas viven en stage_controller; se reexportan para no romper los imports existentes.
from backend.controllers.stage_controller import list_stages  # noqa: F401
from backend.controllers.stage_controller import router as stages_router  # noqa: F401
from backend.models.opportunity import (
    OpportunityCreate,
    OpportunityResponse,
    OpportunityStatus,
    OpportunityUpdate,
    OpportunityVersionResponse,
    TimelineEvent,
)
from backend.services.opportunity_service import OpportunityService

router = APIRouter(prefix="/api/opportunities", tags=["Oportunidades / Presupuestos"])


def _ensure_can_touch_closed(authorization: str | None, opp: OpportunityResponse) -> None:
    """Regla 14: un presupuesto ganado o perdido sólo lo modifican o reabren admin y responsable comercial."""
    if opp.status == OpportunityStatus.ABIERTA:
        return
    if session_from_header(authorization).get("role") not in MANAGER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El presupuesto está cerrado: sólo el administrador o el responsable comercial lo pueden modificar o reabrir.",
        )


def _authorize_client(authorization: str | None, data, current: OpportunityResponse | None = None) -> None:
    """Un vendedor sólo presupuesta a clientes que puede ver (los suyos o la cartera libre). En una
    edición se autoriza sólo el cliente nuevo: el que ya tenía el presupuesto propio sigue valiendo."""
    for field, authorize in (("company_id", authorize_company), ("contact_id", authorize_contact)):
        new = getattr(data, field)
        if not new or (current is not None and str(new) == str(getattr(current, field))):
            continue
        authorize(authorization, new)


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
    response_model=list[OpportunityResponse],
    summary="Listar presupuestos u oportunidades activas",
)
def list_opportunities(
    company_id: UUID | None = Query(None, description="Filtrar por empresa"),
    contact_id: UUID | None = Query(None, description="Filtrar por contacto"),
    stage_id: UUID | None = Query(None, description="Filtrar por etapa"),
    status: OpportunityStatus | None = Query(None, description="Filtrar por estado"),
    assigned_to: UUID | None = Query(None, description="Filtrar por responsable (sólo admin y responsable comercial)"),
    origin: str | None = Query(None, max_length=100, description="Filtrar por origen del presupuesto"),
    q: str | None = Query(None, description="Búsqueda por título"),
    limit: int = Query(LIST_DEFAULT_LIMIT, ge=1, le=LIST_MAX_LIMIT),
    offset: int = Query(0, ge=0),
    authorization: str | None = Header(None),
) -> list[OpportunityResponse]:
    """Retorna los presupuestos activos ordenados cronológicamente. Cada vendedor ve sólo los suyos."""
    # El vendedor queda siempre limitado a lo suyo: su filtro por responsable se ignora.
    scope = owner_scope(authorization)
    return OpportunityService.get_opportunities(
        company_id=company_id,
        contact_id=contact_id,
        stage_id=stage_id,
        status_filter=status,
        q=q,
        limit=limit,
        offset=offset,
        assigned_to=scope or assigned_to,
        origin=origin.strip() if origin and origin.strip() else None,
    )


@router.post(
    "",
    response_model=OpportunityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear un nuevo presupuesto comercial",
)
def create_opportunity(
    data: OpportunityCreate,
    authorization: str | None = Header(None),
) -> OpportunityResponse:
    """Crea un presupuesto para una obra/cliente con sus materiales. El vendedor siempre queda como responsable."""
    user_id = _extract_user_id(authorization)
    _authorize_client(authorization, data)
    if owner_scope(authorization) is not None or data.assigned_to is None:
        data.assigned_to = user_id or data.assigned_to
    return OpportunityService.create_opportunity(data, created_by=user_id)


@router.get(
    "/{opp_id}",
    response_model=OpportunityResponse,
    summary="Detalle de un presupuesto",
)
def get_opportunity(opp_id: UUID, authorization: str | None = Header(None)) -> OpportunityResponse:
    """Obtiene el detalle de un presupuesto y sus materiales cotizados."""
    opp = OpportunityService.get_opportunity_by_id(opp_id)
    ensure_owner(authorization, opp.assigned_to)
    return opp


@router.get(
    "/{opp_id}/versions",
    response_model=list[OpportunityVersionResponse],
    summary="Historial de versiones de materiales de un presupuesto",
)
def get_opportunity_versions(
    opp_id: UUID, authorization: str | None = Header(None)
) -> list[OpportunityVersionResponse]:
    """Cada renegociación de materiales o descuento deja una versión con la foto completa."""
    ensure_owner(authorization, OpportunityService.get_opportunity_by_id(opp_id).assigned_to)
    return OpportunityService.get_versions(opp_id)


@router.get(
    "/{opp_id}/timeline",
    response_model=list[TimelineEvent],
    summary="Hitos del presupuesto: cambios de etapa y versiones",
)
def get_opportunity_timeline(opp_id: UUID, authorization: str | None = Header(None)) -> list[TimelineEvent]:
    """Hitos con fecha y hora para el seguimiento."""
    ensure_owner(authorization, OpportunityService.get_opportunity_by_id(opp_id).assigned_to)
    return OpportunityService.get_timeline(opp_id)


@router.put(
    "/{opp_id}",
    response_model=OpportunityResponse,
    summary="Actualizar un presupuesto o cambiar de etapa",
)
def update_opportunity(
    opp_id: UUID,
    data: OpportunityUpdate,
    authorization: str | None = Header(None),
) -> OpportunityResponse:
    """Modifica datos o etapa del presupuesto. Reasignar el responsable queda para administrador y responsable comercial."""
    user_id = _extract_user_id(authorization)
    current = OpportunityService.get_opportunity_by_id(opp_id)
    ensure_owner(authorization, current.assigned_to)
    _ensure_can_touch_closed(authorization, current)
    if data.assigned_to is not None and str(current.assigned_to) != str(data.assigned_to):
        require_roles(authorization, MANAGER_ROLES)
    _authorize_client(authorization, data, current)
    return OpportunityService.update_opportunity(opp_id, data, user_id=user_id)


@router.delete(
    "/{opp_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Baja lógica de un presupuesto",
)
def delete_opportunity(opp_id: UUID, authorization: str | None = Header(None)):
    """Aplica baja lógica (Invariante 2). Sólo los managers: el vendedor cierra sus presupuestos como perdidos,
    así queda el motivo y cuentan en los indicadores, en vez de desaparecer."""
    require_roles(authorization, MANAGER_ROLES)
    current = OpportunityService.get_opportunity_by_id(opp_id)
    ensure_owner(authorization, current.assigned_to)
    _ensure_can_touch_closed(authorization, current)
    success = OpportunityService.delete_opportunity(opp_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo dar de baja el presupuesto",
        )
