from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://maji:maji_secret@localhost:5432/maji"
    anthropic_api_key: str = "sk-ant-dummy"
    jwt_secret: str = "maji_jwt_secret_change_in_prod"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480
    validation_threshold: float = 10000.0
    tva_rate: float = 0.20
    app_env: str = "development"
    # Origines CORS autorisées — "*" en dev, domaine(s) réel(s) en prod
    cors_origins: str = "*"
    # Comptes utilisateurs créés au premier démarrage
    deviseur_email: str = "deviseur@maji.fr"
    deviseur_password: str = "deviseur123"
    deviseur_name: str = "Deviseur"
    directeur_email: str = "directeur@maji.fr"
    directeur_password: str = "directeur123"
    directeur_name: str = "Directeur"
    # SMTP — laisser smtp_host vide pour désactiver l'envoi d'email
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "devis@maji.fr"
    smtp_tls: bool = True

    @property
    def cors_origins_list(self) -> List[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"


settings = Settings()
