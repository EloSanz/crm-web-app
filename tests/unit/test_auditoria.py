"""Auditoría general (regla 15): cada cambio exitoso por la API deja quién, cuándo y sobre qué."""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.audit_middleware import REDACTED, describe, redact
from backend.config import settings
from backend.controllers.auth_controller import generate_simple_token
from backend.main import app
from backend.models.auth import UserResponse
from backend.services import audit_service

ADMIN_ID = "00000000-0000-0000-0000-000000000001"
VENDEDOR_ID = "00000000-0000-0000-0000-000000000002"
GERENTE_ID = "00000000-0000-0000-0000-000000000003"


def _as(user_id: str, role: str, name: str) -> TestClient:
    user = UserResponse(id=user_id, email=f"{role}@crm.com", full_name=name, role=role)
    headers = {"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {generate_simple_token(user)}"}
    return TestClient(app, headers=headers)


def _entries(**filters) -> list[dict]:
    page = audit_service.AuditService.list(limit=200, **filters)
    return [e.model_dump(mode="json") for e in page.items]


@pytest.fixture(autouse=True)
def _clean_audit():
    audit_service._mock_audit.clear()
    yield
    audit_service._mock_audit.clear()


def test_crear_editar_y_dar_de_baja_empresa_queda_auditado(client: TestClient):
    name = f"Corralón Auditado {uuid4().hex[:6]}"
    created = client.post("/api/companies", json={"name": name, "status": "potencial"})
    assert created.status_code == 201
    company_id = created.json()["id"]
    assert client.put(f"/api/companies/{company_id}", json={"phone": "11 5555-0000"}).status_code == 200
    assert client.delete(f"/api/companies/{company_id}").status_code == 204

    rows = _entries(entity="empresa", entity_id=company_id)
    assert [r["action"] for r in rows] == ["dar_de_baja", "modificar", "crear"]
    for r in rows:
        assert r["user_id"] == ADMIN_ID
        assert r["user_name"] == "Administrador CRM"
        assert r["user_role"] == "admin"
        assert r["entity"] == "empresa"
        assert r["entity_id"] == company_id
    alta, edicion = rows[2], rows[1]
    assert alta["method"] == "POST" and alta["path"] == "/api/companies"
    assert name in alta["summary"] and alta["changes"]["name"] == name
    assert edicion["changes"] == {"phone": "11 5555-0000"}
    assert "phone" in edicion["summary"]


def test_la_contrasena_al_crear_usuario_queda_redactada(client: TestClient):
    email = f"audit.{uuid4().hex[:6]}@crm.com"
    res = client.post(
        "/api/users",
        json={
            "email": email,
            "full_name": "Vendedora Auditada",
            "role": "ejecutivo_ventas",
            "password": "ladrillo2026",
        },
    )
    assert res.status_code == 201, res.text
    rows = _entries(entity="usuario")
    assert len(rows) == 1
    row = rows[0]
    assert row["action"] == "crear" and row["entity_id"] == res.json()["id"]
    assert row["changes"]["password"] == REDACTED
    assert row["changes"]["email"] == email
    assert "ladrillo2026" not in str(row)


def test_redaccion_en_cualquier_nivel():
    body = {
        "name": "x",
        "Authorization": "Bearer abc",
        "config": {"api_key": "k", "nested": [{"refresh_token": "r", "ok": 1}], "client_secret": "s"},
        "access_token": "t",
    }
    out = redact(body)
    assert out["name"] == "x" and out["Authorization"] == REDACTED and out["access_token"] == REDACTED
    assert out["config"]["api_key"] == REDACTED and out["config"]["client_secret"] == REDACTED
    assert out["config"]["nested"] == [{"refresh_token": REDACTED, "ok": 1}]


def test_un_get_no_se_audita(client: TestClient):
    assert client.get("/api/companies").status_code == 200
    assert client.get("/api/opportunities").status_code == 200
    assert audit_service._mock_audit == []


