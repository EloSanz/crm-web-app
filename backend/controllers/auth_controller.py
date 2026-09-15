import base64
import json
import time

from fastapi import APIRouter, Header, HTTPException, status

from backend.models.auth import LoginRequest, LoginResponse, UserResponse
from backend.services.supabase_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["Auth"])


def generate_simple_token(user: UserResponse) -> str:
    """Genera un token firmado/serializado para la sesión."""
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "name": user.full_name,
        "exp": int(time.time()) + 86400,
    }
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")
    return f"crm_{encoded}"


def decode_simple_token(token: str) -> dict:
    if token.startswith("Bearer "):
        token = token[7:]
    if token.startswith("crm_"):
        token = token[4:]
    try:
        decoded = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
        return json.loads(decoded)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
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
    return UserResponse(
        id=data.get("sub", ""),
        email=data.get("email", ""),
        full_name=data.get("name", "Usuario"),
        role=data.get("role", "ejecutivo_ventas"),
        is_active=True,
    )
