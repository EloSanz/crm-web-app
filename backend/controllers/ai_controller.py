import logging
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, status

from backend.controllers.permissions import (
    MANAGER_ROLES,
    SELLER_ROLE,
    ensure_owner,
    session_from_header,
    session_user_id,
)
from backend.models.ai import (
    AIStatusResponse,
    CatchupAnswer,
    CatchupOverview,
    CatchupQuestion,
    DraftRequest,
    DraftResponse,
)
from backend.models.message import MessageChannel
from backend.models.opportunity import OpportunityResponse, OpportunityStatus
from backend.services import ai_service, catchup_service, dossier_service, draft_service, whatsapp_service
from backend.services.company_service import CompanyService
from backend.services.contact_service import ContactService
from backend.services.message_service import MessageService
from backend.services.opportunity_service import OpportunityService

logger = logging.getLogger("crm.controllers.ai")

router = APIRouter(prefix="/api/ai", tags=["Asistente con IA"])


def _fail(err: ai_service.AIError) -> HTTPException:
    return HTTPException(status_code=err.http_status, detail=err.message)


@router.get("/status", response_model=AIStatusResponse, summary="Estado del asistente: modo, modelo y gasto del mes")
def ai_status(authorization: str | None = Header(None)) -> AIStatusResponse:
    return AIStatusResponse(**ai_service.status(session_user_id(authorization)))


# ---------------------------------------------------------------------------
# Borradores de respuesta (correo y WhatsApp)
# ---------------------------------------------------------------------------


def _draft_opportunity(
    session: dict, authorization: str | None, data: DraftRequest, contact
) -> OpportunityResponse | None:
    if data.opportunity_id:
        opp = OpportunityService.get_opportunity_by_id(data.opportunity_id)
        ensure_owner(authorization, opp.assigned_to)
        return opp
    if not contact:
        return None
    opps = OpportunityService.get_opportunities(
        contact_id=contact.id, status_filter=OpportunityStatus.ABIERTA, limit=20
    )
    if session.get("role") == SELLER_ROLE:
        opps = [o for o in opps if str(o.assigned_to) == str(session.get("sub"))]
    return opps[0] if opps else None


@router.post(
    "/drafts",
    response_model=DraftResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Sugerir un borrador de respuesta (no se envía: vuelve al editor para revisarlo)",
)
def create_draft(data: DraftRequest, authorization: str | None = Header(None)) -> DraftResponse:
    session = session_from_header(authorization)
    user_id = session_user_id(authorization)

    contact = ContactService.get_contact_by_id(data.contact_id) if data.contact_id else None
    opp = _draft_opportunity(session, authorization, data, contact)
    if not contact and opp and opp.contact_id:
        try:
            contact = ContactService.get_contact_by_id(opp.contact_id)
        except HTTPException:
            contact = None
    # Un vendedor sólo manda al modelo datos de clientes propios.
    if session.get("role") == SELLER_ROLE and not opp:
        owner = contact.assigned_to if contact else None
        if str(owner) != str(session.get("sub")):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sólo podés pedir borradores para clientes o presupuestos asignados a vos",
            )

    phone = None
    if data.channel == MessageChannel.WHATSAPP:
        phone = whatsapp_service.normalize_phone(data.phone or (contact.phone if contact else None))
        recent = MessageService.list_messages(phone=phone, channel=data.channel, limit=10) if phone else []
    elif opp:
        recent = MessageService.list_messages(opportunity_id=opp.id, channel=data.channel, limit=10)
    else:
        recent = MessageService.list_messages(contact_id=contact.id, channel=data.channel, limit=10) if contact else []
    reason, last_inbound = draft_service.detect_reason(opp, recent)

    ctx = draft_service.DraftContext(
        channel=data.channel,
        opportunity=opp,
        dossier=dossier_service.build_for_opportunity(opp) if opp else None,
        contact_first_name=draft_service._first(contact.first_name) if contact else None,
        seller_name=session.get("name") or "Equipo Corralap",
        last_inbound=last_inbound,
        reason=reason,
        instruction=data.instruction,
        phone=phone,
    )
    log = {
        "feature": "borrador",
        "user_id": user_id,
        "opportunity_id": opp.id if opp else None,
        "company_id": (opp.company_id if opp else None) or (contact.company_id if contact else None),
        "channel": data.channel.value,
        "question": data.instruction,
    }
    try:
        draft, result = draft_service.generate(ctx, user_id)
    except ai_service.AIError as err:
        ai_service.log_request(**log, result=None, status="error", error=err.message)
        raise _fail(err)
    request_id = ai_service.log_request(**log, result=result, answer=draft["body_text"])
    return DraftResponse(id=request_id, **draft)


# ---------------------------------------------------------------------------
# «Ponete al día» con un cliente
# ---------------------------------------------------------------------------


def _authorize_company(authorization: str | None, company_id: UUID):
    """Admin y responsable comercial preguntan por cualquier cliente. Un vendedor, por los clientes
    asignados a él o con algún presupuesto suyo (el caso típico: heredó la constructora)."""
    session = session_from_header(authorization)
    company = CompanyService.get_company_by_id(company_id)
    if session.get("role") in MANAGER_ROLES:
        return company
    me = str(session.get("sub") or "")
    if me and str(company.assigned_to) == me:
        return company
    if me and OpportunityService.get_opportunities(company_id=company_id, assigned_to=UUID(me), limit=1):
        return company
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Sólo podés consultar clientes asignados a vos o con presupuestos tuyos",
    )


@router.get(
    "/catchup/{company_id}",
    response_model=CatchupOverview,
    summary="Resumen del cliente y preguntas sugeridas (no consulta al modelo)",
)
def catchup_overview(company_id: UUID, authorization: str | None = Header(None)) -> CatchupOverview:
    _authorize_company(authorization, company_id)
    dossier = dossier_service.build_for_company(company_id)
    return CatchupOverview(
        **catchup_service.overview(dossier),
        assistant=AIStatusResponse(**ai_service.status(session_user_id(authorization))),
    )


@router.post(
    "/catchup/{company_id}/ask",
    response_model=CatchupAnswer,
    summary="Preguntar por la historia del cliente (respuesta con citas al seguimiento)",
)
def catchup_ask(company_id: UUID, data: CatchupQuestion, authorization: str | None = Header(None)) -> CatchupAnswer:
    _authorize_company(authorization, company_id)
    user_id = session_user_id(authorization)
    dossier = dossier_service.build_for_company(company_id)
    question = " ".join(data.question.split())
    log = {"feature": "ponete_al_dia", "user_id": user_id, "company_id": company_id, "question": question}
    try:
        out, result = catchup_service.ask(dossier, question, [t.model_dump() for t in data.history], user_id)
    except ai_service.AIError as err:
        ai_service.log_request(**log, result=None, status="error", error=err.message)
        raise _fail(err)
    request_id = ai_service.log_request(
        **log,
        result=result,
        answer=out["answer"],
        citations=[c["ref"] for c in out["citations"]],
        status="sin_fuente" if out["unsourced"] else "ok",
    )
    return CatchupAnswer(id=request_id, question=question, **out)
