from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AuditEntry(BaseModel):
    """Un cambio hecho por la API: quién, cuándo, sobre qué entidad y con qué datos (regla 15)."""

    id: str
    user_id: str | None = None
    user_name: str | None = None
    user_role: str | None = None
    action: str = Field(..., description="crear, modificar, dar_de_baja u otra")
    method: str
    path: str
    entity: str = Field(..., description="empresa, contacto, presupuesto, obra, producto, usuario, etapa, catálogo…")
    entity_id: str | None = None
    summary: str | None = None
    changes: Any = Field(default_factory=dict, description="Cuerpo del pedido con secretos redactados")
    status_code: int | None = None
    created_at: datetime


class AuditPage(BaseModel):
    """Página de la auditoría, de lo más nuevo a lo más viejo."""

    items: list[AuditEntry]
    total: int
    limit: int
    offset: int
