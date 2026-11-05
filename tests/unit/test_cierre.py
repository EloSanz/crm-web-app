"""Reglas de cierre de presupuestos (4, 5, 6 y 14), origen propio y filtros del listado."""

from datetime import datetime

from fastapi.testclient import TestClient

from backend.config import settings
from backend.controllers.auth_controller import generate_simple_token
from backend.controllers.opportunity_controller import list_stages
from backend.main import app
from backend.models.auth import UserResponse
from backend.services.activity_service import _mock_activities
from backend.services.stage_history_service import StageHistoryService

VENDEDOR_ID = "00000000-0000-0000-0000-000000000002"
GERENTE_ID = "00000000-0000-0000-0000-000000000003"


def _client_as(role: str, user_id: str, name: str) -> TestClient:
    user = UserResponse(id=user_id, email=f"{role}@crm.com", full_name=name, role=role)
    headers = {"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {generate_simple_token(user)}"}
    return TestClient(app, headers=headers)


def _stages() -> dict:
    stages = sorted(list_stages(), key=lambda s: s["position"])
    return {
        "open": [s["id"] for s in stages if not s["is_closed_won"] and not s["is_closed_lost"]],
        "won": next(s["id"] for s in stages if s["is_closed_won"]),
        "lost": next(s["id"] for s in stages if s["is_closed_lost"]),
    }


