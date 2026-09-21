from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, status

from backend.controllers.permissions import require_roles, session_user_id
from backend.models.user import CrmUserCreate, CrmUserResponse, CrmUserUpdate
from backend.services.user_service import UserService

router = APIRouter(prefix="/api/users", tags=["Usuarios y Roles"])


@router.get("", response_model=list[CrmUserResponse], summary="Listar usuarios del CRM")
def list_users(include_inactive: bool = True) -> list[CrmUserResponse]:
    """Todos los roles pueden listar usuarios (para ver responsables y asignar presupuestos)."""
    return UserService.list_users(include_inactive=include_inactive)


@router.get("/{user_id}", response_model=CrmUserResponse, summary="Detalle de un usuario")
def get_user(user_id: UUID) -> CrmUserResponse:
    return UserService.get_user(user_id)


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
