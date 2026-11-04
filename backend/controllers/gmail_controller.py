import hmac
import logging
from datetime import datetime
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from backend.config import settings
from backend.controllers.permissions import ensure_owner, session_from_header, session_user_id
from backend.services import gmail_service
from backend.services.opportunity_service import OpportunityService

logger = logging.getLogger("crm.controllers.gmail")

router = APIRouter(prefix="/api/gmail", tags=["Gmail del vendedor"])


class GmailStatus(BaseModel):
    configured: bool
    connected: bool
    email: str | None = None
    last_sync_at: datetime | None = None
    last_error: str | None = None
    fallback_provider: str


class ConnectUrl(BaseModel):
    url: str


class SyncRequest(BaseModel):
    opportunity_id: UUID | None = None
    force: bool = False


class SyncResult(BaseModel):
    connected: bool
    new_messages: int = 0
    last_sync_at: datetime | None = None
    error: str | None = None


def _me(authorization: str | None) -> str:
    uid = session_user_id(authorization)
    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Iniciá sesión nuevamente")
    return str(uid)


@router.get("/status", response_model=GmailStatus, summary="¿Tengo mi Gmail conectado?")
def gmail_status(authorization: str | None = Header(None)) -> GmailStatus:
    account = gmail_service.get_account(session_user_id(authorization))
    from backend.services.email_service import provider_name

    return GmailStatus(
        configured=gmail_service.is_configured(),
        connected=bool(account),
        email=account.email if account else None,
        last_sync_at=account.last_sync_at if account else None,
        last_error=account.last_error if account else None,
        fallback_provider=provider_name(),
    )


@router.get(
    "/connect", response_model=ConnectUrl, summary="Enlace para conectar la cuenta de Gmail (consentimiento de Google)"
)
def gmail_connect(authorization: str | None = Header(None)) -> ConnectUrl:
    session = session_from_header(authorization)
    try:
        return ConnectUrl(url=gmail_service.authorization_url(_me(authorization), session.get("email")))
    except gmail_service.GmailError as err:
        raise HTTPException(status_code=err.http_status, detail=err.message)


def _back(result: str, reason: str | None = None) -> RedirectResponse:
    params = {"gmail": result}
    if reason:
        params["motivo"] = reason
    base = settings.FRONTEND_URL.rstrip("/")
    return RedirectResponse(f"{base}/cuenta/correo?{urlencode(params)}", status_code=status.HTTP_303_SEE_OTHER)


@router.get("/callback", include_in_schema=False)
def gmail_callback(
    code: str | None = Query(None), state: str | None = Query(None), error: str | None = Query(None)
) -> RedirectResponse:
    """Google vuelve acá después del consentimiento. Público: el «state» firmado identifica al vendedor."""
    if error:
        return _back("cancelado", "No se dio permiso a la cuenta de Gmail.")
    if not code or not state:
        return _back("error", "Faltan datos de Google. Volvé a intentarlo.")
    try:
        user_id = gmail_service.read_state(state)
        gmail_service.connect(user_id, code)
    except gmail_service.GmailError as err:
        return _back("error", err.message)
    except Exception:
        logger.exception("Fallo inesperado al conectar Gmail")
        return _back("error", "No se pudo conectar la cuenta. Probá de nuevo.")
    return _back("conectado")


@router.delete("/connection", status_code=status.HTTP_204_NO_CONTENT, summary="Desconectar mi Gmail")
def gmail_disconnect(authorization: str | None = Header(None)) -> None:
    gmail_service.disconnect(_me(authorization))


@router.post("/sync", response_model=SyncResult, summary="Buscar respuestas nuevas de clientes en mi Gmail")
def gmail_sync(data: SyncRequest, authorization: str | None = Header(None)) -> SyncResult:
    user_id = _me(authorization)
    if data.opportunity_id:
        # Al abrir un presupuesto se buscan las respuestas en la casilla de su responsable.
        opp = OpportunityService.get_opportunity_by_id(data.opportunity_id)
        ensure_owner(authorization, opp.assigned_to)
        user_id = str(opp.assigned_to)
    account = gmail_service.get_account(user_id)
    if not account or not gmail_service.is_configured():
        return SyncResult(connected=False)
    try:
        new = gmail_service.sync_account(account, force=data.force)
    except gmail_service.GmailError as err:
        return SyncResult(connected=True, error=err.message, last_sync_at=account.last_sync_at)
    return SyncResult(connected=True, new_messages=new, last_sync_at=account.last_sync_at)


@router.get("/cron", include_in_schema=False)
def gmail_cron(authorization: str | None = Header(None)) -> dict:
    """Vercel Cron: sincroniza todas las casillas conectadas. Se valida con CRON_SECRET."""
    expected = settings.CRON_SECRET.strip()
    given = (authorization or "").removeprefix("Bearer ").strip()
    if not expected or not hmac.compare_digest(given.encode(), expected.encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autorizado")
    total, failed = 0, 0
    for account in gmail_service.list_accounts():
        try:
            total += gmail_service.sync_account(account, force=True)
        except gmail_service.GmailError:
            failed += 1
        except Exception:
            failed += 1
            logger.exception(f"Fallo sincronizando Gmail de {account.user_id}")
    return {"new_messages": total, "failed_accounts": failed}
