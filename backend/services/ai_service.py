"""Cliente del modelo (Claude) para el asistente del CRM.

- Sin ANTHROPIC_API_KEY funciona en modo simulado: cada función arma su respuesta con plantillas
  y no se gasta nada (ideal para desarrollar y para los tests).
- Cada consulta queda registrada en crm_ai_requests con tokens y costo; antes de llamar al modelo
  se controla el tope de gasto mensual y el límite diario por usuario.
- Pide la respuesta en JSON con esquema (structured outputs), así no hay que adivinar el formato.
"""

import json
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import httpx

from backend.config import settings
from backend.database import get_supabase_client

logger = logging.getLogger("crm.services.ai")

API_URL = "https://api.anthropic.com/v1/messages"
API_VERSION = "2026-10-21"
# Si el modelo declina por sus filtros de seguridad, la API reintenta sola con el modelo recomendado.
FALLBACK_BETA = "server-side-fallback-2026-07-01"
FALLBACK_MODELS = {"claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"}
EFFORTS = {"low", "medium", "high", "xhigh", "max"}
SIMULATED_MODEL = "simulado"

# Respaldo en memoria: desarrollo local, tests y bases sin la migración 08.
_mock_requests: dict[str, dict] = {}


class AIError(Exception):
    """Error mostrable al vendedor, con el código HTTP que corresponde."""

    def __init__(self, message: str, http_status: int = 502):
        super().__init__(message)
        self.message = message
        self.http_status = http_status


@dataclass
class AIResult:
    data: dict
    model: str
    simulated: bool
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    warnings: list[str] = field(default_factory=list)


def is_configured() -> bool:
    return bool((settings.ANTHROPIC_API_KEY or "").strip())


def _effort() -> str:
    value = (settings.AI_EFFORT or "low").strip().lower()
    return value if value in EFFORTS else "low"


def _cost(usage: dict) -> float:
    """Costo en dólares: entrada normal, escritura de caché (×1,25), lectura de caché (×0,1) y salida."""
    price_in = settings.AI_PRICE_INPUT_PER_MTOK / 1_000_000
    price_out = settings.AI_PRICE_OUTPUT_PER_MTOK / 1_000_000
    return round(
        (usage.get("input_tokens") or 0) * price_in
        + (usage.get("cache_creation_input_tokens") or 0) * price_in * 1.25
        + (usage.get("cache_read_input_tokens") or 0) * price_in * 0.1
        + (usage.get("output_tokens") or 0) * price_out,
        6,
    )


# ---------------------------------------------------------------------------
# Registro de consultas y tope de gasto
# ---------------------------------------------------------------------------


def _str(value) -> str | None:
    return str(value) if value else None


