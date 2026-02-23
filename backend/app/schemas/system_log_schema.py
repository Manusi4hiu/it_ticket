from marshmallow import Schema, fields

class SystemLogSchema(Schema):
    id = fields.Int(dump_only=True)
    timestamp = fields.DateTime(format='iso')
    action = fields.Str()
    details = fields.Str()
    userId = fields.Str(attribute='user_id')
    user = fields.Function(lambda obj: obj.user.full_name if obj.user else 'System')
    targetId = fields.Str(attribute='target_id')
    ipAddress = fields.Str(attribute='ip_address')
    metadata = fields.Method("get_metadata")
    
    def get_metadata(self, obj):
        import json
        if obj.metadata_json:
            try:
                return json.loads(obj.metadata_json)
            except:
                return {}
        return None
