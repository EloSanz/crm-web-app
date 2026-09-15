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


def test_get_current_user_me_missing_header(client):
    """Verifica rechazo 401 si falta el header Authorization."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert "Header Authorization no provisto" in response.json()["detail"]


def test_get_current_user_me_invalid_token(client):
    """Verifica rechazo 401 con token corrupto o malformado."""
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer token_invalido_xyz"})
    assert response.status_code == 401
    assert "Token inválido o expirado" in response.json()["detail"]
