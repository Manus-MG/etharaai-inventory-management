from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "Inventory & Order Management System"
    ENV: str = "dev"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/inventory_db"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
