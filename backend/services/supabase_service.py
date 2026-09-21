import hashlib
import logging

from backend.config import settings
from backend.database import get_supabase_client
from backend.models.auth import LoginRequest, UserResponse

logger = logging.getLogger("crm.services.auth")


def hash_password(password: str) -> str:
    """Calcula hash SHA-256 con salt para contraseñas de desarrollo/demo."""
    salt = settings.JWT_SECRET_KEY[:8]
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


class AuthService:
    """Servicio de autenticación para el CRM."""

    @staticmethod
    async def authenticate_user(credentials: LoginRequest) -> UserResponse | None:
        """
        Valida las credenciales del usuario contra Supabase Auth o tabla crm_users.
        Incluye fallback para desarrollo local con credenciales demo predeterminadas.
        """
        email = credentials.email.lower().strip()
        password = credentials.password

        # 1. Credencial Demo / Superadmin local por defecto
        if email == "admin@crm.com" and password in ["admin123", "admin"]:
            return UserResponse(
                id="00000000-0000-0000-0000-000000000001",
                email="admin@crm.com",
                full_name="Administrador CRM",
                role="admin",
                is_active=True,
            )

        if email == "vendedor@crm.com" and password in ["vendedor123", "vendedor"]:
            return UserResponse(
                id="00000000-0000-0000-0000-000000000002",
                email="vendedor@crm.com",
                full_name="Ejecutivo Comercial",
                role="ejecutivo_ventas",
                is_active=True,
            )

        if email == "gerente@crm.com" and password in ["gerente123", "gerente"]:
            return UserResponse(
                id="00000000-0000-0000-0000-000000000003",
                email="gerente@crm.com",
                full_name="Responsable Comercial",
                role="gerente_comercial",
                is_active=True,
            )

        # 2. Intento contra Supabase Auth si está configurado
        try:
            supabase = get_supabase_client()
            if settings.SUPABASE_URL and settings.SUPABASE_URL != "https://placeholder.supabase.co":
                response = supabase.auth.sign_in_with_password({"email": email, "password": password})
                if response and response.user:
                    user_data = response.user
                    # Consultar rol en crm_users si existe
                    role = "ejecutivo_ventas"
                    full_name = user_data.user_metadata.get("full_name", email.split("@")[0].title())
                    try:
                        profile_res = (
                            supabase.table("crm_users")
                            .select("role, full_name, is_active")
                            .eq("id", user_data.id)
                            .execute()
                        )
                        if profile_res.data and len(profile_res.data) > 0:
                            role = profile_res.data[0].get("role", role)
                            full_name = profile_res.data[0].get("full_name", full_name)
                    except Exception:
                        pass

                    return UserResponse(
                        id=user_data.id,
                        email=user_data.email or email,
                        full_name=full_name,
                        role=role,
                        is_active=True,
                    )
        except Exception as e:
            logger.warning(f"Error autenticando con Supabase: {e}")

        return None
