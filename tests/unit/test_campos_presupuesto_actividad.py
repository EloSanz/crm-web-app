"""Observaciones y edición completa del presupuesto, resultado y fecha de la actividad, actividades
registradas desde la empresa o el contacto y valor final al ganar (casos de uso 9 y 11, reglas 5, 8 y 9)."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.controllers.opportunity_controller import list_stages


def _stages() -> dict:
    stages = sorted(list_stages(), key=lambda s: s["position"])
    return {
        "open": [s["id"] for s in stages if not s["is_closed_won"] and not s["is_closed_lost"]],
        "won": next(s["id"] for s in stages if s["is_closed_won"]),
    }


def _company(client: TestClient, name: str = "Constructora") -> dict:
    res = client.post("/api/companies", json={"name": f"{name} {uuid4().hex[:6]}"})
    assert res.status_code == 201, res.text
    return res.json()


def _opp(client: TestClient, **extra) -> dict:
    company = extra.pop("company", None) or _company(client)
    res = client.post(
        "/api/opportunities",
        json={
            "title": "Platea y columnas",
            "company_id": company["id"],
            "stage_id": _stages()["open"][0],
            "items": [{"product_name": "Cemento 50 kg", "unit": "bolsa", "quantity": 10, "unit_price": 10000}],
            **extra,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


# ---------------------------------------------------------------------------
# Observaciones del presupuesto
# ---------------------------------------------------------------------------


def test_notes_on_create_and_update(client: TestClient):
    opp = _opp(client, notes="  Entrega con hidrogrúa; pagan contra entrega.  ")
    assert opp["notes"] == "Entrega con hidrogrúa; pagan contra entrega."

    res = client.put(f"/api/opportunities/{opp['id']}", json={"notes": "Precio sostenido por 7 días."})
    assert res.status_code == 200, res.text
    assert res.json()["notes"] == "Precio sostenido por 7 días."
    assert client.get(f"/api/opportunities/{opp['id']}").json()["notes"] == "Precio sostenido por 7 días."

    cleared = client.put(f"/api/opportunities/{opp['id']}", json={"notes": "   "}).json()
    assert cleared["notes"] is None


# ---------------------------------------------------------------------------
# Edición completa de los datos generales (caso de uso 9)
# ---------------------------------------------------------------------------


def test_edit_general_data(client: TestClient):
    opp = _opp(client)
    other = _company(client, "Otra empresa")
    contact = client.post(
        "/api/contacts", json={"first_name": "Rubén", "last_name": "Paz", "company_id": other["id"]}
    ).json()
    project = client.post(
        "/api/projects",
        json={"name": f"Obra Aromos {uuid4().hex[:4]}", "address": "Calle 1", "company_id": other["id"]},
    ).json()

    res = client.put(
        f"/api/opportunities/{opp['id']}",
        json={
            "title": "  Losa del segundo piso ",
            "expected_close_date": "2026-12-20",
            "delivery_location": "Av. Rivadavia 14000, Ramos Mejía",
            "company_id": other["id"],
            "contact_id": contact["id"],
            "project_id": project["id"],
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["title"] == "Losa del segundo piso"
    assert body["expected_close_date"] == "2026-12-20"
    assert body["delivery_location"] == "Av. Rivadavia 14000, Ramos Mejía"
    assert body["company_id"] == other["id"]
    assert body["contact_id"] == contact["id"]
    assert body["project_id"] == project["id"]
    # Editar los datos generales no genera una versión nueva de materiales.
    assert body["current_version"] == opp["current_version"]


# ---------------------------------------------------------------------------
# Valor final (regla 5)
# ---------------------------------------------------------------------------


def test_win_keeps_estimated_value_and_records_final_value(client: TestClient):
    opp = _opp(client)
    assert float(opp["estimated_value"]) == 100000.0
    assert opp["final_value"] is None

    res = client.put(
        f"/api/opportunities/{opp['id']}",
        json={"stage_id": _stages()["won"], "status": "ganada", "final_value": 92000},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert float(body["final_value"]) == 92000.0
    assert float(body["estimated_value"]) == 100000.0


def test_win_without_value_takes_current_total(client: TestClient):
    opp = _opp(client)
    body = client.put(f"/api/opportunities/{opp['id']}", json={"stage_id": _stages()["won"], "status": "ganada"}).json()
    assert float(body["final_value"]) == 100000.0
    assert float(body["estimated_value"]) == 100000.0

    # Al reabrir, el valor final se limpia.
    reopened = client.put(
        f"/api/opportunities/{opp['id']}",
        json={"stage_id": _stages()["open"][0], "status": "abierta", "reopen_reason": "Pidieron más material"},
    ).json()
    assert reopened["final_value"] is None


# ---------------------------------------------------------------------------
# Actividad: descripción, resultado y fecha
# ---------------------------------------------------------------------------


def test_activity_with_description_and_result(client: TestClient):
    opp = _opp(client)
    res = client.post(
        "/api/activities",
        json={
            "opportunity_id": opp["id"],
            "company_id": opp["company_id"],
            "activity_type": "llamada",
            "summary": "Llamé para confirmar cantidades",
            "description": "Quieren sumar 20 bolsas más si se mantiene el precio.",
            "result": "Acepta el presupuesto si se entrega el lunes",
            "activity_date": (datetime.now(timezone.utc) - timedelta(days=1, hours=3)).isoformat(),
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["description"] == "Quieren sumar 20 bolsas más si se mantiene el precio."
    assert body["result"] == "Acepta el presupuesto si se entrega el lunes"

    listed = client.get(f"/api/opportunities/{opp['id']}/activities").json()
    assert any(a["result"] == "Acepta el presupuesto si se entrega el lunes" for a in listed)


def test_future_activity_date_is_rejected(client: TestClient):
    company = _company(client)
    res = client.post(
        "/api/activities",
        json={
            "company_id": company["id"],
            "activity_type": "visita_obra",
            "summary": "Visita a la obra",
            "activity_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        },
    )
    assert res.status_code == 422
    assert "futura" in res.text

    # Unos minutos de desfasaje entre relojes se toleran.
    ok = client.post(
        "/api/activities",
        json={
            "company_id": company["id"],
            "activity_type": "visita_obra",
            "summary": "Visita a la obra",
            "activity_date": (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat(),
        },
    )
    assert ok.status_code == 201, ok.text


# ---------------------------------------------------------------------------
# Actividades desde la empresa y el contacto (caso de uso 11, regla 9)
# ---------------------------------------------------------------------------


def test_activity_from_company_without_quote_shows_in_history(client: TestClient):
    company = _company(client)
    res = client.post(
        "/api/activities",
        json={
            "company_id": company["id"],
            "activity_type": "reunion",
            "summary": "Reunión de presentación",
            "description": "Conocimos al jefe de compras.",
            "result": "Mandan el listado de la próxima obra",
        },
    )
    assert res.status_code == 201, res.text
    assert res.json()["opportunity_id"] is None

    history = client.get(f"/api/companies/{company['id']}/history").json()
    entry = next(e for e in history["items"] if e["kind"] == "actividad")
    assert "Reunión de presentación" in entry["title"]
    assert entry["detail"] == "Conocimos al jefe de compras."
    assert entry["result"] == "Mandan el listado de la próxima obra"
    assert entry["opportunity_id"] is None


def test_activity_from_contact_without_quote_shows_in_history(client: TestClient):
    contact = client.post("/api/contacts", json={"first_name": "Nora", "last_name": "Ibarra"}).json()
    res = client.post(
        "/api/activities",
        json={
            "contact_id": contact["id"],
            "activity_type": "whatsapp",
            "summary": "Consultó por arena",
            "result": "Pasa por el local el sábado",
        },
    )
    assert res.status_code == 201, res.text

    history = client.get(f"/api/contacts/{contact['id']}/history").json()
    entry = next(e for e in history["items"] if e["kind"] == "actividad")
    assert "Consultó por arena" in entry["title"]
    assert entry["result"] == "Pasa por el local el sábado"


# ---------------------------------------------------------------------------
# Bases sin la migración 12: el resultado viaja en el detalle y se recupera al leer
# ---------------------------------------------------------------------------


def test_result_round_trip_without_column():
    from backend.models.activity import ActivityAttachment, ActivityCreate
    from backend.services.activity_service import _with_attachments, _without

    data = ActivityCreate(
        company_id=uuid4(),
        activity_type="llamada",
        summary="Llamada",
        attachments=[ActivityAttachment(url="https://s3/remito.pdf", name="remito.pdf")],
    )
    row = {
        "description": "Detalle",
        "result": "Compra el lunes",
        "attachments": [a.model_dump() for a in data.attachments],
    }
    stored = _without(row, data, {"result", "attachments"})
    assert "result" not in stored and "attachments" not in stored
    read = _with_attachments(dict(stored))
    assert read["description"] == "Detalle"
    assert read["result"] == "Compra el lunes"
    assert read["attachments"][0]["name"] == "remito.pdf"

    no_files = data.model_copy(update={"attachments": []})
    only_result = _with_attachments(_without({"description": None, "result": "Sin novedades"}, no_files, {"result"}))
    assert only_result["description"] is None
    assert only_result["result"] == "Sin novedades"
