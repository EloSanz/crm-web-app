def test_login_successful_admin(client):
    """Verifica inicio de sesión exitoso con credenciales de administrador."""
    payload = {
        "email": "admin@crm.com",
        "password": "admin123",
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "admin@crm.com"
    assert data["user"]["role"] == "admin"


def test_login_successful_vendedor(client):
    """Verifica inicio de sesión exitoso con credenciales de vendedor."""
    payload = {
        "email": "vendedor@crm.com",
        "password": "vendedor123",
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "vendedor@crm.com"
    assert data["user"]["role"] == "ejecutivo_ventas"


def test_login_invalid_password(client):
    """Verifica rechazo con código 401 ante contraseña incorrecta."""
    payload = {
        "email": "admin@crm.com",
        "password": "wrongpassword",
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 401
    assert "Credenciales incorrectas" in response.json()["detail"]


def test_login_unknown_email(client):
    """Verifica rechazo con código 401 ante email desconocido."""
    payload = {
        "email": "desconocido@crm.com",
        "password": "password123",
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 401
    assert "Credenciales incorrectas" in response.json()["detail"]


def test_login_invalid_email_format(client):
    """Verifica validación 422 ante formato de email inválido."""
    payload = {
        "email": "no-es-un-email",
        "password": "password123",
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 422


def test_get_current_user_me_successful(client):
    """Verifica obtención del perfil con token Bearer válido."""
    login_res = client.post(
        "/api/auth/login",
        json={"email": "vendedor@crm.com", "password": "vendedor123"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    data = me_res.json()
    assert data["email"] == "vendedor@crm.com"
    assert data["role"] == "ejecutivo_ventas"


def test_api_key_required_without_header(raw_client):
    """Verifica rechazo 403 si la petición carece del header X-API-Key."""
    response = raw_client.get("/api/companies")
    assert response.status_code == 403
    assert "API Key" in response.json()["detail"]


def test_get_current_user_me_missing_header(raw_client):
    """Verifica rechazo 401 si se envía API Key pero falta el token Bearer."""
    response = raw_client.get(
        "/api/auth/me",
        headers={"X-API-Key": "crm_live_corralon_secret_key_2026"},
    )
    assert response.status_code == 401
    assert "Se requiere token de sesión Bearer" in response.json()["detail"]


def test_get_current_user_me_invalid_token(raw_client):
    """Verifica rechazo 401 con token corrupto o malformado."""
    response = raw_client.get(
        "/api/auth/me",
        headers={
            "X-API-Key": "crm_live_corralon_secret_key_2026",
            "Authorization": "Bearer token_invalido_xyz",
        },
    )
    assert response.status_code == 401
    assert "Sesión inválida o expirada" in response.json()["detail"]
