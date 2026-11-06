"""Tope de `limit` en los listados: el frontend pagina en el cliente y pide hasta 1000 de una vez."""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.controllers.pagination import LIST_MAX_LIMIT

LISTADOS = ["/api/companies", "/api/contacts", "/api/products", "/api/projects", "/api/opportunities"]


@pytest.mark.parametrize("path", LISTADOS)
def test_listados_aceptan_hasta_el_tope(client: TestClient, path: str):
    assert client.get(f"{path}?limit={LIST_MAX_LIMIT}").status_code == 200
    assert client.get(f"{path}?limit={LIST_MAX_LIMIT + 1}").status_code == 422


def test_con_mas_de_100_materiales_el_tope_trae_todos(client: TestClient):
    tanda = uuid4().hex[:6]
    for i in range(105):
        res = client.post(
            "/api/products",
            json={
                "code": f"LIM-{tanda}-{i:03d}",
                "name": f"Material de prueba {tanda} {i}",
                "category": "Áridos",
                "unit": "m3",
                "unit_price": "1000.00",
            },
        )
        assert res.status_code == 201

    todos = client.get(f"/api/products?limit={LIST_MAX_LIMIT}&q={tanda}").json()
    assert len(todos) == 105
    # Sin `limit` sigue el valor por defecto de la API (100): por eso el frontend pide el tope.
    assert len(client.get(f"/api/products?q={tanda}").json()) == 100
