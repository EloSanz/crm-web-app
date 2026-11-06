from datetime import datetime, timedelta, timezone
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_core import PydanticCustomError


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
    description: str | None = Field(None, description="Detalle extendido de la interacción")
    result: str | None = Field(None, description="Resultado de la interacción (qué se logró o acordó)")
    activity_date: datetime = Field(default_factory=datetime.utcnow, description="Fecha y hora en que ocurrió el hecho")
    attachments: list[ActivityAttachment] = Field(default_factory=list, description="Archivos adjuntos (URLs en S3)")

    @field_validator("activity_type", mode="before")
    @classmethod
    def normalize_type(cls, value: object) -> object:
        """Acepta las constantes ActivityType y normaliza el código a minúsculas."""
        if isinstance(value, Enum):
            value = value.value
        return value.strip().lower() if isinstance(value, str) else value


# Margen para relojes desfasados entre el navegador y el servidor.
FUTURE_TOLERANCE = timedelta(minutes=5)


class ActivityCreate(ActivityBase):
    description: str | None = Field(None, max_length=4000, description="Detalle extendido de la interacción")
    result: str | None = Field(None, max_length=1000, description="Resultado de la interacción")

    @field_validator("activity_date")
    @classmethod
    def not_in_future(cls, value: datetime) -> datetime:
        """La actividad es un hecho que ya ocurrió (regla 8: fecha real): no puede tener fecha futura."""
        aware = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if aware > datetime.now(timezone.utc) + FUTURE_TOLERANCE:
            # Error propio: el mensaje llega al usuario tal cual (sin el «Value error,» de Pydantic).
            raise PydanticCustomError(
                "fecha_futura", "La fecha de la actividad no puede ser futura: registrá un hecho que ya ocurrió."
            )
        return value


class ActivityResponse(ActivityBase):
    id: UUID
    user_id: UUID
    user_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
