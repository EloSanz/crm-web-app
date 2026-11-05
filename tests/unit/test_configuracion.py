"""Configuración del embudo y de los catálogos (pantallas del administrador)."""

import copy

import pytest
from fastapi.testclient import TestClient

from backend.config import settings
from backend.controllers.auth_controller import generate_simple_token
from backend.main import app
from backend.models.auth import UserResponse
from backend.services import catalog_service, stage_service

VENDEDOR_ID = "00000000-0000-0000-0000-000000000002"


@pytest.fixture(autouse=True)
def _restore_config():
    """Cada test deja etapas y catálogos como estaban: el resto de la suite usa las etapas por defecto."""
    stages = copy.deepcopy(stage_service._mock_stages)
    catalog = copy.deepcopy(catalog_service._mock_catalog)
    yield
    stage_service._mock_stages.clear()
    stage_service._mock_stages.update(stages)
    catalog_service._mock_catalog.clear()
    catalog_service._mock_catalog.update(catalog)


def _vendedor() -> TestClient:
    user = UserResponse(
        id=VENDEDOR_ID, email="vendedor@crm.com", full_name="Ejecutivo Comercial", role="ejecutivo_ventas"
    )
    headers = {"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {generate_simple_token(user)}"}
    return TestClient(app, headers=headers)


def _items(client: TestClient, kind: str, include_inactive: bool = False) -> list[dict]:
    res = client.get("/api/catalogs", params={"kind": kind, "include_inactive": include_inactive})
    assert res.status_code == 200
    return res.json()


# --- Catálogos -----------------------------------------------------------------


@pytest.mark.parametrize("kind", ["activity_type", "origin", "loss_reason"])
def test_admin_crea_edita_reordena_y_desactiva(client: TestClient, kind: str):
    before = _items(client, kind)
    assert before and [i["position"] for i in before] == sorted(i["position"] for i in before)

    res = client.post("/api/catalogs", json={"kind": kind, "label": "  Valor   Nuevo Ñandú "})
    assert res.status_code == 201
    item = res.json()
    assert item["label"] == "Valor Nuevo Ñandú"
    assert item["code"] in {"valor_nuevo_nandu", "valor-nuevo-nandu"}
    assert item["is_active"] and not item["is_system"]
    assert item["position"] == len(before) + 1

    # Duplicado por nombre -> 409
    assert client.post("/api/catalogs", json={"kind": kind, "label": "valor nuevo ñandú"}).status_code == 409

    # Renombrar
    res = client.put(f"/api/catalogs/{item['id']}", json={"label": "Valor renombrado"})
    assert res.status_code == 200 and res.json()["label"] == "Valor renombrado"
    assert res.json()["code"] == item["code"]

    # Reordenar: el nuevo pasa primero
    ids = [item["id"]] + [i["id"] for i in before]
    res = client.put("/api/catalogs/reorder", json={"kind": kind, "ids": ids})
    assert res.status_code == 200
    assert [i["id"] for i in _items(client, kind)][: len(ids)] == ids

    # Mover con position
    res = client.put(f"/api/catalogs/{item['id']}", json={"position": 3})
    assert res.status_code == 200 and res.json()["position"] == 3

    # Desactivar: sale de las opciones activas pero sigue en la lista completa
    res = client.put(f"/api/catalogs/{item['id']}", json={"is_active": False})
    assert res.status_code == 200 and res.json()["is_active"] is False
    assert item["id"] not in {i["id"] for i in _items(client, kind)}
    assert item["id"] in {i["id"] for i in _items(client, kind, include_inactive=True)}

    # Reactivar
    assert client.put(f"/api/catalogs/{item['id']}", json={"is_active": True}).json()["is_active"] is True


def test_vendedor_lee_pero_no_escribe_catalogos(client: TestClient):
    target = _items(client, "origin")[0]
    with _vendedor() as vendedor:
        assert vendedor.get("/api/catalogs", params={"kind": "origin"}).status_code == 200
        assert vendedor.post("/api/catalogs", json={"kind": "origin", "label": "Feria"}).status_code == 403
        assert vendedor.put(f"/api/catalogs/{target['id']}", json={"label": "Otro"}).status_code == 403
        assert vendedor.put("/api/catalogs/reorder", json={"kind": "origin", "ids": [target["id"]]}).status_code == 403


