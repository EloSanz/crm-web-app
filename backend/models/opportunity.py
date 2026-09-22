from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OpportunityStatus(str, Enum):
    ABIERTA = "abierta"
    GANADA = "ganada"
    PERDIDA = "perdida"


class PriceTier(str, Enum):
    MINORISTA = "minorista"
    MAYORISTA = "mayorista"
    MANUAL = "manual"


class OpportunityItemBase(BaseModel):
    product_id: UUID | None = None
    product_name: str = Field(..., min_length=2, max_length=255)
    unit: str = Field(default="unidad", max_length=50)
    quantity: Decimal = Field(default=Decimal("1.00"), gt=0)
    unit_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    subtotal: Decimal = Field(default=Decimal("0.00"), ge=0)
    # Negociación: precio de lista del catálogo, escala aplicada y descuento por renglón.
    list_price: Decimal | None = Field(None, ge=0, description="Precio minorista de catálogo al cotizar")
    price_tier: PriceTier = Field(default=PriceTier.MINORISTA, description="Escala de precio aplicada")
    discount_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100, description="Descuento del renglón (%)")


class OpportunityItemCreate(BaseModel):
    product_id: UUID | None = None
    product_name: str = Field(..., min_length=2, max_length=255)
    unit: str = Field(default="unidad", max_length=50)
    quantity: Decimal = Field(default=Decimal("1.00"), gt=0)
    unit_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    list_price: Decimal | None = Field(None, ge=0)
    price_tier: PriceTier = PriceTier.MINORISTA
    discount_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)


class OpportunityItemResponse(OpportunityItemBase):
    id: UUID
    opportunity_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OpportunityBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255, description="Título o descripción del presupuesto")
    company_id: UUID | None = Field(None, description="Empresa contratista vinculada")
    contact_id: UUID | None = Field(None, description="Contacto o maestro de obra vinculado")
    project_id: UUID | None = Field(None, description="Obra o locación vinculada")
    assigned_to: UUID = Field(..., description="ID del ejecutivo de ventas responsable")
    stage_id: UUID = Field(..., description="ID de la etapa en el embudo comercial")
    status: OpportunityStatus = Field(default=OpportunityStatus.ABIERTA, description="Estado de la oportunidad")
    estimated_value: Decimal = Field(default=Decimal("0.00"), ge=0, description="Monto total presupuestado")
    currency: str = Field(default="ARS", max_length=10)
    expected_close_date: date | None = Field(None, description="Fecha estimada de concreción de la venta")
    delivery_location: str | None = Field(None, description="Dirección de entrega o referencia de obra")
    loss_reason: str | None = Field(None, description="Motivo de pérdida si la oportunidad no se concreta")
    discount_pct: Decimal = Field(
        default=Decimal("0"), ge=0, le=100, description="Descuento general del presupuesto (%)"
    )
    current_version: int = Field(default=1, ge=1, description="Versión vigente de los materiales cotizados")


class OpportunityCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    company_id: UUID | None = None
    contact_id: UUID | None = None
    project_id: UUID | None = None
    assigned_to: UUID | None = Field(None, description="Si falta, queda asignado a quien lo crea")
    stage_id: UUID
    status: OpportunityStatus = OpportunityStatus.ABIERTA
    estimated_value: Decimal | None = None
    currency: str = "ARS"
    expected_close_date: date | None = None
    delivery_location: str | None = None
    discount_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    items: list[OpportunityItemCreate] = Field(default_factory=list, description="Lista de materiales presupuestados")


class OpportunityUpdate(BaseModel):
    title: str | None = Field(None, min_length=2, max_length=255)
    company_id: UUID | None = None
    contact_id: UUID | None = None
    project_id: UUID | None = None
    assigned_to: UUID | None = None
    stage_id: UUID | None = None
    status: OpportunityStatus | None = None
    estimated_value: Decimal | None = None
    expected_close_date: date | None = None
    delivery_location: str | None = None
    loss_reason: str | None = None
    discount_pct: Decimal | None = Field(None, ge=0, le=100)
    items: list[OpportunityItemCreate] | None = None
    version_note: str | None = Field(
        None, max_length=500, description="Motivo del cambio de materiales (queda en la versión)"
    )


class OpportunityResponse(OpportunityBase):
    id: UUID
    company_name: str | None = None
    contact_name: str | None = None
    project_name: str | None = None
    assigned_to_name: str | None = None
    stage_name: str | None = None
    stage_slug: str | None = None
    stage_color: str | None = None
    items: list[OpportunityItemResponse] = Field(default_factory=list)
    # North Star Metric (NSM) - Semáforo comercial de actividad reciente
    last_activity_at: datetime | None = None
    days_since_last_activity: int | None = None
    health_status: str = "stale"  # "healthy" (<=7d) | "warning" (8-14d) | "stale" (>14d o sin actividad)
    is_deleted: bool = False
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OpportunityVersionResponse(BaseModel):
    """Foto de los materiales y montos de un presupuesto en cada renegociación."""

    id: UUID
    opportunity_id: UUID
    version: int
    items: list[OpportunityItemBase] = Field(default_factory=list)
    subtotal: Decimal = Decimal("0")
    discount_pct: Decimal = Decimal("0")
    total: Decimal = Decimal("0")
    note: str | None = None
    created_by: UUID | None = None
    created_by_name: str | None = None
    created_at: datetime


class TimelineEvent(BaseModel):
    """Hito del presupuesto para el seguimiento: cambio de etapa o nueva versión de materiales."""

    id: str
    kind: str  # "etapa" | "version"
    at: datetime
    user_id: UUID | None = None
    user_name: str | None = None
    title: str
    detail: str | None = None
    from_stage_id: UUID | None = None
    to_stage_id: UUID | None = None
    version: int | None = None
    total: Decimal | None = None
    previous_total: Decimal | None = None
