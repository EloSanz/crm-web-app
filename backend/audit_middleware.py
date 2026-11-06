"""Middleware de auditoría: deja registrado quién hizo cada cambio por la API (regla 15).

Es un middleware ASGI puro (no BaseHTTPMiddleware) para no consumir el cuerpo del pedido: envuelve
`receive` y `send` y sólo *copia* los bytes que pasan, así el endpoint recibe el JSON intacto y las
respuestas en streaming siguen saliendo de a pedazos. Recién cuando la respuesta terminó (y fue
exitosa, status < 400) arma la fila y la guarda con AuditService.

Un fallo de la auditoría nunca rompe el pedido: todo el registro va dentro de try/except y se loguea.
"""

import json
import logging
import re
from typing import Any

from starlette.concurrency import run_in_threadpool
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from backend.controllers.permissions import session_from_header
from backend.services.audit_service import AuditService

logger = logging.getLogger("crm.audit")

AUDITED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Hasta cuánto del cuerpo (pedido o respuesta) se guarda; más que eso queda resumido.
MAX_BODY_BYTES = 64 * 1024

# Rutas ruidosas o que ya tienen su propio registro: no se auditan.
EXCLUDED_PREFIXES = (
    "/api/auth/",  # login: no es un cambio y lleva la contraseña
    "/api/dev/",  # carga de datos demo
    "/api/ai/",  # el asistente ya registra cada pedido en crm_ai_requests
    "/api/gmail/sync",
    "/api/gmail/cron",
    "/api/whatsapp/webhook",
)
# Subidas de archivos (la baja de un archivo sí se audita).
EXCLUDED_UPLOAD_PREFIX = "/api/upload/"

# Primer segmento del path → entidad de negocio.
ENTITIES = {
    "companies": "empresa",
    "contacts": "contacto",
    "opportunities": "presupuesto",
    "projects": "obra",
    "products": "producto",
    "users": "usuario",
    "stages": "etapa",
    "catalogs": "catálogo",
    "activities": "actividad",
    "email": "comunicación",
    "whatsapp": "comunicación",
    "calls": "comunicación",
    "gmail": "configuración",
    "upload": "archivo",
}
ARTICLES = {
    "empresa": "la empresa",
    "contacto": "el contacto",
    "presupuesto": "el presupuesto",
    "obra": "la obra",
    "producto": "el material",
    "usuario": "el usuario",
    "etapa": "la etapa",
    "catálogo": "el valor de catálogo",
    "actividad": "una actividad",
    "comunicación": "una comunicación",
    "configuración": "la configuración",
    "archivo": "el archivo",
}
# Segmentos que nombran una acción, no un id: /users/{id}/password, /email/send, /stages/reorder…
VERB_SEGMENTS = {
    "password": "Restableció la contraseña de",
    "reorder": "Reordenó",
    "send": "Envió",
    "log": "Registró",
    "connection": "Desconectó",
}

# Claves cuyo valor nunca se guarda, en cualquier nivel del JSON.
SENSITIVE_KEY = re.compile(
    r"pass(word|wd)?|contrase|token|secret|api[_-]?key|authorization|credential|private[_-]?key|cookie",
    re.IGNORECASE,
)
REDACTED = "[redactado]"


