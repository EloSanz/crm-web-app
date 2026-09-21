import logging
import time
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from backend.database import get_supabase_client
from backend.models.user import CrmUserCreate, CrmUserResponse, CrmUserUpdate

logger = logging.getLogger("crm.services.user")

ADMIN_ID = "00000000-0000-0000-0000-000000000001"
VENDEDOR_ID = "00000000-0000-0000-0000-000000000002"
GERENTE_ID = "00000000-0000-0000-0000-000000000003"

_now = datetime.now(timezone.utc).isoformat()

# Usuarios semilla del modo local (coinciden con las credenciales demo del login)
_mock_users: dict[str, dict] = {
    ADMIN_ID: {
        "id": ADMIN_ID,
        "email": "admin@crm.com",
        "full_name": "Administrador CRM",
        "role": "admin",
        "is_active": True,
        "created_at": _now,
        "updated_at": _now,
    },
    VENDEDOR_ID: {
        "id": VENDEDOR_ID,
        "email": "vendedor@crm.com",
        "full_name": "Ejecutivo Comercial",
        "role": "ejecutivo_ventas",
        "is_active": True,
        "created_at": _now,
        "updated_at": _now,
    },
    GERENTE_ID: {
        "id": GERENTE_ID,
        "email": "gerente@crm.com",
        "full_name": "Responsable Comercial",
        "role": "gerente_comercial",
        "is_active": True,
        "created_at": _now,
        "updated_at": _now,
    },
}


class UserService:
    """Gestión de usuarios del CRM (tabla crm_users). La baja es lógica: is_active = False."""

    @classmethod
    def list_users(cls, include_inactive: bool = True) -> list[CrmUserResponse]:
        try:
            client = get_supabase_client()
            query = client.table("crm_users").select("*").order("full_name")
            if not include_inactive:
                query = query.eq("is_active", True)
            res = query.execute()
            if res.data:
                return [CrmUserResponse(**u) for u in res.data]
        except Exception as e:
            logger.warning(f"Error consultando crm_users en Supabase: {e}")

        users = [CrmUserResponse(**u) for u in _mock_users.values() if include_inactive or u["is_active"]]
        return sorted(users, key=lambda u: u.full_name.lower())

    @classmethod
    def get_user(cls, user_id: UUID) -> CrmUserResponse:
        try:
            client = get_supabase_client()
            res = client.table("crm_users").select("*").eq("id", str(user_id)).execute()
            if res.data:
                return CrmUserResponse(**res.data[0])
        except Exception as e:
            logger.warning(f"Error consultando usuario en Supabase: {e}")

        found = _mock_users.get(str(user_id))
        if not found:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
        return CrmUserResponse(**found)

    _name_cache: tuple[float, dict[str, str]] | None = None

    @classmethod
    def name_map(cls) -> dict[str, str]:
        """Id → nombre, para mostrar responsables sin una consulta por fila (cache de 30 s)."""
        now = time.monotonic()
        if cls._name_cache and now - cls._name_cache[0] < 30:
            return cls._name_cache[1]
        names = {str(u.id): u.full_name for u in cls.list_users()}
        cls._name_cache = (now, names)
        return names

    @classmethod
    def _invalidate(cls) -> None:
        cls._name_cache = None

    @classmethod
    def _email_taken(cls, email: str, exclude_id: str | None = None) -> bool:
        return any(u.email.lower() == email.lower() and str(u.id) != exclude_id for u in cls.list_users())

    @classmethod
    def create_user(cls, data: CrmUserCreate) -> CrmUserResponse:
        if cls._email_taken(data.email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un usuario con ese correo")
        now = datetime.now(timezone.utc).isoformat()
        user = {
            "id": str(uuid4()),
            "email": data.email.lower(),
            "full_name": data.full_name.strip(),
            "role": data.role.value,
            "is_active": data.is_active,
            "created_at": now,
            "updated_at": now,
        }
        try:
            client = get_supabase_client()
            res = client.table("crm_users").insert(user).execute()
            if res.data:
                cls._invalidate()
                return CrmUserResponse(**res.data[0])
        except Exception as e:
            logger.warning(f"Error insertando en crm_users: {e}")

        _mock_users[user["id"]] = user
        cls._invalidate()
        return CrmUserResponse(**user)

    @classmethod
    def update_user(cls, user_id: UUID, data: CrmUserUpdate) -> CrmUserResponse:
        current = cls.get_user(user_id)
        changes = data.model_dump(exclude_unset=True)
        if "email" in changes and changes["email"] and cls._email_taken(changes["email"], exclude_id=str(user_id)):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un usuario con ese correo")
        if "role" in changes and changes["role"] is not None:
            changes["role"] = changes["role"].value if hasattr(changes["role"], "value") else changes["role"]
        changes["updated_at"] = datetime.now(timezone.utc).isoformat()

        try:
            client = get_supabase_client()
            res = client.table("crm_users").update(changes).eq("id", str(user_id)).execute()
            if res.data:
                cls._invalidate()
                return CrmUserResponse(**res.data[0])
        except Exception as e:
            logger.warning(f"Error actualizando crm_users: {e}")

        merged = {
            **current.model_dump(mode="json"),
            **{k: v for k, v in changes.items() if v is not None or k == "is_active"},
        }
        _mock_users[str(user_id)] = merged
        cls._invalidate()
        return CrmUserResponse(**merged)
