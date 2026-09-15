from datetime import datetime, timezone

from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    """Modelo de respuesta para el estado de salud de la API."""

    status: str = Field(default="healthy", json_schema_extra={"example": "healthy"})
    app: str = Field(default="CRM Web App", json_schema_extra={"example": "CRM Web App"})
    version: str = Field(default="0.1.0", json_schema_extra={"example": "0.1.0"})
    environment: str = Field(default="development", json_schema_extra={"example": "development"})
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    database_connected: bool = Field(default=True)
