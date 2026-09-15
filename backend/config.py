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

    # Frontend URL (CORS)
    FRONTEND_URL: str = "http://localhost:3000"


settings = Settings()
