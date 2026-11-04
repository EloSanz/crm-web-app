from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from backend.models.message import MessageChannel


class AIStatusResponse(BaseModel):
    configured: bool
    simulated: bool
    model: str
    budget_usd: float
    spent_usd: float
    budget_reached: bool
    daily_limit: int
    daily_used: int


class DraftRequest(BaseModel):
    channel: MessageChannel = Field(..., description="email o whatsapp")
    opportunity_id: UUID | None = None
    contact_id: UUID | None = None
    company_id: UUID | None = None
    phone: str | None = Field(None, max_length=50)
    instruction: str | None = Field(None, max_length=300, description="Ej.: «más corto», «ofrecé pasar a medir»")
    current_text: str | None = Field(None, max_length=20000, description="Texto actual del editor, con lo que editó")
    previous_draft: str | None = Field(None, max_length=20000, description="Última versión que escribió el asistente")

    @model_validator(mode="after")
    def _needs_target(self):
        if (
            not self.opportunity_id
            and not self.contact_id
            and not self.company_id
            and not (self.phone and self.phone.strip())
        ):
            raise ValueError("Indicá el presupuesto, el cliente o el teléfono")
        return self


class DraftResponse(BaseModel):
    id: UUID
    channel: MessageChannel
    reason: str
    reason_label: str
    subject: str | None = None
    body_text: str
    body_html: str | None = None
    # Párrafos tal cual: «**negrita**», renglones «- » (lista) y la marca [[DETALLE_DEL_PRESUPUESTO]] (la tabla).
    paragraphs: list[str] = Field(default_factory=list)
    includes_detail: bool = False
    to_confirm: list[str] = Field(default_factory=list)
    rationale: str | None = None
    simulated: bool
    model: str


class Citation(BaseModel):
    ref: str
    kind: str
    kind_label: str
    at: str
    title: str
    detail: str | None = None
    opportunity_id: UUID | None = None
    opportunity_title: str | None = None
    source_id: str | None = None
    user_name: str | None = None
    link: str | None = None


class CatchupOverview(BaseModel):
    company_id: UUID | None = None
    company_name: str | None = None
    opportunities: int
    open: int
    won: int
    lost: int
    quoted_total: float
    won_total: float
    entries: int
    last_contact: Citation | None = None
    sellers: list[str] = Field(default_factory=list)
    suggested_questions: list[str] = Field(default_factory=list)
    truncated: bool = False
    assistant: AIStatusResponse


class CatchupTurn(BaseModel):
    question: str = Field(..., max_length=500)
    answer: str = Field(..., max_length=4000)


class CatchupQuestion(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)
    history: list[CatchupTurn] = Field(default_factory=list, max_length=10)


class CatchupAnswer(BaseModel):
    id: UUID
    question: str
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    unknown: bool = False
    unsourced: bool = False
    simulated: bool
    model: str
