from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app import db
from app.models.ticket import Ticket
from app.services.ticket_service import TicketService
from app.services.file_service import FileService

tickets_bp = Blueprint('tickets', __name__)

def get_ticket_or_404(ticket_id):
    """Helper to handle both numeric ID and Ticket Code"""
    ticket = None
    if str(ticket_id).isdigit():
        ticket = Ticket.query.get(int(ticket_id))
    
    if not ticket:
        ticket = Ticket.query.filter(Ticket.ticket_code.ilike(ticket_id)).first()
        
    return ticket

@tickets_bp.route('', methods=['GET'])
def get_tickets():
    """Get all tickets with optional filters"""
    # Query parameters
    status = request.args.get('status')
    priority = request.args.get('priority')
    category = request.args.get('category')
    assigned_to = request.args.get('assignedTo')
    search = request.args.get('search')
    
    query = Ticket.query
    
    if status:
        query = query.filter(Ticket.status == status)
    if priority:
        query = query.filter(Ticket.priority == priority)
    if category:
        query = query.filter(Ticket.category == category)
    if assigned_to:
        query = query.filter(Ticket.assigned_to_id == assigned_to)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            db.or_(
                Ticket.title.ilike(search_term),
                Ticket.description.ilike(search_term),
                Ticket.submitter_name.ilike(search_term),
                Ticket.ticket_code.ilike(search_term)
            )
        )
    
    # Authenticate query visibility
    is_authenticated = False
    try:
        verify_jwt_in_request(optional=True)
        if get_jwt_identity():
            is_authenticated = True
    except:
        pass

    if not is_authenticated:
        if not search and not assigned_to:
            return jsonify({'success': True, 'tickets': [], 'total': 0}), 200

    # Total count before pagination
    total = query.count()
    
    # Pagination
    page = request.args.get('page', type=int)
    per_page = request.args.get('per_page', default=20, type=int)
    
    if page:
        query = query.order_by(Ticket.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    else:
        query = query.order_by(Ticket.created_at.desc())

    tickets = query.all()
    
    # Update SLA status for each ticket
    for ticket in tickets:
        ticket.sla_status = TicketService.calculate_sla_status(ticket.sla_deadline, ticket.resolved_at)
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'tickets': [ticket.to_dict(include_notes=False) for ticket in tickets],
        'total': total,
        'page': page,
        'per_page': per_page
    }), 200


@tickets_bp.route('/<ticket_id>', methods=['GET'])
def get_ticket(ticket_id):
    """Get a single ticket by ID or ticket_code"""
    ticket = get_ticket_or_404(ticket_id)
   
    if not ticket:
        return jsonify({'success': False, 'error': 'Ticket tidak ditemukan'}), 404
    
    # Update SLA status
    ticket.sla_status = TicketService.calculate_sla_status(ticket.sla_deadline, ticket.resolved_at)
    db.session.commit()
    
    # Filter internal notes if not authenticated
    is_authenticated = False
    try:
        verify_jwt_in_request(optional=True)
        if get_jwt_identity():
            is_authenticated = True
    except:
        pass

    ticket_data = ticket.to_dict()
    if not is_authenticated and 'notes' in ticket_data:
        ticket_data['notes'] = [n for n in ticket_data['notes'] if not n.get('isInternal')]

    return jsonify({
        'success': True,
        'ticket': ticket_data
    }), 200


@tickets_bp.route('', methods=['POST'])
def create_ticket():
    """Create a new ticket"""
    # Handle both JSON and multipart/form-data
    if request.is_json:
        data = request.get_json()
        image_file = None
    else:
        data = request.form.to_dict()
        image_file = request.files.get('image')
    
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    
    required_fields = ['title', 'description', 'category', 'submitterName']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'error': f'{field} diperlukan'}), 400
    
    # Image handling
    image_url = FileService.save_file(image_file, 'tickets')
    
    # Get idempotency key from headers (ACID principle - Isolation/Durability)
    idempotency_key = request.headers.get('X-Idempotency-Key')
    
    # Create ticket via service
    try:
        ticket = TicketService.create_ticket(data, image_url, idempotency_key)
        return jsonify({
            'success': True,
            'ticket': ticket.to_dict(),
            'message': 'Ticket berhasil dibuat'
        }), 201
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Gagal membuat ticket: {str(e)}'
        }), 500
    