def test_tipo_de_sistema_no_se_desactiva_pero_se_renombra(client: TestClient):
    llamada = next(i for i in _items(client, "activity_type") if i["code"] == "llamada")
    assert llamada["is_system"] is True

    res = client.put(f"/api/catalogs/{llamada['id']}", json={"is_active": False})
    assert res.status_code == 409
    assert "sistema" in res.json()["detail"]

    res = client.put(f"/api/catalogs/{llamada['id']}", json={"label": "Llamado telefónico"})
    assert res.status_code == 200
    assert res.json()["label"] == "Llamado telefónico" and res.json()["code"] == "llamada"


def test_catalogo_desconocido_da_422(client: TestClient):
    assert client.get("/api/catalogs", params={"kind": "colores"}).status_code == 422


# --- Actividades con tipos configurables ---------------------------------------


def _opportunity(client: TestClient) -> str:
    comp = client.post("/api/companies", json={"name": "Corralón Config SRL"}).json()
    stage = client.get("/api/stages").json()[0]
    res = client.post(
        "/api/opportunities",
        json={"title": "Presupuesto config", "company_id": comp["id"], "stage_id": stage["id"]},
    )
    assert res.status_code == 201
    return res.json()["id"]


def test_actividad_con_tipo_nuevo_funciona_y_con_tipo_inexistente_da_422(client: TestClient):
    opp_id = _opportunity(client)
    nuevo = client.post("/api/catalogs", json={"kind": "activity_type", "label": "Visita técnica"}).json()
    assert nuevo["code"] == "visita_tecnica"

    res = client.post(
        "/api/activities",
        json={"opportunity_id": opp_id, "activity_type": "visita_tecnica", "summary": "Fuimos a medir la losa"},
    )
    assert res.status_code == 201
    assert res.json()["activity_type"] == "visita_tecnica"

    res = client.post(
        "/api/activities",
        json={"opportunity_id": opp_id, "activity_type": "telepatia", "summary": "No debería guardarse"},
    )
    assert res.status_code == 422

    # Desactivado -> 422 para cargas nuevas
    client.put(f"/api/catalogs/{nuevo['id']}", json={"is_active": False})
    res = client.post(
        "/api/activities",
        json={"opportunity_id": opp_id, "activity_type": "visita_tecnica", "summary": "Otra visita"},
    )
    assert res.status_code == 422
    assert "desactivado" in res.json()["detail"]

    # Los tipos de sistema siguen funcionando
    res = client.post(
        "/api/activities", json={"opportunity_id": opp_id, "activity_type": "llamada", "summary": "Llamado"}
    )
    assert res.status_code == 201


# --- Etapas ----------------------------------------------------------------------


def _stages(client: TestClient, include_inactive: bool = False) -> list[dict]:
    res = client.get("/api/stages", params={"include_inactive": include_inactive})
    assert res.status_code == 200
    return res.json()


def test_get_stages_ordenadas_y_solo_activas(client: TestClient):
    stages = _stages(client)
    assert len(stages) >= 6
    assert [s["position"] for s in stages] == sorted(s["position"] for s in stages)
    assert all(s["is_active"] for s in stages)


def test_admin_crea_edita_reordena_y_desactiva_etapa(client: TestClient):
    before = _stages(client)
    res = client.post("/api/stages", json={"name": "Visita al cliente", "color": "#123456", "kind": "open"})
    assert res.status_code == 201
    stage = res.json()
    assert stage["slug"] == "visita-al-cliente"
    assert not stage["is_closed_won"] and not stage["is_closed_lost"]

    # Una abierta nueva queda antes de los cierres
    after = _stages(client)
    names = [s["name"] for s in after]
    first_closed = next(i for i, s in enumerate(after) if s["is_closed_won"] or s["is_closed_lost"])
    assert names.index("Visita al cliente") == first_closed - 1
    assert len(after) == len(before) + 1

    assert client.post("/api/stages", json={"name": "visita al cliente"}).status_code == 409

    res = client.put(f"/api/stages/{stage['id']}", json={"name": "Visita a la obra", "color": "#654321"})
    assert res.status_code == 200
    assert res.json()["name"] == "Visita a la obra" and res.json()["color"] == "#654321"

    # Reordenar: la nueva primero
    ids = [stage["id"]] + [s["id"] for s in before]
    res = client.put("/api/stages/reorder", json={"ids": ids})
    assert res.status_code == 200
    assert [s["id"] for s in _stages(client)] == ids
    assert _stages(client)[0]["position"] == 1

    # Desactivar (sin presupuestos abiertos)
    res = client.put(f"/api/stages/{stage['id']}", json={"is_active": False})
    assert res.status_code == 200 and res.json()["is_active"] is False
    assert stage["id"] not in {s["id"] for s in _stages(client)}
    assert stage["id"] in {s["id"] for s in _stages(client, include_inactive=True)}


