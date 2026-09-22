from fastapi.testclient import TestClient

from backend.config import settings
from backend.controllers.auth_controller import generate_simple_token
from backend.main import app
from backend.models.auth import UserResponse
from backend.models.company import CompanyCreate
from backend.services.activity_service import _with_attachments

ADMIN_ID = "00000000-0000-0000-0000-000000000001"
VENDEDOR_ID = "00000000-0000-0000-0000-000000000002"
OTRO_VENDEDOR_ID = "00000000-0000-0000-0000-000000000009"


def _client_as(user_id: str, role: str, name: str) -> TestClient:
    user = UserResponse(id=user_id, email=f"{user_id[-4:]}@crm.com", full_name=name, role=role)
    headers = {"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {generate_simple_token(user)}"}
    return TestClient(app, headers=headers)


def _first_stage(client: TestClient) -> dict:
    return sorted(client.get("/api/stages").json(), key=lambda s: s["position"])[0]


def _company(client: TestClient, name: str, status: str = "cliente") -> str:
    res = client.post("/api/companies", json={"name": name, "status": status})
    assert res.status_code == 201
    return res.json()["id"]


def test_vendedor_only_sees_and_touches_own_quotes(client: TestClient):
    stage = _first_stage(client)
    company = _company(client, "Constructora Permisos SRL")
    other = client.post(
        "/api/opportunities",
        json={
            "title": "De otro vendedor",
            "company_id": company,
            "assigned_to": OTRO_VENDEDOR_ID,
            "stage_id": stage["id"],
        },
    ).json()

    with _client_as(VENDEDOR_ID, "ejecutivo_ventas", "Ejecutivo Comercial") as vendedor:
        # Aunque mande otro responsable, queda asignado a quien lo crea.
        mine = vendedor.post(
            "/api/opportunities",
            json={"title": "Mío", "company_id": company, "assigned_to": OTRO_VENDEDOR_ID, "stage_id": stage["id"]},
        )
        assert mine.status_code == 201
        assert mine.json()["assigned_to"] == VENDEDOR_ID

        listed = {o["id"] for o in vendedor.get("/api/opportunities").json()}
        assert mine.json()["id"] in listed
        assert other["id"] not in listed

        assert vendedor.get(f"/api/opportunities/{other['id']}").status_code == 403
        assert vendedor.get(f"/api/opportunities/{other['id']}/activities").status_code == 403
        assert vendedor.put(f"/api/opportunities/{other['id']}", json={"title": "Robado"}).status_code == 403

    # El administrador ve todo.
    all_ids = {o["id"] for o in client.get("/api/opportunities").json()}
    assert other["id"] in all_ids


def test_inactive_company_cannot_get_quotes(client: TestClient):
    stage = _first_stage(client)
    company = _company(client, "Empresa Dormida SA", status="inactivo")
    res = client.post(
        "/api/opportunities",
        json={"title": "No debería", "company_id": company, "assigned_to": ADMIN_ID, "stage_id": stage["id"]},
    )
    assert res.status_code == 400
    assert "inactiva" in res.json()["detail"]


