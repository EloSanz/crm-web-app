from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, status

from backend.controllers.auth_controller import decode_simple_token
from backend.controllers.permissions import MANAGER_ROLES, ensure_owner, owner_scope, require_roles
from backend.database import get_supabase_client
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
stages_router = APIRouter(prefix="/api/stages", tags=["Etapas del Embudo"])


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
    q: str | None = Query(None, description="Búsqueda por título"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    authorization: str | None = Header(None),
) -> list[OpportunityResponse]:
    """Retorna los presupuestos activos ordenados cronológicamente. Cada vendedor ve sólo los suyos."""
    return OpportunityService.get_opportunities(
        company_id=company_id,
        contact_id=contact_id,
        stage_id=stage_id,
        status_filter=status,
        q=q,
        limit=limit,
        offset=offset,
        assigned_to=owner_scope(authorization),
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
    if data.assigned_to is not None and str(current.assigned_to) != str(data.assigned_to):
        require_roles(authorization, MANAGER_ROLES)
    return OpportunityService.update_opportunity(opp_id, data, user_id=user_id)


@router.delete(
    "/{opp_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Baja lógica de un presupuesto",
)
def delete_opportunity(opp_id: UUID, authorization: str | None = Header(None)):
    """Aplica baja lógica (Invariante 2)."""
    ensure_owner(authorization, OpportunityService.get_opportunity_by_id(opp_id).assigned_to)
    success = OpportunityService.delete_opportunity(opp_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo dar de baja el presupuesto",
        )


@stages_router.get(
    "",
    summary="Listar etapas del embudo comercial del corralón",
)
def list_stages():
    """Retorna las 6 etapas ordenadas por posición."""
    try:
        client = get_supabase_client()
        res = client.table("crm_stages").select("*").order("position").execute()
        if res.data:
            return res.data
    except Exception:
        pass

    # Fallback con las 6 etapas de corralón
    return [
        {
            "id": "11111111-0000-0000-0000-000000000001",
            "name": "Consulta Recibida",
            "slug": "consulta-recibida",
            "position": 1,
            "is_closed_won": False,
            "is_closed_lost": False,
            "color": "#38bdf8",
        },
        {
            "id": "11111111-0000-0000-0000-000000000002",
            "name": "Presupuesto en Preparación",
            "slug": "presupuesto-preparacion",
            "position": 2,
            "is_closed_won": False,
            "is_closed_lost": False,
            "color": "#818cf8",
        },
        {
            "id": "11111111-0000-0000-0000-000000000003",
            "name": "Presupuesto Enviado",
            "slug": "presupuesto-enviado",
            "position": 3,
            "is_closed_won": False,
            "is_closed_lost": False,
            "color": "#fbbf24",
        },
        {
            "id": "11111111-0000-0000-0000-000000000004",
            "name": "Negociación",
            "slug": "negociacion",
            "position": 4,
            "is_closed_won": False,
            "is_closed_lost": False,
            "color": "#f97316",
        },
        {
            "id": "11111111-0000-0000-0000-000000000005",
            "name": "Venta Concretada",
            "slug": "venta-concretada",
            "position": 5,
            "is_closed_won": True,
            "is_closed_lost": False,
            "color": "#22c55e",
        },
        {
            "id": "11111111-0000-0000-0000-000000000006",
            "name": "Perdida",
            "slug": "perdida",
            "position": 6,
            "is_closed_won": False,
            "is_closed_lost": True,
            "color": "#ef4444",
        },
    ]
