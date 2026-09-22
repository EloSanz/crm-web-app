from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from backend.models.activity import ActivityAttachment


class MessageChannel(str, Enum):
    EMAIL = "email"
    WHATSAPP = "whatsapp"


class MessageDirection(str, Enum):
    SALIENTE = "saliente"
    ENTRANTE = "entrante"


class MessageStatus(str, Enum):
    ENVIADO = "enviado"
    ENTREGADO = "entregado"
    LEIDO = "leido"
    FALLIDO = "fallido"
    SIMULADO = "simulado"
    RECIBIDO = "recibido"


class MessageResponse(BaseModel):
    """Mensaje enviado o recibido con un cliente (correo o WhatsApp)."""

    id: UUID
    channel: MessageChannel
    direction: MessageDirection
    status: MessageStatus
    opportunity_id: UUID | None = None
    contact_id: UUID | None = None
    company_id: UUID | None = None
    user_id: UUID | None = None
    user_name: str | None = None
    to_addresses: list[str] = Field(default_factory=list)
    cc: list[str] = Field(default_factory=list)
    subject: str | None = None
    body_html: str | None = None
    body_text: str | None = None
    attachments: list[ActivityAttachment] = Field(default_factory=list)
    phone: str | None = None
    provider: str | None = None
    provider_message_id: str | None = None
    error: str | None = None
    created_at: datetime
    # Sólo en la respuesta del envío (no se persiste): avisos como adjuntos que no se pudieron descargar.
    warnings: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class EmailSendRequest(BaseModel):
    to: list[EmailStr] = Field(..., min_length=1, max_length=20, description="Destinatarios")
    cc: list[EmailStr] = Field(default_factory=list, max_length=20, description="Con copia")
    subject: str = Field(..., min_length=1, max_length=255, description="Asunto")
    html: str = Field("", max_length=300_000, description="Cuerpo del correo en HTML")
    attachments: list[ActivityAttachment] = Field(default_factory=list, max_length=10)
    opportunity_id: UUID | None = None
    contact_id: UUID | None = None
    company_id: UUID | None = None


class _PhoneTarget(BaseModel):
    contact_id: UUID | None = None
    phone: str | None = Field(None, max_length=50)
    opportunity_id: UUID | None = None
    company_id: UUID | None = None

    @model_validator(mode="after")
    def _needs_target(self):
        if not self.contact_id and not (self.phone and self.phone.strip()):
            raise ValueError("Indicá un contacto o un teléfono")
        return self


class WhatsAppSendRequest(_PhoneTarget):
    text: str = Field("", max_length=4096, description="Texto del mensaje")
    template: bool = Field(False, description="Enviar la plantilla aprobada en lugar de texto libre")

    @model_validator(mode="after")
    def _needs_text(self):
        if not self.template and not self.text.strip():
            raise ValueError("Escribí un mensaje")
        return self


class WhatsAppLogRequest(_PhoneTarget):
    text: str | None = Field(None, max_length=4096, description="Mensaje precargado al abrir WhatsApp")


class CallLogRequest(_PhoneTarget):
    pass


class WhatsAppStatusResponse(BaseModel):
    configured: bool
    template_available: bool = False
    provider: str | None = None


class WhatsAppConversation(BaseModel):
    configured: bool
    phone: str
    contact_id: UUID | None = None
    contact_name: str | None = None
    window_open: bool = False
    window_expires_at: datetime | None = None
    last_inbound_at: datetime | None = None
    template_available: bool = False
    messages: list[MessageResponse] = Field(default_factory=list)
