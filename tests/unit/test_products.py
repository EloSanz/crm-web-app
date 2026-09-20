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
