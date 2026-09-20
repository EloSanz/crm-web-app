import os

import pytest
from fastapi.testclient import TestClient

# Configurar variables de entorno seguras para testing
os.environ["SUPABASE_URL"] = "https://placeholder.supabase.co"
os.environ["SUPABASE_PUBLISHABLE_KEY"] = "placeholder-key"
os.environ["SUPABASE_SECRET_KEY"] = "placeholder-secret"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-1234567890"

from backend.config import settings
from backend.controllers.auth_controller import generate_simple_token
from backend.main import app
from backend.models.auth import UserResponse


@pytest.fixture
def client():
    """Fixture de cliente de pruebas para FastAPI preconfigurado con API Key y sesión."""
    demo_user = UserResponse(
        id="00000000-0000-0000-0000-000000000001",
        email="admin@crm.com",
        full_name="Administrador CRM",
        role="admin",
        is_active=True,
    )
    token = generate_simple_token(demo_user)
    headers = {
        "X-API-Key": settings.CRM_API_KEY,
        "Authorization": f"Bearer {token}",
    }
    with TestClient(app, headers=headers) as test_client:
        yield test_client


@pytest.fixture
def raw_client():
    """Fixture sin headers para testear validaciones de seguridad."""
    with TestClient(app) as test_client:
        yield test_client
