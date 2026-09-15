import os

import pytest
from fastapi.testclient import TestClient

# Configurar variables de entorno seguras para testing
os.environ["SUPABASE_URL"] = "https://placeholder.supabase.co"
os.environ["SUPABASE_PUBLISHABLE_KEY"] = "placeholder-key"
os.environ["SUPABASE_SECRET_KEY"] = "placeholder-secret"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-1234567890"

from backend.main import app


@pytest.fixture
def client():
    """Fixture de cliente de pruebas para FastAPI."""
    with TestClient(app) as test_client:
        yield test_client
