from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.config import settings
from backend.controllers.auth_controller import generate_simple_token
from backend.main import app
from backend.models.auth import UserResponse
from backend.services.catalog_audit_service import diff_fields

ADMIN_ID = "00000000-0000-0000-0000-000000000001"
VENDEDOR_ID = "00000000-0000-0000-0000-000000000002"
GERENTE_ID = "00000000-0000-0000-0000-000000000003"


def _client_as(user_id: str, role: str, name: str) -> TestClient:
    user = UserResponse(id=user_id, email=f"{role}@crm.com", full_name=name, role=role)
    headers = {"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {generate_simple_token(user)}"}
    return TestClient(app, headers=headers)


def _new_material(client: TestClient, **extra) -> dict:
    payload = {
        "code": f"AUD-{uuid4().hex[:6]}",
        "name": "Hierro Aletado Ø 6 mm (Barra 12 m)",
        "category": "Hierros y Aceros",
        "unit": "barra 12m",
        "unit_price": "4600.00",
        **extra,
    }
    res = client.post("/api/products", json=payload)
    assert res.status_code == 201
    return res.json()


def _history(client: TestClient, product_id: str) -> list[dict]:
    res = client.get(f"/api/products/audit?product_id={product_id}")
    assert res.status_code == 200
    return res.json()


def test_audit_route_is_not_taken_as_product_id(client: TestClient):
    res = client.get("/api/products/audit")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_create_records_alta_with_loaded_fields(client: TestClient):
    product = _new_material(client, wholesale_price="4200.00", wholesale_min_qty="20")
    entries = _history(client, product["id"])
    assert len(entries) == 1
    alta = entries[0]
    assert alta["action"] == "alta"
    assert alta["product_code"] == product["code"]
    assert alta["product_name"] == product["name"]
    assert alta["user_id"] == ADMIN_ID
    assert alta["user_name"] == "Administrador CRM"
    assert alta["changes"]["unit_price"] == {"antes": None, "despues": 4600}
    assert alta["changes"]["wholesale_price"] == {"antes": None, "despues": 4200}
    assert alta["changes"]["wholesale_min_qty"] == {"antes": None, "despues": 20}
    assert "description" not in alta["changes"]


def test_update_records_only_changed_fields(client: TestClient):
    product = _new_material(client)
    res = client.put(
        f"/api/products/{product['id']}",
        json={"unit_price": "4990.50", "name": product["name"], "unit": "barra 12m", "is_active": False},
    )
    assert res.status_code == 200

    entries = _history(client, product["id"])
    assert [e["action"] for e in entries] == ["edicion", "alta"]
    changes = entries[0]["changes"]
    assert changes == {
        "unit_price": {"antes": 4600, "despues": 4990.5},
        "is_active": {"antes": True, "despues": False},
    }
    assert "updated_at" not in changes


def test_update_without_real_changes_is_not_recorded(client: TestClient):
    product = _new_material(client)
    client.put(f"/api/products/{product['id']}", json={"unit_price": "4600", "code": product["code"].lower()})
    assert [e["action"] for e in _history(client, product["id"])] == ["alta"]


def test_delete_records_baja_with_acting_user(client: TestClient):
    product = _new_material(client)
    with _client_as(GERENTE_ID, "gerente_comercial", "Responsable Comercial") as gerente:
        assert gerente.delete(f"/api/products/{product['id']}").status_code == 204

    entries = _history(client, product["id"])
    assert entries[0]["action"] == "baja"
    assert entries[0]["user_id"] == GERENTE_ID
    assert entries[0]["user_name"] == "Responsable Comercial"
    assert entries[0]["product_name"] == product["name"]


def test_audit_filters_by_user_and_text(client: TestClient):
    code = f"FIL-{uuid4().hex[:6]}"
    with _client_as(VENDEDOR_ID, "ejecutivo_ventas", "Ejecutivo Comercial") as vendedor:
        product = _new_material(vendedor, code=code)

    res = client.get(f"/api/products/audit?user_id={VENDEDOR_ID}")
    assert res.status_code == 200
    assert res.json()
    assert all(e["user_id"] == VENDEDOR_ID for e in res.json())
    assert any(e["product_id"] == product["id"] for e in res.json())

    res = client.get(f"/api/products/audit?q={code.lower()}")
    assert [e["product_id"] for e in res.json()] == [product["id"]]


def test_audit_is_newest_first_and_paginates(client: TestClient):
    product = _new_material(client)
    for price in ("4700", "4800", "4900"):
        client.put(f"/api/products/{product['id']}", json={"unit_price": price})

    entries = _history(client, product["id"])
    assert [e["changes"].get("unit_price", {}).get("despues") for e in entries[:3]] == [4900, 4800, 4700]
    assert entries[-1]["action"] == "alta"

    page = client.get(f"/api/products/audit?product_id={product['id']}&limit=2&offset=2").json()
    assert [e["id"] for e in page] == [e["id"] for e in entries[2:4]]


@pytest.mark.parametrize(
    ("user_id", "role", "name"),
    [
        (VENDEDOR_ID, "ejecutivo_ventas", "Ejecutivo Comercial"),
        (GERENTE_ID, "gerente_comercial", "Responsable Comercial"),
    ],
)
def test_audit_is_admin_only(user_id: str, role: str, name: str):
    with _client_as(user_id, role, name) as other:
        res = other.get("/api/products/audit")
        assert res.status_code == 403


def test_diff_fields_normalizes_values():
    before = {"unit_price": "9800.00", "description": None, "category": "Aglomerantes", "is_active": True}
    after = {"unit_price": 9800.0, "description": "", "category": "Aglomerantes", "is_active": True}
    assert diff_fields(before, after) == {}
    assert diff_fields(before, {"unit_price": 9500}) == {"unit_price": {"antes": 9800, "despues": 9500}}
