import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import timedelta

from app.config import config

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def create_app(config_name=None):
    """Application factory"""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')

    # Fail fast on misconfigured production deployments
    if config_name == 'production':
        from app.config import ProductionConfig
        ProductionConfig.validate()

    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # File upload limit: 5MB max per upload
    app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024
    
    # JWT Configuration
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

    # JWT error handlers — return 401 for invalid/tampered tokens
    @jwt.invalid_token_loader
    def invalid_token_callback(reason):
        return {'success': False, 'error': 'Invalid token: ' + reason}, 401

    @jwt.unauthorized_loader
    def missing_token_callback(reason):
        return {'success': False, 'error': 'Authorization required: ' + reason}, 401

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return {'success': False, 'error': 'Token has expired'}, 401

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload: dict) -> bool:
        from app.routes.auth import jwt_blocklist
        jti = jwt_payload.get("jti")
        return jti in jwt_blocklist if jti else False

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return {'success': False, 'error': 'Token has been revoked'}, 401
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    
    # CORS configuration
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    CORS(app, resources={
        r"/api/*": {
            "origins": [frontend_url],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    })
    
    # Import models for migrations
    from app.models import user, ticket, master_data, system_log, notification
    
    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.tickets import tickets_bp
    from app.routes.users import users_bp
    from app.routes.settings import settings_bp
    from app.routes.notifications import notifications_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(tickets_bp, url_prefix='/api/tickets')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
    app.register_blueprint(notifications_bp, url_prefix='/api/notifications')
    
    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        return {'status': 'healthy', 'message': 'IT Ticket Backend is running'}
    return app
