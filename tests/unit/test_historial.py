"""Historial comercial de empresas y contactos (caso de uso 12)."""

from fastapi.testclient import TestClient

from backend.config import settings
from backend.controllers.auth_controller import generate_simple_token
from backend.main import app
from backend.models.auth import UserResponse

VENDEDOR_ID = "00000000-0000-0000-0000-000000000002"
OTRO_ID = "00000000-0000-0000-0000-000000000003"
GERENTE_ID = "00000000-0000-0000-0000-000000000004"


def _client_as(user_id: str, role: str) -> TestClient:
    user = UserResponse(id=user_id, email=f"{user_id[-1]}@crm.com", full_name="Usuario", role=role)
    headers = {"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {generate_simple_token(user)}"}
    return TestClient(app, headers=headers)


def _setup(client: TestClient, tag: str, assigned_to: str = VENDEDOR_ID):
    """Empresa con un contacto, un presupuesto que cambia de etapa y actividades con y sin presupuesto."""
    company = client.post("/api/companies", json={"name": f"Constructora {tag}"}).json()
    contact = client.post(
        "/api/contacts",
        json={"first_name": "Marta", "last_name": "Gómez", "company_id": company["id"]},
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
            "items": [{"product_name": "Cemento 50 kg", "unit": "bolsa", "quantity": 80, "unit_price": 9500}],
        },
    ).json()
    moved = client.put(f"/api/opportunities/{opp['id']}", json={"stage_id": stages[1]["id"]})
    assert moved.status_code == 200, moved.text
    with_opp = client.post(
        "/api/activities",
        json={
            "opportunity_id": opp["id"],
            "company_id": company["id"],
            "contact_id": contact["id"],
            "activity_type": "llamada",
            "summary": "Pidió precio del hierro",
            "activity_date": "2026-03-10T15:00:00Z",
        },
    ).json()
    without_opp = client.post(
        "/api/activities",
        json={
            "company_id": company["id"],
            "contact_id": contact["id"],
            "activity_type": "visita_obra",
            "summary": "Visita a la obra de Ituzaingó",
            "activity_date": "2026-02-01T12:00:00Z",
        },
    ).json()
    return company, contact, opp, with_opp, without_opp


def _assert_newest_first(items: list[dict]):
    dates = [it["at"] for it in items]
    assert dates == sorted(dates, reverse=True)


def test_company_history_has_everything_newest_first(client: TestClient):
    company, _, opp, with_opp, without_opp = _setup(client, "hist-emp")
    res = client.get(f"/api/companies/{company['id']}/history")
    assert res.status_code == 200, res.text
    body = res.json()
    kinds = {it["kind"] for it in body["items"]}
    assert {"presupuesto", "etapa", "actividad"} <= kinds
    ids = {it["id"] for it in body["items"]}
    assert f"actividad-{with_opp['id']}" in ids
    assert f"actividad-{without_opp['id']}" in ids
    assert f"presupuesto-{opp['id']}" in ids
    _assert_newest_first(body["items"])
    # Sin repetidos: la actividad del presupuesto llega por dos caminos.
    assert len(ids) == len(body["items"]) == body["total"]

    linked = next(it for it in body["items"] if it["id"] == f"actividad-{with_opp['id']}")
    assert linked["opportunity_id"] == opp["id"]
    assert linked["opportunity_title"] == opp["title"]
    assert linked["activity_type"] == "llamada"
    assert linked["user_name"]  # trazabilidad: quién lo registró
    assert linked["link"].startswith(f"/opportunities/{opp['id']}?ver=actividad-{with_opp['id']}")
    loose = next(it for it in body["items"] if it["id"] == f"actividad-{without_opp['id']}")
    assert loose["opportunity_id"] is None
    assert loose["link"] is None
    # La más vieja de todas es la visita sin presupuesto.
    assert body["items"][-1]["id"] == f"actividad-{without_opp['id']}"
    stage = next(it for it in body["items"] if it["kind"] == "etapa")
    assert stage["opportunity_id"] == opp["id"]


def test_contact_history_has_everything_newest_first(client: TestClient):
    from backend.models.message import MessageChannel, MessageDirection, MessageStatus
    from backend.services.message_service import MessageService

    company, contact, opp, with_opp, without_opp = _setup(client, "hist-ct")
    MessageService.create(
        channel=MessageChannel.WHATSAPP,
        direction=MessageDirection.ENTRANTE,
        status=MessageStatus.RECIBIDO,
        contact_id=contact["id"],
        company_id=company["id"],
        body_text="¿Me confirmás la entrega del viernes?",
        phone="5491145550101",
    )
    # Otro contacto de la misma empresa: lo suyo no aparece en el historial de Marta.
    other = client.post(
        "/api/contacts", json={"first_name": "Raúl", "last_name": "Díaz", "company_id": company["id"]}
    ).json()
    foreign = client.post(
        "/api/activities",
        json={"company_id": company["id"], "contact_id": other["id"], "activity_type": "nota", "summary": "De Raúl"},
    ).json()

    body = client.get(f"/api/contacts/{contact['id']}/history").json()
    ids = {it["id"] for it in body["items"]}
    assert f"actividad-{with_opp['id']}" in ids
    assert f"actividad-{without_opp['id']}" in ids
    assert f"presupuesto-{opp['id']}" in ids
    assert f"actividad-{foreign['id']}" not in ids
    kinds = {it["kind"] for it in body["items"]}
    assert {"presupuesto", "etapa", "actividad", "mensaje"} <= kinds
    _assert_newest_first(body["items"])
    assert body["counts"]["mensaje"] == 1


