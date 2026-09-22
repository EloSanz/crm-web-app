import hashlib
import hmac
import json
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.config import settings
from backend.controllers.auth_controller import generate_simple_token
from backend.main import app
from backend.models.auth import UserResponse
from backend.services import email_service, whatsapp_service

ADMIN_ID = "00000000-0000-0000-0000-000000000001"
VENDEDOR_ID = "00000000-0000-0000-0000-000000000002"
S3_URL = f"https://{settings.AWS_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/crm/adjuntos/remito.pdf"


@pytest.fixture(autouse=True)
def _comms_settings(monkeypatch):
    """Cada test arranca sin proveedores reales: correo simulado y WhatsApp sin conectar."""
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "log")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")
    monkeypatch.setattr(settings, "WHATSAPP_TOKEN", "")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")
    monkeypatch.setattr(settings, "WHATSAPP_VERIFY_TOKEN", "")
    monkeypatch.setattr(settings, "WHATSAPP_APP_SECRET", "")
    monkeypatch.setattr(settings, "WHATSAPP_TEMPLATE_NAME", "")


def _vendedor_client() -> TestClient:
    user = UserResponse(
        id=VENDEDOR_ID, email="vendedor@crm.com", full_name="Ejecutivo Comercial", role="ejecutivo_ventas"
    )
    headers = {"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {generate_simple_token(user)}"}
    return TestClient(app, headers=headers)


