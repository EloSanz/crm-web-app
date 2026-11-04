"""Asistente con IA: borradores de respuesta y «Ponete al día» (modo simulado y modelo simulado)."""

import base64
import json

import pytest
from fastapi.testclient import TestClient

from backend.config import settings
from backend.controllers.auth_controller import generate_simple_token
from backend.main import app
from backend.models.auth import UserResponse
from backend.services import ai_service

ADMIN_ID = "00000000-0000-0000-0000-000000000001"
VENDEDOR_ID = "00000000-0000-0000-0000-000000000002"
OTRO_ID = "00000000-0000-0000-0000-000000000003"


@pytest.fixture(autouse=True)
def _ai_settings(monkeypatch):
    """Cada test arranca en modo simulado (sin clave) y con el registro de gasto vacío."""
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "")
    monkeypatch.setattr(settings, "AI_MONTHLY_BUDGET_USD", 10.0)
    monkeypatch.setattr(settings, "AI_DAILY_REQUESTS_PER_USER", 60)
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "log")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    ai_service._mock_requests.clear()


def _client_as(user_id: str, role: str, name: str = "Ejecutivo Comercial") -> TestClient:
    user = UserResponse(id=user_id, email=f"{user_id[-1]}@crm.com", full_name=name, role=role)
    headers = {"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {generate_simple_token(user)}"}
    return TestClient(app, headers=headers)


def _setup(client: TestClient, tag: str, assigned_to: str = VENDEDOR_ID):
    company = client.post("/api/companies", json={"name": f"Constructora {tag}"}).json()
    contact = client.post(
        "/api/contacts",
        json={
            "first_name": "Marta",
            "last_name": "Gómez",
            "company_id": company["id"],
            "email": f"marta.{tag}@obra.com.ar",
        },
    ).json()
    stages = client.get("/api/stages").json()
    opp = client.post(
        "/api/opportunities",
        json={
            "title": f"Platea {tag}",
            "company_id": company["id"],
            "contact_id": contact["id"],
            "assigned_to": assigned_to,
            "stage_id": stages[0]["id"],
            "items": [
                {"product_name": "Cemento Loma Negra 50 kg", "unit": "bolsa", "quantity": 80, "unit_price": 9500}
            ],
        },
    ).json()
    return company, contact, opp


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload
        self.text = json.dumps(payload)

    def json(self):
        return self._payload


def _model_reply(payload: dict, input_tokens: int = 1200, output_tokens: int = 200) -> _FakeResponse:
    return _FakeResponse(
        200,
        {
            "model": "claude-opus-5-5",
            "stop_reason": "end_turn",
            "content": [{"type": "thinking", "thinking": ""}, {"type": "text", "text": json.dumps(payload)}],
            "usage": {"input_tokens": input_tokens, "output_tokens": output_tokens},
        },
    )


# ---------------------------------------------------------------------------
# Estado y modo simulado
# ---------------------------------------------------------------------------


def test_status_without_key_is_simulated(client: TestClient):
    body = client.get("/api/ai/status").json()
    assert body["simulated"] is True
    assert body["model"] == "simulado"
    assert body["spent_usd"] == 0


def test_email_draft_in_simulated_mode_never_sends(client: TestClient):
    _, contact, opp = _setup(client, "sim")
    res = client.post("/api/ai/drafts", json={"channel": "email", "opportunity_id": opp["id"]})
    assert res.status_code == 201, res.text
    draft = res.json()
    assert draft["simulated"] is True
    assert draft["subject"].startswith("Presupuesto")
    assert "Hola Marta," in draft["body_text"]
    assert draft["body_html"].startswith("<p>")
    # Pedir un borrador no manda nada ni ensucia el seguimiento.
    assert client.get("/api/messages", params={"opportunity_id": opp["id"]}).json() == []
    assert client.get(f"/api/opportunities/{opp['id']}/activities").json() == []


def test_whatsapp_draft_detects_unanswered_client_message(client: TestClient):
    from backend.models.message import MessageChannel, MessageDirection, MessageStatus
    from backend.services.message_service import MessageService

    company = client.post("/api/companies", json={"name": "Constructora WA"}).json()
    contact = client.post(
        "/api/contacts",
        json={"first_name": "Raúl", "last_name": "Díaz", "company_id": company["id"], "phone": "11 4555-0101"},
    ).json()
    MessageService.create(
        channel=MessageChannel.WHATSAPP,
        direction=MessageDirection.ENTRANTE,
        status=MessageStatus.RECIBIDO,
        contact_id=contact["id"],
        company_id=company["id"],
        body_text="¿Tienen hierro del 8 para el viernes?",
        phone="5491145550101",
    )
    res = client.post("/api/ai/drafts", json={"channel": "whatsapp", "contact_id": contact["id"]})
    assert res.status_code == 201, res.text
    draft = res.json()
    assert draft["reason"] == "respuesta"
    assert draft["subject"] is None
    assert draft["body_html"] is None
    assert draft["body_text"].startswith("Hola Raúl,")


