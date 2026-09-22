from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from backend.config import settings
from backend.controllers.auth_controller import generate_simple_token
from backend.controllers.opportunity_controller import list_stages
from backend.main import app
from backend.models.auth import UserResponse
from backend.services.metrics_service import Dataset, MetricsService
from backend.services.opportunity_service import _mock_opportunities
from backend.services.stage_history_service import StageHistoryService, _mock_stage_history

ADMIN_ID = "00000000-0000-0000-0000-000000000001"
VENDEDOR_ID = "00000000-0000-0000-0000-000000000002"
GERENTE_ID = "00000000-0000-0000-0000-000000000003"

TABS = ["sales", "sellers", "stages", "quotes", "contact", "clients", "projects", "catalog"]
MANAGER_TABS = ["sales", "sellers", "stages", "quotes", "contact"]
ADMIN_TABS = ["clients", "projects", "catalog"]


def _client_as(role: str, user_id: str, name: str) -> TestClient:
    user = UserResponse(id=user_id, email=f"{role}@crm.com", full_name=name, role=role)
    headers = {"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {generate_simple_token(user)}"}
    return TestClient(app, headers=headers)


@pytest.fixture(autouse=True)
def _fresh_metrics():
    MetricsService.clear_cache()
    yield
    MetricsService.clear_cache()


def _stages() -> list[dict]:
    return sorted(list_stages(), key=lambda s: s["position"])


def _new_seller(client: TestClient, name: str) -> str:
    res = client.post(
        "/api/users",
        json={"email": f"{name.lower().replace(' ', '.')}@crm.com", "full_name": name, "role": "ejecutivo_ventas"},
    )
    assert res.status_code == 201
    return res.json()["id"]


def _new_opportunity(client: TestClient, seller_id: str, stage_id: str, **extra) -> dict:
    comp = client.post("/api/companies", json={"name": f"Indicadores {datetime.now().timestamp()}"}).json()
    res = client.post(
        "/api/opportunities",
        json={
            "title": extra.pop("title", "Presupuesto para indicadores"),
            "company_id": comp["id"],
            "assigned_to": seller_id,
            "stage_id": stage_id,
            "estimated_value": extra.pop("estimated_value", 500000.0),
            **extra,
        },
    )
    assert res.status_code == 201
    opp = res.json()
    # El historial lo sembramos a mano con fechas pasadas: se descarta lo que haya registrado el alta.
    for key in [k for k, row in _mock_stage_history.items() if row["opportunity_id"] == opp["id"]]:
        del _mock_stage_history[key]
    return opp


def _backdate(opp_id: str, created: datetime) -> None:
    _mock_opportunities[opp_id]["created_at"] = created.isoformat()


# ---------------------------------------------------------------------------
# Permisos por rol
# ---------------------------------------------------------------------------


def test_vendedor_sees_no_metrics():
    with _client_as("ejecutivo_ventas", VENDEDOR_ID, "Ejecutivo Comercial") as vendedor:
        for tab in TABS:
            assert vendedor.get(f"/api/metrics/{tab}").status_code == 403, tab
        assert vendedor.get(f"/api/metrics/sellers/{VENDEDOR_ID}").status_code == 403
        assert vendedor.get(f"/api/metrics/quotes/{ADMIN_ID}").status_code == 403


def test_gerente_sees_commercial_tabs_only():
    with _client_as("gerente_comercial", GERENTE_ID, "Responsable Comercial") as gerente:
        for tab in MANAGER_TABS:
            assert gerente.get(f"/api/metrics/{tab}?days=30").status_code == 200, tab
        for tab in ADMIN_TABS:
            assert gerente.get(f"/api/metrics/{tab}").status_code == 403, tab
        assert gerente.get(f"/api/metrics/sellers/{VENDEDOR_ID}").status_code == 200


def test_admin_sees_every_tab(client: TestClient):
    for tab in TABS:
        for days in (30, 90, 180, 365):
            res = client.get(f"/api/metrics/{tab}?days={days}")
            assert res.status_code == 200, (tab, days)
            body = res.json()
            assert body["days"] == days
            assert body["granularity"] == ("week" if days <= 90 else "month")


def test_period_must_be_a_known_window(client: TestClient):
    assert client.get("/api/metrics/sales?days=45").status_code == 422


# ---------------------------------------------------------------------------
# Tiempo por etapa
# ---------------------------------------------------------------------------


