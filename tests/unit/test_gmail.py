"""Gmail del vendedor con la API de Google simulada: conexión, envío en hilo y sincronización sin duplicados."""

import base64
import json
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from backend.config import settings
from backend.controllers.auth_controller import generate_simple_token
from backend.main import app
from backend.models.auth import UserResponse
from backend.services import gmail_service

VENDEDOR_ID = "00000000-0000-0000-0000-000000000002"
SELLER_EMAIL = "lucia.corralap@gmail.com"


class _Resp:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload
        self.text = json.dumps(payload)

    def json(self):
        return self._payload


def _b64(text: str) -> str:
    return base64.urlsafe_b64encode(text.encode()).decode().rstrip("=")


class FakeGoogle:
    """Google OAuth + Gmail en memoria."""

    def __init__(self):
        self.sent: list[dict] = []
        self.threads: dict[str, list[dict]] = {}
        self.token_calls: list[dict] = []
        self.revoked: list[str] = []

    def post(self, url, data=None, json=None, headers=None, timeout=None):
        if url == gmail_service.TOKEN_URL:
            self.token_calls.append(data)
            return _Resp(
                200,
                {
                    "access_token": "ya29.acceso",
                    "refresh_token": "1//refresco",
                    "expires_in": 3600,
                    "scope": " ".join(gmail_service.SCOPES),
                },
            )
        if url == gmail_service.REVOKE_URL:
            self.revoked.append(data["token"])
            return _Resp(200, {})
        raise AssertionError(f"POST inesperado a {url}")

    def request(self, method, url, headers=None, timeout=None, json=None, params=None):
        path = url.removeprefix(gmail_service.API)
        assert headers["Authorization"] == "Bearer ya29.acceso"
        if path == "/profile":
            return _Resp(200, {"emailAddress": SELLER_EMAIL})
        if path == "/messages/send":
            gid = f"g{len(self.sent) + 1}"
            thread = json.get("threadId") or f"t{len(self.sent) + 1}"
            self.sent.append(json)
            self.threads.setdefault(thread, []).append(
                {
                    "id": gid,
                    "labelIds": ["SENT"],
                    "internalDate": "1767225600000",
                    "payload": {"headers": [{"name": "From", "value": SELLER_EMAIL}]},
                }
            )
            return _Resp(200, {"id": gid, "threadId": thread})
        if path.startswith("/messages/"):
            return _Resp(200, {"payload": {"headers": [{"name": "Message-ID", "value": "<abc@mail.gmail.com>"}]}})
        if path.startswith("/threads/"):
            return _Resp(200, {"messages": self.threads.get(path.split("/")[-1], [])})
        raise AssertionError(f"{method} inesperado a {url}")

    def client_replies(self, thread_id: str, text: str):
        self.threads[thread_id].append(
            {
                "id": f"r{len(self.threads[thread_id])}",
                "labelIds": ["INBOX"],
                "internalDate": "1767312000000",
                "payload": {
                    "mimeType": "multipart/alternative",
                    "headers": [
                        {"name": "From", "value": "Marta Gómez <marta@obra.com.ar>"},
                        {"name": "Subject", "value": "Re: Presupuesto platea"},
                        {"name": "Message-ID", "value": "<resp1@obra.com.ar>"},
                    ],
                    "parts": [{"mimeType": "text/plain", "body": {"data": _b64(text)}}],
                },
            }
        )


@pytest.fixture
def google(monkeypatch):
    fake = FakeGoogle()
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "cliente.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "secreto")
    monkeypatch.setattr(settings, "FRONTEND_URL", "http://localhost:3000")
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "log")
    monkeypatch.setattr(settings, "CRON_SECRET", "cron-secreto")
    monkeypatch.setattr(gmail_service.httpx, "post", fake.post)
    monkeypatch.setattr(gmail_service.httpx, "request", fake.request)
    gmail_service._mock_accounts.clear()
    yield fake
    gmail_service._mock_accounts.clear()


@pytest.fixture
def seller() -> TestClient:
    user = UserResponse(id=VENDEDOR_ID, email="vendedor@crm.com", full_name="Lucía Fernández", role="ejecutivo_ventas")
    headers = {"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {generate_simple_token(user)}"}
    return TestClient(app, headers=headers)


def _connect(seller: TestClient) -> None:
    url = seller.get("/api/gmail/connect").json()["url"]
    state = parse_qs(urlparse(url).query)["state"][0]
    res = TestClient(app).get(
        "/api/gmail/callback", params={"code": "4/codigo", "state": state}, follow_redirects=False
    )
    assert res.status_code == 303
    assert res.headers["location"] == "http://localhost:3000/cuenta/correo?gmail=conectado"


def _quote(client: TestClient, tag: str):
    company = client.post("/api/companies", json={"name": f"Constructora Gmail {tag}"}).json()
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
    return client.post(
        "/api/opportunities",
        json={
            "title": "Platea",
            "company_id": company["id"],
            "contact_id": contact["id"],
            "assigned_to": VENDEDOR_ID,
            "stage_id": stages[0]["id"],
        },
    ).json()


