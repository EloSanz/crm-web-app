from datetime import datetime, timezone

from fastapi import APIRouter

from backend.config import settings
from backend.models.health import HealthCheckResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="Health check general de la API",
)
async def health_check() -> HealthCheckResponse:
    """Retorna el estado de operatividad del backend y versión de la API."""
    return HealthCheckResponse(
        status="healthy",
        app=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        timestamp=datetime.now(timezone.utc),
        database_connected=True,
    )


@router.get(
    "/api/health",
    response_model=HealthCheckResponse,
    summary="Health check bajo prefijo /api",
)
async def api_health_check() -> HealthCheckResponse:
    return await health_check()
