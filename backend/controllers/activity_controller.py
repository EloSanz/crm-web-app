from uuid import UUID

from fastapi import APIRouter, Header, Query, status

from backend.controllers.auth_controller import decode_simple_token
from backend.controllers.permissions import ensure_owner, owner_scope
from backend.models.activity import ActivityCreate, ActivityResponse
from backend.services.activity_service import ActivityService
from backend.services.opportunity_service import OpportunityService

router = APIRouter(tags=["Actividades Comerciales y Métrica NSM"])


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
    "/api/opportunities/{opportunity_id}/activities",
    response_model=list[ActivityResponse],
    summary="Listar línea de tiempo / actividades de una oportunidad",
)
def get_opportunity_activities(
    opportunity_id: UUID, authorization: str | None = Header(None)
) -> list[ActivityResponse]:
    """Retorna los hechos comerciales ordenados cronológicamente inverso."""
    ensure_owner(authorization, OpportunityService.get_opportunity_by_id(opportunity_id).assigned_to)
    return ActivityService.get_activities_by_opportunity(opportunity_id)


@router.post(
    "/api/activities",
    response_model=ActivityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar una nueva interacción comercial (llamada, visita, nota)",
)
def create_activity(
    data: ActivityCreate,
    authorization: str | None = Header(None),
) -> ActivityResponse:
    """Registra un hecho comercial inmutable respaldando el seguimiento del presupuesto."""
    user_id = _extract_user_id(authorization)
    if data.opportunity_id:
        ensure_owner(authorization, OpportunityService.get_opportunity_by_id(data.opportunity_id).assigned_to)
    return ActivityService.create_activity(data, user_id=user_id)


@router.get(
    "/api/metrics/active-pipeline",
    summary="North Star Metric (NSM): Oportunidades activas con seguimiento reciente",
)
def get_active_pipeline_metric(
    days: int = Query(7, ge=1, le=90, description="Ventana de días para considerar la oportunidad activa"),
    authorization: str | None = Header(None),
):
    """
    Retorna el Pipeline Activo Real del corralón:
    Oportunidades abiertas que registran actividad en los últimos N días vs presupuestos estancados.
    """
    return OpportunityService.get_active_pipeline_metric(window_days=days, assigned_to=owner_scope(authorization))
