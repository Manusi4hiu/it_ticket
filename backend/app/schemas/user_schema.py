from marshmallow import Schema, fields

class UserSchema(Schema):
    id = fields.Str(dump_only=True)
    username = fields.Str(required=True)
    email = fields.Email()
    fullName = fields.Str(attribute='full_name')
    role = fields.Str()
    department = fields.Str()
    phone = fields.Str()
    avatarUrl = fields.Str(attribute='avatar_url')
    createdAt = fields.DateTime(attribute='created_at', format='iso')
    lastLogin = fields.DateTime(attribute='last_login', format='iso')
