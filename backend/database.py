import logging

from supabase import Client, create_client

from backend.config import settings

logger = logging.getLogger("crm.database")

_supabase_client: Client | None = None


def get_supabase_client() -> Client:
    """Retorna un singleton del cliente Supabase inicializado."""
    global _supabase_client
    if _supabase_client is None:
        if (
            not settings.SUPABASE_URL
            or settings.SUPABASE_URL == "https://placeholder.supabase.co"
            or not settings.SUPABASE_SECRET_KEY
        ):
            logger.warning(
                "Supabase URL o Secret Key no configurados adecuadamente. Usando cliente con credenciales por defecto."
            )
        _supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SECRET_KEY or settings.SUPABASE_PUBLISHABLE_KEY,
        )
    return _supabase_client
