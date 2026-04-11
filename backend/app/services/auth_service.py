from flask_jwt_extended import create_access_token
from app.models.user import User

class AuthService:
    @staticmethod
    def login(username, password):
        if not username or not password:
            return None, 'Username dan password diperlukan'
        
        # Find user by username
        user = User.query.filter_by(username=username).first()
        
        if not user:
            return None, 'Username atau password salah. Silakan coba lagi.'
        
        # Verify password
        if not user.check_password(password):
            return None, 'Username atau password salah. Silakan coba lagi.'
        
        # Create JWT token
        access_token = create_access_token(identity=str(user.id))
        
        return {
            'token': access_token,
            'user': user.to_dict()
        }, None

    @staticmethod
    def get_current_user(user_id):
        user = User.query.get(user_id)
        if not user:
            return None
        return user.to_dict()
