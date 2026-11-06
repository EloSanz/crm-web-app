"""Huecos de permisos y validaciones del backend: catálogo de materiales, actividades sin cliente,
mensajes a clientes ajenos, borrado de archivos, presupuestos y contactos para clientes ajenos,
edición que deja el presupuesto incompleto, usuarios dados de baja y catálogos de origen/motivo."""

from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.config import settings
from backend.controllers.auth_controller import generate_simple_token
from backend.main import app
from backend.models.auth import UserResponse

ADMIN_ID = "00000000-0000-0000-0000-000000000001"
VENDEDOR_ID = "00000000-0000-0000-0000-000000000002"
GERENTE_ID = "00000000-0000-0000-0000-000000000003"
OTRO_VENDEDOR_ID = "00000000-0000-0000-0000-0000000000b7"


def _as(user_id: str, role: str, name: str = "Usuario de prueba") -> TestClient:
    user = UserResponse(id=user_id, email=f"{role}.{user_id[-4:]}@crm.com", full_name=name, role=role)
    headers = {"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {generate_simple_token(user)}"}
    return TestClient(app, headers=headers)


def _vendedor() -> TestClient:
    return _as(VENDEDOR_ID, "ejecutivo_ventas", "Ejecutivo Comercial")


def _tag() -> str:
    return uuid4().hex[:6]


def _phone(prefix: str = "5") -> str:
    """Celular único por test (los teléfonos de contacto no se pueden repetir)."""
    return f"11 {prefix}{uuid4().int % 10**7:07d}"


def _company(client: TestClient, assigned_to: str | None = None, **extra) -> dict:
    res = client.post("/api/companies", json={"name": f"Constructora {_tag()}", "assigned_to": assigned_to, **extra})
    assert res.status_code == 201, res.text
    return res.json()


def _contact(client: TestClient, assigned_to: str | None = None, **extra) -> dict:
    res = client.post(
        "/api/contacts",
        json={"first_name": "Ramón", "last_name": f"Obra {_tag()}", "assigned_to": assigned_to, **extra},
    )
    assert res.status_code == 201, res.text
    return res.json()


def _stage(client: TestClient) -> str:
    stages = sorted(client.get("/api/stages").json(), key=lambda s: s["position"])
    return next(s["id"] for s in stages if not s["is_closed_won"] and not s["is_closed_lost"])


def _lost_stage(client: TestClient) -> str:
    return next(s["id"] for s in client.get("/api/stages").json() if s["is_closed_lost"])


def _opp(client: TestClient, **fields) -> dict:
    payload = {"title": f"Presupuesto {_tag()}", "stage_id": _stage(client), "assigned_to": ADMIN_ID, **fields}
    res = client.post("/api/opportunities", json=payload)
    assert res.status_code == 201, res.text
    return res.json()


def _project(client: TestClient, **fields) -> dict:
    res = client.post("/api/projects", json={"name": f"Obra {_tag()}", "address": "Av. de Mayo 1234", **fields})
    assert res.status_code == 201, res.text
    return res.json()


# ---------------------------------------------------------------------------
# 1. Catálogo de materiales: sólo el administrador lo mantiene
# ---------------------------------------------------------------------------