def test_history_pagination(client: TestClient):
    company, *_ = _setup(client, "hist-pag")
    full = client.get(f"/api/companies/{company['id']}/history").json()
    assert full["total"] >= 4

    first = client.get(f"/api/companies/{company['id']}/history", params={"limit": 2, "offset": 0}).json()
    second = client.get(f"/api/companies/{company['id']}/history", params={"limit": 2, "offset": 2}).json()
    assert first["total"] == second["total"] == full["total"]
    assert (first["limit"], first["offset"]) == (2, 0)
    assert len(first["items"]) == 2 and first["has_more"] is True
    assert [it["id"] for it in first["items"] + second["items"]] == [it["id"] for it in full["items"][:4]]

    last = client.get(
        f"/api/companies/{company['id']}/history", params={"limit": 2, "offset": full["total"] - 1}
    ).json()
    assert len(last["items"]) == 1 and last["has_more"] is False
    assert client.get(f"/api/companies/{company['id']}/history", params={"limit": 0}).status_code == 422


def test_history_filter_by_kind(client: TestClient):
    company, contact, *_ = _setup(client, "hist-kind")
    acts = client.get(f"/api/companies/{company['id']}/history", params={"kind": "actividad"}).json()
    assert acts["total"] == 2
    assert {it["kind"] for it in acts["items"]} == {"actividad"}
    # Los conteos por tipo no dependen del filtro (para los chips).
    assert acts["counts"]["actividad"] == 2
    assert acts["counts"]["presupuesto"] == 1

    stages = client.get(f"/api/contacts/{contact['id']}/history", params={"kind": "etapa"}).json()
    assert stages["total"] >= 1 and {it["kind"] for it in stages["items"]} == {"etapa"}
    assert client.get(f"/api/companies/{company['id']}/history", params={"kind": "ficha"}).status_code == 422


def test_seller_without_relation_gets_403(client: TestClient):
    company, contact, *_ = _setup(client, "hist-ajeno", assigned_to=OTRO_ID)
    seller = _client_as(VENDEDOR_ID, "ejecutivo_ventas")
    assert seller.get(f"/api/companies/{company['id']}/history").status_code == 403
    assert seller.get(f"/api/contacts/{contact['id']}/history").status_code == 403


def test_seller_with_a_quote_in_the_company_gets_200(client: TestClient):
    company, contact, *_ = _setup(client, "hist-propio", assigned_to=VENDEDOR_ID)
    seller = _client_as(VENDEDOR_ID, "ejecutivo_ventas")
    res = seller.get(f"/api/companies/{company['id']}/history")
    assert res.status_code == 200, res.text
    assert res.json()["total"] >= 4
    assert seller.get(f"/api/contacts/{contact['id']}/history").status_code == 200


def test_seller_assigned_to_the_contact_or_its_company_gets_200(client: TestClient):
    company = client.post("/api/companies", json={"name": "Constructora asignada", "assigned_to": VENDEDOR_ID}).json()
    via_company = client.post(
        "/api/contacts", json={"first_name": "Ana", "last_name": "Paz", "company_id": company["id"]}
    ).json()
    own = client.post(
        "/api/contacts", json={"first_name": "Luis", "last_name": "Sosa", "assigned_to": VENDEDOR_ID}
    ).json()
    alien = client.post("/api/contacts", json={"first_name": "Eva", "last_name": "Ruiz"}).json()
    seller = _client_as(VENDEDOR_ID, "ejecutivo_ventas")
    assert seller.get(f"/api/companies/{company['id']}/history").status_code == 200
    assert seller.get(f"/api/contacts/{via_company['id']}/history").status_code == 200
    assert seller.get(f"/api/contacts/{own['id']}/history").status_code == 200
    assert seller.get(f"/api/contacts/{alien['id']}/history").status_code == 403


def test_commercial_manager_sees_any_client(client: TestClient):
    company, contact, *_ = _setup(client, "hist-gerente", assigned_to=OTRO_ID)
    manager = _client_as(GERENTE_ID, "gerente_comercial")
    res = manager.get(f"/api/companies/{company['id']}/history")
    assert res.status_code == 200, res.text
    assert res.json()["total"] >= 4
    assert manager.get(f"/api/contacts/{contact['id']}/history").status_code == 200


def test_history_of_unknown_client_is_404(client: TestClient):
    missing = "11111111-1111-1111-1111-111111111111"
    assert client.get(f"/api/companies/{missing}/history").status_code == 404
    assert client.get(f"/api/contacts/{missing}/history").status_code == 404
