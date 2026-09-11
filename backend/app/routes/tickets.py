from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from sqlalchemy import case
from sqlalchemy.orm import joinedload, selectinload
from app import db
from app.models.ticket import Ticket
from app.services.ticket_service import TicketService
from app.services.file_service import FileService
from app.constants import DEV_CATEGORY
from app.utils.permissions import (
    get_current_user,
    is_administrator,
    assign_permission_required,
    status_change_permission_required,
)

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
@jwt_required()
def get_tickets():
    """Get all tickets with optional filters"""
    # Query parameters
    status = request.args.get('status')
    exclude_status = request.args.get('exclude_status')
    priority = request.args.get('priority')
    category = request.args.get('category')
    assigned_to = request.args.get('assignedTo')
    search = request.args.get('search')
    is_resolved = request.args.get('is_resolved', type=lambda v: v.lower() == 'true')
    
    query = Ticket.query.options(
        joinedload(Ticket.assigned_user),
        selectinload(Ticket.collaborators)
    )
    
    if status:
        if ',' in status:
            status_list = [s.strip().lower() for s in status.split(',') if s.strip()]
            query = query.filter(db.func.lower(Ticket.status).in_(status_list))
        else:
            query = query.filter(db.func.lower(Ticket.status) == status.strip().lower())
    
    if exclude_status:
        if ',' in exclude_status:
            exclude_list = [s.strip().lower() for s in exclude_status.split(',') if s.strip()]
            query = query.filter(db.func.lower(Ticket.status).notin_(exclude_list))
        else:
            query = query.filter(db.func.lower(Ticket.status) != exclude_status.strip().lower())

    if is_resolved is not None:
        resolved_statuses = ['resolved', 'completed']
        if is_resolved:
            query = query.filter(db.func.lower(Ticket.status).in_(resolved_statuses))
        else:
            query = query.filter(db.func.lower(Ticket.status).notin_(resolved_statuses))

    if priority:
        priority_list = [p.strip().lower() for p in priority.split(',') if p.strip()]
        if len(priority_list) == 1:
            query = query.filter(db.func.lower(Ticket.priority) == priority_list[0])
        else:
            query = query.filter(db.func.lower(Ticket.priority).in_(priority_list))
    if category:
        category_list = [c.strip().lower() for c in category.split(',') if c.strip()]
        if len(category_list) == 1:
            query = query.filter(db.func.lower(Ticket.category) == category_list[0])
        else:
            query = query.filter(db.func.lower(Ticket.category).in_(category_list))
    else:
        query = query.filter(Ticket.category != DEV_CATEGORY)
    if assigned_to:
        unassigned_tokens = ('unassigned', 'null', 'none')
        assigned_values = [a.strip() for a in assigned_to.split(',') if a.strip()]
        has_unassigned = any(a.lower() in unassigned_tokens for a in assigned_values)
        named_values = [a for a in assigned_values if a.lower() not in unassigned_tokens]

        conditions = []
        if has_unassigned:
            conditions.append(Ticket.assigned_to_id.is_(None))
        if named_values:
            assigned_ids = []
            assigned_names = []
            for value in named_values:
                try:
                    assigned_ids.append(int(value))
                except ValueError:
                    assigned_names.append(value)
            if assigned_ids:
                conditions.append(Ticket.assigned_to_id.in_(assigned_ids))
            if assigned_names:
                from app.models.user import User
                name_conditions = [User.full_name.ilike(f"%{name}%") for name in assigned_names]
                query = query.outerjoin(Ticket.assigned_user)
                conditions.append(db.or_(*name_conditions))

        if conditions:
            query = query.filter(db.or_(*conditions))
    if search:
        # PostgreSQL Full-Text Search
        # Convert "server down" -> "server & down:*"
        search_query = ' & '.join(search.split()) + ':*'
        query = query.filter(
            db.or_(
                Ticket.ticket_code.ilike(f"%{search}%"),
                db.func.to_tsvector('english', 
                    Ticket.title + ' ' + 
                    Ticket.description + ' ' + 
                    Ticket.submitter_name
                ).match(search_query, postgresql_regconfig='english')
            )
        )

    # Total count before pagination
    total = query.count()
    
    # Ordering — workflow status lifecycle first: New → Triaged → Assigned → In Progress
    # → Pending → Resolved → Closed, then newest first
    status_order = case(
        (db.func.lower(Ticket.status) == 'new', 1),
        (db.func.lower(Ticket.status) == 'triaged', 2),
        (db.func.lower(Ticket.status) == 'assigned', 3),
        (Ticket.status.ilike('%progress%'), 4),
        (db.func.lower(Ticket.status) == 'pending', 5),
        (db.func.lower(Ticket.status) == 'resolved', 6),
        (db.func.lower(Ticket.status) == 'closed', 7),
        else_=99
    )
    
    # Pagination — clamp per_page to 1..100, validate page >= 1
    page = request.args.get('page', type=int)
    if page is not None and page < 1:
        return jsonify({'success': False, 'error': 'Page harus berupa angka >= 1'}), 400

    raw_per_page = request.args.get('per_page', default=20, type=int)
    per_page = max(1, min(raw_per_page or 20, 100))
    
    if page:
        query = query.order_by(status_order, Ticket.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    else:
        query = query.order_by(status_order, Ticket.created_at.desc())

    tickets = query.all()
    
    return jsonify({
        'success': True,
        'tickets': [ticket.to_dict(include_notes=False) for ticket in tickets],
        'total': total,
        'page': page,
        'per_page': per_page
    }), 200


@tickets_bp.route('/<ticket_id>', methods=['GET'])
@jwt_required()
def get_ticket(ticket_id):
    """Get a single ticket by ID or ticket_code (auth required)"""
    ticket = get_ticket_or_404(ticket_id)
   
    if not ticket:
        return jsonify({'success': False, 'error': 'Ticket tidak ditemukan'}), 404
    
    ticket_data = ticket.to_dict()
    return jsonify({
        'success': True,
        'ticket': ticket_data
    }), 200


@tickets_bp.route('', methods=['POST'])
def create_ticket():
    """Create a new ticket with single image support (public/authenticated)"""
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
        if field not in data or not str(data[field]).strip():
            return jsonify({'success': False, 'error': f'{field} diperlukan'}), 400

    # Check authentication
    is_authenticated = False
    try:
        verify_jwt_in_request(optional=True)
        if get_jwt_identity():
            is_authenticated = True
    except Exception:
        pass
    
    # Image handling
    image_url = FileService.save_file(image_file, 'tickets')
    
    # Get idempotency key from headers (ACID principle - Isolation/Durability)
    idempotency_key = request.headers.get('X-Idempotency-Key')
    
    # Create ticket via service
    try:
        ticket = TicketService.create_ticket(data, image_url, idempotency_key, is_authenticated=is_authenticated)
        return jsonify({
            'success': True,
            'ticket': ticket.to_dict(),
            'message': 'Ticket berhasil dibuat'
        }), 201
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Gagal membuat ticket: {str(e)}'
        }), 500


