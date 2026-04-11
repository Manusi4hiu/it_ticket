from app import db
import uuid

class Category(db.Model):
    """Category master data"""
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'isActive': self.is_active
        }

class Priority(db.Model):
    """Priority master data"""
    __tablename__ = 'priorities'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(20), unique=True, nullable=False) # e.g. Low, Medium, High, Critical
    level = db.Column(db.Integer, nullable=False) # 1=Critical, 4=Low. Used for sorting.
    color = db.Column(db.String(20), nullable=True) # e.g. #FF0000
    sla_hours = db.Column(db.Integer, nullable=False, default=24) # Resolution SLA in hours
    response_time_minutes = db.Column(db.Integer, nullable=False, default=60) # Response SLA in minutes
    description = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'level': self.level,
            'color': self.color,
            'slaHours': self.sla_hours,
            'responseTimeMinutes': self.response_time_minutes,
            'description': self.description,
            'isActive': self.is_active
        }

class SLAConfig(db.Model):
    """SLA Configuration (global overrides or specific settings)"""
    __tablename__ = 'sla_configs'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), nullable=False) # e.g. "Default", "Weekend"
    config_json = db.Column(db.JSON, nullable=False) # Store flexible config here if needed
    is_active = db.Column(db.Boolean, default=True)
    
    # Or strict columns if we prefer:
    response_time_hours = db.Column(db.Integer, default=1)
    resolution_time_hours = db.Column(db.Integer, default=24)
    # We can link this to priority or category if needed, but for now let's keep it simple or stick to Priority's sla_hours for simplicity first. 
    # The User requested "Master Data SLA", usually this means mapping Priority + Category -> Time.
    # Let's make it a mapping: Priority ID + Category ID -> Resolution Time.

class SLAPolicy(db.Model):
    """SLA Policy mapping Priority and/or Category to limits"""
    __tablename__ = 'sla_policies'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    priority_id = db.Column(db.Integer, db.ForeignKey('priorities.id'), nullable=True)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)
    
    response_time_minutes = db.Column(db.Integer, default=60) # Time to first response
    resolution_time_hours = db.Column(db.Integer, default=24) # Time to resolve
    
    priority = db.relationship('Priority')
    category = db.relationship('Category')

    def to_dict(self):
        return {
            'id': self.id,
            'priorityId': self.priority_id,
            'categoryId': self.category_id,
            'priorityName': self.priority.name if self.priority else 'All',
            'categoryName': self.category.name if self.category else 'All',
            'responseTimeMinutes': self.response_time_minutes,
            'resolutionTimeHours': self.resolution_time_hours
        }

class Department(db.Model):
    """Department master data"""
    __tablename__ = 'departments'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    code = db.Column(db.String(10), unique=True, nullable=True) # e.g., IT, HR, FIN
    description = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'isActive': self.is_active
        }

class Status(db.Model):
    """Status master data"""
    __tablename__ = 'statuses'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    color = db.Column(db.String(20), nullable=True, default='#6B7280') # Default gray
    order = db.Column(db.Integer, default=0) # For custom ordering in UI
    is_default = db.Column(db.Boolean, default=False) # Only one should be true

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'color': self.color,
            'order': self.order,
            'isDefault': self.is_default
        }
