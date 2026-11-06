import base64
import hashlib
import hmac
import json
import time

from fastapi import APIRouter, Header, HTTPException, status

from backend.config import settings
from backend.models.auth import LoginRequest, LoginResponse, UserResponse
from backend.services.supabase_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["Auth"])


def _sign(payload_b64: str) -> str:
    digest = hmac.new(settings.JWT_SECRET_KEY.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


def generate_simple_token(user: UserResponse) -> str:
    """Token de sesión firmado con HMAC-SHA256 (JWT_SECRET_KEY): nadie puede armarse uno con otro rol."""
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "name": user.full_name,
        "exp": int(time.time()) + settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")
    return f"crm_{encoded}.{_sign(encoded)}"


def _invalid() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")


def decode_simple_token(token: str) -> dict:
    """Valida firma y vencimiento. Los tokens viejos sin firma ya no se aceptan."""
    if token.startswith("Bearer "):
        token = token[7:]
    if token.startswith("crm_"):
        token = token[4:]
    encoded, _, signature = token.partition(".")
    if not encoded or not signature or not hmac.compare_digest(signature, _sign(encoded)):
        raise _invalid()
    try:
        data = json.loads(base64.urlsafe_b64decode(encoded.encode("utf-8")).decode("utf-8"))
    except Exception:
        raise _invalid()
    if not isinstance(data, dict) or int(data.get("exp") or 0) < time.time():
        raise _invalid()
    ensure_active_user(data)
    return data


def ensure_active_user(data: dict) -> None:
    """Un usuario dado de baja deja de entrar en el momento (a lo sumo un minuto después, por la caché),
    aunque su token todavía no haya vencido. Si el usuario no figura en crm_users se lo deja pasar."""
    from backend.services.user_service import UserService

    if data.get("sub") and UserService.is_active_cached(data["sub"]) is False:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tu usuario está dado de baja. Hablá con el administrador.",
        )


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Inicio de sesión simple",
)
async def login(credentials: LoginRequest) -> LoginResponse:
    """Valida credenciales y retorna un token de acceso."""
    user = await AuthService.authenticate_user(credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas. Verifique su email y contraseña.",
        )

    token = generate_simple_token(user)
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=user,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Obtener información del usuario autenticado",
)
async def get_current_user(authorization: str = Header(None)) -> UserResponse:
    """Retorna los datos del usuario a partir del token Bearer."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header Authorization no provisto",
        )

    data = decode_simple_token(authorization)
    from backend.services.user_service import UserService

    # Estado real del usuario en crm_users (si no figura ahí, se lo toma como activo).
    is_active = UserService.is_active_cached(data.get("sub", ""))
    return UserResponse(
        id=data.get("sub", ""),
        email=data.get("email", ""),
        full_name=data.get("name", "Usuario"),
        role=data.get("role", "ejecutivo_ventas"),
        is_active=True if is_active is None else is_active,
    )