def _setup_client(client: TestClient, phone: str, assigned_to: str = VENDEDOR_ID, email: str | None = None):
    company = client.post("/api/companies", json={"name": f"Obras {phone}"}).json()
    contact = client.post(
        "/api/contacts",
        json={
            "first_name": "Juan",
            "last_name": "Pérez",
            "company_id": company["id"],
            "phone": phone,
            "email": email or f"juan.{''.join(ch for ch in phone if ch.isdigit())}@obrasdelsur.com.ar",
        },
    ).json()
    stages = client.get("/api/stages").json()
    opp = client.post(
        "/api/opportunities",
        json={
            "title": "Losa planta baja",
            "company_id": company["id"],
            "contact_id": contact["id"],
            "assigned_to": assigned_to,
            "stage_id": stages[0]["id"],
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


# ---------------------------------------------------------------------------
# Correo
# ---------------------------------------------------------------------------


def test_email_send_in_log_mode_stores_message_and_activity(client: TestClient):
    _, contact, opp = _setup_client(client, "11 4000-0001")
    res = client.post(
        "/api/email/send",
        json={
            "to": [contact["email"]],
            "cc": ["compras@obrasdelsur.com.ar", contact["email"].upper()],
            "subject": "Presupuesto Losa planta baja · Corralap",
            "html": "<p>Hola <strong>Juan</strong></p><script>alert(1)</script>",
            "attachments": [
                {"url": S3_URL, "name": "remito.pdf", "content_type": "application/pdf", "size_bytes": 2048}
            ],
            "opportunity_id": opp["id"],
        },
    )
    assert res.status_code == 201, res.text
    msg = res.json()
    assert msg["status"] == "simulado"
    assert msg["provider"] == "log"
    assert msg["channel"] == "email"
    assert msg["contact_id"] == contact["id"]
    assert msg["cc"] == ["compras@obrasdelsur.com.ar"]
    assert "<script>" not in msg["body_html"]
    assert msg["body_text"] == "Hola Juan"

    listed = client.get("/api/messages", params={"opportunity_id": opp["id"]}).json()
    assert [m["id"] for m in listed] == [msg["id"]]

    timeline = client.get(f"/api/opportunities/{opp['id']}/activities").json()
    assert timeline[0]["activity_type"] == "email"
    assert timeline[0]["summary"] == "Correo enviado: Presupuesto Losa planta baja · Corralap"
    assert timeline[0]["attachments"][0]["name"] == "remito.pdf"
    assert "simulado" in timeline[0]["description"]


def test_email_send_requires_content(client: TestClient):
    res = client.post("/api/email/send", json={"to": ["a@obrasdelsur.com.ar"], "subject": "Hola", "html": "<p> </p>"})
    assert res.status_code == 422


def test_email_send_with_resend(monkeypatch, client: TestClient):
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "resend")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test")
    calls = []

    def fake_post(url, json=None, headers=None, timeout=None):
        calls.append({"url": url, "json": json, "headers": headers})
        return _FakeResponse(200, {"id": "re_123"})

    monkeypatch.setattr(email_service.httpx, "post", fake_post)
    res = client.post(
        "/api/email/send",
        json={
            "to": ["cliente@obrasdelsur.com.ar"],
            "subject": "Presupuesto",
            "html": "<p>Adjunto el presupuesto.</p>",
            "attachments": [
                {"url": S3_URL, "name": "remito.pdf"},
                {"url": "http://169.254.169.254/latest", "name": "interno.txt"},
            ],
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "enviado"
    assert body["provider_message_id"] == "re_123"
    assert body["warnings"] == ["No se pudo adjuntar interno.txt"]

    sent = calls[0]
    assert sent["url"] == email_service.RESEND_URL
    assert sent["headers"]["Authorization"] == "Bearer re_test"
    assert sent["json"]["attachments"] == [{"filename": "remito.pdf", "path": S3_URL}]
    assert "CORRALAP" in sent["json"]["html"]
    assert "#FFC20E" in sent["json"]["html"]
    assert sent["json"]["text"] == "Adjunto el presupuesto."


def test_email_provider_error_returns_clear_message(monkeypatch, client: TestClient):
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "resend")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test")
    monkeypatch.setattr(
        email_service.httpx,
        "post",
        lambda *a, **k: _FakeResponse(403, {"message": "The domain is not verified"}),
    )
    res = client.post(
        "/api/email/send",
        json={"to": ["cliente@obrasdelsur.com.ar"], "subject": "Presupuesto", "html": "<p>Hola</p>"},
    )
    assert res.status_code == 502
    assert "proveedor de correo" in res.json()["detail"]


def test_smtp_skips_attachments_that_cannot_be_downloaded(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_USER", "")
    sent = {}

    class FakeSMTP:
        def __init__(self, host, port, timeout=None):
            sent["host"] = (host, port)

        def ehlo(self):
            pass

        def has_extn(self, name):
            return False

        def send_message(self, msg, to_addrs=None):
            sent["msg"] = msg
            sent["to"] = to_addrs

        def quit(self):
            pass

    def broken_stream(*args, **kwargs):
        raise httpx.ConnectError("sin red")

    monkeypatch.setattr(email_service.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(email_service.httpx, "stream", broken_stream)
    from backend.models.activity import ActivityAttachment

    result = email_service.send_email(
        to=["a@obrasdelsur.com.ar"],
        cc=["b@obrasdelsur.com.ar"],
        subject="Hola",
        html="<p>Hola</p>",
        text="Hola",
        attachments=[ActivityAttachment(url=S3_URL, name="remito.pdf")],
    )
    assert result.status == "enviado"
    assert result.warnings == ["No se pudo adjuntar remito.pdf"]
    assert sent["to"] == ["a@obrasdelsur.com.ar", "b@obrasdelsur.com.ar"]
    assert sent["msg"]["Subject"] == "Hola"


def test_sanitize_html_strips_dangerous_content():
    dirty = (
        '<p onclick="steal()" style="color:red">Hola <b>Juan</b></p>'
        "<script>alert(1)</script><style>p{}</style>"
        '<iframe src="https://evil.test">x</iframe>'
        '<a href="javascript:alert(1)">malo</a>'
        '<a href="jav&#x09;ascript:alert(1)">malo2</a>'
        '<a href="https://corralap.com" target="_blank">bueno</a>'
        '<span style="background:url(javascript:x)">texto</span>'
        "<ul><li>uno<li>dos</ul><img src=x onerror=alert(1)>"
    )
    clean = email_service.sanitize_html(dirty)
    for bad in ("onclick", "script", "alert", "<style", "iframe", "javascript", "onerror", "<img", "url("):
        assert bad not in clean.lower(), bad
    assert '<p style="color:red">Hola <b>Juan</b></p>' in clean
    assert '<a href="https://corralap.com" target="_blank" rel="noopener noreferrer">bueno</a>' in clean
    assert "<a>malo</a>" in clean
    assert "<span>texto</span>" in clean


def test_html_to_text_keeps_structure():
    html = (
        "<p>Hola <strong>Juan</strong>,</p><ul><li>Cemento</li><li>Arena</li></ul>"
        '<ol><li>Uno</li></ol><p><a href="https://corralap.com">Ver</a></p>'
        "<table><tr><th>Material</th><th>Total</th></tr><tr><td>Cemento</td><td>$ 100</td></tr></table>"
    )
    text = email_service.html_to_text(html)
    assert text.splitlines() == [
        "Hola Juan,",
        "",
        "• Cemento",
        "• Arena",
        "",
        "1. Uno",
        "",
        "Ver (https://corralap.com)",
        "",
        "Material | Total",
        "Cemento | $ 100",
    ]


# ---------------------------------------------------------------------------
# Permisos, llamadas y wa.me
# ---------------------------------------------------------------------------


def test_vendedor_cannot_contact_from_someone_elses_opportunity(client: TestClient):
    _, _, opp = _setup_client(client, "11 4000-0002", assigned_to=ADMIN_ID)
    _, _, own = _setup_client(client, "11 4000-0003", assigned_to=VENDEDOR_ID)
    with _vendedor_client() as vendedor:
        res = vendedor.post(
            "/api/email/send",
            json={
                "to": ["juan.perez@obrasdelsur.com.ar"],
                "subject": "Hola",
                "html": "<p>Hola</p>",
                "opportunity_id": opp["id"],
            },
        )
        assert res.status_code == 403
        assert (
            vendedor.post("/api/calls/log", json={"opportunity_id": opp["id"], "phone": "1140000002"}).status_code
            == 403
        )
        assert vendedor.get("/api/messages", params={"opportunity_id": opp["id"]}).status_code == 403
        assert (
            vendedor.post("/api/calls/log", json={"opportunity_id": own["id"], "phone": "1140000003"}).status_code
            == 201
        )


def test_whatsapp_log_and_call_log_create_activities(client: TestClient):
    _, contact, opp = _setup_client(client, "11 4000-0004")
    status = client.get("/api/whatsapp/status").json()
    assert status == {"configured": False, "template_available": False, "provider": None}

    res = client.post(
        "/api/whatsapp/log",
        json={"contact_id": contact["id"], "opportunity_id": opp["id"], "text": "Hola Juan, te paso el presupuesto"},
    )
    assert res.status_code == 201, res.text
    assert res.json()["activity_type"] == "whatsapp"
    assert res.json()["summary"] == "Se abrió WhatsApp con Juan Pérez"

    res = client.post("/api/calls/log", json={"opportunity_id": opp["id"], "phone": "11 4000-0004"})
    assert res.status_code == 201, res.text
    assert res.json()["activity_type"] == "llamada"
    assert res.json()["summary"] == "Llamada saliente a Juan Pérez"
    assert res.json()["contact_id"] == contact["id"]

    types = [a["activity_type"] for a in client.get(f"/api/opportunities/{opp['id']}/activities").json()]
    assert {"whatsapp", "llamada"} <= set(types)


def test_whatsapp_send_requires_configuration(client: TestClient):
    _, contact, _ = _setup_client(client, "11 4000-0005")
    res = client.post("/api/whatsapp/send", json={"contact_id": contact["id"], "text": "Hola"})
    assert res.status_code == 409


def test_normalize_phone_argentina():
    assert whatsapp_service.normalize_phone("+54 9 11 2233-4455") == "5491122334455"
    assert whatsapp_service.normalize_phone("11 2233-4455") == "5491122334455"
    assert whatsapp_service.normalize_phone("011 15 2233-4455") == "5491122334455"
    assert whatsapp_service.normalize_phone("(0221) 15-456-7890") == "5492214567890"
    assert whatsapp_service.normalize_phone("541122334455") == "5491122334455"
    assert whatsapp_service.normalize_phone("+1 415 555 0100") == "14155550100"
    assert whatsapp_service.normalize_phone("123") is None
    assert whatsapp_service.normalize_phone(None) is None


# ---------------------------------------------------------------------------
# WhatsApp Cloud API
# ---------------------------------------------------------------------------


def _inbound_payload(from_number: str, wamid: str, text: str) -> dict:
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "WABA",
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {"display_phone_number": "5491100000000", "phone_number_id": "PHONE_ID"},
                            "contacts": [{"profile": {"name": "Juan"}, "wa_id": from_number}],
                            "messages": [
                                {
                                    "from": from_number,
                                    "id": wamid,
                                    "timestamp": str(int(time.time())),
                                    "type": "text",
                                    "text": {"body": text},
                                }
                            ],
                        },
                    }
                ],
            }
        ],
    }


