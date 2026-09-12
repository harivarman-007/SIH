from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://intellifusion:intellifusion_dev@db:5432/intellifusion"
    database_url_sync: str = "postgresql://intellifusion:intellifusion_dev@db:5432/intellifusion"
    jwt_secret: str = "dev_secret_change_in_prod"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    environment: str = "development"
    photo_storage_path: str = "/app/photos"

    class Config:
        env_file = ".env"


settings = Settings()
