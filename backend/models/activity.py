from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ActivityType(str, Enum):
    LLAMADA = "llamada"
    WHATSAPP = "whatsapp"
    REUNION = "reunion"
    VISITA_OBRA = "visita_obra"
    MOSTRADOR = "mostrador"
    EMAIL = "email"
    NOTA = "nota"
    PRESUPUESTO = "presupuesto"


class ActivityBase(BaseModel):
    opportunity_id: UUID | None = Field(None, description="Oportunidad o presupuesto vinculado")
    contact_id: UUID | None = Field(None, description="Contacto vinculado")
    company_id: UUID | None = Field(None, description="Empresa contratista vinculada")
    activity_type: ActivityType = Field(..., description="Tipo de interacción comercial realizada")
    summary: str = Field(..., min_length=2, max_length=255, description="Título o resumen breve de la interacción")
    description: str | None = Field(None, description="Detalle extendido o resultado de la conversación")
    activity_date: datetime = Field(default_factory=datetime.utcnow, description="Fecha y hora en que ocurrió el hecho")


class ActivityCreate(ActivityBase):
    pass


class ActivityResponse(ActivityBase):
    id: UUID
    user_id: UUID
    user_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
