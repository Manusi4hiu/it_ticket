import os
from dotenv import load_dotenv

load_dotenv()

_INSECURE_DEFAULT_KEY = "dev-secret-key"


class Config:
    """Base configuration"""
    SECRET_KEY = os.getenv('JWT_SECRET_KEY', _INSECURE_DEFAULT_KEY)
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/it_ticket_db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', _INSECURE_DEFAULT_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = 86400  # 24 hours in seconds

    # Mail / SMTP settings
    MAIL_SERVER   = os.getenv('MAIL_SERVER', 'mail.ani.co.id')
    MAIL_PORT     = int(os.getenv('MAIL_PORT', 587))
    MAIL_USERNAME = os.getenv('MAIL_USERNAME', '')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD', '')
    MAIL_FROM     = os.getenv('MAIL_FROM', 'IT Support <it-support@ani.co.id>')
    MAIL_USE_TLS  = os.getenv('MAIL_USE_TLS', 'true').lower() == 'true'
    FRONTEND_URL  = os.getenv('FRONTEND_URL', 'http://localhost:5173')


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    SQLALCHEMY_ECHO = True


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    SQLALCHEMY_ECHO = False

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)

    @classmethod
    def validate(cls):
        """Raise an error early if insecure defaults are used in production."""
        jwt_key = os.getenv('JWT_SECRET_KEY', _INSECURE_DEFAULT_KEY)
        if jwt_key == _INSECURE_DEFAULT_KEY:
            raise ValueError(
                "[SECURITY] JWT_SECRET_KEY is still set to the insecure default value. "
                "Set a strong, random value via the JWT_SECRET_KEY environment variable "
                "before deploying to production."
            )
        db_url = os.getenv('DATABASE_URL', '')
        if not db_url:
            raise ValueError(
                "[CONFIG] DATABASE_URL environment variable is not set for production."
            )


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