# ---------------------------------------------------------------------------
# Permisos por dueño
# ---------------------------------------------------------------------------


def test_seller_cannot_draft_for_another_sellers_quote(client: TestClient):
    _, _, opp = _setup(client, "ajeno", assigned_to=OTRO_ID)
    seller = _client_as(VENDEDOR_ID, "ejecutivo_ventas")
    res = seller.post("/api/ai/drafts", json={"channel": "email", "opportunity_id": opp["id"]})
    assert res.status_code == 403
    # Y no queda registrada ninguna consulta al modelo.
    assert ai_service._mock_requests == {}


def test_seller_can_draft_for_own_quote(client: TestClient):
    _, _, opp = _setup(client, "propio", assigned_to=VENDEDOR_ID)
    seller = _client_as(VENDEDOR_ID, "ejecutivo_ventas", "Lucía Fernández")
    res = seller.post("/api/ai/drafts", json={"channel": "whatsapp", "opportunity_id": opp["id"]})
    assert res.status_code == 201, res.text
    assert "Lucía" in res.json()["body_text"]


def test_seller_cannot_catch_up_on_unrelated_client(client: TestClient):
    company, _, _ = _setup(client, "otro-cliente", assigned_to=OTRO_ID)
    seller = _client_as(VENDEDOR_ID, "ejecutivo_ventas")
    assert seller.get(f"/api/ai/catchup/{company['id']}").status_code == 403
    assert (
        seller.post(f"/api/ai/catchup/{company['id']}/ask", json={"question": "¿Qué se le cotizó?"}).status_code == 403
    )


def test_seller_who_inherited_the_client_can_catch_up(client: TestClient):
    company, _, _ = _setup(client, "heredado", assigned_to=VENDEDOR_ID)
    seller = _client_as(VENDEDOR_ID, "ejecutivo_ventas")
    res = seller.get(f"/api/ai/catchup/{company['id']}")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["opportunities"] == 1
    assert len(body["suggested_questions"]) == 10


# ---------------------------------------------------------------------------
# «Ponete al día»
# ---------------------------------------------------------------------------


