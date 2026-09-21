from uuid import UUID

from fastapi import HTTPException, status

from backend.controllers.auth_controller import decode_simple_token

MANAGER_ROLES = {"admin", "gerente_comercial"}


def session_from_header(authorization: str | None) -> dict:
    """Datos de la sesión (sub, role, name) a partir del header Authorization."""
    if not authorization:
        return {}
    try:
        return decode_simple_token(authorization)
    except HTTPException:
        return {}


def session_user_id(authorization: str | None) -> UUID | None:
    sub = session_from_header(authorization).get("sub")
    try:
        return UUID(sub) if sub else None
    except ValueError:
        return None


def require_roles(authorization: str | None, roles: set[str]) -> dict:
    """Corta con 403 si el rol de la sesión no está habilitado para la acción."""
    session = session_from_header(authorization)
    if session.get("role") not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu rol no tiene permiso para esta acción",
        )
    return session
