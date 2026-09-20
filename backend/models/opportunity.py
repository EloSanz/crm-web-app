from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OpportunityStatus(str, Enum):
    ABIERTA = "abierta"
    GANADA = "ganada"
    PERDIDA = "perdida"


class OpportunityItemBase(BaseModel):
    product_id: UUID | None = None
    product_name: str = Field(..., min_length=2, max_length=255)
    unit: str = Field(default="unidad", max_length=50)
    quantity: Decimal = Field(default=Decimal("1.00"), gt=0)
    unit_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    subtotal: Decimal = Field(default=Decimal("0.00"), ge=0)


class OpportunityItemCreate(BaseModel):
    product_id: UUID | None = None
    product_name: str = Field(..., min_length=2, max_length=255)
    unit: str = Field(default="unidad", max_length=50)
    quantity: Decimal = Field(default=Decimal("1.00"), gt=0)
    unit_price: Decimal = Field(default=Decimal("0.00"), ge=0)


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


class OpportunityCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    company_id: UUID | None = None
    contact_id: UUID | None = None
    project_id: UUID | None = None
    assigned_to: UUID
    stage_id: UUID
    status: OpportunityStatus = OpportunityStatus.ABIERTA
    estimated_value: Decimal | None = None
    currency: str = "ARS"
    expected_close_date: date | None = None
    delivery_location: str | None = None
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
    items: list[OpportunityItemCreate] | None = None


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
    is_deleted: bool = False
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
