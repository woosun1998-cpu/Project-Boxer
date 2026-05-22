"""
Boxer 백엔드 환경 설정 모듈.

- `.env` 파일과 시스템 환경 변수를 읽어 DB URL, JWT, CORS 등을 설정합니다.
- `DATABASE_URL`이 비어 있거나 예시 값이면 `DB_*` 값으로 자동 조합합니다.
- 한글 주석은 팀원·초보자도 읽기 쉽게 적었습니다.
"""
from typing import List

from pydantic import model_validator, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Boxer API"
    APP_VERSION: str = "4.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    DATABASE_URL: str = (
        "mysql+aiomysql://root:YOUR_PASSWORD@localhost:3306/boxer_db?charset=utf8mb4"
    )
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "boxer_db"
    DB_USER: str = "root"
    DB_PASSWORD: str = "YOUR_PASSWORD"

    JWT_SECRET_KEY: str = "boxer-super-secret-key-2026-must-be-256-bits-long!!"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    # 프론트는 로컬에서 포트·호스트가 달라질 수 있어 기본값에 자주 쓰는 조합을 넣습니다.
    CORS_ORIGINS: List[str] = [
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    GEMINI_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @model_validator(mode="after")
    def build_database_url(self) -> "Settings":
        placeholder = "mysql+aiomysql://root:YOUR_PASSWORD@localhost:3306/boxer_db?charset=utf8mb4"
        if not self.DATABASE_URL or self.DATABASE_URL == placeholder:
            self.DATABASE_URL = (
                f"mysql+aiomysql://{self.DB_USER}:{self.DB_PASSWORD}"
                f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
            )
        return self

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, value: bool | str) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "dev", "development", "debug"}:
                return True
            if normalized in {"0", "false", "no", "off", "prod", "production", "release"}:
                return False
        raise ValueError("DEBUG must be a boolean-like value.")

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | List[str]) -> List[str]:
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("[") and stripped.endswith("]"):
                import json

                return json.loads(stripped)
            return [item.strip() for item in stripped.split(",") if item.strip()]
        return ["http://localhost:5500"]


settings = Settings()