def test_vendedor_no_escribe_etapas(client: TestClient):
    stage = _stages(client)[0]
    with _vendedor() as vendedor:
        assert vendedor.get("/api/stages").status_code == 200
        assert vendedor.post("/api/stages", json={"name": "Etapa pirata"}).status_code == 403
        assert vendedor.put(f"/api/stages/{stage['id']}", json={"name": "X etapa"}).status_code == 403
        assert vendedor.put("/api/stages/reorder", json={"ids": [stage["id"]]}).status_code == 403


def test_no_se_desactiva_etapa_con_presupuestos_abiertos(client: TestClient):
    stage = client.post("/api/stages", json={"name": "Esperando plano", "kind": "open"}).json()
    comp = client.post("/api/companies", json={"name": "Constructora Plano SA"}).json()
    res = client.post(
        "/api/opportunities",
        json={"title": "Presupuesto con plano", "company_id": comp["id"], "stage_id": stage["id"]},
    )
    assert res.status_code == 201

    res = client.put(f"/api/stages/{stage['id']}", json={"is_active": False})
    assert res.status_code == 409
    assert "presupuesto abierto" in res.json()["detail"]
    assert stage["id"] in {s["id"] for s in _stages(client)}

    # Tampoco se le cambia el tipo si ya tiene presupuestos
    assert client.put(f"/api/stages/{stage['id']}", json={"kind": "won"}).status_code == 409


def test_siempre_queda_una_etapa_ganada_y_una_perdida(client: TestClient):
    stages = _stages(client)
    won = [s for s in stages if s["is_closed_won"]]
    lost = [s for s in stages if s["is_closed_lost"]]
    assert len(won) == 1 and len(lost) == 1

    res = client.put(f"/api/stages/{won[0]['id']}", json={"is_active": False})
    assert res.status_code == 409 and "ganada" in res.json()["detail"]
    res = client.put(f"/api/stages/{lost[0]['id']}", json={"is_active": False})
    assert res.status_code == 409 and "perdida" in res.json()["detail"]

    # Cambiar el tipo de la única perdida a abierta tampoco deja el embudo sin cierre
    nueva_perdida = client.post("/api/stages", json={"name": "Cancelada", "kind": "lost"}).json()
    assert nueva_perdida["is_closed_lost"] is True
    assert _stages(client)[-1]["id"] == nueva_perdida["id"]
    # Con otra perdida activa, ahora sí se puede desactivar la nueva
    assert client.put(f"/api/stages/{nueva_perdida['id']}", json={"is_active": False}).status_code == 200


def test_siempre_queda_una_etapa_abierta(client: TestClient):
    open_ids = [s["id"] for s in _stages(client) if not s["is_closed_won"] and not s["is_closed_lost"]]
    ultima = client.post("/api/stages", json={"name": "Etapa solitaria", "kind": "open"}).json()
    # Se simulan las demás abiertas desactivadas (en memoria) para probar la regla sin tocar presupuestos.
    for sid in open_ids:
        stage_service._mock_stages[sid]["is_active"] = False
    res = client.put(f"/api/stages/{ultima['id']}", json={"is_active": False})
    assert res.status_code == 409 and "abierta" in res.json()["detail"]


def test_list_stages_importable_desde_opportunity_controller():
    from backend.controllers.opportunity_controller import list_stages

    assert all(s["is_active"] for s in list_stages())
    assert len(list_stages(include_inactive=True)) >= len(list_stages())
