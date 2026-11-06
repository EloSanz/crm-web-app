from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Response, status

from backend.controllers.permissions import MANAGER_ROLES, require_roles, session_from_header, session_user_id
from backend.models.user import CrmUserCreate, CrmUserDirectoryEntry, CrmUserResponse, CrmUserUpdate, PasswordReset
from backend.services.user_service import UserService

router = APIRouter(prefix="/api/users", tags=["Usuarios y Roles"])


def _directory(user: CrmUserResponse) -> CrmUserDirectoryEntry:
    return CrmUserDirectoryEntry(id=user.id, full_name=user.full_name, role=user.role, is_active=user.is_active)


@router.get("", response_model=list[CrmUserResponse | CrmUserDirectoryEntry], summary="Listar usuarios del CRM")
def list_users(
    include_inactive: bool = True, authorization: str | None = Header(None)
) -> list[CrmUserResponse | CrmUserDirectoryEntry]:
    """Todos los roles listan usuarios (para ver responsables); el vendedor ve sólo los activos, sin correo."""
    if session_from_header(authorization).get("role") in MANAGER_ROLES:
        return UserService.list_users(include_inactive=include_inactive)
    return [_directory(u) for u in UserService.list_users(include_inactive=False)]


@router.get("/{user_id}", response_model=CrmUserResponse | CrmUserDirectoryEntry, summary="Detalle de un usuario")
def get_user(user_id: UUID, authorization: str | None = Header(None)) -> CrmUserResponse | CrmUserDirectoryEntry:
    user = UserService.get_user(user_id)
    return user if session_from_header(authorization).get("role") in MANAGER_ROLES else _directory(user)


@router.post(
    "",
    response_model=CrmUserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear usuario (solo administrador)",
)
def create_user(data: CrmUserCreate, authorization: str | None = Header(None)) -> CrmUserResponse:
    require_roles(authorization, {"admin"})
    return UserService.create_user(data)


@router.put("/{user_id}", response_model=CrmUserResponse, summary="Modificar usuario o su rol (solo administrador)")
def update_user(user_id: UUID, data: CrmUserUpdate, authorization: str | None = Header(None)) -> CrmUserResponse:
    require_roles(authorization, {"admin"})
    if data.is_active is False and session_user_id(authorization) == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No podés darte de baja a vos mismo")
    return UserService.update_user(user_id, data)


@router.post(
    "/{user_id}/password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Restablecer la contraseña de un usuario (solo administrador)",
)
def reset_password(user_id: UUID, data: PasswordReset, authorization: str | None = Header(None)) -> Response:
    """El administrador define una contraseña nueva. La contraseña nunca se devuelve ni se registra."""
    require_roles(authorization, {"admin"})
    UserService.reset_password(user_id, data.password.get_secret_value())
    return Response(status_code=status.HTTP_204_NO_CONTENT)
