from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class HistoryKind(str, Enum):
    ACTIVIDAD = "actividad"
    ETAPA = "etapa"
    VERSION = "version"
    PRESUPUESTO = "presupuesto"
    MENSAJE = "mensaje"


class HistoryEntry(BaseModel):
    """Un hecho del historial comercial de un cliente, con quién lo hizo y dónde verlo."""

    id: str = Field(..., description="Clave estable: <tipo>-<id de origen>")
    kind: HistoryKind
    kind_label: str
    at: datetime
    title: str
    detail: str | None = None
    activity_type: str | None = Field(None, description="Sólo en actividades: llamada, visita_obra, etc.")
    result: str | None = Field(None, description="Sólo en actividades: resultado de la interacción")
    opportunity_id: UUID | None = None
    opportunity_title: str | None = None
    source_id: str | None = None
    user_name: str | None = Field(None, description="Quién lo hizo (o el remitente, en mensajes del cliente)")
    link: str | None = Field(None, description="Seguimiento del presupuesto, con el hecho resaltado")


class HistoryPage(BaseModel):
    items: list[HistoryEntry]
    total: int = Field(..., description="Cantidad total con el filtro aplicado")
    limit: int
    offset: int
    has_more: bool
    counts: dict[str, int] = Field(default_factory=dict, description="Cantidad por tipo, sin filtrar")
