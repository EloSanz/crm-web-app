"""Obras: el vendedor ve y opera sólo las de sus clientes, la cartera libre y las que tienen presupuestos
suyos; toda obra pertenece a un cliente (empresa o contacto)."""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.config import settings
from backend.controllers.auth_controller import generate_simple_token
from backend.main import app
from backend.models.auth import UserResponse
from backend.services import project_service

VENDEDOR_ID = "00000000-0000-0000-0000-000000000002"
OTRO_ID = "00000000-0000-0000-0000-000000000004"
GERENTE_ID = "00000000-0000-0000-0000-000000000003"


def _as(user_id: str, role: str) -> TestClient:
    user = UserResponse(id=user_id, email=f"{user_id[-2:]}@crm.com", full_name="Usuario", role=role)
    return TestClient(
        app, headers={"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {generate_simple_token(user)}"}
    )


def _seller() -> TestClient:
    return _as(VENDEDOR_ID, "ejecutivo_ventas")


def _manager() -> TestClient:
    return _as(GERENTE_ID, "gerente_comercial")


def _company(client: TestClient, assigned_to: str | None = None) -> str:
    body = {"name": f"Constructora {uuid4().hex[:6]}"}
    if assigned_to:
        body["assigned_to"] = assigned_to
    return client.post("/api/companies", json=body).json()["id"]


def _contact(client: TestClient, assigned_to: str) -> str:
    body = {"first_name": "Rita", "last_name": f"Obra {uuid4().hex[:4]}", "assigned_to": assigned_to}
    return client.post("/api/contacts", json=body).json()["id"]


def _project(client: TestClient, **client_ids) -> str:
    body = {"name": f"Obra {uuid4().hex[:6]}", "address": "Av. de Mayo 100, Ramos Mejía", **client_ids}
    res = client.post("/api/projects", json=body)
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _quote(client: TestClient, assigned_to: str, project_id: str, **client_ids) -> None:
    stage = client.get("/api/stages").json()[0]["id"]
    body = {
        "title": f"Presupuesto {uuid4().hex[:4]}",
        "assigned_to": assigned_to,
        "stage_id": stage,
        "project_id": project_id,
        **client_ids,
    }
    res = client.post("/api/opportunities", json=body)
    assert res.status_code == 201, res.text


def _legacy_project_without_client() -> str:
    """Obra vieja sin cliente, cargada antes de la regla (por la API ya no se puede crear)."""
    pid = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    project_service._mock_projects[pid] = {
        "id": pid,
        "name": "Obra heredada sin cliente",
        "company_id": None,
        "contact_id": None,
        "address": "Calle 1 234, San Justo",
        "project_type": "refaccion",
        "status": "en_curso",
        "observations": None,
        "is_deleted": False,
        "created_at": now,
        "updated_at": now,
    }
    return pid


def _visible_ids(client: TestClient) -> set[str]:
    res = client.get("/api/projects", params={"limit": 1000})
    assert res.status_code == 200
    return {p["id"] for p in res.json()}


def test_seller_sees_only_projects_of_their_clients_free_portfolio_or_own_quotes(client: TestClient):
    mine = _project(client, company_id=_company(client, VENDEDOR_ID))
    free = _project(client, company_id=_company(client))
    other = _project(client, company_id=_company(client, OTRO_ID))
    my_contact = _contact(client, VENDEDOR_ID)
    by_contact = _project(client, contact_id=my_contact)
    # Obra de un cliente de otro vendedor, pero con un presupuesto mío (cargado a mi contacto).
    quoted = _project(client, company_id=_company(client, OTRO_ID))
    _quote(client, VENDEDOR_ID, quoted, contact_id=my_contact)
    # Obras sin cliente: cartera libre, salvo que la trabaje otro vendedor.
    legacy_free = _legacy_project_without_client()
    legacy_taken = _legacy_project_without_client()
    _quote(client, OTRO_ID, legacy_taken, contact_id=_contact(client, OTRO_ID))

    seller = _seller()
    ids = _visible_ids(seller)
    assert {mine, free, by_contact, quoted, legacy_free} <= ids
    assert other not in ids and legacy_taken not in ids

    assert seller.get(f"/api/projects/{mine}").status_code == 200
    assert seller.get(f"/api/projects/{quoted}").status_code == 200
    res = seller.get(f"/api/projects/{other}")
    assert res.status_code == 403 and "obras" in res.json()["detail"]
    assert seller.get(f"/api/projects/{legacy_taken}").status_code == 403

    # Los managers ven todo.
    assert {mine, free, other, by_contact, quoted, legacy_free, legacy_taken} <= _visible_ids(_manager())