def _material(client: TestClient) -> dict:
    res = client.post(
        "/api/products",
        json={
            "code": f"PER-{_tag()}",
            "name": "Cemento Portland x 50 kg",
            "category": "Aglomerantes",
            "unit": "bolsa",
            "unit_price": "9800.00",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


@pytest.mark.parametrize(("user_id", "role"), [(VENDEDOR_ID, "ejecutivo_ventas"), (GERENTE_ID, "gerente_comercial")])
def test_only_admin_maintains_materials(client: TestClient, user_id: str, role: str):
    product = _material(client)
    with _as(user_id, role) as other:
        assert other.get("/api/products").status_code == 200
        assert other.get(f"/api/products/{product['id']}").status_code == 200
        payload = {"code": f"X-{_tag()}", "name": "Arena", "category": "Áridos", "unit": "m3", "unit_price": "1"}
        assert other.post("/api/products", json=payload).status_code == 403
        assert other.put(f"/api/products/{product['id']}", json={"unit_price": "1.00"}).status_code == 403
        assert other.delete(f"/api/products/{product['id']}").status_code == 403
    assert client.get(f"/api/products/{product['id']}").json()["is_active"] is True


# ---------------------------------------------------------------------------
# 2. Actividades: vinculadas a un cliente (regla 9) y sólo sobre clientes visibles
# ---------------------------------------------------------------------------


def test_activity_without_link_is_rejected(client: TestClient):
    res = client.post("/api/activities", json={"activity_type": "nota", "summary": "Nota suelta"})
    assert res.status_code == 422
    assert "vinculada" in res.json()["detail"]


def test_seller_cannot_log_activity_on_someone_elses_client(client: TestClient):
    ajena = _company(client, assigned_to=OTRO_VENDEDOR_ID)
    contacto_ajeno = _contact(client, assigned_to=OTRO_VENDEDOR_ID)
    propia = _company(client, assigned_to=VENDEDOR_ID)
    with _vendedor() as vendedor:
        base = {"activity_type": "llamada", "summary": "Llamado de seguimiento"}
        assert vendedor.post("/api/activities", json={**base, "company_id": ajena["id"]}).status_code == 403
        assert vendedor.post("/api/activities", json={**base, "contact_id": contacto_ajeno["id"]}).status_code == 403
        assert vendedor.post("/api/activities", json={**base, "company_id": propia["id"]}).status_code == 201


# ---------------------------------------------------------------------------
# 3. Correo, WhatsApp y llamadas a clientes ajenos
# ---------------------------------------------------------------------------


def test_seller_cannot_contact_someone_elses_client(client: TestClient):
    phone = _phone()
    ajena = _company(client, assigned_to=OTRO_VENDEDOR_ID)
    ajeno = _contact(client, assigned_to=OTRO_VENDEDOR_ID, phone=phone, email=f"ajeno.{_tag()}@obra.com.ar")
    propio = _contact(client, assigned_to=VENDEDOR_ID, phone=_phone("4"))
    with _vendedor() as vendedor:
        assert vendedor.post("/api/calls/log", json={"contact_id": ajeno["id"]}).status_code == 403
        assert (
            vendedor.post("/api/whatsapp/log", json={"company_id": ajena["id"], "phone": _phone("7")}).status_code
            == 403
        )
        assert vendedor.get("/api/messages", params={"contact_id": ajeno["id"]}).status_code == 403
        assert vendedor.get("/api/whatsapp/conversation", params={"contact_id": ajeno["id"]}).status_code == 403
        email = {"to": ["x@obra.com.ar"], "subject": "Hola", "html": "<p>Hola</p>", "contact_id": ajeno["id"]}
        assert vendedor.post("/api/email/send", json=email).status_code == 403
        # Por teléfono: el número es de un contacto ajeno, aunque se lo cuelgue de un contacto propio.
        assert vendedor.get("/api/whatsapp/conversation", params={"phone": phone}).status_code == 403
        res = vendedor.post("/api/calls/log", json={"contact_id": propio["id"], "phone": phone})
        assert res.status_code == 403
        # Lo propio sigue andando.
        assert vendedor.post("/api/calls/log", json={"contact_id": propio["id"]}).status_code == 201
        assert vendedor.get("/api/messages", params={"contact_id": propio["id"]}).status_code == 200


def test_unknown_phone_is_only_for_managers(client: TestClient):
    unknown = _phone("6")
    with _vendedor() as vendedor:
        assert vendedor.get("/api/whatsapp/conversation", params={"phone": unknown}).status_code == 403
        assert vendedor.post("/api/calls/log", json={"phone": unknown}).status_code == 403
    assert client.get("/api/whatsapp/conversation", params={"phone": unknown}).status_code == 200
    with _as(GERENTE_ID, "gerente_comercial") as gerente:
        assert gerente.get("/api/whatsapp/conversation", params={"phone": unknown}).status_code == 200


# ---------------------------------------------------------------------------
# 4. Borrado físico de archivos: sólo administrador
# ---------------------------------------------------------------------------


def test_delete_upload_is_admin_only(client: TestClient):
    with patch("backend.services.storage_service.storage_service.delete_image", return_value=True) as delete:
        with _vendedor() as vendedor:
            assert vendedor.delete("/api/upload/crm/adjuntos/remito.pdf").status_code == 403
        with _as(GERENTE_ID, "gerente_comercial") as gerente:
            assert gerente.delete("/api/upload/crm/adjuntos/remito.pdf").status_code == 403
        delete.assert_not_called()
        assert client.delete("/api/upload/crm/adjuntos/remito.pdf").status_code == 200
        delete.assert_called_once_with("crm/adjuntos/remito.pdf")


# ---------------------------------------------------------------------------
# 5. Presupuestos y contactos para clientes ajenos; obra de otro cliente
# ---------------------------------------------------------------------------


def test_seller_cannot_quote_or_attach_contacts_to_someone_elses_client(client: TestClient):
    ajena = _company(client, assigned_to=OTRO_VENDEDOR_ID)
    ajeno = _contact(client, assigned_to=OTRO_VENDEDOR_ID)
    propia = _company(client, assigned_to=VENDEDOR_ID)
    with _vendedor() as vendedor:
        stage = _stage(vendedor)
        base = {"title": "Presupuesto ajeno", "stage_id": stage}
        assert vendedor.post("/api/opportunities", json={**base, "company_id": ajena["id"]}).status_code == 403
        assert vendedor.post("/api/opportunities", json={**base, "contact_id": ajeno["id"]}).status_code == 403
        mine = vendedor.post("/api/opportunities", json={**base, "company_id": propia["id"]})
        assert mine.status_code == 201
        # Tampoco puede mover su presupuesto a un cliente ajeno.
        res = vendedor.put(f"/api/opportunities/{mine.json()['id']}", json={"company_id": ajena["id"]})
        assert res.status_code == 403

        contact = {"first_name": "Juan", "last_name": "Capataz"}
        assert vendedor.post("/api/contacts", json={**contact, "company_id": ajena["id"]}).status_code == 403
        own_contact = vendedor.post("/api/contacts", json={**contact, "company_id": propia["id"]})
        assert own_contact.status_code == 201
        res = vendedor.put(f"/api/contacts/{own_contact.json()['id']}", json={"company_id": ajena["id"]})
        assert res.status_code == 403


def test_project_must_belong_to_the_quote_client(client: TestClient):
    empresa = _company(client)
    otra = _company(client)
    contacto = _contact(client, company_id=empresa["id"])
    obra_propia = _project(client, company_id=empresa["id"])
    obra_ajena = _project(client, company_id=otra["id"])

    stage = _stage(client)
    base = {"title": "Presupuesto con obra", "stage_id": stage, "assigned_to": ADMIN_ID}
    res = client.post("/api/opportunities", json={**base, "company_id": empresa["id"], "project_id": obra_ajena["id"]})
    assert res.status_code == 422
    assert "otro cliente" in res.json()["detail"]
    res = client.post("/api/opportunities", json={**base, "company_id": empresa["id"], "project_id": str(uuid4())})
    assert res.status_code == 422
    assert "no existe" in res.json()["detail"]

    ok = client.post("/api/opportunities", json={**base, "company_id": empresa["id"], "project_id": obra_propia["id"]})
    assert ok.status_code == 201
    # Presupuesto a un contacto de la empresa titular de la obra: es el mismo cliente.
    res = client.post(
        "/api/opportunities", json={**base, "contact_id": contacto["id"], "project_id": obra_propia["id"]}
    )
    assert res.status_code == 201

    res = client.put(f"/api/opportunities/{ok.json()['id']}", json={"project_id": obra_ajena["id"]})
    assert res.status_code == 422
    # Cambiar el cliente dejando la obra del cliente anterior tampoco.
    res = client.put(f"/api/opportunities/{ok.json()['id']}", json={"company_id": otra["id"]})
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# 6. Edición que deja el presupuesto sin cliente o sin responsable
# ---------------------------------------------------------------------------


def test_edit_cannot_leave_quote_without_client_or_owner(client: TestClient):
    opp = _opp(client, company_id=_company(client)["id"])
    url = f"/api/opportunities/{opp['id']}"

    res = client.put(url, json={"company_id": None, "contact_id": None})
    assert res.status_code == 422
    assert "empresa o a un contacto" in res.json()["detail"]

    res = client.put(url, json={"assigned_to": None})
    assert res.status_code == 422
    assert "responsable" in res.json()["detail"]

    res = client.put(url, json={"assigned_to": str(uuid4())})
    assert res.status_code == 422
    assert "no existe" in res.json()["detail"]

    baja = client.post(
        "/api/users",
        json={
            "email": f"baja.{_tag()}@crm.com",
            "full_name": "Vendedor de Baja",
            "role": "ejecutivo_ventas",
            "password": "ladrillo2026",
        },
    ).json()
    assert client.put(f"/api/users/{baja['id']}", json={"is_active": False}).status_code == 200
    res = client.put(url, json={"assigned_to": baja["id"]})
    assert res.status_code == 422
    assert "dado de baja" in res.json()["detail"]

    assert client.put(url, json={"assigned_to": GERENTE_ID}).status_code == 200


# ---------------------------------------------------------------------------
# 7. Usuario dado de baja con token vigente
# ---------------------------------------------------------------------------


def test_deactivated_user_is_rejected_even_with_valid_token(client: TestClient):
    user = client.post(
        "/api/users",
        json={
            "email": f"temporal.{_tag()}@crm.com",
            "full_name": "Vendedora Temporal",
            "role": "ejecutivo_ventas",
            "password": "ladrillo2026",
        },
    ).json()
    with _as(user["id"], "ejecutivo_ventas", "Vendedora Temporal") as temporal:
        me = temporal.get("/api/auth/me")
        assert me.status_code == 200
        assert me.json()["is_active"] is True
        assert temporal.get("/api/opportunities").status_code == 200

        assert client.put(f"/api/users/{user['id']}", json={"is_active": False}).status_code == 200
        assert temporal.get("/api/opportunities").status_code == 401
        assert temporal.get("/api/auth/me").status_code == 401

        # Reactivada vuelve a entrar con el mismo token.
        assert client.put(f"/api/users/{user['id']}", json={"is_active": True}).status_code == 200
        assert temporal.get("/api/opportunities").status_code == 200


# ---------------------------------------------------------------------------
# 8. Origen y motivo de pérdida contra el catálogo
# ---------------------------------------------------------------------------


def _catalog_item(client: TestClient, kind: str) -> dict:
    res = client.post("/api/catalogs", json={"kind": kind, "label": f"Valor de prueba {_tag()}"})
    assert res.status_code == 201, res.text
    return res.json()


def test_origin_must_come_from_active_catalog(client: TestClient):
    company = _company(client)["id"]
    res = client.post(
        "/api/opportunities",
        json={
            "title": "Origen inventado",
            "company_id": company,
            "stage_id": _stage(client),
            "origin": "Volante en la plaza",
        },
    )
    assert res.status_code == 422
    assert "catálogo" in res.json()["detail"]

    item = _catalog_item(client, "origin")
    opp = _opp(client, company_id=company, origin=item["label"])
    url = f"/api/opportunities/{opp['id']}"
    assert client.put(url, json={"origin": "Origen trucho"}).status_code == 422

    # Si el origen se desactiva, el presupuesto que ya lo tenía se sigue pudiendo editar con él...
    assert client.put(f"/api/catalogs/{item['id']}", json={"is_active": False}).status_code == 200
    assert client.put(url, json={"origin": item["label"], "title": "Sigue con su origen"}).status_code == 200
    # ...pero no se lo puede elegir para otro.
    otro = _opp(client, company_id=company)
    res = client.put(f"/api/opportunities/{otro['id']}", json={"origin": item["label"]})
    assert res.status_code == 422
    assert "desactivado" in res.json()["detail"]


def test_loss_reason_must_come_from_active_catalog(client: TestClient):
    opp = _opp(client, company_id=_company(client)["id"])
    url = f"/api/opportunities/{opp['id']}"
    lost = _lost_stage(client)
    res = client.put(url, json={"stage_id": lost, "status": "perdida", "loss_reason": "Me cayó mal"})
    assert res.status_code == 422
    assert "motivo de pérdida" in res.json()["detail"]

    item = _catalog_item(client, "loss_reason")
    assert (
        client.put(url, json={"stage_id": lost, "status": "perdida", "loss_reason": item["label"]}).status_code == 200
    )
    assert client.put(f"/api/catalogs/{item['id']}", json={"is_active": False}).status_code == 200
    # El motivo que ya tenía vale aunque esté desactivado; uno desactivado nuevo, no.
    assert client.put(url, json={"loss_reason": item["label"]}).status_code == 200
    otro = _opp(client, company_id=_company(client)["id"])
    res = client.put(
        f"/api/opportunities/{otro['id']}", json={"stage_id": lost, "status": "perdida", "loss_reason": item["label"]}
    )
    assert res.status_code == 422
