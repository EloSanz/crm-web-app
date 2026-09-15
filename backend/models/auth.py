from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserRole(str):
    ADMIN = "admin"
    GERENTE = "gerente_comercial"
    VENDEDOR = "ejecutivo_ventas"


class LoginRequest(BaseModel):
    """Payload para autenticación por credenciales."""

    email: EmailStr = Field(..., json_schema_extra={"example": "admin@crm.com"})
    password: str = Field(..., min_length=4, json_schema_extra={"example": "admin123"})


class UserResponse(BaseModel):
    """Representación pública de un usuario autenticado."""

    id: str
    email: EmailStr
    full_name: str
    role: str
    is_active: bool = True
    created_at: datetime | None = None


class LoginResponse(BaseModel):
    """Respuesta exitosa de inicio de sesión."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