def test_seller_cannot_create_project_for_a_foreign_client(client: TestClient):
    seller = _seller()
    body = {"name": "Obra ajena", "address": "Ruta 3 km 20"}
    assert seller.post("/api/projects", json={**body, "company_id": _company(client, OTRO_ID)}).status_code == 403
    assert seller.post("/api/projects", json={**body, "contact_id": _contact(client, OTRO_ID)}).status_code == 403
    res = seller.post("/api/projects", json={**body, "company_id": _company(client, VENDEDOR_ID)})
    assert res.status_code == 201


def test_project_without_client_is_rejected(client: TestClient):
    res = client.post("/api/projects", json={"name": "Obra huérfana", "address": "Sin cliente 123"})
    assert res.status_code == 422
    assert "cliente" in res.json()["detail"]
    # Al editar tampoco se le puede sacar el cliente.
    pid = _project(client, company_id=_company(client))
    assert client.put(f"/api/projects/{pid}", json={"company_id": None, "contact_id": None}).status_code == 422


def test_seller_cannot_edit_or_deactivate_projects_of_foreign_clients(client: TestClient):
    seller = _seller()
    other = _project(client, company_id=_company(client, OTRO_ID))
    assert seller.put(f"/api/projects/{other}", json={"status": "frenada"}).status_code == 403
    assert seller.delete(f"/api/projects/{other}").status_code == 403

    # La ve por un presupuesto suyo, pero el cliente es de otro: no la edita ni la da de baja.
    quoted = _project(client, company_id=_company(client, OTRO_ID))
    _quote(client, VENDEDOR_ID, quoted, contact_id=_contact(client, VENDEDOR_ID))
    assert seller.get(f"/api/projects/{quoted}").status_code == 200
    assert seller.put(f"/api/projects/{quoted}", json={"status": "frenada"}).status_code == 403
    assert seller.delete(f"/api/projects/{quoted}").status_code == 403


def test_seller_edits_own_projects_and_only_moves_them_to_visible_clients(client: TestClient):
    seller = _seller()
    mine = _project(client, company_id=_company(client, VENDEDOR_ID))
    res = seller.put(f"/api/projects/{mine}", json={"status": "frenada"})
    assert res.status_code == 200 and res.json()["status"] == "frenada"
    assert seller.put(f"/api/projects/{mine}", json={"company_id": _company(client, OTRO_ID)}).status_code == 403
    assert seller.put(f"/api/projects/{mine}", json={"company_id": _company(client)}).status_code == 200

    # Obra de la cartera libre: la edita quien la ve, pero la baja es de los managers.
    free = _project(client, company_id=_company(client))
    assert seller.put(f"/api/projects/{free}", json={"observations": "Descarga por la tarde"}).status_code == 200
    assert seller.delete(f"/api/projects/{free}").status_code == 403

    own = _project(client, company_id=_company(client, VENDEDOR_ID))
    assert seller.delete(f"/api/projects/{own}").status_code == 204


def test_manager_sees_and_edits_everything(client: TestClient):
    manager = _manager()
    other = _project(client, company_id=_company(client, OTRO_ID))
    assert manager.get(f"/api/projects/{other}").status_code == 200
    res = manager.put(f"/api/projects/{other}", json={"company_id": _company(client, VENDEDOR_ID)})
    assert res.status_code == 200
    assert manager.delete(f"/api/projects/{other}").status_code == 204
