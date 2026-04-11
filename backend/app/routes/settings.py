from flask import Blueprint, request, jsonify
from app.models.system_log import SystemLog
from app.utils.decorators import admin_required
from app.services.master_data_service import MasterDataService

settings_bp = Blueprint('settings', __name__)

# --- CATEGORIES ---

@settings_bp.route('/categories', methods=['GET'])
def get_categories():
    categories = MasterDataService.get_categories()
    return jsonify({'success': True, 'data': [c.to_dict() for c in categories]})

@settings_bp.route('/categories', methods=['POST'])
@admin_required
def create_category():
    data = request.get_json()
    if not data:
         return jsonify({'success': False, 'error': 'No data provided'}), 400
         
    category, error = MasterDataService.create_category(data)
    if error:
        return jsonify({'success': False, 'error': error}), 400
        
    return jsonify({'success': True, 'data': category.to_dict()})

@settings_bp.route('/categories/<id>', methods=['PUT'])
@admin_required
def update_category(id):
    data = request.get_json()
    if not data:
         return jsonify({'success': False, 'error': 'No data provided'}), 400
         
    category, error = MasterDataService.update_category(id, data)
    if error:
        return jsonify({'success': False, 'error': error}), 400 if error != 'Category not found' else 404
        
    return jsonify({'success': True, 'data': category.to_dict()})

@settings_bp.route('/categories/<id>', methods=['DELETE'])
@admin_required
def delete_category(id):
    success = MasterDataService.delete_category(id)
    if not success:
        return jsonify({'success': False, 'error': 'Category not found'}), 404
    return jsonify({'success': True})

# --- PRIORITIES ---

@settings_bp.route('/priorities', methods=['GET'])
def get_priorities():
    priorities = MasterDataService.get_priorities()
    return jsonify({'success': True, 'data': [p.to_dict() for p in priorities]})

@settings_bp.route('/priorities', methods=['POST'])
@admin_required
def create_priority():
    data = request.get_json()
    if not data:
         return jsonify({'success': False, 'error': 'No data provided'}), 400
    
    priority, error = MasterDataService.create_priority(data)
    if error:
        return jsonify({'success': False, 'error': error}), 400
        
    return jsonify({'success': True, 'data': priority.to_dict()})

@settings_bp.route('/priorities/<id>', methods=['PUT'])
@admin_required
def update_priority(id):
    data = request.get_json()
    if not data:
         return jsonify({'success': False, 'error': 'No data provided'}), 400
         
    priority, error = MasterDataService.update_priority(id, data)
    if error:
        return jsonify({'success': False, 'error': error}), 400 if error != 'Priority not found' else 404
        
    return jsonify({'success': True, 'data': priority.to_dict()})

@settings_bp.route('/priorities/<id>', methods=['DELETE'])
@admin_required
def delete_priority(id):
    success = MasterDataService.delete_priority(id)
    if not success:
        return jsonify({'success': False, 'error': 'Priority not found'}), 404
    return jsonify({'success': True})

# --- SLA POLICIES ---

@settings_bp.route('/sla-policies', methods=['GET'])
def get_sla_policies():
    policies = MasterDataService.get_sla_policies()
    return jsonify({'success': True, 'data': [p.to_dict() for p in policies]})

@settings_bp.route('/sla-policies', methods=['POST'])
@admin_required
def create_sla_policy():
    data = request.get_json()
    if not data:
         return jsonify({'success': False, 'error': 'No data provided'}), 400
         
    policy, error = MasterDataService.create_sla_policy(data)
    return jsonify({'success': True, 'data': policy.to_dict()})

@settings_bp.route('/sla-policies/<id>', methods=['PUT'])
@admin_required
def update_sla_policy(id):
    data = request.get_json()
    if not data:
         return jsonify({'success': False, 'error': 'No data provided'}), 400
         
    policy, error = MasterDataService.update_sla_policy(id, data)
    if error:
        return jsonify({'success': False, 'error': error}), 404
        
    return jsonify({'success': True, 'data': policy.to_dict()})

@settings_bp.route('/sla-policies/<id>', methods=['DELETE'])
@admin_required
def delete_sla_policy(id):
    success = MasterDataService.delete_sla_policy(id)
    if not success:
        return jsonify({'success': False, 'error': 'SLA Policy not found'}), 404
    return jsonify({'success': True})

# --- DEPARTMENTS ---

@settings_bp.route('/departments', methods=['GET'])
def get_departments():
    departments = MasterDataService.get_departments()
    return jsonify({'success': True, 'data': [d.to_dict() for d in departments]})

@settings_bp.route('/departments', methods=['POST'])
@admin_required
def create_department():
    data = request.get_json()
    if not data:
         return jsonify({'success': False, 'error': 'No data provided'}), 400
         
    department, error = MasterDataService.create_department(data)
    if error:
        return jsonify({'success': False, 'error': error}), 400
        
    return jsonify({'success': True, 'data': department.to_dict()})

@settings_bp.route('/departments/<id>', methods=['PUT'])
@admin_required
def update_department(id):
    data = request.get_json()
    if not data:
         return jsonify({'success': False, 'error': 'No data provided'}), 400
         
    department, error = MasterDataService.update_department(id, data)
    if error:
        return jsonify({'success': False, 'error': error}), 400 if 'exists' in error else 404
        
    return jsonify({'success': True, 'data': department.to_dict()})

@settings_bp.route('/departments/<id>', methods=['DELETE'])
@admin_required
def delete_department(id):
    success = MasterDataService.delete_department(id)
    if not success:
        return jsonify({'success': False, 'error': 'Department not found'}), 404
    return jsonify({'success': True})

# --- STATUSES ---

@settings_bp.route('/statuses', methods=['GET'])
def get_statuses():
    statuses = MasterDataService.get_statuses()
    return jsonify({'success': True, 'data': [s.to_dict() for s in statuses]})

@settings_bp.route('/statuses', methods=['POST'])
@admin_required
def create_status():
    data = request.get_json()
    if not data:
         return jsonify({'success': False, 'error': 'No data provided'}), 400
         
    status, error = MasterDataService.create_status(data)
    if error:
        return jsonify({'success': False, 'error': error}), 400
        
    return jsonify({'success': True, 'data': status.to_dict()})

@settings_bp.route('/statuses/<id>', methods=['PUT'])
@admin_required
def update_status(id):
    data = request.get_json()
    if not data:
         return jsonify({'success': False, 'error': 'No data provided'}), 400
         
    status, error = MasterDataService.update_status(id, data)
    if error:
        return jsonify({'success': False, 'error': error}), 400 if error != 'Status not found' else 404
        
    return jsonify({'success': True, 'data': status.to_dict()})

@settings_bp.route('/statuses/<id>', methods=['DELETE'])
@admin_required
def delete_status(id):
    success, error = MasterDataService.delete_status(id)
    if not success:
        return jsonify({'success': False, 'error': error or 'Status not found'}), 404 if error != 'Cannot delete status that is currently in use by tickets' else 400
    return jsonify({'success': True})

# --- SYSTEM LOGS ---

@settings_bp.route('/logs', methods=['GET'])
@admin_required
def get_logs():
    """Get all system logs for administrators"""
    # Logic in route for now (simple query) or move to service if needed later
    logs = SystemLog.query.order_by(SystemLog.timestamp.desc()).limit(500).all()
    return jsonify({
        'success': True, 
        'data': [log.to_dict() for log in logs]
    })
