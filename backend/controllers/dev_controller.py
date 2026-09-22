from fastapi import APIRouter, Header, HTTPException, Query, status

from backend.controllers.permissions import require_roles
from backend.services import demo_seed

router = APIRouter(prefix="/api/dev", tags=["Desarrollo local"])


@router.post("/demo", summary="Cargar datos de demostración (sólo modo local, sin Supabase)")
def load_demo_data(
    reset: bool = Query(False, description="Vaciar los datos locales antes de cargar"),
    authorization: str | None = Header(None),
) -> dict:
    """Arma un año de actividad del corralón para ver indicadores con datos. No existe en producción."""
    if not demo_seed.is_local_mode():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No disponible")
    require_roles(authorization, {"admin"})
    if reset:
        demo_seed.reset()
    return demo_seed.seed()
