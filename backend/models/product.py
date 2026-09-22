from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductCategory(str, Enum):
    AGLOMERANTES = "Aglomerantes"
    ARIDOS = "Áridos"
    HIERROS = "Hierros y Aceros"
    MAMPOSTERIA = "Mampostería"
    TECHOS_HIDRAULICA = "Techos e Hidráulica"
    SERVICIOS = "Servicios"


def wholesale_error(
    unit_price: Decimal | float | None,
    wholesale_price: Decimal | float | None,
    wholesale_min_qty: Decimal | float | None,
) -> str | None:
    """Regla del precio mayorista: va de a par con su cantidad mínima y nunca supera al minorista."""
    if (wholesale_price is None) != (wholesale_min_qty is None):
        return "Completá el precio mayorista y la cantidad desde la que aplica, o dejá los dos vacíos"
    if (
        wholesale_price is not None
        and unit_price is not None
        and Decimal(str(wholesale_price)) > Decimal(str(unit_price))
    ):
        return "El precio mayorista no puede superar al minorista"
    return None


class ProductBase(BaseModel):
    code: str = Field(..., min_length=2, max_length=50, description="Código de artículo (ej. CEM-50, HIE-12)")
    name: str = Field(..., min_length=2, max_length=255, description="Descripción comercial del material")
    category: ProductCategory = Field(..., description="Rubro o familia de materiales")
    unit: str = Field(default="unidad", max_length=50, description="Unidad de medida (bolsa 50kg, m3, barra 12m, etc.)")
    unit_price: Decimal = Field(default=Decimal("0.00"), ge=0, description="Precio minorista de referencia ($ ARS)")
    wholesale_price: Decimal | None = Field(
        None, gt=0, description="Precio mayorista ($ ARS); aplica desde wholesale_min_qty unidades"
    )
    wholesale_min_qty: Decimal | None = Field(
        None, gt=0, description="Cantidad desde la que aplica el precio mayorista (en la unidad del material)"
    )
    description: str | None = Field(None, description="Detalles técnicos o recomendaciones de uso")
    is_active: bool = Field(default=True, description="Habilitado para presupuestos")


class ProductCreate(ProductBase):
    """Alta de material. La regla mayorista (wholesale_error) se valida en el servicio con un 422 legible."""


class ProductUpdate(BaseModel):
    """Cambios parciales. La regla mayorista se valida en el servicio contra el material guardado."""

    code: str | None = Field(None, min_length=2, max_length=50)
    name: str | None = Field(None, min_length=2, max_length=255)
    category: ProductCategory | None = None
    unit: str | None = Field(None, max_length=50)
    unit_price: Decimal | None = Field(None, ge=0)
    wholesale_price: Decimal | None = Field(None, gt=0)
    wholesale_min_qty: Decimal | None = Field(None, gt=0)
    description: str | None = None
    is_active: bool | None = None


class ProductResponse(ProductBase):
    id: UUID
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Historial de cambios del catálogo (sólo lectura para el administrador)
# ---------------------------------------------------------------------------


class CatalogAuditAction(str, Enum):
    ALTA = "alta"
    EDICION = "edicion"
    BAJA = "baja"


class CatalogAuditEntry(BaseModel):
    id: UUID
    product_id: UUID | None = None
    product_code: str | None = None
    product_name: str | None = None
    action: CatalogAuditAction
    changes: dict[str, dict[str, Any]] = Field(
        default_factory=dict, description='Campos tocados: {campo: {"antes": x, "despues": y}}'
    )
    user_id: UUID | None = None
    user_name: str | None = None
    created_at: datetime
