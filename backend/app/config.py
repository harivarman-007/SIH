from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://intellifusion:intellifusion_dev@db:5432/intellifusion"
    database_url_sync: str = "postgresql://intellifusion:intellifusion_dev@db:5432/intellifusion"

    # JWT Authentication: must always match between config.py, .env.example, and docker-compose.yml
    jwt_secret: str = "dev_secret_change_in_prod_sih26024_secure_key_min64chars_abcdef0123456789"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # Application Environment & Storage
    environment: str = "development"
    demo_mode: bool = False  # Enabled in development / SIH evaluation via DEMO_MODE=true
    photo_storage_path: str = "/app/photos"
    ocr_upload_path: str = "/app/uploads/ocr"
    reports_storage_path: str = "/app/uploads/reports"

    # CORS Allowlist: Comma-separated list of trusted origins (no wildcard when allow_credentials=True)
    cors_allowed_origins: str = (
        "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
    )

    class Config:
        env_file = ".env"


settings = Settings()