def _new_opp(client: TestClient, assigned_to: str = VENDEDOR_ID, **extra) -> dict:
    comp = client.post(
        "/api/companies",
        json={"name": f"Cierre {datetime.now().timestamp()}", "origin": extra.pop("company_origin", None)},
    ).json()
    res = client.post(
        "/api/opportunities",
        json={
            "title": extra.pop("title", "Presupuesto de cierre"),
            "company_id": comp["id"],
            "assigned_to": assigned_to,
            "stage_id": _stages()["open"][0],
            "estimated_value": 250000.0,
            **extra,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


# ---------------------------------------------------------------------------
# Coherencia estado ↔ etapa
# ---------------------------------------------------------------------------


def test_new_quote_must_start_open(client: TestClient):
    comp = client.post("/api/companies", json={"name": "Alta cerrada"}).json()
    base = {"title": "Alta directa en ganado", "company_id": comp["id"], "assigned_to": VENDEDOR_ID}
    res = client.post("/api/opportunities", json={**base, "stage_id": _stages()["won"], "status": "ganada"})
    assert res.status_code == 422
    res = client.post("/api/opportunities", json={**base, "stage_id": _stages()["open"][0], "status": "perdida"})
    assert res.status_code == 422


def test_status_must_match_stage(client: TestClient):
    opp = _new_opp(client)
    st = _stages()
    # Abierta en la etapa de ganado, ganada en una etapa abierta, perdida en la de ganado: todo incoherente.
    assert (
        client.put(f"/api/opportunities/{opp['id']}", json={"stage_id": st["won"], "status": "abierta"}).status_code
        == 422
    )
    assert client.put(f"/api/opportunities/{opp['id']}", json={"status": "ganada"}).status_code == 422
    res = client.put(
        f"/api/opportunities/{opp['id']}", json={"stage_id": st["won"], "status": "perdida", "loss_reason": "Precio"}
    )
    assert res.status_code == 422
    assert client.get(f"/api/opportunities/{opp['id']}").json()["status"] == "abierta"


def test_status_is_derived_from_closing_stage(client: TestClient):
    opp = _new_opp(client)
    res = client.put(f"/api/opportunities/{opp['id']}", json={"stage_id": _stages()["won"]})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ganada"
    assert body["closed_at"] is not None
    assert float(body["estimated_value"]) == 250000.0


def test_unknown_stage_is_rejected(client: TestClient):
    opp = _new_opp(client)
    res = client.put(f"/api/opportunities/{opp['id']}", json={"stage_id": "99999999-0000-0000-0000-000000000000"})
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# Cierre: fecha, valor final y motivo de pérdida
# ---------------------------------------------------------------------------


def test_lost_requires_reason(client: TestClient):
    opp = _new_opp(client)
    lost = _stages()["lost"]
    res = client.put(f"/api/opportunities/{opp['id']}", json={"stage_id": lost, "status": "perdida"})
    assert res.status_code == 422
    assert "motivo" in res.json()["detail"]
    res = client.put(
        f"/api/opportunities/{opp['id']}", json={"stage_id": lost, "status": "perdida", "loss_reason": "  "}
    )
    assert res.status_code == 422

    res = client.put(
        f"/api/opportunities/{opp['id']}",
        json={"stage_id": lost, "status": "perdida", "loss_reason": "Precio / Presupuesto más caro"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "perdida"
    assert body["loss_reason"] == "Precio / Presupuesto más caro"
    assert body["closed_at"] is not None
    notes = [h["notes"] for h in StageHistoryService.list_by_opportunity(opp["id"])]
    assert "Motivo: Precio / Presupuesto más caro" in notes


def test_won_records_close_date_and_final_value(client: TestClient):
    opp = _new_opp(client)
    before = datetime.now().astimezone()
    res = client.put(
        f"/api/opportunities/{opp['id']}",
        json={"stage_id": _stages()["won"], "status": "ganada", "estimated_value": 240000},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ganada"
    assert float(body["estimated_value"]) == 240000.0
    closed_at = datetime.fromisoformat(body["closed_at"].replace("Z", "+00:00"))
    assert closed_at >= before.replace(microsecond=0)
    assert body["loss_reason"] is None


# ---------------------------------------------------------------------------
# Presupuesto cerrado: sólo admin y responsable comercial
# ---------------------------------------------------------------------------


def _closed_opp(client: TestClient) -> dict:
    opp = _new_opp(client)
    res = client.put(
        f"/api/opportunities/{opp['id']}",
        json={"stage_id": _stages()["lost"], "status": "perdida", "loss_reason": "Plazo de entrega prolongado"},
    )
    assert res.status_code == 200
    return res.json()


def test_seller_cannot_touch_closed_quote(client: TestClient):
    opp = _closed_opp(client)
    with _client_as("ejecutivo_ventas", VENDEDOR_ID, "Vendedor") as vendedor:
        assert vendedor.get(f"/api/opportunities/{opp['id']}").status_code == 200
        assert vendedor.put(f"/api/opportunities/{opp['id']}", json={"title": "Cambio"}).status_code == 403
        res = vendedor.put(
            f"/api/opportunities/{opp['id']}",
            json={"stage_id": _stages()["open"][0], "status": "abierta", "reopen_reason": "Volvió el cliente"},
        )
        assert res.status_code == 403
        assert vendedor.delete(f"/api/opportunities/{opp['id']}").status_code == 403
    assert client.get(f"/api/opportunities/{opp['id']}").json()["status"] == "perdida"


def test_reopen_requires_reason(client: TestClient):
    opp = _closed_opp(client)
    with _client_as("gerente_comercial", GERENTE_ID, "Responsable Comercial") as gerente:
        res = gerente.put(
            f"/api/opportunities/{opp['id']}", json={"stage_id": _stages()["open"][2], "status": "abierta"}
        )
        assert res.status_code == 422
        assert "motivo" in res.json()["detail"]


def test_manager_reopens_with_reason_and_it_stays_in_history(client: TestClient):
    opp = _closed_opp(client)
    target = _stages()["open"][2]
    with _client_as("gerente_comercial", GERENTE_ID, "Responsable Comercial") as gerente:
        res = gerente.put(
            f"/api/opportunities/{opp['id']}",
            json={"stage_id": target, "status": "abierta", "reopen_reason": "El cliente consiguió financiación"},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "abierta"
    assert body["stage_id"] == target
    assert body["closed_at"] is None
    assert body["loss_reason"] is None

    last = StageHistoryService.list_by_opportunity(opp["id"])[0]
    assert last["notes"] == "Reabierto: El cliente consiguió financiación"
    assert last["changed_by"] == GERENTE_ID
    assert last["to_stage_id"] == target

    timeline = client.get(f"/api/opportunities/{opp['id']}/timeline").json()
    assert any("Reabierto: El cliente consiguió financiación" in (e["detail"] or "") for e in timeline)


def test_manager_edit_on_closed_quote_is_logged(client: TestClient):
    opp = _closed_opp(client)
    with _client_as("gerente_comercial", GERENTE_ID, "Responsable Comercial") as gerente:
        res = gerente.put(f"/api/opportunities/{opp['id']}", json={"loss_reason": "Precio / Presupuesto más caro"})
        assert res.status_code == 200
        assert res.json()["loss_reason"] == "Precio / Presupuesto más caro"
        # Seguir perdido sin motivo no se puede.
        assert gerente.put(f"/api/opportunities/{opp['id']}", json={"loss_reason": ""}).status_code == 422
    notes = [
        a
        for a in _mock_activities.values()
        if a["opportunity_id"] == opp["id"] and a["activity_type"] == "nota" and a["user_id"] == GERENTE_ID
    ]
    assert len(notes) == 1
    assert "motivo de pérdida" in notes[0]["description"]


# ---------------------------------------------------------------------------
# Origen y filtros
# ---------------------------------------------------------------------------


def test_origin_defaults_to_client_origin_and_is_editable(client: TestClient):
    opp = _new_opp(client, company_origin="Redes sociales")
    assert opp["origin"] == "Redes sociales"
    own = _new_opp(client, company_origin="Redes sociales", origin="Página web")
    assert own["origin"] == "Página web"
    res = client.put(f"/api/opportunities/{opp['id']}", json={"origin": "Publicidad"})
    assert res.status_code == 200
    assert res.json()["origin"] == "Publicidad"


def test_list_filters_by_status_origin_and_assignee(client: TestClient):
    tag = datetime.now().timestamp()
    origin = f"Origen filtro {tag}"
    mine = _new_opp(client, assigned_to=VENDEDOR_ID, origin=origin, title=f"Filtro vendedor {tag}")
    theirs = _new_opp(client, assigned_to=GERENTE_ID, origin=origin, title=f"Filtro gerente {tag}")
    client.put(f"/api/opportunities/{theirs['id']}", json={"stage_id": _stages()["won"], "status": "ganada"})

    ids = {o["id"] for o in client.get("/api/opportunities", params={"origin": origin}).json()}
    assert ids == {mine["id"], theirs["id"]}

    won = client.get("/api/opportunities", params={"origin": origin, "status": "ganada"}).json()
    assert [o["id"] for o in won] == [theirs["id"]]
    open_ = client.get("/api/opportunities", params={"origin": origin, "status": "abierta"}).json()
    assert [o["id"] for o in open_] == [mine["id"]]

    by_owner = client.get("/api/opportunities", params={"origin": origin, "assigned_to": GERENTE_ID}).json()
    assert [o["id"] for o in by_owner] == [theirs["id"]]

    # El vendedor sigue viendo sólo lo suyo aunque pida los de otro.
    with _client_as("ejecutivo_ventas", VENDEDOR_ID, "Vendedor") as vendedor:
        res = vendedor.get("/api/opportunities", params={"origin": origin, "assigned_to": GERENTE_ID}).json()
        assert [o["id"] for o in res] == [mine["id"]]