@tickets_bp.route('/<ticket_id>', methods=['PUT'])
@jwt_required()
def update_ticket(ticket_id):
    """Update a ticket (Administrator/Staff penuh; Management view-only: boleh note, tidak boleh status/assign/priority/category)"""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400

    # ── RBAC: Management view-only ──
    current_user = get_current_user()
    if current_user and current_user.role == 'Management':
        return jsonify({
            'success': False,
            'error': 'Unauthorized. Role Management bersifat view-only dan tidak dapat mengubah ticket.'
        }), 403

    ticket = get_ticket_or_404(ticket_id)
    if not ticket:
        return jsonify({'success': False, 'error': 'Ticket tidak ditemukan'}), 404

    # Validate requiresReason for status change
    if 'status' in data:
        from app.models.master_data import Status
        new_status = Status.query.filter(Status.name.ilike(data['status'])).first()
        if new_status and getattr(new_status, 'requires_reason', False):
            reason = data.get('reason')
            has_reason = reason and str(reason).strip()
            is_resolved = new_status.name.lower() in ['resolved', 'closed']
            has_summary = data.get('resolutionSummary') and str(data.get('resolutionSummary')).strip()
            if not has_reason and not (is_resolved and has_summary):
                return jsonify({'success': False, 'error': 'Reason is required for this status'}), 400

    user_id = get_jwt_identity()
    try:
        updated_ticket = TicketService.update_ticket(ticket.id, data, user_id=user_id)
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': f'Gagal mengupdate ticket: {str(e)}'}), 500
    
    if not updated_ticket:
        return jsonify({'success': False, 'error': 'Ticket tidak ditemukan'}), 404
    
    return jsonify({
        'success': True,
        'ticket': updated_ticket.to_dict(),
        'message': 'Ticket berhasil diupdate'
    }), 200


