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


settings = Settings()
