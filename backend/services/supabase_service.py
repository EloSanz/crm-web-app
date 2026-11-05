import logging
from dataclasses import dataclass

from fastapi import HTTPException, status
from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions

from backend.config import settings
from backend.database import get_supabase_client
from backend.models.auth import LoginRequest, UserResponse
from backend.services import user_service
from backend.services.passwords import verify_password

logger = logging.getLogger("crm.services.auth")


@dataclass(frozen=True)
class _DemoUser:
    passwords: tuple[str, ...]
    id: str
    full_name: str
    role: str


# Usuarios de demostración con contraseña en el código. Sólo valen en modo local o con ALLOW_DEMO_LOGIN=true:
# producción tiene que entrar con cuentas reales de Supabase Auth (ver scripts/crear_usuarios_auth.py).
DEMO_USERS: dict[str, _DemoUser] = {
    "admin@crm.com": _DemoUser(("admin123", "admin"), user_service.ADMIN_ID, "Administrador CRM", "admin"),
    "vendedor@crm.com": _DemoUser(
        ("vendedor123", "vendedor"), user_service.VENDEDOR_ID, "Ejecutivo Comercial", "ejecutivo_ventas"
    ),
    "gerente@crm.com": _DemoUser(
        ("gerente123", "gerente"), user_service.GERENTE_ID, "Responsable Comercial", "gerente_comercial"
    ),
}

INACTIVE_DETAIL = "Tu usuario está dado de baja. Pedile al administrador que lo reactive."
NO_PROFILE_DETAIL = "Tu cuenta no tiene un perfil en el CRM. Pedile al administrador que te dé de alta."


def _local_mode() -> bool:
    # Import diferido: demo_seed arrastra controladores y servicios que importan este módulo.
    from backend.services.demo_seed import is_local_mode

    return is_local_mode()


def demo_login_enabled() -> bool:
    return _local_mode() or settings.ALLOW_DEMO_LOGIN


def _login_client() -> Client:
    """Cliente aparte, sin sesión persistida, sólo para validar la contraseña.

    Si el login usara el cliente compartido, supabase-py le pondría el token del usuario en el header
    Authorization y las consultas siguientes del backend dejarían de ir con la secret key.
    """
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SECRET_KEY or settings.SUPABASE_PUBLISHABLE_KEY,
        SyncClientOptions(auto_refresh_token=False, persist_session=False),
    )


def _find_profile(user_id: str, email: str) -> dict | None:
    """Perfil en crm_users: primero por id; si no está, por correo.

    Los usuarios demo tienen ids fijos (referenciados en presupuestos). Si alguien crea en Auth una cuenta
    con el mismo correo, tiene otro id: se resuelve al perfil existente y la sesión usa el id del perfil.
    """
    email = email.lower().strip()
    if _local_mode():
        users = user_service._mock_users
        return users.get(user_id) or next((u for u in users.values() if u["email"].lower() == email), None)

    table = get_supabase_client().table("crm_users")
    fields = "id, email, full_name, role, is_active"
    res = table.select(fields).eq("id", user_id).execute()
    if res.data:
        return res.data[0]
    res = get_supabase_client().table("crm_users").select(fields).eq("email", email).execute()
    return res.data[0] if res.data else None


def _session_user(profile: dict) -> UserResponse:
    """Usuario de la sesión a partir del perfil: rol y nombre salen de crm_users."""
    if profile.get("is_active") is False:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INACTIVE_DETAIL)
    return UserResponse(
        id=str(profile["id"]),
        email=profile["email"],
        full_name=profile.get("full_name") or profile["email"].split("@")[0].title(),
        role=profile.get("role") or "ejecutivo_ventas",
        is_active=True,
    )


class AuthService:
    """Servicio de autenticación para el CRM."""

    @staticmethod
    async def authenticate_user(credentials: LoginRequest) -> UserResponse | None:
        """
        Valida las credenciales. Devuelve None si no son correctas y corta con 403 si la cuenta
        es correcta pero el usuario está dado de baja o no tiene perfil en el CRM.

        - Usuarios demo (contraseña en el código): sólo en modo local o con ALLOW_DEMO_LOGIN.
        - Modo local: usuarios creados desde la pantalla, con hash scrypt.
        - Modo Supabase: Supabase Auth valida la contraseña y el perfil sale de crm_users.
        """
        email = credentials.email.lower().strip()
        password = credentials.password

        demo = DEMO_USERS.get(email)
        if demo and password in demo.passwords and demo_login_enabled():
            try:
                profile = _find_profile(demo.id, email)
            except Exception as e:
                logger.warning("No se pudo leer el perfil del usuario demo: %s", type(e).__name__)
                profile = None
            if profile:
                return _session_user(profile)
            return UserResponse(id=demo.id, email=email, full_name=demo.full_name, role=demo.role, is_active=True)

        if _local_mode():
            profile = _find_profile("", email)
            if profile and verify_password(password, user_service._mock_passwords.get(str(profile["id"]))):
                return _session_user(profile)
            return None

        try:
            response = _login_client().auth.sign_in_with_password({"email": email, "password": password})
        except Exception as e:
            code = str(getattr(e, "code", "") or "").lower()
            message = str(getattr(e, "message", "") or "").lower()
            if code == "user_banned" or "banned" in message:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INACTIVE_DETAIL)
            logger.info("Login rechazado por Supabase Auth: %s", type(e).__name__)
            return None
        if not response or not response.user:
            return None

        try:
            profile = _find_profile(str(response.user.id), response.user.email or email)
        except Exception as e:
            logger.warning("No se pudo leer el perfil en crm_users: %s", type(e).__name__)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No pudimos leer tu perfil. Probá de nuevo en un rato.",
            )
        if not profile:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=NO_PROFILE_DETAIL)
        return _session_user(profile)
