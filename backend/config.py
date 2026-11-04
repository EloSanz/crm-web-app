from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración global de la aplicación CRM mediante variables de entorno."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "CRM Web App"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Supabase Credentials
    SUPABASE_URL: str = "https://placeholder.supabase.co"
    SUPABASE_PUBLISHABLE_KEY: str = "placeholder-publishable-key"
    SUPABASE_SECRET_KEY: str = "placeholder-secret-key"

    # Security & Auth
    JWT_SECRET_KEY: str = "dev-secret-key-change-in-production-1234567890"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    CRM_API_KEY: str = "crm_live_corralon_secret_key_2026"

    # Frontend URL (CORS)
    FRONTEND_URL: str = "http://localhost:3000"

    # AWS S3 Storage (Materiales de construcción, remitos y fotos de obra)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-2"
    AWS_BUCKET_NAME: str = "myawsbucketelito"
    AWS_S3_CUSTOM_DOMAIN: str = ""

    # Correo saliente al cliente: "log" (no envía, queda simulado), "resend" o "smtp"
    EMAIL_PROVIDER: str = "log"
    EMAIL_FROM: str = "Corralap <ventas@corralap.com.ar>"
    EMAIL_REPLY_TO: str = ""
    EMAIL_BRAND_NAME: str = "Corralap"
    RESEND_API_KEY: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    # WhatsApp Cloud API (Meta). Sin token ni número, el CRM abre wa.me y registra el contacto.
    WHATSAPP_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_VERIFY_TOKEN: str = ""
    WHATSAPP_APP_SECRET: str = ""
    WHATSAPP_API_VERSION: str = "v21.0"
    WHATSAPP_TEMPLATE_NAME: str = ""
    WHATSAPP_TEMPLATE_LANG: str = "es_AR"
    WHATSAPP_DEFAULT_COUNTRY_CODE: str = "54"

    # Asistente con IA (borradores de respuesta y «Ponete al día»). Sin ANTHROPIC_API_KEY
    # funciona en modo simulado: arma respuestas con plantillas y no gasta nada.
    ANTHROPIC_API_KEY: str = ""
    AI_MODEL: str = "claude-opus-5-5"
    # low | medium | high: cuánto razona el modelo (más alto = mejor y más caro).
    AI_EFFORT: str = "low"
    # Tope de gasto mensual en dólares para todo el CRM. Al llegar, el asistente se apaga hasta el mes siguiente.
    AI_MONTHLY_BUDGET_USD: float = 10.0
    # Precio por millón de tokens del modelo configurado (para calcular el gasto).
    AI_PRICE_INPUT_PER_MTOK: float = 4.0
    AI_PRICE_OUTPUT_PER_MTOK: float = 20.0
    # Consultas por usuario por día (evita que un bucle o un abuso queme el tope en minutos).
    AI_DAILY_REQUESTS_PER_USER: int = 60

    # Gmail del vendedor (OAuth de Google). Sin GOOGLE_CLIENT_ID el correo sale por EMAIL_PROVIDER.
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    # URL pública del callback: https://<tu-dominio>/api/gmail/callback (cargada igual en Google Cloud).
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/gmail/callback"
    # Clave para cifrar los tokens de Google en la base. Si falta, se deriva de JWT_SECRET_KEY.
    TOKEN_ENCRYPTION_KEY: str = ""
    # Vercel Cron manda este secreto en Authorization para sincronizar respuestas de Gmail.
    CRON_SECRET: str = ""


settings = Settings()