def test_catchup_without_history_says_it_does_not_know(client: TestClient):
    company = client.post("/api/companies", json={"name": "Constructora Nueva"}).json()
    res = client.post(f"/api/ai/catchup/{company['id']}/ask", json={"question": "¿Por qué se perdió el último?"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["unknown"] is True
    assert body["citations"] == []


def test_catchup_simulated_answer_cites_the_quote(client: TestClient):
    company, _, opp = _setup(client, "cita")
    res = client.post(f"/api/ai/catchup/{company['id']}/ask", json={"question": "¿Qué se le cotizó?"})
    body = res.json()
    assert body["unknown"] is False
    assert body["citations"][0]["opportunity_id"] == opp["id"]
    assert body["citations"][0]["link"].startswith(f"/opportunities/{opp['id']}")
    assert "[F1]" in body["answer"]


def test_catchup_drops_invented_citations_and_flags_unsourced(monkeypatch, client: TestClient):
    company, _, _ = _setup(client, "inventa")
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.setattr(
        ai_service.httpx,
        "post",
        lambda *a, **k: _model_reply(
            {"respuesta": "Se le vendió una losa en 2019 [F99].", "fuentes": ["F99"], "no_lo_se": False}
        ),
    )
    body = client.post(f"/api/ai/catchup/{company['id']}/ask", json={"question": "¿Qué le vendimos?"}).json()
    assert "[F99]" not in body["answer"]
    assert body["citations"] == []
    assert body["unsourced"] is True


def test_catchup_can_cite_the_client_profile(monkeypatch, client: TestClient):
    company, _, _ = _setup(client, "ficha")
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.setattr(
        ai_service.httpx,
        "post",
        lambda *a, **k: _model_reply(
            {"respuesta": "El contacto es Marta Gómez [F0].", "fuentes": ["F0"], "no_lo_se": False}
        ),
    )
    body = client.post(f"/api/ai/catchup/{company['id']}/ask", json={"question": "¿Quién es el contacto?"}).json()
    assert body["unsourced"] is False
    assert body["citations"][0]["kind"] == "ficha"
    assert body["citations"][0]["link"] == f"/companies/{company['id']}"


# ---------------------------------------------------------------------------
# Modelo simulado: forma de la llamada, costo y tope de gasto
# ---------------------------------------------------------------------------


def test_draft_with_model_sends_structured_request_and_logs_cost(monkeypatch, client: TestClient):
    _, _, opp = _setup(client, "modelo")
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-test")
    calls = []

    def fake_post(url, json=None, headers=None, timeout=None):
        calls.append({"url": url, "json": json, "headers": headers})
        return _model_reply(
            {
                "asunto": "Platea modelo",
                "parrafos": ["Hola Marta,", "¿Pudiste ver el presupuesto? <b>ojo</b>", "Saludos,\nAdmin"],
                "datos_a_confirmar": ["Stock de cemento"],
                "motivo": "El presupuesto está abierto.",
            },
            input_tokens=1_000_000,
            output_tokens=100_000,
        )

    monkeypatch.setattr(ai_service.httpx, "post", fake_post)
    res = client.post(
        "/api/ai/drafts", json={"channel": "email", "opportunity_id": opp["id"], "instruction": "más corto"}
    )
    assert res.status_code == 201, res.text
    draft = res.json()
    assert draft["simulated"] is False
    assert draft["to_confirm"] == ["Stock de cemento"]
    # El HTML del modelo se escapa: nunca entra una etiqueta al editor.
    assert "&lt;b&gt;ojo&lt;/b&gt;" in draft["body_html"]

    sent = calls[0]
    assert sent["url"] == ai_service.API_URL
    assert sent["headers"]["x-api-key"] == "sk-test"
    assert sent["json"]["model"] == settings.AI_MODEL
    assert sent["json"]["output_config"]["format"]["type"] == "json_schema"
    assert "temperature" not in sent["json"]
    context, request = sent["json"]["messages"][0]["content"]
    assert context["cache_control"] == {"type": "ephemeral"}
    assert "Cemento Loma Negra" in context["text"]
    assert "más corto" in request["text"]

    # 1 M de entrada a 4 USD + 100 mil de salida a 20 USD = 6 USD.
    status = client.get("/api/ai/status").json()
    assert status["spent_usd"] == pytest.approx(6.0)


def test_budget_cap_blocks_the_model(monkeypatch, client: TestClient):
    _, _, opp = _setup(client, "tope")
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.setattr(settings, "AI_MONTHLY_BUDGET_USD", 0.5)
    ai_service.log_request(
        feature="borrador",
        user_id=None,
        result=ai_service.AIResult(data={}, model="claude-opus-5-5", simulated=False, cost_usd=0.6),
    )

    def must_not_call(*a, **k):
        raise AssertionError("No debería llamar al modelo con el tope alcanzado")

    monkeypatch.setattr(ai_service.httpx, "post", must_not_call)
    res = client.post("/api/ai/drafts", json={"channel": "email", "opportunity_id": opp["id"]})
    assert res.status_code == 429
    assert "tope de gasto" in res.json()["detail"]


def test_model_refusal_returns_clear_error(monkeypatch, client: TestClient):
    _, _, opp = _setup(client, "rechazo")
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.setattr(
        ai_service.httpx,
        "post",
        lambda *a, **k: _FakeResponse(200, {"stop_reason": "refusal", "content": [], "usage": {}}),
    )
    res = client.post("/api/ai/drafts", json={"channel": "email", "opportunity_id": opp["id"]})
    assert res.status_code == 422


def test_email_sent_from_draft_is_noted_in_timeline(client: TestClient):
    _, contact, opp = _setup(client, "anota")
    draft = client.post("/api/ai/drafts", json={"channel": "email", "opportunity_id": opp["id"]}).json()
    res = client.post(
        "/api/email/send",
        json={
            "to": [contact["email"]],
            "subject": draft["subject"],
            "html": draft["body_html"],
            "opportunity_id": opp["id"],
            "ai_draft_id": draft["id"],
        },
    )
    assert res.status_code == 201, res.text
    act = client.get(f"/api/opportunities/{opp['id']}/activities").json()[0]
    assert "borrador del asistente" in act["description"]


# ---------------------------------------------------------------------------
# Token de sesión firmado
# ---------------------------------------------------------------------------


def test_forged_unsigned_token_is_rejected(raw_client: TestClient):
    payload = {"sub": ADMIN_ID, "email": "x@x.com", "role": "admin", "name": "Falso", "exp": 99999999999}
    forged = "crm_" + base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    res = raw_client.get(
        "/api/ai/status", headers={"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {forged}"}
    )
    assert res.status_code == 401


def test_tampered_role_breaks_signature(raw_client: TestClient):
    user = UserResponse(id=VENDEDOR_ID, email="v@crm.com", full_name="V", role="ejecutivo_ventas")
    token = generate_simple_token(user)
    encoded, _, sig = token[4:].partition(".")
    data = json.loads(base64.urlsafe_b64decode(encoded))
    data["role"] = "admin"
    tampered = "crm_" + base64.urlsafe_b64encode(json.dumps(data).encode()).decode() + "." + sig
    res = raw_client.get(
        "/api/ai/status", headers={"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {tampered}"}
    )
    assert res.status_code == 401
