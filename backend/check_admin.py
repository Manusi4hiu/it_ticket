from app import create_app, db
from app.models.user import User

app = create_app()

with app.app_context():
    admin = User.query.filter_by(username='admin').first()
    if admin:
        print(f"✓ Admin user found:")
        print(f"  - Email: {admin.email}")
        print(f"  - Username: {admin.username}")
        print(f"  - Role: {admin.role}")
        print(f"  - ID: {admin.id}")
    else:
        print("✗ Admin user not found!")
    
    # Check all users
    all_users = User.query.all()
    print(f"\nTotal users: {len(all_users)}")
    for user in all_users:
        print(f"  - {user.username} ({user.email}) - Role: {user.role}")