def test_stage_durations_come_from_consecutive_history_rows(client: TestClient):
    s1, s2, s3, s4, won_stage = (_stages()[i]["id"] for i in range(5))
    seller = _new_seller(client, "Vendedora Etapas")
    now = datetime.now(timezone.utc)

    # Presupuesto abierto: 5 días en consulta, 10 en preparación y 5 (en curso) en enviado.
    open_opp = _new_opportunity(client, seller, s3, title="Abierto con historial")
    _backdate(open_opp["id"], now - timedelta(days=20))
    StageHistoryService.record(open_opp["id"], None, s1, seller, at=now - timedelta(days=20))
    StageHistoryService.record(open_opp["id"], s1, s2, seller, at=now - timedelta(days=15))
    StageHistoryService.record(open_opp["id"], s2, s3, seller, at=now - timedelta(days=5))

    # Presupuesto ganado: 2 días en consulta, 8 en preparación y cierre hace 30 días.
    won_opp = _new_opportunity(client, seller, won_stage, title="Ganado con historial", status="ganada")
    _backdate(won_opp["id"], now - timedelta(days=40))
    StageHistoryService.record(won_opp["id"], None, s1, seller, at=now - timedelta(days=40))
    StageHistoryService.record(won_opp["id"], s1, s2, seller, at=now - timedelta(days=38))
    StageHistoryService.record(won_opp["id"], s2, won_stage, seller, at=now - timedelta(days=30))

    detail = client.get(f"/api/metrics/quotes/{open_opp['id']}").json()
    times = {t["stage_id"]: t for t in detail["stage_times"]}
    assert times[s1]["days"] == pytest.approx(5, abs=0.01)
    assert times[s2]["days"] == pytest.approx(10, abs=0.01)
    assert times[s3]["days"] == pytest.approx(5, abs=0.01)
    assert times[s3]["en_curso"] is True and times[s2]["en_curso"] is False
    assert times[s4]["visits"] == 0
    assert detail["quote"]["days_in_stage"] == 5

    stages = client.get("/api/metrics/stages?days=90").json()
    cells = {(c["user_id"], c["stage_id"]): c for c in stages["matrix"]["cells"]}
    assert cells[(seller, s1)]["avg_days"] == pytest.approx(3.5, abs=0.01)
    assert cells[(seller, s2)]["avg_days"] == pytest.approx(9, abs=0.01)
    assert cells[(seller, s3)]["count"] == 1
    assert any(r["id"] == open_opp["id"] and r["days_in_stage"] == 5 for r in stages["open"])
    conversion = {c["stage_id"]: c for c in stages["conversion"]}
    assert conversion[s3]["en_curso"] >= 1
    assert conversion[s2]["advanced"] >= 2

    seller_detail = client.get(f"/api/metrics/sellers/{seller}?days=90").json()
    assert seller_detail["seller"]["won_count"] == 1
    assert seller_detail["seller"]["won_amount"] == pytest.approx(500000)
    assert seller_detail["seller"]["close_rate"] == 1.0
    mine = {t["stage_id"]: t for t in seller_detail["stage_times"]}
    assert mine[s2]["avg_days"] == pytest.approx(9, abs=0.01)
    assert [o["id"] for o in seller_detail["open"]] == [open_opp["id"]]

    won_detail = client.get(f"/api/metrics/quotes/{won_opp['id']}").json()
    assert won_detail["quote"]["cycle_days"] == pytest.approx(10, abs=0.01)

    # El ganado cerró hace 30 días: entra en 90 días, no en el período de 30 días anterior al cierre.
    in_90 = client.get("/api/metrics/sales?days=90").json()
    assert any(s["id"] == won_opp["id"] for s in in_90["sales"])


def test_first_response_measures_creation_to_first_contact(client: TestClient):
    s1 = _stages()[0]["id"]
    seller = _new_seller(client, "Vendedor Respuesta")
    now = datetime.now(timezone.utc)
    opp = _new_opportunity(client, seller, s1, title="Primera respuesta")
    _backdate(opp["id"], now - timedelta(hours=3))
    res = client.post(
        "/api/activities",
        json={
            "opportunity_id": opp["id"],
            "activity_type": "whatsapp",
            "summary": "Primer contacto por WhatsApp",
            "activity_date": (now - timedelta(hours=1)).isoformat(),
        },
    )
    assert res.status_code == 201
    detail = client.get(f"/api/metrics/quotes/{opp['id']}").json()
    assert detail["first_response_hours"] == pytest.approx(2, abs=0.05)
    assert {c["channel"]: c["count"] for c in detail["contacts_by_channel"]}["whatsapp"] == 1

    contact = client.get("/api/metrics/contact?days=30").json()
    assert contact["summary"]["whatsapp"] >= 1
    assert sum(b["whatsapp"] for b in contact["buckets"]) == contact["summary"]["whatsapp"]


def test_unknown_drilldowns_return_404(client: TestClient):
    missing = "99999999-0000-0000-0000-000000000000"
    assert client.get(f"/api/metrics/quotes/{missing}").status_code == 404
    assert client.get(f"/api/metrics/sellers/{missing}").status_code == 404
    assert client.get(f"/api/metrics/clients/{missing}").status_code == 404
    assert client.get(f"/api/metrics/projects/{missing}").status_code == 404


# ---------------------------------------------------------------------------
# Sin datos: nada divide por cero
# ---------------------------------------------------------------------------


def test_empty_data_is_safe(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    stages = list_stages()
    monkeypatch.setattr(
        MetricsService,
        "_dataset",
        classmethod(lambda cls: Dataset(datetime.now(timezone.utc), [], stages, [], [], [])),
    )
    for tab in TABS:
        res = client.get(f"/api/metrics/{tab}?days=30")
        assert res.status_code == 200, tab

    sales = client.get("/api/metrics/sales").json()
    assert sales["summary"]["close_rate"] is None
    assert sales["summary"]["avg_ticket"] is None
    assert sales["summary"]["avg_cycle_days"] is None
    assert all(b["close_rate"] is None for b in sales["buckets"])

    stages_body = client.get("/api/metrics/stages").json()
    assert all(m["avg_days"] is None and m["median_days"] is None for m in stages_body["macro"])
    assert all(c["advance_rate"] is None for c in stages_body["conversion"])
    assert stages_body["summary"]["slowest_stage"] is None

    quotes = client.get("/api/metrics/quotes").json()
    assert quotes["summary"]["renegotiated_pct"] is None
    assert quotes["summary"]["avg_discount_pct"] is None

    sellers = client.get("/api/metrics/sellers").json()
    assert sellers["summary"]["healthy_pct"] is None
    assert sellers["sellers"] == []

    contact = client.get("/api/metrics/contact").json()
    assert contact["summary"]["first_response_avg_hours"] is None