def test_webhook_verification(monkeypatch, raw_client: TestClient):
    monkeypatch.setattr(settings, "WHATSAPP_VERIFY_TOKEN", "palabra-secreta")
    ok = raw_client.get(
        "/api/whatsapp/webhook",
        params={"hub.mode": "subscribe", "hub.verify_token": "palabra-secreta", "hub.challenge": "1158201444"},
    )
    assert ok.status_code == 200
    assert ok.text == "1158201444"

    bad = raw_client.get(
        "/api/whatsapp/webhook",
        params={"hub.mode": "subscribe", "hub.verify_token": "otra", "hub.challenge": "1158201444"},
    )
    assert bad.status_code == 403


def test_webhook_inbound_message_is_stored_with_activity(client: TestClient, raw_client: TestClient):
    _, contact, opp = _setup_client(client, "+54 9 11 4000-0006")
    # Una actividad previa con fecha por defecto: el entrante no debe mezclar fechas con y sin zona.
    assert client.post("/api/calls/log", json={"opportunity_id": opp["id"], "phone": "1140000006"}).status_code == 201
    payload = _inbound_payload("5491140000006", "wamid.IN.0006", "Hola, ¿me confirman la entrega del lunes?")

    res = raw_client.post("/api/whatsapp/webhook", json=payload)
    assert res.status_code == 200
    assert res.json()["received"] == 1
    # Meta reintenta: el mismo mensaje no se duplica.
    assert raw_client.post("/api/whatsapp/webhook", json=payload).json()["received"] == 0

    conv = client.get("/api/whatsapp/conversation", params={"contact_id": contact["id"]}).json()
    assert conv["phone"] == "5491140000006"
    assert conv["window_open"] is True
    assert conv["contact_name"] == "Juan Pérez"
    assert [m["direction"] for m in conv["messages"]] == ["entrante"]
    assert conv["messages"][0]["opportunity_id"] == opp["id"]

    timeline = client.get(f"/api/opportunities/{opp['id']}/activities").json()
    received = [a for a in timeline if a["activity_type"] == "whatsapp"]
    assert len(received) == 1
    assert received[0]["summary"].startswith("WhatsApp recibido: Hola, ¿me confirman")
    assert client.get(f"/api/opportunities/{opp['id']}").status_code == 200


