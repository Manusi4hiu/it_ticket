from marshmallow import Schema, fields

class CategorySchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    description = fields.Str()
    isActive = fields.Bool(attribute='is_active')
    createdAt = fields.DateTime(attribute='created_at', format='iso')

class PrioritySchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    level = fields.Int()
    color = fields.Str()
    slaHours = fields.Int(attribute='sla_hours')
    responseTimeMinutes = fields.Int(attribute='response_time_minutes')
    description = fields.Str()
    isActive = fields.Bool(attribute='is_active')

class SLAPolicySchema(Schema):
    id = fields.Int(dump_only=True)
    priorityId = fields.Int(attribute='priority_id')
    categoryId = fields.Int(attribute='category_id')
    responseTimeMinutes = fields.Int(attribute='response_time_minutes')
    resolutionTimeHours = fields.Int(attribute='resolution_time_hours')
    priority = fields.Nested(PrioritySchema, only=('name', 'level'))
    category = fields.Nested(CategorySchema, only=('name',))

class DepartmentSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    code = fields.Str()
    description = fields.Str()
    isActive = fields.Bool(attribute='is_active')
