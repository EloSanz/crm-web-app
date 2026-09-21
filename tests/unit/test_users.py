from fastapi.testclient import TestClient

from backend.config import settings
from backend.controllers.auth_controller import generate_simple_token
from backend.main import app
from backend.models.auth import UserResponse

VENDEDOR_ID = "00000000-0000-0000-0000-000000000002"


def _vendedor_client() -> TestClient:
    user = UserResponse(
        id=VENDEDOR_ID, email="vendedor@crm.com", full_name="Ejecutivo Comercial", role="ejecutivo_ventas"
    )
    headers = {"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {generate_simple_token(user)}"}
    return TestClient(app, headers=headers)


def test_list_users_includes_demo_roles(client: TestClient):
    res = client.get("/api/users")
    assert res.status_code == 200
    roles = {u["role"] for u in res.json()}
    assert {"admin", "ejecutivo_ventas", "gerente_comercial"} <= roles


def test_admin_creates_and_deactivates_user(client: TestClient):
    res = client.post(
        "/api/users",
        json={"email": "nuevo.vendedor@crm.com", "full_name": "Nuevo Vendedor", "role": "ejecutivo_ventas"},
    )
    assert res.status_code == 201
    user = res.json()
    assert user["is_active"] is True

    res = client.put(f"/api/users/{user['id']}", json={"is_active": False, "role": "gerente_comercial"})
    assert res.status_code == 200
    assert res.json()["is_active"] is False
    assert res.json()["role"] == "gerente_comercial"


def test_duplicate_email_is_rejected(client: TestClient):
    res = client.post("/api/users", json={"email": "admin@crm.com", "full_name": "Otro Admin", "role": "admin"})
    assert res.status_code == 409


def test_vendedor_cannot_manage_users():
    with _vendedor_client() as vendedor:
        res = vendedor.post("/api/users", json={"email": "x@crm.com", "full_name": "Equis", "role": "admin"})
        assert res.status_code == 403


def test_only_managers_reassign_opportunities(client: TestClient):
    comp = client.post("/api/companies", json={"name": "Reasignaciones SRL"}).json()
    stages = client.get("/api/stages").json()
    opp = client.post(
        "/api/opportunities",
        json={
            "title": "Presupuesto a reasignar",
            "company_id": comp["id"],
            "assigned_to": VENDEDOR_ID,
            "stage_id": stages[0]["id"],
        },
    ).json()
    assert opp["assigned_to_name"] == "Ejecutivo Comercial"

    with _vendedor_client() as vendedor:
        res = vendedor.put(
            f"/api/opportunities/{opp['id']}", json={"assigned_to": "00000000-0000-0000-0000-000000000003"}
        )
        assert res.status_code == 403
        # Cambiar otros datos sin tocar el responsable sigue permitido
        res = vendedor.put(
            f"/api/opportunities/{opp['id']}", json={"title": "Presupuesto renombrado", "assigned_to": VENDEDOR_ID}
        )
        assert res.status_code == 200

    res = client.put(f"/api/opportunities/{opp['id']}", json={"assigned_to": "00000000-0000-0000-0000-000000000003"})
    assert res.status_code == 200
    assert res.json()["assigned_to_name"] == "Responsable Comercial"


def test_activity_keeps_attachments(client: TestClient):
    comp = client.post("/api/companies", json={"name": "Adjuntos SA"}).json()
    stages = client.get("/api/stages").json()
    opp = client.post(
        "/api/opportunities",
        json={
            "title": "Presupuesto con remito",
            "company_id": comp["id"],
            "assigned_to": VENDEDOR_ID,
            "stage_id": stages[0]["id"],
        },
    ).json()
    res = client.post(
        "/api/activities",
        json={
            "opportunity_id": opp["id"],
            "activity_type": "visita_obra",
            "summary": "Foto del acopio en obra",
            "attachments": [
                {
                    "url": "https://example.com/acopio.jpg",
                    "name": "acopio.jpg",
                    "content_type": "image/jpeg",
                    "size_bytes": 1200,
                }
            ],
        },
    )
    assert res.status_code == 201
    assert res.json()["user_name"] == "Administrador CRM"
    timeline = client.get(f"/api/opportunities/{opp['id']}/activities").json()
    assert timeline[0]["attachments"][0]["name"] == "acopio.jpg"