@tickets_bp.route('/<ticket_id>', methods=['PUT'])
@jwt_required()
def update_ticket(ticket_id):
    """Update a ticket"""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
        
    ticket = get_ticket_or_404(ticket_id)
    if not ticket:
        return jsonify({'success': False, 'error': 'Ticket tidak ditemukan'}), 404
        
    ticket = TicketService.update_ticket(ticket.id, data)
    
    if not ticket:
        return jsonify({'success': False, 'error': 'Ticket tidak ditemukan'}), 404
    
    return jsonify({
        'success': True,
        'ticket': ticket.to_dict(),
        'message': 'Ticket berhasil diupdate'
    }), 200


@tickets_bp.route('/<ticket_id>', methods=['DELETE'])
@jwt_required()
def delete_ticket(ticket_id):
    """Delete a ticket"""
    user_id = get_jwt_identity()
    ticket = get_ticket_or_404(ticket_id)
    if not ticket:
        return jsonify({'success': False, 'error': 'Ticket tidak ditemukan'}), 404
    success = TicketService.delete_ticket(ticket.id, user_id)
    
    if not success:
        return jsonify({'success': False, 'error': 'Ticket tidak ditemukan'}), 404
    
    return jsonify({
        'success': True,
        'message': 'Ticket berhasil dihapus'
    }), 200


@tickets_bp.route('/<ticket_id>/assign', methods=['PUT'])
@jwt_required()
def assign_ticket(ticket_id):
    """Assign a ticket to an agent"""
    data = request.get_json()
    user_id = data.get('userId')
    
    ticket = get_ticket_or_404(ticket_id)
    if not ticket:
        return jsonify({'success': False, 'error': 'Ticket tidak ditemukan'}), 404
    ticket, error = TicketService.assign_ticket(ticket.id, user_id)
    
    if error:
        return jsonify({'success': False, 'error': error}), 404
    
    return jsonify({
        'success': True,
        'ticket': ticket.to_dict(),
        'message': 'Ticket berhasil di-assign'
    }), 200


@tickets_bp.route('/<ticket_id>/status', methods=['PUT'])
@jwt_required()
def update_ticket_status(ticket_id):
    """Update ticket status"""
    data = request.get_json()
    status = data.get('status')
    
    # Validate against master data
    from app.models.master_data import Status
    valid_status = Status.query.filter_by(name=status).first()
    if not valid_status:
        # Fallback for case-insensitive check if exact match fails
        valid_status = Status.query.filter(Status.name.ilike(status)).first()
        if valid_status:
            status = valid_status.name # Use the canonical name
        else:
            return jsonify({'success': False, 'error': 'Status tidak valid'}), 400
        
    resolution_summary = data.get('resolutionSummary')
    
    ticket = get_ticket_or_404(ticket_id)
    if not ticket:
        return jsonify({'success': False, 'error': 'Ticket tidak ditemukan'}), 404
    ticket = TicketService.update_ticket_status(ticket.id, status, resolution_summary)
    
    if not ticket:
        return jsonify({'success': False, 'error': 'Ticket tidak ditemukan'}), 404
    
    return jsonify({
        'success': True,
        'ticket': ticket.to_dict(),
        'message': 'Status ticket berhasil diupdate'
    }), 200


@tickets_bp.route('/<ticket_id>/notes', methods=['POST'])
@jwt_required()
def add_ticket_note(ticket_id):
    """Add a note to a ticket with optional image documentation"""
    # Handle both JSON and multipart/form-data
    if request.is_json:
        data = request.get_json()
        content = data.get('content')
        is_internal = data.get('isInternal', False)
        image_file = None
    else:
        content = request.form.get('content')
        is_internal = request.form.get('isInternal') == 'true'
        image_file = request.files.get('image')
    
    if not content:
        return jsonify({'success': False, 'error': 'Content diperlukan'}), 400
    
    user_id = get_jwt_identity()
    image_url = FileService.save_file(image_file, 'notes')
    
    ticket = get_ticket_or_404(ticket_id)
    if not ticket:
        return jsonify({'success': False, 'error': 'Ticket tidak ditemukan'}), 404
    note = TicketService.add_note(ticket.id, content, user_id, is_internal, image_url)
    
    if not note:
        return jsonify({'success': False, 'error': 'Ticket tidak ditemukan'}), 404
    
    return jsonify({
        'success': True,
        'note': note.to_dict(),
        'message': 'Note berhasil ditambahkan'
    }), 201


@tickets_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_ticket_stats():
    """Get ticket statistics for dashboard"""
    stats = TicketService.get_stats()
    
    return jsonify({
        'success': True,
        'stats': stats
    }), 200