def test_un_pedido_fallido_no_se_audita(client: TestClient):
    assert client.post("/api/companies", json={}).status_code == 422
    assert client.put(f"/api/companies/{uuid4()}", json={"name": "No existe"}).status_code == 404
    seller = _as(VENDEDOR_ID, "ejecutivo_ventas", "Vendedor")
    assert seller.post("/api/users", json={"email": "x@crm.com"}).status_code in {403, 422}
    assert audit_service._mock_audit == []


def test_rutas_excluidas_no_se_auditan(client: TestClient):
    client.post("/api/auth/login", json={"email": "admin@crm.com", "password": "secreto123"})
    assert audit_service._mock_audit == []


def test_el_endpoint_sigue_recibiendo_el_json_del_body(client: TestClient):
    """El middleware copia el cuerpo sin consumirlo: el endpoint lo recibe completo."""
    payload = {
        "name": "Hormigones del Sur SA",
        "cuit": "30-71234567-9",
        "email": "ventas@hormigonesdelsur.com",
        "notes": "Pide entrega en obra los martes " + "x" * 2000,
    }
    res = client.post("/api/companies", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == payload["name"] and data["cuit"] == payload["cuit"]
    assert data["email"] == payload["email"] and data["notes"] == payload["notes"]

    upd = client.put(f"/api/companies/{data['id']}", json={"name": "Hormigones del Sur SRL"})
    assert upd.status_code == 200 and upd.json()["name"] == "Hormigones del Sur SRL"
    assert client.get(f"/api/companies/{data['id']}").json()["name"] == "Hormigones del Sur SRL"


def test_un_fallo_de_auditoria_no_rompe_el_pedido(client: TestClient, monkeypatch):
    def boom(**_):
        raise RuntimeError("base caída")

    monkeypatch.setattr(audit_service.AuditService, "record", staticmethod(boom))
    res = client.post("/api/companies", json={"name": "Sigue andando SA"})
    assert res.status_code == 201 and res.json()["name"] == "Sigue andando SA"


def test_endpoint_auditoria_permisos_y_paginacion(client: TestClient):
    for i in range(12):
        assert client.post("/api/companies", json={"name": f"Paginada {i:02d}"}).status_code == 201

    seller = _as(VENDEDOR_ID, "ejecutivo_ventas", "Vendedor")
    assert seller.get("/api/audit").status_code == 403

    manager = _as(GERENTE_ID, "gerente_comercial", "Responsable Comercial")
    first = manager.get("/api/audit", params={"entity": "empresa", "limit": 10, "offset": 0})
    assert first.status_code == 200
    body = first.json()
    assert body["total"] == 12 and body["limit"] == 10 and body["offset"] == 0
    assert len(body["items"]) == 10
    # Del más nuevo al más viejo.
    assert "Paginada 11" in body["items"][0]["summary"]

    second = manager.get("/api/audit", params={"entity": "empresa", "limit": 10, "offset": 10}).json()
    assert len(second["items"]) == 2 and "Paginada 00" in second["items"][-1]["summary"]

    by_user = manager.get("/api/audit", params={"user_id": VENDEDOR_ID}).json()
    assert by_user["total"] == 0
    by_admin = manager.get("/api/audit", params={"user_id": ADMIN_ID}).json()
    assert by_admin["total"] == 12


def test_describe_deriva_entidad_id_y_accion():
    oid = str(uuid4())
    assert describe("POST", "/api/opportunities", {"title": "Losa"}, {"id": oid}) == {
        "entity": "presupuesto",
        "entity_id": oid,
        "action": "crear",
        "summary": "Creó el presupuesto «Losa»",
    }
    d = describe("PUT", f"/api/stages/{oid}", {"is_active": False}, None)
    assert d["entity"] == "etapa" and d["action"] == "dar_de_baja" and d["entity_id"] == oid
    d = describe("PUT", "/api/catalogs/reorder", {"kind": "origin", "ids": []}, None)
    assert d["entity"] == "catálogo" and d["entity_id"] is None and d["action"] == "otra"
    d = describe("POST", f"/api/users/{oid}/password", {"password": "x"}, None)
    assert d["entity"] == "usuario" and d["entity_id"] == oid and d["action"] == "otra"
    d = describe("DELETE", f"/api/projects/{oid}", None, None)
    assert d["entity"] == "obra" and d["action"] == "dar_de_baja"