def redact(value: Any) -> Any:
    """Copia del JSON con los valores de claves sensibles reemplazados por «[redactado]»."""
    if isinstance(value, dict):
        return {k: (REDACTED if SENSITIVE_KEY.search(str(k)) else redact(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(v) for v in value]
    return value


def is_audited(method: str, path: str) -> bool:
    if method not in AUDITED_METHODS or not path.startswith("/api/"):
        return False
    if path.startswith(EXCLUDED_PREFIXES):
        return False
    if method == "POST" and path.startswith(EXCLUDED_UPLOAD_PREFIX):
        return False
    return True


def _label(*sources: Any) -> str | None:
    """Nombre legible del registro tocado, tomado del pedido o de la respuesta."""
    for src in sources:
        if not isinstance(src, dict):
            continue
        for key in ("name", "title", "full_name", "label", "code", "email", "subject"):
            if isinstance(src.get(key), str) and src[key].strip():
                return src[key].strip()
        first, last = src.get("first_name"), src.get("last_name")
        if isinstance(first, str) or isinstance(last, str):
            full = f"{first or ''} {last or ''}".strip()
            if full:
                return full
    return None


def _lookup_name(head: str, entity_id: str) -> str | None:
    """Nombre del registro por id, para las acciones que no lo traen en el pedido ni en la respuesta
    (bajas que responden 204, restablecer contraseña). Se busca antes de la acción: después de la baja ya no aparece."""
    from uuid import UUID

    from backend.services.company_service import CompanyService
    from backend.services.contact_service import ContactService
    from backend.services.opportunity_service import OpportunityService
    from backend.services.product_service import ProductService
    from backend.services.project_service import ProjectService
    from backend.services.user_service import UserService

    getters = {
        "companies": CompanyService.get_company_by_id,
        "contacts": ContactService.get_contact_by_id,
        "opportunities": OpportunityService.get_opportunity_by_id,
        "projects": ProjectService.get_project_by_id,
        "products": ProductService.get_product_by_id,
        "users": UserService.get_user,
    }
    getter = getters.get(head)
    if not getter:
        return None
    try:
        record = getter(UUID(entity_id.split("/")[0]))
    except Exception:
        return None
    return _label(record.model_dump() if hasattr(record, "model_dump") else record)


def _needs_lookup(method: str, path: str) -> tuple[str, str] | None:
    segments = [s for s in path.split("/")[2:] if s]
    if len(segments) < 2 or segments[0] not in ENTITIES:
        return None
    if method == "DELETE" or (len(segments) >= 3 and segments[2] == "password"):
        return segments[0], segments[1]
    return None


def describe(method: str, path: str, body: Any, response: Any, known_label: str | None = None) -> dict:
    """Deriva del path y del método la entidad, el id, la acción y un resumen en castellano."""
    segments = [s for s in path.split("/")[2:] if s]
    head = segments[0] if segments else ""
    entity = ENTITIES.get(head, head or "otra")
    rest = segments[1:]
    verb = next((s for s in rest if s in VERB_SEGMENTS), None)
    ids = [s for s in rest if s not in VERB_SEGMENTS]
    entity_id = "/".join(ids) if ids else None

    if method == "DELETE":
        action = "dar_de_baja"
    elif method in {"PUT", "PATCH"}:
        action = "modificar"
        # Desactivar (is_active=false) o marcar como borrado también es una baja.
        if isinstance(body, dict) and (body.get("is_active") is False or body.get("is_deleted") is True):
            action = "dar_de_baja"
    elif not rest:
        action = "crear"
    else:
        action = "otra"
    if verb == "password":
        action = "modificar"
    elif verb and action != "dar_de_baja":
        action = "otra"

    if not entity_id and isinstance(response, dict) and response.get("id") is not None:
        entity_id = str(response["id"])

    noun = ARTICLES.get(entity, entity)
    label = known_label or _label(body, response) or ("Gmail" if head == "gmail" else None)
    target = f"{noun} «{label}»" if label else noun
    if verb == "password":
        summary = f"{VERB_SEGMENTS[verb]} «{label}»" if label else f"{VERB_SEGMENTS[verb]} un usuario"
    elif verb:
        summary = f"{VERB_SEGMENTS[verb]} {target}"
    elif action == "crear":
        summary = f"Creó {target}"
    elif action == "dar_de_baja":
        summary = f"Dio de baja {target}"
    else:
        summary = f"Modificó {target}"
        if isinstance(body, dict) and body:
            summary += ": " + ", ".join(str(k) for k in body.keys())
    return {"entity": entity, "entity_id": entity_id, "action": action, "summary": summary}


def _parse_json(raw: bytes, content_type: str) -> Any:
    if not raw:
        return None
    if "json" not in content_type:
        return {"_contenido": f"sin JSON ({content_type.split(';')[0] or 'desconocido'})"}
    try:
        return json.loads(raw)
    except ValueError:
        return {"_contenido": "JSON inválido"}


class AuditMiddleware:
    """Registra en crm_audit_log cada POST/PUT/PATCH/DELETE exitoso sobre /api/*."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not is_audited(scope.get("method", ""), scope.get("path", "")):
            await self.app(scope, receive, send)
            return

        req_chunks: list[bytes] = []
        res_chunks: list[bytes] = []
        sizes = {"req": 0, "res": 0}
        state: dict[str, Any] = {"status": None, "content_type": ""}

        async def receive_copy() -> Message:
            # Se le pasa al endpoint el mismo mensaje; sólo se guarda una copia de los bytes.
            message = await receive()
            if message.get("type") == "http.request":
                chunk = message.get("body", b"")
                sizes["req"] += len(chunk)
                if sizes["req"] <= MAX_BODY_BYTES:
                    req_chunks.append(chunk)
            return message

        async def send_copy(message: Message) -> None:
            try:
                if message["type"] == "http.response.start":
                    state["status"] = message["status"]
                    for key, value in message.get("headers", []):
                        if key.lower() == b"content-type":
                            state["content_type"] = value.decode("latin-1").lower()
                elif message["type"] == "http.response.body":
                    chunk = message.get("body", b"")
                    sizes["res"] += len(chunk)
                    if sizes["res"] <= MAX_BODY_BYTES:
                        res_chunks.append(chunk)
            except Exception:  # pragma: no cover - defensa
                pass
            await send(message)

        lookup = _needs_lookup(scope["method"], scope["path"])
        state["label"] = None
        if lookup:
            try:
                state["label"] = await run_in_threadpool(_lookup_name, *lookup)
            except Exception:  # pragma: no cover - defensa
                state["label"] = None

        await self.app(scope, receive_copy, send_copy)

        status = state["status"]
        if status is None or status >= 400:
            return
        try:
            await self._record(scope, status, req_chunks, sizes, res_chunks, state["content_type"], state["label"])
        except Exception as e:  # la auditoría nunca corta el pedido
            logger.error(f"No se pudo auditar {scope.get('method')} {scope.get('path')}: {e}")

    async def _record(
        self,
        scope: Scope,
        status: int,
        req_chunks: list[bytes],
        sizes: dict[str, int],
        res_chunks: list[bytes],
        res_content_type: str,
        known_label: str | None = None,
    ) -> None:
        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
        method, path = scope["method"], scope["path"]

        if sizes["req"] > MAX_BODY_BYTES:
            body: Any = {"_contenido": f"cuerpo de {sizes['req']} bytes, no se guarda completo"}
        else:
            body = _parse_json(b"".join(req_chunks), headers.get("content-type", "").lower())
        response = None
        if sizes["res"] <= MAX_BODY_BYTES and "json" in res_content_type:
            try:
                response = json.loads(b"".join(res_chunks) or b"null")
            except ValueError:
                response = None

        info = describe(method, path, body, response, known_label)
        session = session_from_header(headers.get("authorization"))
        await run_in_threadpool(
            AuditService.record,
            action=info["action"],
            method=method,
            path=path,
            entity=info["entity"],
            entity_id=info["entity_id"],
            summary=info["summary"],
            changes=redact(body) if body is not None else {},
            status_code=status,
            user_id=session.get("sub"),
            user_name=session.get("name") or session.get("email"),
            user_role=session.get("role"),
        )
