# Loading environmental variables
# Reasoning:
    # - No hardcoded URLs and secrets hardcoded in code.

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
        DATABASE_URL: str

        #  Key used to sign web tokens
        JWT_SECRET: str
        #Algorithm used to verify tokens
        JWT_ALG: str = "HS256"

        #Access tokens
        ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
        
        #Refresh token
        REFRESH_TOKEN_EXPIRE_DAYS: int = 14

        #Cookie settings:
        # -COOKIE_SECURE will be false until pushed into PROD
        COOKIE_SECURE: bool = False

        #cookie domain (leave blank until prod)
        COOKIE_DOMAIN: str | None = None

        # OpenAI api key
        OPENAI_API_KEY: str

        class Config:
                # Load settings from .env files
                env_file = ".env"
settings = Settings()