def test_webhook_signature_is_checked_when_app_secret_is_set(monkeypatch, raw_client: TestClient):
    monkeypatch.setattr(settings, "WHATSAPP_APP_SECRET", "app-secret")
    body = json.dumps(_inbound_payload("5491140000007", "wamid.IN.0007", "Hola")).encode()

    unsigned = raw_client.post("/api/whatsapp/webhook", content=body, headers={"Content-Type": "application/json"})
    assert unsigned.status_code == 403
    forged = raw_client.post(
        "/api/whatsapp/webhook",
        content=body,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": "sha256=deadbeef"},
    )
    assert forged.status_code == 403

    signature = hmac.new(b"app-secret", body, hashlib.sha256).hexdigest()
    signed = raw_client.post(
        "/api/whatsapp/webhook",
        content=body,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": f"sha256={signature}"},
    )
    assert signed.status_code == 200


def test_whatsapp_send_status_updates_and_window_errors(monkeypatch, client: TestClient, raw_client: TestClient):
    monkeypatch.setattr(settings, "WHATSAPP_TOKEN", "EAAG-test")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "PHONE_ID")
    _, contact, opp = _setup_client(client, "11 4000-0008")
    calls = []

    def fake_post(url, json=None, headers=None, timeout=None):
        calls.append({"url": url, "json": json, "headers": headers})
        return _FakeResponse(200, {"messaging_product": "whatsapp", "messages": [{"id": "wamid.OUT.0008"}]})

    monkeypatch.setattr(whatsapp_service.httpx, "post", fake_post)
    res = client.post(
        "/api/whatsapp/send",
        json={
            "contact_id": contact["id"],
            "opportunity_id": opp["id"],
            "text": "Hola Juan, ¿recibiste el presupuesto?",
        },
    )
    assert res.status_code == 201, res.text
    assert res.json()["status"] == "enviado"
    assert calls[0]["url"].endswith("/PHONE_ID/messages")
    assert calls[0]["json"]["to"] == "5491140000008"
    assert calls[0]["headers"]["Authorization"] == "Bearer EAAG-test"

    # Un segundo mensaje enseguida no suma otra actividad: es la misma conversación.
    client.post(
        "/api/whatsapp/send", json={"contact_id": contact["id"], "opportunity_id": opp["id"], "text": "Avisame"}
    )
    whatsapp_acts = [
        a for a in client.get(f"/api/opportunities/{opp['id']}/activities").json() if a["activity_type"] == "whatsapp"
    ]
    assert len(whatsapp_acts) == 1
    assert whatsapp_acts[0]["summary"] == "WhatsApp: Hola Juan, ¿recibiste el presupuesto?"

    status_payload = {
        "entry": [
            {
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "metadata": {"phone_number_id": "PHONE_ID"},
                            "statuses": [{"id": "wamid.OUT.0008", "status": "read", "recipient_id": "5491140000008"}],
                        },
                    }
                ]
            }
        ]
    }
    assert raw_client.post("/api/whatsapp/webhook", json=status_payload).json()["statuses"] == 1
    conv = client.get("/api/whatsapp/conversation", params={"contact_id": contact["id"]}).json()
    assert conv["messages"][0]["status"] == "leido"
    assert conv["window_open"] is False

    monkeypatch.setattr(
        whatsapp_service.httpx,
        "post",
        lambda *a, **k: _FakeResponse(
            400, {"error": {"message": "Re-engagement message", "code": 131047, "type": "OAuthException"}}
        ),
    )
    res = client.post("/api/whatsapp/send", json={"contact_id": contact["id"], "text": "¿Seguís ahí?"})
    assert res.status_code == 422
    assert "24 h" in res.json()["detail"]
    conv = client.get("/api/whatsapp/conversation", params={"contact_id": contact["id"]}).json()
    assert conv["messages"][-1]["status"] == "fallido"
    assert "24 h" in conv["messages"][-1]["error"]
