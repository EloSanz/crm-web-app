from uuid import uuid4

from fastapi.testclient import TestClient


def test_list_projects_and_filter_by_status(client: TestClient):
    res = client.get("/api/projects")
    assert res.status_code == 200
    items = res.json()
    assert len(items) > 0

    # Filtrar por status en_curso
    res_status = client.get("/api/projects?status=en_curso")
    assert res_status.status_code == 200
    assert all(item["status"] == "en_curso" for item in res_status.json())


def test_create_and_get_project(client: TestClient):
    payload = {
        "name": f"Edificio Los Aromos {uuid4().hex[:4]}",
        "address": "Calle Falsa 123, Ramos Mejía",
        "project_type": "edificio_multifamiliar",
        "status": "en_curso",
        "observations": "Coordinar entrega matutina.",
    }
    create_res = client.post("/api/projects", json=payload)
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["name"] == payload["name"]
    assert data["address"] == payload["address"]
    project_id = data["id"]

    # Detalle por ID
    get_res = client.get(f"/api/projects/{project_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == payload["name"]


def test_update_project_status_and_address(client: TestClient):
    create_res = client.post(
        "/api/projects",
        json={
            "name": f"Obra Refacción {uuid4().hex[:4]}",
            "address": "San Martín 450, Morón",
            "project_type": "refaccion",
            "status": "planificacion",
        },
    )
    project_id = create_res.json()["id"]

    update_res = client.put(
        f"/api/projects/{project_id}",
        json={"status": "frenada", "address": "San Martín 450 Bis, Morón"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "frenada"
    assert update_res.json()["address"] == "San Martín 450 Bis, Morón"


def test_soft_delete_project(client: TestClient):
    create_res = client.post(
        "/api/projects",
        json={
            "name": f"Obra Temporal {uuid4().hex[:4]}",
            "address": "Alvear 100, San Justo",
            "project_type": "vivienda_unifamiliar",
            "status": "finalizada",
        },
    )
    project_id = create_res.json()["id"]

    del_res = client.delete(f"/api/projects/{project_id}")
    assert del_res.status_code == 204

    # Verificar que retorne 404 al consultar una obra eliminada
    get_res = client.get(f"/api/projects/{project_id}")
    assert get_res.status_code == 404
