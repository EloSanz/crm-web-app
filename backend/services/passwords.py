"""
Hash de contraseñas para el modo local (sin Supabase).

En modo Supabase el hash lo guarda Supabase Auth (bcrypt) y el CRM nunca ve la contraseña guardada.
En modo local usamos scrypt de la librería estándar: sal aleatoria por usuario, parámetros
guardados junto al hash y comparación en tiempo constante. Nunca texto plano ni SHA-256 simple.
"""

import base64
import hashlib
import hmac
import secrets

from fastapi import HTTPException, status

_ALGORITHM = "scrypt"
_N = 2**14
_R = 8
_P = 1
_DKLEN = 32

MIN_PASSWORD_LENGTH = 8
# bcrypt (Supabase Auth) sólo mira los primeros 72 bytes: más largo daría una falsa sensación de seguridad.
MAX_PASSWORD_BYTES = 72


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def hash_password(password: str) -> str:
    """Devuelve 'scrypt$n$r$p$sal$hash' (sal y hash en base64)."""
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=_N, r=_R, p=_P, dklen=_DKLEN)
    return f"{_ALGORITHM}${_N}${_R}${_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str | None) -> bool:
    """Compara una contraseña contra el hash guardado. Cualquier formato raro cuenta como no válido."""
    if not stored:
        return False
    try:
        algorithm, n, r, p, salt_b64, digest_b64 = stored.split("$")
        if algorithm != _ALGORITHM:
            return False
        expected = base64.b64decode(digest_b64)
        digest = hashlib.scrypt(
            password.encode("utf-8"),
            salt=base64.b64decode(salt_b64),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(digest, expected)


def validate_new_password(password: str) -> None:
    """Reglas mínimas para una contraseña nueva. Corta con 400 y un mensaje para mostrar en pantalla."""
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La contraseña tiene que tener al menos {MIN_PASSWORD_LENGTH} caracteres",
        )
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La contraseña puede tener hasta {MAX_PASSWORD_BYTES} caracteres",
        )
    if not password.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña no puede ser sólo espacios")
