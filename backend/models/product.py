from datetime import datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductCategory(str, Enum):
    AGLOMERANTES = "Aglomerantes"
    ARIDOS = "Áridos"
    HIERROS = "Hierros y Aceros"
    MAMPOSTERIA = "Mampostería"
    TECHOS_HIDRAULICA = "Techos e Hidráulica"
    SERVICIOS = "Servicios"


class ProductBase(BaseModel):
    code: str = Field(..., min_length=2, max_length=50, description="Código de artículo (ej. CEM-50, HIE-12)")
    name: str = Field(..., min_length=2, max_length=255, description="Descripción comercial del material")
    category: ProductCategory = Field(..., description="Rubro o familia de materiales")
    unit: str = Field(default="unidad", max_length=50, description="Unidad de medida (bolsa 50kg, m3, barra 12m, etc.)")
    unit_price: Decimal = Field(
        default=Decimal("0.00"), ge=0, description="Precio unitario estimado de referencia ($ ARS)"
    )
    description: str | None = Field(None, description="Detalles técnicos o recomendaciones de uso")
    is_active: bool = Field(default=True, description="Habilitado para presupuestos")


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    code: str | None = Field(None, min_length=2, max_length=50)
    name: str | None = Field(None, min_length=2, max_length=255)
    category: ProductCategory | None = None
    unit: str | None = Field(None, max_length=50)
    unit_price: Decimal | None = Field(None, ge=0)
    description: str | None = None
    is_active: bool | None = None


class ProductResponse(ProductBase):
    id: UUID
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
