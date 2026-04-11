"""
Seed script to populate the database with initial data
Run this script after setting up the database: python seed.py
"""
from datetime import datetime, timedelta
from app import create_app, db
from app.models.user import User
from app.models.ticket import Ticket, TicketNote


def seed_database():
    """Seed the database with initial data"""
    app = create_app()
    
    with app.app_context():
        # Create all tables if they don't exist
        db.create_all()
        
        print("Seeding database...")
        
        # Clear existing data
        TicketNote.query.delete()
        Ticket.query.delete()
        User.query.delete()
        from app.models.master_data import Category, Priority, SLAPolicy, Department, Status
        SLAPolicy.query.delete()
        Category.query.delete()
        Priority.query.delete()
        Department.query.delete()
        Status.query.delete()
        
        # Create categories
        categories_data = [
            {"name": "Hardware", "description": "Physical equipment issues"},
            {"name": "Software", "description": "Application and OS issues"},
            {"name": "Network", "description": "Connectivity and VPN issues"},
            {"name": "Access", "description": "Login and permission issues"},
            {"name": "Other", "description": "Miscellaneous requests"}
        ]
        
        for cat in categories_data:
            db.session.add(Category(**cat))
            
        # Create priorities
        priorities_data = [
            {"name": "Low", "level": 4, "color": "#10B981", "sla_hours": 72, "response_time_minutes": 240, "description": "Not urgent, routine request"},
            {"name": "Medium", "level": 3, "color": "#3B82F6", "sla_hours": 24, "response_time_minutes": 60, "description": "Standard priority, affects productivity"},
            {"name": "High", "level": 2, "color": "#F59E0B", "sla_hours": 4, "response_time_minutes": 30, "description": "Urgent, affects multiple users or critical workflow"},
            {"name": "Critical", "level": 1, "color": "#EF4444", "sla_hours": 1, "response_time_minutes": 15, "description": "System down, business halted"},
        ]
        
        for prio in priorities_data:
            db.session.add(Priority(**prio))

        # Create statuses
        statuses_data = [
            {"name": "New", "color": "#3B82F6", "order": 1, "is_default": True},
            {"name": "Triaged", "color": "#8B5CF6", "order": 2, "is_default": False},
            {"name": "Assigned", "color": "#F59E0B", "order": 3, "is_default": False},
            {"name": "In Progress", "color": "#10B981", "order": 4, "is_default": False},
            {"name": "Resolved", "color": "#059669", "order": 5, "is_default": False},
            {"name": "Closed", "color": "#6B7280", "order": 6, "is_default": False},
        ]

        for stat in statuses_data:
            db.session.add(Status(**stat))

        # Create departments
        departments_data = [
            {"name": "HR", "code": "HR", "description": "Human Resources"},
            {"name": "Finance", "code": "FIN", "description": "Finance and Accounting"},
            {"name": "Operations", "code": "OPS", "description": "Operations and Logistics"},
            {"name": "Sales", "code": "SLS", "description": "Sales and Business Development"},
            {"name": "Marketing", "code": "MKT", "description": "Marketing and Communications"},
            {"name": "IT", "code": "IT", "description": "Information Technology"},
            {"name": "Legal", "code": "LGL", "description": "Legal Department"},
            {"name": "Other", "code": "OTH", "description": "Other Departments"}
        ]

        for dept in departments_data:
            db.session.add(Department(**dept))
            
        db.session.commit()
        print(f"Created {len(categories_data)} categories, {len(priorities_data)} priorities, {len(statuses_data)} statuses, and {len(departments_data)} departments")

        # Create single admin user
        admin_data = {
            "email": "admin@company.com",
            "username": "admin",
            "password": "admin123",
            "full_name": "System Administrator",
            "role": "Administrator"
        }
        
        user = User(
            email=admin_data['email'],
            username=admin_data['username'],
            full_name=admin_data['full_name'],
            role=admin_data['role']
        )
        user.set_password(admin_data['password'])
        db.session.add(user)
        
        db.session.commit()
        
        print("\nDatabase seeded successfully!")
        print(f"\nUser created:")
        print(f"   - {user.email} (password: {admin_data['password']}, role: {user.role})")


if __name__ == '__main__':
    seed_database()
