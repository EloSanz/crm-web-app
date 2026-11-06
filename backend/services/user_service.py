import logging
import time
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from backend.database import get_supabase_client
from backend.models.user import CrmUserCreate, CrmUserResponse, CrmUserUpdate
from backend.services.passwords import hash_password, validate_new_password

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

# Modo local: hash scrypt de la contraseña de cada usuario creado desde la pantalla (id → hash).
# Va separado de _mock_users para que el hash nunca termine en una respuesta de la API.
_mock_passwords: dict[str, str] = {}

# Bloqueo de Supabase Auth para un usuario dado de baja (100 años) y para levantarlo al reactivarlo.
BAN_FOREVER = "876000h"
BAN_NONE = "none"


def _local_mode() -> bool:
    # Import diferido: demo_seed importa este módulo.
    from backend.services.demo_seed import is_local_mode

    return is_local_mode()


def _auth_error(exc: Exception, action: str) -> HTTPException:
    """Traduce un error de Supabase Auth a un mensaje para el administrador (sin datos sensibles)."""
    message = str(getattr(exc, "message", "") or exc).lower()
    code = str(getattr(exc, "code", "") or "").lower()
    if code == "weak_password" or "weak" in message or "password should" in message:
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El servicio de autenticación rechazó la contraseña por débil. Probá con una más larga, con letras y números.",
        )
    if code in {"email_exists", "user_already_exists"} or "already" in message:
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Ya existe una cuenta de acceso con ese correo"
        )
    logger.warning("Supabase Auth falló al %s: %s", action, type(exc).__name__)
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"No se pudo {action} en el servicio de autenticación. Probá de nuevo en un rato.",
    )


