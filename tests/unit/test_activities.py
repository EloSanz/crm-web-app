from fastapi.testclient import TestClient


def test_active_pipeline_metric_endpoint(client: TestClient):
    """Verifica que el endpoint de North Star Metric retorne el formato esperado."""
    res = client.get("/api/metrics/active-pipeline?days=7")
    assert res.status_code == 200
    data = res.json()
    assert "window_days" in data
    assert data["window_days"] == 7
    assert "active_opportunities_amount" in data
    assert "active_opportunities_count" in data
    assert "stale_opportunities_amount" in data
    assert "stale_opportunities_count" in data
    assert "pipeline_health_ratio" in data
    assert isinstance(data["active_opportunities_amount"], (int, float))
    assert isinstance(data["pipeline_health_ratio"], (int, float))


def test_create_activity_and_fetch_timeline(client: TestClient):
    """Prueba registrar una actividad en una oportunidad y recuperarla en el timeline."""
    # 1. Crear empresa y oportunidad
    comp = client.post("/api/companies", json={"name": "Obras del Sur S.A."}).json()
    stages = client.get("/api/stages").json()
    opp = client.post(
        "/api/opportunities",
        json={
            "title": "Presupuesto Ladrillos Huecos Obras del Sur",
            "company_id": comp["id"],
            "assigned_to": "00000000-0000-0000-0000-000000000002",
            "stage_id": stages[0]["id"],
            "estimated_value": 350000.0,
        },
    ).json()

    opp_id = opp["id"]

    # 2. Registrar actividad tipo llamada
    act_payload = {
        "opportunity_id": opp_id,
        "activity_type": "llamada",
        "summary": "Seguimiento telefónico con capataz de obra",
        "description": "Llamada de seguimiento con el capataz. Solicita descuento por pago en efectivo.",
    }
    create_act_res = client.post("/api/activities", json=act_payload)
    assert create_act_res.status_code == 201
    act_data = create_act_res.json()
    assert act_data["opportunity_id"] == opp_id
    assert act_data["activity_type"] == "llamada"
    assert "descuento por pago en efectivo" in act_data["description"]
    assert act_data["user_name"] is not None

    # 3. Consultar timeline de la oportunidad
    timeline_res = client.get(f"/api/opportunities/{opp_id}/activities")
    assert timeline_res.status_code == 200
    timeline = timeline_res.json()
    assert len(timeline) >= 1
    assert timeline[0]["activity_type"] == "llamada"

    # 4. Verificar que la oportunidad ahora refleja salud y última actividad
    get_opp_res = client.get(f"/api/opportunities/{opp_id}")
    assert get_opp_res.status_code == 200
    opp_detail = get_opp_res.json()
    assert opp_detail["health_status"] == "healthy"
    assert opp_detail["days_since_last_activity"] == 0
