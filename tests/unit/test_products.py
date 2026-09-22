from uuid import uuid4

from fastapi.testclient import TestClient


def test_list_products_and_filter_by_category(client: TestClient):
    res = client.get("/api/products")
    assert res.status_code == 200
    items = res.json()
    assert len(items) > 0

    # Filtrar por categoría
    res_aglo = client.get("/api/products?category=Aglomerantes")
    assert res_aglo.status_code == 200
    assert all(item["category"] == "Aglomerantes" for item in res_aglo.json())


def test_create_and_get_product(client: TestClient):
    payload = {
        "code": f"TEST-{uuid4().hex[:6]}",
        "name": "Membrana Asfáltica 4mm con Aluminio",
        "category": "Techos e Hidráulica",
        "unit": "rollo 10m2",
        "unit_price": "29500.00",
        "description": "Membrana impermeabilizante con aluminio gofrado.",
    }
    create_res = client.post("/api/products", json=payload)
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["name"] == "Membrana Asfáltica 4mm con Aluminio"
    assert data["unit"] == "rollo 10m2"
    product_id = data["id"]

    # Detalle
    get_res = client.get(f"/api/products/{product_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Membrana Asfáltica 4mm con Aluminio"


def test_update_product_price(client: TestClient):
    create_res = client.post(
        "/api/products",
        json={
            "code": f"PRICE-{uuid4().hex[:6]}",
            "name": "Clavos Punta París 2 1/2 pulgada",
            "category": "Hierros y Aceros",
            "unit": "kg",
            "unit_price": "2200.00",
        },
    )
    product_id = create_res.json()["id"]

    update_res = client.put(
        f"/api/products/{product_id}",
        json={"unit_price": "2500.00"},
    )
    assert update_res.status_code == 200
    assert float(update_res.json()["unit_price"]) == 2500.00


def test_soft_delete_product(client: TestClient):
    create_res = client.post(
        "/api/products",
        json={
            "code": f"DEL-{uuid4().hex[:6]}",
            "name": "Producto para Eliminar",
            "category": "Servicios",
            "unit_price": "100.00",
        },
    )
    product_id = create_res.json()["id"]

    del_res = client.delete(f"/api/products/{product_id}")
    assert del_res.status_code == 204

    # GET 404
    get_res = client.get(f"/api/products/{product_id}")
    assert get_res.status_code == 404


def _material(**extra) -> dict:
    return {
        "code": f"MAY-{uuid4().hex[:6]}",
        "name": "Cemento de Albañilería 40 kg",
        "category": "Aglomerantes",
        "unit": "bolsa 40kg",
        "unit_price": "7000.00",
        **extra,
    }


def test_seed_catalog_has_wholesale_prices(client: TestClient):
    items = client.get("/api/products?q=CEM-50").json()
    cemento = next(p for p in items if p["code"] == "CEM-50")
    assert float(cemento["wholesale_price"]) < float(cemento["unit_price"])
    assert float(cemento["wholesale_min_qty"]) == 50


def test_create_product_with_wholesale_price(client: TestClient):
    res = client.post("/api/products", json=_material(wholesale_price="6300.00", wholesale_min_qty="40"))
    assert res.status_code == 201
    data = res.json()
    assert float(data["wholesale_price"]) == 6300.00
    assert float(data["wholesale_min_qty"]) == 40

    detail = client.get(f"/api/products/{data['id']}").json()
    assert float(detail["wholesale_price"]) == 6300.00


def test_product_without_wholesale_keeps_it_empty(client: TestClient):
    data = client.post("/api/products", json=_material()).json()
    assert data["wholesale_price"] is None
    assert data["wholesale_min_qty"] is None


def test_wholesale_price_cannot_exceed_retail(client: TestClient):
    res = client.post("/api/products", json=_material(wholesale_price="7500.00", wholesale_min_qty="10"))
    assert res.status_code == 422
    assert "minorista" in res.json()["detail"]


def test_wholesale_price_and_min_qty_go_together(client: TestClient):
    res = client.post("/api/products", json=_material(wholesale_price="6500.00"))
    assert res.status_code == 422
    assert isinstance(res.json()["detail"], str)

    res = client.post("/api/products", json=_material(wholesale_min_qty="10"))
    assert res.status_code == 422


def test_wholesale_values_must_be_positive(client: TestClient):
    res = client.post("/api/products", json=_material(wholesale_price="0", wholesale_min_qty="10"))
    assert res.status_code == 422
    res = client.post("/api/products", json=_material(wholesale_price="6000", wholesale_min_qty="0"))
    assert res.status_code == 422


def test_update_validates_wholesale_against_saved_product(client: TestClient):
    product = client.post("/api/products", json=_material(wholesale_price="6300.00", wholesale_min_qty="40")).json()

    # Bajar el minorista por debajo del mayorista guardado no se permite
    res = client.put(f"/api/products/{product['id']}", json={"unit_price": "6000.00"})
    assert res.status_code == 422

    # Mandar sólo la mitad del par tampoco
    res = client.put(f"/api/products/{product['id']}", json={"wholesale_price": None})
    assert res.status_code == 422

    # Sacar el mayorista completo sí
    res = client.put(f"/api/products/{product['id']}", json={"wholesale_price": None, "wholesale_min_qty": None})
    assert res.status_code == 200
    assert res.json()["wholesale_price"] is None
    assert res.json()["wholesale_min_qty"] is None

    # Y volver a cargarlo junto con un nuevo minorista
    res = client.put(
        f"/api/products/{product['id']}",
        json={"unit_price": "7400.00", "wholesale_price": "6900.00", "wholesale_min_qty": "30"},
    )
    assert res.status_code == 200
    assert float(res.json()["wholesale_price"]) == 6900.00


def test_update_ignores_null_for_required_fields(client: TestClient):
    product = client.post("/api/products", json=_material()).json()
    res = client.put(
        f"/api/products/{product['id']}", json={"unit_price": None, "name": "Cemento de Albañilería 25 kg"}
    )
    assert res.status_code == 200
    assert float(res.json()["unit_price"]) == 7000.00
    assert res.json()["name"] == "Cemento de Albañilería 25 kg"