def test_connect_url_asks_offline_access_with_both_scopes(google, seller):
    url = seller.get("/api/gmail/connect").json()["url"]
    q = parse_qs(urlparse(url).query)
    assert q["access_type"] == ["offline"]
    assert set(q["scope"][0].split()) == set(gmail_service.SCOPES)


def test_callback_stores_encrypted_tokens(google, seller):
    _connect(seller)
    row = gmail_service._mock_accounts[VENDEDOR_ID]
    assert row["email"] == SELLER_EMAIL
    assert "1//refresco" not in row["refresh_token_enc"]
    assert gmail_service.decrypt(row["refresh_token_enc"]) == "1//refresco"
    status = seller.get("/api/gmail/status").json()
    assert status == {**status, "connected": True, "email": SELLER_EMAIL}


def test_callback_rejects_tampered_state(google):
    state = gmail_service.make_state(VENDEDOR_ID)
    encoded, _, sig = state.partition(".")
    other = gmail_service.make_state("00000000-0000-0000-0000-000000000001").partition(".")[0]
    res = TestClient(app).get(
        "/api/gmail/callback", params={"code": "x", "state": f"{other}.{sig}"}, follow_redirects=False
    )
    assert "gmail=error" in res.headers["location"]
    assert gmail_service._mock_accounts == {}


def test_without_gmail_falls_back_to_crm_provider(google, seller, client):
    opp = _quote(client, "respaldo")
    res = seller.post(
        "/api/email/send",
        json={
            "to": ["marta@obra.com.ar"],
            "subject": "Presupuesto",
            "html": "<p>Hola</p>",
            "opportunity_id": opp["id"],
        },
    )
    assert res.status_code == 201, res.text
    assert res.json()["provider"] == "log"
    assert google.sent == []


def test_send_reply_sync_and_no_duplicates(google, seller, client):
    _connect(seller)
    opp = _quote(client, "hilo")
    sent = seller.post(
        "/api/email/send",
        json={
            "to": ["marta@obra.com.ar"],
            "subject": "Presupuesto platea",
            "html": "<p>Hola Marta</p>",
            "opportunity_id": opp["id"],
        },
    ).json()
    assert sent["provider"] == "gmail"
    assert sent["thread_id"] == "t1"
    assert sent["from_address"] == SELLER_EMAIL
    raw = base64.urlsafe_b64decode(google.sent[0]["raw"]).decode()
    assert f"From: =?utf-8?q?Luc=C3=ADa_Fern=C3=A1ndez?= <{SELLER_EMAIL}>" in raw or SELLER_EMAIL in raw

    google.client_replies(
        "t1", "Dale, pasen el jueves.\n\nEl lun, 1 ene 2026 a las 10:00, Lucía escribió:\n> Hola Marta"
    )
    first = seller.post("/api/gmail/sync", json={"opportunity_id": opp["id"], "force": True}).json()
    assert first["new_messages"] == 1
    again = seller.post("/api/gmail/sync", json={"opportunity_id": opp["id"], "force": True}).json()
    assert again["new_messages"] == 0

    msgs = seller.get("/api/messages", params={"opportunity_id": opp["id"]}).json()
    inbound = [m for m in msgs if m["direction"] == "entrante"]
    assert len(inbound) == 1
    assert inbound[0]["body_text"] == "Dale, pasen el jueves."
    assert inbound[0]["thread_id"] == "t1"

    acts = seller.get(f"/api/opportunities/{opp['id']}/activities").json()
    assert any(a["summary"] == "Correo recibido: Re: Presupuesto platea" for a in acts)

    # Responder dentro del hilo: mismo threadId y cabecera In-Reply-To.
    reply = seller.post(
        "/api/email/send",
        json={
            "to": ["marta@obra.com.ar"],
            "subject": "Re: Presupuesto platea",
            "html": "<p>Perfecto, el jueves vamos.</p>",
            "opportunity_id": opp["id"],
            "reply_to_message_id": inbound[0]["id"],
        },
    ).json()
    assert reply["thread_id"] == "t1"
    assert google.sent[1]["threadId"] == "t1"
    assert "In-Reply-To: <resp1@obra.com.ar>" in base64.urlsafe_b64decode(google.sent[1]["raw"]).decode()


def test_disconnect_revokes_and_forgets(google, seller):
    _connect(seller)
    assert seller.delete("/api/gmail/connection").status_code == 204
    assert google.revoked == ["1//refresco"]
    assert seller.get("/api/gmail/status").json()["connected"] is False


def test_cron_requires_secret(google):
    assert TestClient(app).get("/api/gmail/cron").status_code == 401
    ok = TestClient(app).get("/api/gmail/cron", headers={"Authorization": "Bearer cron-secreto"})
    assert ok.status_code == 200


def test_strip_quoted_keeps_only_new_text():
    text = "Gracias!\nNos vemos.\n\nOn Mon, Jan 1, 2026 at 10:00 AM Lucía wrote:\n> viejo"
    assert gmail_service.strip_quoted(text) == "Gracias!\nNos vemos."
