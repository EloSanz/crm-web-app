"""Clientes asignados: el vendedor ve los suyos y la cartera libre; reasignar es de los managers (reglas 11 y 12)."""

from fastapi.testclient import TestClient

from backend.config import settings
from backend.controllers.auth_controller import generate_simple_token
from backend.main import app
from backend.models.auth import UserResponse

VENDEDOR_ID = "00000000-0000-0000-0000-000000000002"
OTRO_ID = "00000000-0000-0000-0000-000000000004"


def _as(user_id: str, role: str) -> TestClient:
    user = UserResponse(id=user_id, email=f"{user_id[-2:]}@crm.com", full_name="Usuario", role=role)
    return TestClient(
        app, headers={"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {generate_simple_token(user)}"}
    )


def test_seller_created_client_is_assigned_to_them(client: TestClient):
    seller = _as(VENDEDOR_ID, "ejecutivo_ventas")
    co = seller.post("/api/companies", json={"name": "Propia del vendedor", "assigned_to": OTRO_ID}).json()
    assert co["assigned_to"] == VENDEDOR_ID
    ct = seller.post("/api/contacts", json={"first_name": "Lola", "last_name": "Mía"}).json()
    assert ct["assigned_to"] == VENDEDOR_ID


def test_seller_sees_own_and_free_clients_but_not_others(client: TestClient):
    mine = client.post("/api/companies", json={"name": "Cliente mío PC", "assigned_to": VENDEDOR_ID}).json()
    free = client.post("/api/companies", json={"name": "Cliente libre PC"}).json()
    other = client.post("/api/companies", json={"name": "Cliente de otro PC", "assigned_to": OTRO_ID}).json()
    seller = _as(VENDEDOR_ID, "ejecutivo_ventas")
    ids = {c["id"] for c in seller.get("/api/companies", params={"limit": 500}).json()}
    assert mine["id"] in ids and free["id"] in ids and other["id"] not in ids
    assert seller.get(f"/api/companies/{other['id']}").status_code == 403
    assert seller.get(f"/api/companies/{free['id']}").status_code == 200
    # El responsable comercial ve todo.
    manager = _as("00000000-0000-0000-0000-000000000003", "gerente_comercial")
    assert other["id"] in {c["id"] for c in manager.get("/api/companies", params={"limit": 500}).json()}


def test_only_managers_reassign_and_owner_edits(client: TestClient):
    co = client.post("/api/companies", json={"name": "Reasignable PC", "assigned_to": VENDEDOR_ID}).json()
    seller = _as(VENDEDOR_ID, "ejecutivo_ventas")
    assert seller.put(f"/api/companies/{co['id']}", json={"notes": "Llamar el lunes"}).status_code == 200
    assert seller.put(f"/api/companies/{co['id']}", json={"assigned_to": OTRO_ID}).status_code == 403
    # Tampoco puede dejarlo sin responsable (pasarlo a la cartera libre).
    assert seller.put(f"/api/companies/{co['id']}", json={"assigned_to": None}).status_code == 403
    manager = _as("00000000-0000-0000-0000-000000000003", "gerente_comercial")
    res = manager.put(f"/api/companies/{co['id']}", json={"assigned_to": OTRO_ID})
    assert res.status_code == 200 and res.json()["assigned_to"] == OTRO_ID
    # Ya no es suyo: no lo puede editar ni ver.
    assert seller.put(f"/api/companies/{co['id']}", json={"notes": "x"}).status_code == 403


def test_seller_cannot_deactivate_a_free_client(client: TestClient):
    free = client.post("/api/companies", json={"name": "Libre no se borra PC"}).json()
    seller = _as(VENDEDOR_ID, "ejecutivo_ventas")
    assert seller.delete(f"/api/companies/{free['id']}").status_code == 403
    assert client.delete(f"/api/companies/{free['id']}").status_code == 204


def test_contact_reassignment_is_for_managers(client: TestClient):
    ct = client.post(
        "/api/contacts", json={"first_name": "Mara", "last_name": "Vega", "assigned_to": VENDEDOR_ID}
    ).json()
    seller = _as(VENDEDOR_ID, "ejecutivo_ventas")
    assert seller.put(f"/api/contacts/{ct['id']}", json={"assigned_to": OTRO_ID}).status_code == 403
    assert client.put(f"/api/contacts/{ct['id']}", json={"assigned_to": OTRO_ID}).status_code == 200
    assert seller.get(f"/api/contacts/{ct['id']}").status_code == 403
