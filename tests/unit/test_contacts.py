from uuid import uuid4

from fastapi.testclient import TestClient


def test_create_and_get_contact_with_company(client: TestClient):
    # 1. Crear empresa primero
    comp_res = client.post(
        "/api/companies",
        json={"name": "Constructora San Martín"},
    )
    company_id = comp_res.json()["id"]

    # 2. Crear contacto asociado a la empresa
    contact_payload = {
        "first_name": "Carlos",
        "last_name": "Gutiérrez",
        "company_id": company_id,
        "job_title": "Maestro Mayor de Obra",
        "email": "carlos.gutierrez@obras.com",
        "phone": "+54 9 11 5566-7788",
        "status": "cliente",
        "origin": "Recomendación de otro contratista",
    }
    contact_res = client.post("/api/contacts", json=contact_payload)
    assert contact_res.status_code == 201
    contact_data = contact_res.json()
    assert contact_data["first_name"] == "Carlos"
    assert contact_data["last_name"] == "Gutiérrez"
    assert contact_data["company_id"] == company_id
    assert contact_data["company_name"] == "Constructora San Martín"
    contact_id = contact_data["id"]

    # 3. Obtener contacto por ID
    get_res = client.get(f"/api/contacts/{contact_id}")
    assert get_res.status_code == 200
    assert get_res.json()["company_name"] == "Constructora San Martín"

    # 4. Listar contactos de la empresa
    comp_contacts_res = client.get(f"/api/companies/{company_id}/contacts")
    assert comp_contacts_res.status_code == 200
    comp_contacts = comp_contacts_res.json()
    assert any(c["id"] == contact_id for c in comp_contacts)


def test_create_independent_contact(client: TestClient):
    """Verifica que un contacto puede existir sin empresa (cliente individual)."""
    payload = {
        "first_name": "Pedro",
        "last_name": "Albarracín",
        "company_id": None,
        "job_title": "Contratista Particular",
        "phone": "11-9988-7766",
        "status": "potencial",
    }
    res = client.post("/api/contacts", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["company_id"] is None
    assert data["company_name"] is None


def test_update_contact(client: TestClient):
    create_res = client.post(
        "/api/contacts",
        json={"first_name": "Luciano", "last_name": "Rossi", "job_title": "Capataz"},
    )
    contact_id = create_res.json()["id"]

    update_res = client.put(
        f"/api/contacts/{contact_id}",
        json={"job_title": "Jefe de Compras", "phone": "11-3322-1100"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["job_title"] == "Jefe de Compras"
    assert update_res.json()["phone"] == "11-3322-1100"


def test_soft_delete_contact(client: TestClient):
    """Verifica baja lógica de contactos."""
    create_res = client.post(
        "/api/contacts",
        json={"first_name": "Contacto", "last_name": "Para Borrar"},
    )
    contact_id = create_res.json()["id"]

    del_res = client.delete(f"/api/contacts/{contact_id}")
    assert del_res.status_code == 204

    # No debe figurar en lista
    list_res = client.get("/api/contacts")
    assert list_res.status_code == 200
    assert all(c["id"] != contact_id for c in list_res.json())

    # GET 404
    get_res = client.get(f"/api/contacts/{contact_id}")
    assert get_res.status_code == 404


def test_contact_with_invalid_company_fails(client: TestClient):
    fake_comp_id = uuid4()
    res = client.post(
        "/api/contacts",
        json={
            "first_name": "Martín",
            "last_name": "Pérez",
            "company_id": str(fake_comp_id),
        },
    )
    assert res.status_code == 404