def test_discounts_versions_and_milestones(client: TestClient):
    stages = sorted(client.get("/api/stages").json(), key=lambda s: s["position"])
    company = _company(client, "Constructora Versiones SRL")
    created = client.post(
        "/api/opportunities",
        json={
            "title": "Losa y columnas",
            "company_id": company,
            "assigned_to": ADMIN_ID,
            "stage_id": stages[0]["id"],
            "discount_pct": 10,
            "items": [
                {
                    "product_name": "Cemento 50 kg",
                    "quantity": 100,
                    "unit_price": 9000,
                    "list_price": 9800,
                    "price_tier": "mayorista",
                },
                {"product_name": "Hierro 12 mm", "quantity": 10, "unit_price": 17800, "discount_pct": 5},
            ],
        },
    )
    assert created.status_code == 201
    opp = created.json()
    # (100 × 9000) + (10 × 17800 × 0,95) = 900.000 + 169.100 = 1.069.100 − 10 % = 962.190
    assert float(opp["estimated_value"]) == 962190.0
    assert opp["current_version"] == 1
    assert opp["items"][0]["price_tier"] == "mayorista"

    # Agregan materiales en la negociación: nueva versión, la anterior queda guardada.
    updated = client.put(
        f"/api/opportunities/{opp['id']}",
        json={
            "version_note": "Sumaron la platea",
            "items": [
                {"product_name": "Cemento 50 kg", "quantity": 150, "unit_price": 9000, "price_tier": "mayorista"},
                {"product_name": "Hierro 12 mm", "quantity": 10, "unit_price": 17800, "discount_pct": 5},
            ],
        },
    ).json()
    assert updated["current_version"] == 2
    versions = client.get(f"/api/opportunities/{opp['id']}/versions").json()
    assert [v["version"] for v in versions] == [2, 1]
    assert float(versions[1]["total"]) == 962190.0
    assert versions[0]["note"] == "Sumaron la platea"

    # Cambio de etapa: queda el hito con fecha y hora.
    client.put(f"/api/opportunities/{opp['id']}", json={"stage_id": stages[1]["id"]})
    timeline = client.get(f"/api/opportunities/{opp['id']}/timeline").json()
    kinds = [e["kind"] for e in timeline]
    assert "version" in kinds and kinds.count("etapa") >= 2
    assert timeline[0]["kind"] == "etapa" and timeline[0]["to_stage_id"] == stages[1]["id"]
    version_event = next(e for e in timeline if e["kind"] == "version")
    assert float(version_event["previous_total"]) == 962190.0


def test_contacts_cannot_repeat_dni_phone_or_email(client: TestClient):
    base = {
        "first_name": "Juan",
        "last_name": "Duplicado",
        "document_number": "41.987.654",
        "phone": "+54 9 11 4999-0001",
        "email": "juan.duplicado@obras-test.com",
    }
    first = client.post("/api/contacts", json=base)
    assert first.status_code == 201

    for field, value in [
        ("document_number", "41987654"),
        ("phone", "11 4999 0001"),
        ("email", "JUAN.duplicado@obras-test.com "),
    ]:
        payload = {"first_name": "Otro", "last_name": "Contacto", field: value}
        res = client.post("/api/contacts", json=payload)
        assert res.status_code == 409, field
        assert "Juan Duplicado" in res.json()["detail"]

    # Editar el mismo contacto sin cambiar sus datos no choca consigo mismo.
    res = client.put(
        f"/api/contacts/{first.json()['id']}", json={"email": "juan.duplicado@obras-test.com", "notes": "ok"}
    )
    assert res.status_code == 200


def test_legacy_attachments_in_description_are_recovered():
    item = {
        "description": "Pasé por la obra\n\nAdjuntos:\nfoto losa.jpg: https://bucket.s3.amazonaws.com/crm/adjuntos/a1.jpg\nremito: 12.pdf: https://bucket.s3.amazonaws.com/crm/adjuntos/b2.pdf",
        "attachments": [],
    }
    out = _with_attachments(item)
    assert out["description"] == "Pasé por la obra"
    assert [a["name"] for a in out["attachments"]] == ["foto losa.jpg", "remito: 12.pdf"]
    assert out["attachments"][0]["content_type"] == "image/jpeg"
    assert out["attachments"][1]["content_type"] == "application/pdf"


def test_cuit_gets_its_dashes():
    assert CompanyCreate(name="Corralón SA", cuit="30712345678").cuit == "30-71234567-8"
    assert CompanyCreate(name="Corralón SA", cuit="30-71234567-8").cuit == "30-71234567-8"


def test_demo_data_is_local_only_and_admin_only(client: TestClient, monkeypatch):
    with _client_as(VENDEDOR_ID, "ejecutivo_ventas", "Ejecutivo Comercial") as vendedor:
        assert vendedor.post("/api/dev/demo").status_code == 403

    res = client.post("/api/dev/demo")
    assert res.status_code == 200
    assert res.json()["presupuestos"] > 0

    # Con Supabase configurado (producción) el endpoint no existe.
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://abcd.supabase.co")
    assert client.post("/api/dev/demo").status_code == 404
