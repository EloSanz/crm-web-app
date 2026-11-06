from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Header, Query

from backend.controllers.permissions import MANAGER_ROLES, require_roles
from backend.models.audit import AuditPage
from backend.services.audit_service import AuditService

router = APIRouter(prefix="/api/audit", tags=["Auditoría"])


@router.get("", response_model=AuditPage, summary="Auditoría de cambios (admin y responsable comercial)")
def list_audit(
    entity: str | None = Query(None, description="empresa, contacto, presupuesto, obra, producto, usuario, etapa…"),
    entity_id: str | None = Query(None, description="Id del registro tocado"),
    user_id: UUID | None = Query(None, description="Usuario que hizo el cambio"),
    desde: datetime | None = Query(None, description="Desde esta fecha y hora (ISO 8601)"),
    hasta: datetime | None = Query(None, description="Hasta esta fecha y hora (ISO 8601)"),
    limit: int = Query(10, ge=1, le=200),
    offset: int = Query(0, ge=0),
    authorization: str | None = Header(None),
) -> AuditPage:
    """Quién cambió qué y cuándo, de lo más nuevo a lo más viejo (regla 15). Sólo los managers la consultan."""
    require_roles(authorization, MANAGER_ROLES)
    return AuditService.list(
        entity=entity,
        entity_id=entity_id,
        user_id=user_id,
        desde=desde,
        hasta=hasta,
        limit=limit,
        offset=offset,
    )
