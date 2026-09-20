from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProjectType(str, Enum):
    VIVIENDA_UNIFAMILIAR = "vivienda_unifamiliar"
    EDIFICIO_MULTIFAMILIAR = "edificio_multifamiliar"
    COMERCIAL_INDUSTRIAL = "comercial_industrial"
    REFACCION = "refaccion"
    OBRA_PUBLICA = "obra_publica"


class ProjectStatus(str, Enum):
    PLANIFICACION = "planificacion"
    EN_CURSO = "en_curso"
    FRENADA = "frenada"
    FINALIZADA = "finalizada"


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Nombre o identificación de la obra")
    company_id: UUID | None = Field(None, description="Empresa contratista titular")
    contact_id: UUID | None = Field(None, description="Maestro mayor de obra o contacto responsable")
    address: str = Field(..., min_length=3, description="Dirección o ubicación física de entrega en obra")
    project_type: ProjectType = Field(
        default=ProjectType.VIVIENDA_UNIFAMILIAR, description="Tipo o envergadura de la obra"
    )
    status: ProjectStatus = Field(default=ProjectStatus.EN_CURSO, description="Estado operativo de la obra")
    observations: str | None = Field(None, description="Indicaciones de descarga o particularidades del terreno")


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    company_id: UUID | None = None
    contact_id: UUID | None = None
    address: str | None = Field(None, min_length=3)
    project_type: ProjectType | None = None
    status: ProjectStatus | None = None
    observations: str | None = None


class ProjectResponse(ProjectBase):
    id: UUID
    company_name: str | None = None
    contact_name: str | None = None
    opportunities_count: int = 0
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