class UserService:
    """Gestión de usuarios del CRM (tabla crm_users). La baja es lógica: is_active = False.

    En modo Supabase cada usuario tiene además su cuenta en Supabase Auth (que guarda el hash de la
    contraseña) con el mismo id que su fila de crm_users. En modo local el hash queda en _mock_passwords.
    """

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

    # Id → (momento de la consulta, activo o None si no se encontró), para la verificación de sesión.
    _active_cache: dict[str, tuple[float, bool | None]] = {}
    ACTIVE_CACHE_SECONDS = 60

    @classmethod
    def is_active_cached(cls, user_id: str) -> bool | None:
        """¿El usuario sigue activo? Se consulta como mucho una vez por minuto por usuario, para no
        pegarle a la base en cada request. None si no se lo encuentra (usuarios fuera de crm_users)."""
        now = time.monotonic()
        hit = cls._active_cache.get(str(user_id))
        if hit and now - hit[0] < cls.ACTIVE_CACHE_SECONDS:
            return hit[1]
        try:
            active: bool | None = cls.get_user(UUID(str(user_id))).is_active
        except (HTTPException, ValueError):
            active = None
        cls._active_cache[str(user_id)] = (now, active)
        return active

    @classmethod
    def _invalidate(cls) -> None:
        cls._name_cache = None
        # Una baja o reactivación tiene que pesar en la próxima request, sin esperar el minuto de caché.
        cls._active_cache.clear()

    @classmethod
    def _email_taken(cls, email: str, exclude_id: str | None = None) -> bool:
        return any(u.email.lower() == email.lower() and str(u.id) != exclude_id for u in cls.list_users())

    # ------------------------------------------------------------------
    # Supabase Auth (sólo modo Supabase)
    # ------------------------------------------------------------------

    @classmethod
    def _auth_user_id(cls, user: CrmUserResponse) -> str | None:
        """Id de la cuenta de Supabase Auth del usuario: primero por id, después por correo.

        Los usuarios demo tienen ids fijos en crm_users; si su cuenta de Auth se creó aparte,
        tiene otro id y se la encuentra por correo.
        """
        admin = get_supabase_client().auth.admin
        try:
            res = admin.get_user_by_id(str(user.id))
            if res and res.user:
                return str(res.user.id)
        except Exception:
            pass
        email = user.email.lower()
        per_page = 200
        for page in range(1, 51):
            batch = admin.list_users(page=page, per_page=per_page) or []
            for auth_user in batch:
                if (auth_user.email or "").lower() == email:
                    return str(auth_user.id)
            if len(batch) < per_page:
                break
        return None

    @classmethod
    def _set_ban(cls, auth_id: str, active: bool) -> None:
        """Bloquea (baja) o desbloquea (reactivación) en Auth. Es una defensa extra: el login ya mira is_active."""
        try:
            get_supabase_client().auth.admin.update_user_by_id(
                auth_id, {"ban_duration": BAN_NONE if active else BAN_FOREVER}
            )
        except Exception as e:
            logger.warning("No se pudo actualizar el bloqueo en Supabase Auth: %s", type(e).__name__)

    @classmethod
    def _create_auth_account(cls, email: str, password: str, full_name: str, user_id: str | None = None) -> str:
        attributes: dict = {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name},
        }
        if user_id:
            attributes["id"] = user_id
        try:
            res = get_supabase_client().auth.admin.create_user(attributes)
        except Exception as e:
            raise _auth_error(e, "crear la cuenta de acceso")
        if not res or not res.user:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail="El servicio de autenticación no devolvió la cuenta"
            )
        return str(res.user.id)

    # ------------------------------------------------------------------
    # Alta, modificación y contraseña
    # ------------------------------------------------------------------

    @classmethod
    def create_user(cls, data: CrmUserCreate) -> CrmUserResponse:
        password = data.password.get_secret_value()
        validate_new_password(password)
        if cls._email_taken(data.email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un usuario con ese correo")
        now = datetime.now(timezone.utc).isoformat()
        user = {
            "email": data.email.lower(),
            "full_name": data.full_name.strip(),
            "role": data.role.value,
            "is_active": data.is_active,
            "created_at": now,
            "updated_at": now,
        }

        if _local_mode():
            user["id"] = str(uuid4())
            _mock_users[user["id"]] = user
            _mock_passwords[user["id"]] = hash_password(password)
            cls._invalidate()
            return CrmUserResponse(**user)

        # Modo Supabase: primero la cuenta de Auth (Supabase guarda el hash), después el perfil con el mismo id.
        auth_id = cls._create_auth_account(user["email"], password, user["full_name"])
        user["id"] = auth_id
        try:
            res = get_supabase_client().table("crm_users").insert(user).execute()
            if not res.data:
                raise RuntimeError("crm_users no devolvió la fila insertada")
        except Exception as e:
            logger.error("Error insertando en crm_users, se borra la cuenta de Auth recién creada: %s", e)
            try:
                get_supabase_client().auth.admin.delete_user(auth_id)
            except Exception as delete_error:
                logger.error("No se pudo borrar la cuenta de Auth %s: %s", auth_id, type(delete_error).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No se pudo guardar el usuario en el CRM y no quedó ninguna cuenta creada. Probá de nuevo.",
            )
        if not data.is_active:
            cls._set_ban(auth_id, active=False)
        cls._invalidate()
        return CrmUserResponse(**res.data[0])

    @classmethod
    def update_user(cls, user_id: UUID, data: CrmUserUpdate) -> CrmUserResponse:
        current = cls.get_user(user_id)
        changes = data.model_dump(exclude_unset=True)
        if "email" in changes and changes["email"] and cls._email_taken(changes["email"], exclude_id=str(user_id)):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un usuario con ese correo")
        if changes.get("email"):
            changes["email"] = changes["email"].lower()
        if "role" in changes and changes["role"] is not None:
            changes["role"] = changes["role"].value if hasattr(changes["role"], "value") else changes["role"]
        changes["updated_at"] = datetime.now(timezone.utc).isoformat()

        if _local_mode():
            merged = {
                **current.model_dump(mode="json"),
                **{k: v for k, v in changes.items() if v is not None or k == "is_active"},
            }
            _mock_users[str(user_id)] = merged
            cls._invalidate()
            return CrmUserResponse(**merged)

        email_changed = bool(changes.get("email")) and changes["email"] != current.email.lower()
        active_changed = changes.get("is_active") is not None and changes["is_active"] != current.is_active
        auth_id = None
        if email_changed or active_changed:
            try:
                auth_id = cls._auth_user_id(current)
            except Exception as e:
                raise _auth_error(e, "buscar la cuenta de acceso")

        # El correo de acceso sigue al del perfil; si Auth lo rechaza, no se toca nada.
        if email_changed and auth_id:
            try:
                get_supabase_client().auth.admin.update_user_by_id(
                    auth_id, {"email": changes["email"], "email_confirm": True}
                )
            except Exception as e:
                raise _auth_error(e, "cambiar el correo de acceso")

        try:
            res = get_supabase_client().table("crm_users").update(changes).eq("id", str(user_id)).execute()
        except Exception as e:
            logger.error("Error actualizando crm_users: %s", e)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="No se pudo guardar el usuario")
        if not res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

        if active_changed and auth_id:
            cls._set_ban(auth_id, active=bool(changes["is_active"]))
        cls._invalidate()
        return CrmUserResponse(**res.data[0])

    @classmethod
    def reset_password(cls, user_id: UUID, password: str) -> None:
        """Define una contraseña nueva. Si el usuario todavía no tenía cuenta de acceso, se la crea."""
        validate_new_password(password)
        user = cls.get_user(user_id)

        if _local_mode():
            _mock_passwords[str(user.id)] = hash_password(password)
            return

        try:
            auth_id = cls._auth_user_id(user)
        except Exception as e:
            raise _auth_error(e, "buscar la cuenta de acceso")
        if auth_id:
            try:
                get_supabase_client().auth.admin.update_user_by_id(auth_id, {"password": password})
            except Exception as e:
                raise _auth_error(e, "cambiar la contraseña")
            return

        # Perfil sin cuenta de Auth (por ejemplo, cargado antes de este cambio): se crea con el mismo id.
        auth_id = cls._create_auth_account(user.email, password, user.full_name, user_id=str(user.id))
        if not user.is_active:
            cls._set_ban(auth_id, active=False)
