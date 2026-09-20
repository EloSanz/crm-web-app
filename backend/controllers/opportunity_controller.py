from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, status

from backend.controllers.auth_controller import decode_simple_token
from backend.database import get_supabase_client
from backend.models.opportunity import (
    OpportunityCreate,
    OpportunityResponse,
    OpportunityStatus,
    OpportunityUpdate,
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
) -> list[OpportunityResponse]:
    """Retorna los presupuestos activos ordenados cronológicamente."""
    return OpportunityService.get_opportunities(
        company_id=company_id,
        contact_id=contact_id,
        stage_id=stage_id,
        status_filter=status,
        q=q,
        limit=limit,
        offset=offset,
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
    """Crea un presupuesto para una obra/cliente con sus materiales."""
    user_id = _extract_user_id(authorization)
    return OpportunityService.create_opportunity(data, created_by=user_id)


@router.get(
    "/{opp_id}",
    response_model=OpportunityResponse,
    summary="Detalle de un presupuesto",
)
def get_opportunity(opp_id: UUID) -> OpportunityResponse:
    """Obtiene el detalle de un presupuesto y sus materiales cotizados."""
    return OpportunityService.get_opportunity_by_id(opp_id)


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
    """Modifica datos o etapa del presupuesto."""
    user_id = _extract_user_id(authorization)
    return OpportunityService.update_opportunity(opp_id, data, user_id=user_id)


@router.delete(
    "/{opp_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Baja lógica de un presupuesto",
)
def delete_opportunity(opp_id: UUID):
    """Aplica baja lógica (Invariante 2)."""
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
