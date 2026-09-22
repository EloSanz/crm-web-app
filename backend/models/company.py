from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CompanyStatus(str, Enum):
    POTENCIAL = "potencial"
    CLIENTE = "cliente"
    INACTIVO = "inactivo"
    NO_CONTACTAR = "no_contactar"


def format_cuit(value: str | None) -> str | None:
    """Con 11 dígitos queda como XX-XXXXXXXX-X; cualquier otro formato se deja como vino."""
    if value is None:
        return None
    digits = "".join(ch for ch in value if ch.isdigit())
    if len(digits) == 11:
        return f"{digits[:2]}-{digits[2:10]}-{digits[10]}"
    return value.strip() or None


class CompanyBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Razón social o nombre de la empresa contratista")
    cuit: str | None = Field(None, max_length=20, description="CUIT o identificación tributaria")
    industry: str | None = Field(
        None, max_length=100, description="Actividad o especialidad (ej. Hormigón, Refacciones, Obra civil)"
    )
    email: str | None = Field(None, max_length=255, description="Correo electrónico comercial")
    phone: str | None = Field(None, max_length=50, description="Teléfono principal")
    address: str | None = Field(None, description="Dirección comercial o depósito")
    website: str | None = Field(None, max_length=255, description="Sitio web o enlace comercial")
    status: CompanyStatus = Field(default=CompanyStatus.POTENCIAL, description="Estado comercial de la empresa")
    origin: str | None = Field(None, max_length=100, description="Origen de captación comercial")
    notes: str | None = Field(None, description="Observaciones o notas comerciales")
    assigned_to: UUID | None = Field(None, description="ID del ejecutivo comercial responsable")

    _cuit = field_validator("cuit")(format_cuit)


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    cuit: str | None = Field(None, max_length=20)
    industry: str | None = Field(None, max_length=100)
    email: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=50)
    address: str | None = None
    website: str | None = Field(None, max_length=255)
    status: CompanyStatus | None = None
    origin: str | None = Field(None, max_length=100)
    notes: str | None = None
    assigned_to: UUID | None = None

    _cuit = field_validator("cuit")(format_cuit)


class CompanyResponse(CompanyBase):
    id: UUID
    is_deleted: bool = False
    deleted_at: datetime | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
