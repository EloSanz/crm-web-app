from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class CrmRole(str, Enum):
    ADMIN = "admin"
    GERENTE = "gerente_comercial"
    VENDEDOR = "ejecutivo_ventas"


class CrmUserBase(BaseModel):
    email: EmailStr = Field(..., description="Correo del usuario del CRM")
    full_name: str = Field(..., min_length=2, max_length=255, description="Nombre y apellido")
    role: CrmRole = Field(default=CrmRole.VENDEDOR, description="Rol dentro del CRM")
    is_active: bool = Field(default=True, description="Baja lógica: False deshabilita el acceso")


class CrmUserCreate(CrmUserBase):
    pass


class CrmUserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = Field(None, min_length=2, max_length=255)
    role: CrmRole | None = None
    is_active: bool | None = None


class CrmUserResponse(CrmUserBase):
    id: UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None
