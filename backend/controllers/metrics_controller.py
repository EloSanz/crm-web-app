from uuid import UUID

from fastapi import APIRouter, Header, Query

from backend.controllers.permissions import MANAGER_ROLES, require_roles
from backend.services.metrics_service import MetricsService

router = APIRouter(prefix="/api/metrics", tags=["Indicadores operativos"])

# Administración ve todo; el responsable comercial, lo comercial; el vendedor, ningún indicador.
ADMIN_ONLY = {"admin"}

Days = Query(90, description="Período en días: 30, 90, 180 o 365")


@router.get("/sales", summary="Ventas: vendido y perdido por período, tasa de cierre, ticket, ciclo y motivos")
def sales(days: int = Days, authorization: str | None = Header(None)) -> dict:
    require_roles(authorization, MANAGER_ROLES)
    return MetricsService.sales(days)


@router.get("/sellers", summary="Vendedores: pipeline, vendido, cierre, estancados y contactos por responsable")
def sellers(days: int = Days, authorization: str | None = Header(None)) -> dict:
    require_roles(authorization, MANAGER_ROLES)
    return MetricsService.sellers(days)


@router.get("/sellers/{user_id}", summary="Detalle de un vendedor: ventas, tiempos por etapa, contactos y abiertos")
def seller_detail(user_id: UUID, days: int = Days, authorization: str | None = Header(None)) -> dict:
    require_roles(authorization, MANAGER_ROLES)
    return MetricsService.seller_detail(user_id, days)


@router.get("/stages", summary="Etapas: días por etapa, matriz vendedor × etapa, conversión y abiertos por antigüedad")
def stages(days: int = Days, authorization: str | None = Header(None)) -> dict:
    require_roles(authorization, MANAGER_ROLES)
    return MetricsService.stages(days)


@router.get("/quotes", summary="Presupuestos: montos, antigüedad, salud, renegociados, descuentos y materiales")
def quotes(days: int = Days, authorization: str | None = Header(None)) -> dict:
    require_roles(authorization, MANAGER_ROLES)
    return MetricsService.quotes(days)


@router.get("/quotes/{opportunity_id}", summary="Detalle de un presupuesto: tiempo por etapa, contactos y versiones")
def quote_detail(opportunity_id: UUID, days: int = Days, authorization: str | None = Header(None)) -> dict:
    require_roles(authorization, MANAGER_ROLES)
    return MetricsService.quote_detail(opportunity_id, days)


@router.get("/clients", summary="Clientes: ranking, nuevos, recompra, estado y origen (administración)")
def clients(days: int = Days, authorization: str | None = Header(None)) -> dict:
    require_roles(authorization, ADMIN_ONLY)
    return MetricsService.clients(days)


@router.get("/clients/{company_id}", summary="Detalle de un cliente (administración)")
def client_detail(company_id: UUID, days: int = Days, authorization: str | None = Header(None)) -> dict:
    require_roles(authorization, ADMIN_ONLY)
    return MetricsService.client_detail(company_id, days)


@router.get("/projects", summary="Obras: presupuestos y ventas por obra, tipo y estado (administración)")
def projects(days: int = Days, authorization: str | None = Header(None)) -> dict:
    require_roles(authorization, ADMIN_ONLY)
    return MetricsService.projects(days)


@router.get("/projects/{project_id}", summary="Detalle de una obra (administración)")
def project_detail(project_id: UUID, days: int = Days, authorization: str | None = Header(None)) -> dict:
    require_roles(authorization, ADMIN_ONLY)
    return MetricsService.project_detail(project_id, days)


@router.get("/contact", summary="Contacto: actividades por canal y semana, por vendedor y primera respuesta")
def contact(days: int = Days, authorization: str | None = Header(None)) -> dict:
    require_roles(authorization, MANAGER_ROLES)
    return MetricsService.contact(days)


@router.get("/catalog", summary="Catálogo: materiales más cotizados y vendidos, por rubro (administración)")
def catalog(days: int = Days, authorization: str | None = Header(None)) -> dict:
    require_roles(authorization, ADMIN_ONLY)
    return MetricsService.catalog(days)
