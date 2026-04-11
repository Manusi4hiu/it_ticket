from app import db
from app.models.master_data import Category, Priority, SLAPolicy, Department, Status
from app.models.ticket import Ticket

class MasterDataService:
    # --- Categories ---
    @staticmethod
    def get_categories():
        return Category.query.all()

    @staticmethod
    def create_category(data):
        if not data.get('name'):
            return None, 'Name is required'
        
        if Category.query.filter_by(name=data['name']).first():
            return None, 'Category already exists'
            
        category = Category(
            name=data['name'],
            description=data.get('description'),
            is_active=data.get('isActive', True)
        )
        db.session.add(category)
        db.session.commit()
        return category, None
    
    @staticmethod
    def update_category(id, data):
        category = Category.query.get(id)
        if not category:
            return None, 'Category not found'
        
        if 'name' in data:
            existing = Category.query.filter_by(name=data['name']).first()
            if existing and existing.id != id:
                return None, 'Category name already exists'
            category.name = data['name']
            
        if 'description' in data: category.description = data['description']
        if 'isActive' in data: category.is_active = data['isActive']
        
        db.session.commit()
        return category, None

    @staticmethod
    def delete_category(id):
        category = Category.query.get(id)
        if not category:
            return False
        db.session.delete(category)
        db.session.commit()
        return True

    # --- Priorities ---
    @staticmethod
    def get_priorities():
        return Priority.query.order_by(Priority.level).all()

    @staticmethod
    def create_priority(data):
        if not data.get('name'):
            return None, 'Name is required'
            
        priority = Priority(
            name=data['name'],
            level=data.get('level', 5),
            color=data.get('color', '#000000'),
            sla_hours=data.get('slaHours', 24),
            response_time_minutes=data.get('responseTimeMinutes', 60),
            description=data.get('description'),
            is_active=data.get('isActive', True)
        )
        db.session.add(priority)
        db.session.commit()
        return priority, None

    @staticmethod
    def update_priority(id, data):
        priority = Priority.query.get(id)
        if not priority:
            return None, 'Priority not found'
        
        if 'name' in data: priority.name = data['name']
        if 'level' in data: priority.level = data['level']
        if 'color' in data: priority.color = data['color']
        if 'slaHours' in data: priority.sla_hours = data['slaHours']
        if 'responseTimeMinutes' in data: priority.response_time_minutes = data['responseTimeMinutes']
        if 'description' in data: priority.description = data['description']
        if 'isActive' in data: priority.is_active = data['isActive']
        
        db.session.commit()
        return priority, None

    @staticmethod
    def delete_priority(id):
        priority = Priority.query.get(id)
        if not priority:
            return False
        db.session.delete(priority)
        db.session.commit()
        return True

    # --- SLA Policies ---
    @staticmethod
    def get_sla_policies():
        return SLAPolicy.query.all()

    @staticmethod
    def create_sla_policy(data):
        policy = SLAPolicy(
            priority_id=data.get('priorityId'),
            category_id=data.get('categoryId'),
            response_time_minutes=data.get('responseTimeMinutes', 60),
            resolution_time_hours=data.get('resolutionTimeHours', 24)
        )
        db.session.add(policy)
        db.session.commit()
        return policy, None

    @staticmethod
    def update_sla_policy(id, data):
        policy = SLAPolicy.query.get(id)
        if not policy:
            return None, 'SLA Policy not found'
        
        if 'priorityId' in data: policy.priority_id = data['priorityId']
        if 'categoryId' in data: policy.category_id = data['categoryId']
        if 'responseTimeMinutes' in data: policy.response_time_minutes = data['responseTimeMinutes']
        if 'resolutionTimeHours' in data: policy.resolution_time_hours = data['resolutionTimeHours']
        
        db.session.commit()
        return policy, None

    @staticmethod
    def delete_sla_policy(id):
        policy = SLAPolicy.query.get(id)
        if not policy:
            return False
        db.session.delete(policy)
        db.session.commit()
        return True

    # --- Departments ---
    @staticmethod
    def get_departments():
        return Department.query.order_by(Department.name).all()

    @staticmethod
    def create_department(data):
        if not data.get('name'):
            return None, 'Name is required'
        
        if Department.query.filter_by(name=data['name']).first():
            return None, 'Department already exists'
            
        department = Department(
            name=data['name'],
            code=data.get('code'),
            description=data.get('description'),
            is_active=data.get('isActive', True)
        )
        db.session.add(department)
        db.session.commit()
        return department, None

    @staticmethod
    def update_department(id, data):
        department = Department.query.get(id)
        if not department:
            return None, 'Department not found'
        
        if 'name' in data:
            existing = Department.query.filter_by(name=data['name']).first()
            if existing and existing.id != id:
                return None, 'Department name already exists'
            department.name = data['name']
        
        if 'code' in data:
            existing = Department.query.filter_by(code=data['code']).first()
            if existing and existing.id != id:
                return None, 'Department code already exists'
            department.code = data['code']
            
        if 'description' in data: department.description = data['description']
        if 'isActive' in data: department.is_active = data['isActive']
        
        db.session.commit()
        return department, None

    @staticmethod
    def delete_department(id):
        department = Department.query.get(id)
        if not department:
            return False
        db.session.delete(department)
        db.session.commit()
        return True

    # --- Statuses ---
    @staticmethod
    def get_statuses():
        return Status.query.order_by(Status.order).all()

    @staticmethod
    def create_status(data):
        if not data.get('name'):
            return None, 'Name is required'
        
        if Status.query.filter_by(name=data['name']).first():
            return None, 'Status name already exists'
            
        # If this is set as default, unset others
        if data.get('isDefault'):
            Status.query.update({Status.is_default: False})

        status = Status(
            name=data['name'],
            color=data.get('color', '#6B7280'),
            order=data.get('order', 0),
            is_default=data.get('isDefault', False)
        )
        db.session.add(status)
        db.session.commit()
        return status, None

    @staticmethod
    def update_status(id, data):
        status = Status.query.get(id)
        if not status:
            return None, 'Status not found'
        
        if 'name' in data:
            existing = Status.query.filter_by(name=data['name']).first()
            if existing and existing.id != id:
                return None, 'Status name already exists'
            status.name = data['name']
            
        if 'color' in data: status.color = data['color']
        if 'order' in data: status.order = data['order']
        
        if 'isDefault' in data and data['isDefault']:
            Status.query.update({Status.is_default: False})
            status.is_default = True
        elif 'isDefault' in data:
            status.is_default = False
            
        
        db.session.commit()
        return status, None

    @staticmethod
    def delete_status(id):
        status = Status.query.get(id)
        if not status:
            return False, 'Status not found'
        
        # Check if status is in use by tickets
        in_use = Ticket.query.filter_by(status=status.name).first()
        if in_use:
            return False, 'Cannot delete status that is currently in use by tickets'
            
        db.session.delete(status)
        db.session.commit()
        return True, None