@tickets_bp.route('/<ticket_id>', methods=['DELETE'])
@jwt_required()
def delete_ticket(ticket_id):
    """Delete a ticket (admin only)"""
    user_id = get_jwt_identity()
    from app.services.user_service import UserService
    current_user = UserService.get_user_by_id(user_id)
    if not current_user or current_user.role != 'Administrator':
        return jsonify({'success': False, 'error': 'Unauthorized. Hanya Administrator yang dapat menghapus ticket.'}), 403

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
@assign_permission_required
def assign_ticket(ticket_id):
    """Assign/take/oper ticket (Administrator/Staff only — Management tidak bisa).

    Body: {"userId": <id|null>, "transferReason": "alasan oper (WAJIB jika oper/transfer)"}
    Oper = assign tiket yang sudah dipegang orang lain ke staff baru, wajib alasan.
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get('userId')
    transfer_reason = data.get('transferReason') or data.get('reason')
    current_user_id = get_jwt_identity()

    ticket = get_ticket_or_404(ticket_id)
    if not ticket:
        return jsonify({'success': False, 'error': 'Ticket tidak ditemukan'}), 404
    try:
        ticket, error = TicketService.assign_ticket(ticket.id, user_id, transfer_reason=transfer_reason, transferred_by_id=current_user_id)
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 409

    if error:
        # 409 Conflict: aksi tidak valid untuk state ticket saat ini
        # (mis. oper tanpa alasan, unassign tiket yang pernah diambil, resolved)
        return jsonify({'success': False, 'error': error}), 409
    
    return jsonify({
        'success': True,
        'ticket': ticket.to_dict(),
        'message': 'Ticket berhasil di-assign'
    }), 200


@tickets_bp.route('/<ticket_id>/status', methods=['PUT'])
@status_change_permission_required
def update_ticket_status(ticket_id):
    """Update ticket status (Administrator/Staff only — Management tidak bisa ubah status) - supports JSON and multipart/form-data with multi-image support"""
    # Handle both JSON and multipart/form-data
    if request.is_json:
        data = request.get_json()
        status = data.get('status')
        resolution_summary = data.get('resolutionSummary')
        resolved_at_str = data.get('resolvedAt')
        reason = data.get('reason')
        resolution_image_url = None
    else:
        data = request.form.to_dict()
        status = data.get('status')
        resolution_summary = data.get('resolutionSummary')
        resolved_at_str = data.get('resolvedAt')
        reason = data.get('reason')
        image_file = request.files.get('resolutionImage')
        resolution_image_url = FileService.save_file(image_file, 'resolutions')

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

    # Validate requiresReason (fix production bug where reason sometimes not sent)
    # For Resolved/Closed, resolutionSummary can satisfy the requirement
    if getattr(valid_status, 'requires_reason', False):
        has_reason = reason and str(reason).strip()
        has_summary = resolution_summary and str(resolution_summary).strip()
        is_resolved = valid_status.name.lower() in ['resolved', 'closed']
        if not has_reason and not (is_resolved and has_summary):
            return jsonify({'success': False, 'error': 'Reason is required for this status'}), 400

    user_id = get_jwt_identity()

    ticket = get_ticket_or_404(ticket_id)
    if not ticket:
        return jsonify({'success': False, 'error': 'Ticket tidak ditemukan'}), 404
    try:
        ticket = TicketService.update_ticket_status(ticket.id, status, resolution_summary, resolved_at_str, reason, user_id, resolution_image_url)
    except ValueError as ve:
        # 409: aturan bisnis melarang transisi ini (mis. LOCK status New utk tiket yg pernah diambil)
        return jsonify({'success': False, 'error': str(ve)}), 409

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
    
    if not content or not str(content).strip():
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
    user_id = get_jwt_identity()
    # Check if we should filter by user (e.g. if not admin)
    # For now, let's allow a query param 'personal' to toggle
    personal = request.args.get('personal', type=lambda v: v.lower() == 'true')
    
    if personal:
        stats = TicketService.get_stats(user_id=user_id)
    else:
        stats = TicketService.get_stats()
    
    return jsonify({
        'success': True,
        'stats': stats
    }), 200
