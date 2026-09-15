def test_health_check_endpoint(client):
    """Verifica que el endpoint /health responda status 200 y formato esperado."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app"] == "CRM Web App"
    assert "version" in data
    assert "timestamp" in data
    assert data["database_connected"] is True


def test_api_health_check_alias(client):
    """Verifica que /api/health responda idéntico."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
