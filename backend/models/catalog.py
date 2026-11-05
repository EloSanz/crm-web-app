from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class CatalogKind(str, Enum):
    ACTIVITY_TYPE = "activity_type"
    ORIGIN = "origin"
    LOSS_REASON = "loss_reason"


class StageKind(str, Enum):
    """Tipo de etapa: abierta (en curso), ganada o perdida."""

    OPEN = "open"
    WON = "won"
    LOST = "lost"


def _clean_label(value: str | None) -> str | None:
    if value is None:
        return None
    value = " ".join(value.split())
    if len(value) < 2:
        raise ValueError("El nombre tiene que tener al menos 2 caracteres")
    return value


class CatalogItemCreate(BaseModel):
    kind: CatalogKind
    label: str = Field(..., min_length=2, max_length=120, description="Texto que ve el usuario")
    code: str | None = Field(
        None,
        max_length=60,
        pattern=r"^[a-z0-9_-]+$",
        description="Código interno; si no viene se arma a partir del nombre",
    )

    @field_validator("label")
    @classmethod
    def clean_label(cls, value: str | None) -> str | None:
        return _clean_label(value)


class CatalogItemUpdate(BaseModel):
    label: str | None = Field(None, min_length=2, max_length=120)
    is_active: bool | None = None
    position: int | None = Field(None, ge=1)

    @field_validator("label")
    @classmethod
    def clean_label(cls, value: str | None) -> str | None:
        return _clean_label(value)


class CatalogReorder(BaseModel):
    kind: CatalogKind
    ids: list[UUID] = Field(..., min_length=1, description="Ids en el orden deseado")


class CatalogItemResponse(BaseModel):
    id: UUID
    kind: CatalogKind
    code: str
    label: str
    position: int
    is_active: bool = True
    is_system: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None


class StageCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    color: str = Field("#3b82f6", pattern=r"^#[0-9a-fA-F]{6}$")
    kind: StageKind = StageKind.OPEN

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        return _clean_label(value)


class StageUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    color: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")
    kind: StageKind | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        return _clean_label(value)


class StageReorder(BaseModel):
    ids: list[UUID] = Field(..., min_length=1, description="Ids de etapas en el orden deseado")
