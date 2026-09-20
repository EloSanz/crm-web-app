from fastapi.testclient import TestClient


def test_create_opportunity_with_items_and_calc(client: TestClient):
    # 1. Crear empresa
    comp_res = client.post("/api/companies", json={"name": "Constructora Rivadavia SRL"})
    comp_id = comp_res.json()["id"]

    # 2. Obtener etapas
    stages_res = client.get("/api/stages")
    assert stages_res.status_code == 200
    stages = stages_res.json()
    first_stage_id = stages[0]["id"]

    # 3. Crear oportunidad con materiales cotizados
    payload = {
        "title": "Presupuesto Cemento y Hierros - Torre Rivadavia 1200",
        "company_id": comp_id,
        "contact_id": None,
        "assigned_to": "00000000-0000-0000-0000-000000000002",
        "stage_id": first_stage_id,
        "delivery_location": "Av. Rivadavia 1200, Morón",
        "items": [
            {
                "product_name": "Cemento Portland Loma Negra 50 kg",
                "unit": "bolsa 50kg",
                "quantity": 50,
                "unit_price": 9800.00,
            },
            {
                "product_name": "Hierro Aletado Ø 12 mm",
                "unit": "barra 12m",
                "quantity": 20,
                "unit_price": 17800.00,
            },
        ],
    }
    # 50 * 9800 = 490.000 + 20 * 17800 = 356.000 -> Total = 846.000
    create_res = client.post("/api/opportunities", json=payload)
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["title"] == "Presupuesto Cemento y Hierros - Torre Rivadavia 1200"
    assert data["company_name"] == "Constructora Rivadavia SRL"
    assert float(data["estimated_value"]) == 846000.00
    assert len(data["items"]) == 2
    opp_id = data["id"]

    # Detalle
    get_res = client.get(f"/api/opportunities/{opp_id}")
    assert get_res.status_code == 200
    assert float(get_res.json()["estimated_value"]) == 846000.00


def test_opportunity_requires_client(client: TestClient):
    """Invariante 6: toda oportunidad requiere al menos empresa o contacto."""
    stages = client.get("/api/stages").json()
    stage_id = stages[0]["id"]
    payload = {
        "title": "Presupuesto Huérfano Sin Cliente",
        "company_id": None,
        "contact_id": None,
        "assigned_to": "00000000-0000-0000-0000-000000000002",
        "stage_id": stage_id,
    }
    res = client.post("/api/opportunities", json=payload)
    assert res.status_code == 400


def test_update_opportunity_stage(client: TestClient):
    comp = client.post("/api/companies", json={"name": "Obras Oeste"}).json()
    stages = client.get("/api/stages").json()
    stage_1 = stages[0]["id"]
    stage_2 = stages[1]["id"]

    opp = client.post(
        "/api/opportunities",
        json={
            "title": "Presupuesto para Avance de Etapa",
            "company_id": comp["id"],
            "assigned_to": "00000000-0000-0000-0000-000000000002",
            "stage_id": stage_1,
            "estimated_value": 150000.00,
        },
    ).json()

    # Mover a etapa 2
    update_res = client.put(
        f"/api/opportunities/{opp['id']}",
        json={"stage_id": stage_2},
    )
    assert update_res.status_code == 200
    assert update_res.json()["stage_id"] == stage_2


def test_soft_delete_opportunity(client: TestClient):
    comp = client.post("/api/companies", json={"name": "Empresa Test Opp"}).json()
    stages = client.get("/api/stages").json()

    opp = client.post(
        "/api/opportunities",
        json={
            "title": "Presupuesto Para Borrar",
            "company_id": comp["id"],
            "assigned_to": "00000000-0000-0000-0000-000000000002",
            "stage_id": stages[0]["id"],
        },
    ).json()

    del_res = client.delete(f"/api/opportunities/{opp['id']}")
    assert del_res.status_code == 204

    get_res = client.get(f"/api/opportunities/{opp['id']}")
    assert get_res.status_code == 404
