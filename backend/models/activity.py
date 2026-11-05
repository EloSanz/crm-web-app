from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ActivityType(str, Enum):
    """Tipos de actividad de sistema (el código los usa). El administrador puede sumar otros desde
    Configuración: por eso `activity_type` es texto y se valida contra el catálogo activo."""

    LLAMADA = "llamada"
    WHATSAPP = "whatsapp"
    REUNION = "reunion"
    VISITA_OBRA = "visita_obra"
    MOSTRADOR = "mostrador"
    EMAIL = "email"
    NOTA = "nota"
    PRESUPUESTO = "presupuesto"


SYSTEM_ACTIVITY_TYPES: frozenset[str] = frozenset(t.value for t in ActivityType)


class ActivityAttachment(BaseModel):
    """Archivo adjunto a un hecho comercial (foto de obra, remito, plano)."""

    url: str = Field(..., max_length=2048)
    name: str = Field(..., max_length=255)
    content_type: str | None = Field(None, max_length=120)
    size_bytes: int | None = Field(None, ge=0)


class ActivityBase(BaseModel):
    opportunity_id: UUID | None = Field(None, description="Oportunidad o presupuesto vinculado")
    contact_id: UUID | None = Field(None, description="Contacto vinculado")
    company_id: UUID | None = Field(None, description="Empresa contratista vinculada")
    activity_type: str = Field(
        ...,
        min_length=2,
        max_length=60,
        pattern=r"^[a-z0-9_-]+$",
        description="Código del tipo de interacción (catálogo de tipos de actividad)",
    )
    summary: str = Field(..., min_length=2, max_length=255, description="Título o resumen breve de la interacción")
    description: str | None = Field(None, description="Detalle extendido o resultado de la conversación")
    activity_date: datetime = Field(default_factory=datetime.utcnow, description="Fecha y hora en que ocurrió el hecho")
    attachments: list[ActivityAttachment] = Field(default_factory=list, description="Archivos adjuntos (URLs en S3)")

    @field_validator("activity_type", mode="before")
    @classmethod
    def normalize_type(cls, value: object) -> object:
        """Acepta las constantes ActivityType y normaliza el código a minúsculas."""
        if isinstance(value, Enum):
            value = value.value
        return value.strip().lower() if isinstance(value, str) else value


class ActivityCreate(ActivityBase):
    pass


class ActivityResponse(ActivityBase):
    id: UUID
    user_id: UUID
    user_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
