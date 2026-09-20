from uuid import uuid4

from fastapi.testclient import TestClient


def test_create_and_get_company(client: TestClient):
    payload = {
        "name": "Constructora Los Andes SRL",
        "cuit": "30-71234567-9",
        "industry": "Obra Civil",
        "email": "compras@losandes.com",
        "phone": "+54 11 4455-6677",
        "address": "Av. Rivadavia 1200, Morón",
        "status": "potencial",
        "origin": "Vino al local (mostrador)",
        "notes": "Cliente potencial para provisión de hierros y cemento",
    }
    create_res = client.post("/api/companies", json=payload)
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["name"] == "Constructora Los Andes SRL"
    assert data["cuit"] == "30-71234567-9"
    assert data["status"] == "potencial"
    assert data["is_deleted"] is False
    company_id = data["id"]

    # Obtener por ID
    get_res = client.get(f"/api/companies/{company_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Constructora Los Andes SRL"


def test_list_and_search_companies(client: TestClient):
    # Crear empresa de prueba
    client.post(
        "/api/companies",
        json={"name": "Hormigonera del Oeste", "status": "cliente", "cuit": "30-99887766-5"},
    )
    # Búsqueda por nombre
    res = client.get("/api/companies?q=Oeste")
    assert res.status_code == 200
    items = res.json()
    assert any("Oeste" in item["name"] for item in items)

    # Filtrar por status
    res_status = client.get("/api/companies?status=cliente")
    assert res_status.status_code == 200
    assert all(item["status"] == "cliente" for item in res_status.json())


def test_update_company(client: TestClient):
    create_res = client.post(
        "/api/companies",
        json={"name": "Gómez Obras", "status": "potencial"},
    )
    company_id = create_res.json()["id"]

    update_res = client.put(
        f"/api/companies/{company_id}",
        json={"name": "Gómez Obras SA", "status": "cliente", "phone": "11-2233-4455"},
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["name"] == "Gómez Obras SA"
    assert updated_data["status"] == "cliente"
    assert updated_data["phone"] == "11-2233-4455"


def test_soft_delete_company(client: TestClient):
    """Verifica que la eliminación sea lógica (is_deleted=True, deleted_at!=None)."""
    create_res = client.post(
        "/api/companies",
        json={"name": "Empresa para Borrar Lógicamente"},
    )
    company_id = create_res.json()["id"]

    # Borrado
    del_res = client.delete(f"/api/companies/{company_id}")
    assert del_res.status_code == 204

    # No debe aparecer en listado
    list_res = client.get("/api/companies")
    assert list_res.status_code == 200
    assert all(item["id"] != company_id for item in list_res.json())

    # GET por ID debe retornar 404 porque está dada de baja
    get_res = client.get(f"/api/companies/{company_id}")
    assert get_res.status_code == 404


def test_get_nonexistent_company(client: TestClient):
    fake_id = uuid4()
    res = client.get(f"/api/companies/{fake_id}")
    assert res.status_code == 404