def log_request(
    *,
    feature: str,
    user_id: UUID | None,
    result: AIResult | None,
    status: str = "ok",
    opportunity_id: UUID | None = None,
    company_id: UUID | None = None,
    channel: str | None = None,
    question: str | None = None,
    answer: str | None = None,
    citations: list | None = None,
    error: str | None = None,
) -> str:
    record = {
        "id": str(uuid4()),
        "feature": feature,
        "user_id": _str(user_id),
        "opportunity_id": _str(opportunity_id),
        "company_id": _str(company_id),
        "channel": channel,
        "question": question,
        "answer": answer,
        "citations": citations or [],
        "model": result.model if result else (settings.AI_MODEL if is_configured() else SIMULATED_MODEL),
        "simulated": result.simulated if result else not is_configured(),
        "input_tokens": result.input_tokens if result else 0,
        "output_tokens": result.output_tokens if result else 0,
        "cost_usd": result.cost_usd if result else 0,
        "status": status,
        "error": error,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        get_supabase_client().table("crm_ai_requests").insert(record).execute()
        return record["id"]
    except Exception as e:
        logger.warning(f"No se pudo registrar la consulta al modelo en Supabase (queda en memoria): {e}")
    _mock_requests[record["id"]] = record
    return record["id"]


def _requests_since(since: datetime, user_id: UUID | None = None) -> list[dict]:
    rows: list[dict] = []
    try:
        query = (
            get_supabase_client()
            .table("crm_ai_requests")
            .select("id, user_id, cost_usd, simulated, created_at")
            .gte("created_at", since.isoformat())
        )
        if user_id:
            query = query.eq("user_id", str(user_id))
        rows = list(query.execute().data or [])
    except Exception as e:
        logger.debug(f"Sin crm_ai_requests en Supabase: {e}")
    seen = {str(r.get("id")) for r in rows}
    for r in _mock_requests.values():
        if r["id"] in seen or datetime.fromisoformat(r["created_at"]) < since:
            continue
        if user_id and str(r.get("user_id")) != str(user_id):
            continue
        rows.append(r)
    return rows


def _month_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def month_spent_usd() -> float:
    return round(sum(float(r.get("cost_usd") or 0) for r in _requests_since(_month_start())), 4)


def user_requests_today(user_id: UUID | None) -> int:
    if not user_id:
        return 0
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    return sum(1 for r in _requests_since(since, user_id) if not r.get("simulated"))


def status(user_id: UUID | None) -> dict:
    spent = month_spent_usd()
    budget = float(settings.AI_MONTHLY_BUDGET_USD)
    return {
        "configured": is_configured(),
        "simulated": not is_configured(),
        "model": settings.AI_MODEL if is_configured() else SIMULATED_MODEL,
        "budget_usd": budget,
        "spent_usd": spent,
        "budget_reached": is_configured() and spent >= budget,
        "daily_limit": settings.AI_DAILY_REQUESTS_PER_USER,
        "daily_used": user_requests_today(user_id),
    }


def _check_limits(user_id: UUID | None) -> None:
    if month_spent_usd() >= float(settings.AI_MONTHLY_BUDGET_USD):
        raise AIError(
            "Se alcanzó el tope de gasto del asistente para este mes. Escribí el mensaje a mano o pedile al administrador que lo amplíe.",
            429,
        )
    if user_requests_today(user_id) >= settings.AI_DAILY_REQUESTS_PER_USER:
        raise AIError("Llegaste al límite de consultas al asistente por hoy. Probá de nuevo mañana.", 429)


# ---------------------------------------------------------------------------
# Llamada al modelo
# ---------------------------------------------------------------------------


def _call_model(system: str, content: list[dict], schema: dict, max_tokens: int) -> AIResult:
    model = settings.AI_MODEL
    headers = {
        "x-api-key": settings.ANTHROPIC_API_KEY.strip(),
        "anthropic-version": API_VERSION,
        "content-type": "application/json",
    }
    body: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": content}],
        "output_config": {"effort": _effort(), "format": {"type": "json_schema", "schema": schema}},
    }
    if model in FALLBACK_MODELS:
        headers["anthropic-beta"] = FALLBACK_BETA
        body["fallbacks"] = "default"

    try:
        res = httpx.post(API_URL, json=body, headers=headers, timeout=90)
    except httpx.HTTPError as e:
        logger.warning(f"El modelo no respondió: {e}")
        raise AIError("El asistente no respondió. Probá de nuevo en un momento.")
    try:
        data = res.json()
    except ValueError:
        data = {}
    if res.status_code >= 400:
        detail = ((data.get("error") or {}).get("message") if isinstance(data, dict) else None) or res.text[:200]
        logger.warning(f"Error del modelo {res.status_code}: {detail}")
        if res.status_code in (401, 403):
            raise AIError("La clave del asistente (ANTHROPIC_API_KEY) no es válida.", 502)
        if res.status_code == 429:
            raise AIError("El asistente está saturado. Probá en unos minutos.", 429)
        raise AIError("El asistente no pudo responder. Probá de nuevo.")

    usage = data.get("usage") or {}
    result_meta = {
        "model": data.get("model") or model,
        "input_tokens": int(usage.get("input_tokens") or 0)
        + int(usage.get("cache_creation_input_tokens") or 0)
        + int(usage.get("cache_read_input_tokens") or 0),
        "output_tokens": int(usage.get("output_tokens") or 0),
        "cost_usd": _cost(usage),
    }
    stop = data.get("stop_reason")
    if stop == "refusal":
        raise AIError("El asistente no quiso responder esta consulta. Escribila a mano.", 422)
    if stop == "max_tokens":
        raise AIError("La respuesta del asistente quedó cortada. Probá con una consulta más corta.")

    text = "".join(b.get("text", "") for b in data.get("content") or [] if b.get("type") == "text").strip()
    try:
        parsed = json.loads(text)
    except ValueError:
        logger.warning(f"Respuesta del modelo que no es JSON: {text[:200]}")
        raise AIError("El asistente devolvió una respuesta ilegible. Probá de nuevo.")
    if not isinstance(parsed, dict):
        raise AIError("El asistente devolvió una respuesta ilegible. Probá de nuevo.")
    return AIResult(data=parsed, simulated=False, **result_meta)


def run_json(
    *,
    system: str,
    context: str,
    request: str,
    schema: dict,
    simulate: Callable[[], dict],
    user_id: UUID | None,
    max_tokens: int = 4000,
) -> AIResult:
    """Pide al modelo un JSON que cumpla `schema`. Sin clave devuelve `simulate()` y no gasta.

    `context` (datos del cliente, estable) va primero y con caché: varias preguntas seguidas sobre el
    mismo cliente pagan el historial una sola vez. `request` (la consigna o pregunta) va después.
    """
    if not is_configured():
        return AIResult(data=simulate(), model=SIMULATED_MODEL, simulated=True)
    _check_limits(user_id)
    content = [
        {"type": "text", "text": context, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": request},
    ]
    return _call_model(system, content, schema, max_tokens)
