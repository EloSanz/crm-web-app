from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ContactStatus(str, Enum):
    POTENCIAL = "potencial"
    CLIENTE = "cliente"
    INACTIVO = "inactivo"
    NO_CONTACTAR = "no_contactar"


class ContactBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100, description="Nombre del contacto / maestro de obra")
    last_name: str = Field(..., min_length=1, max_length=100, description="Apellido")
    company_id: UUID | None = Field(None, description="ID de la empresa contratista vinculada")
    document_number: str | None = Field(None, max_length=50, description="DNI o documento de identidad")
    email: str | None = Field(None, max_length=255, description="Correo electrónico personal o laboral")
    phone: str | None = Field(None, max_length=50, description="Teléfono celular o directo")
    job_title: str | None = Field(
        None, max_length=100, description="Cargo (ej. Maestro Mayor de Obra, Capataz, Compras)"
    )
    status: ContactStatus = Field(default=ContactStatus.POTENCIAL, description="Estado comercial del contacto")
    origin: str | None = Field(None, max_length=100, description="Origen de captación")
    notes: str | None = Field(None, description="Observaciones o notas")
    assigned_to: UUID | None = Field(None, description="ID del ejecutivo comercial asignado")


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    company_id: UUID | None = None
    document_number: str | None = Field(None, max_length=50)
    email: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=50)
    job_title: str | None = Field(None, max_length=100)
    status: ContactStatus | None = None
    origin: str | None = Field(None, max_length=100)
    notes: str | None = None
    assigned_to: UUID | None = None


class ContactResponse(ContactBase):
    id: UUID
    company_name: str | None = None
    is_deleted: bool = False
    deleted_at: datetime | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
