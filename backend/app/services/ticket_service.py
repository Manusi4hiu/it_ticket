from app import db
from app.models.ticket import Ticket, TicketNote
from app.models.user import User
from app.models.master_data import Department, Status, Priority, Category, SLAPolicy
from app.utils.logging import log_activity
from app.utils.security import sanitize_html, NOTE_ALLOWED_TAGS
from datetime import datetime, timedelta, timezone
from app.constants import DEV_CATEGORY

class TicketService:
    # Removed get_next_ticket_id as IDs are now auto-incrementing integers

    @staticmethod
    def calculate_sla_status(sla_deadline, resolved_at=None, sla_paused_at=None):
        """Calculate SLA status based on deadline and resolution time"""
        if not sla_deadline:
            return 'good'
            
        # Ensure sla_deadline is timezone-aware
        if sla_deadline.tzinfo is None:
            sla_deadline = sla_deadline.replace(tzinfo=timezone.utc)
        
        # If resolved, compare deadline with resolution time instead of current time
        # If paused, compare deadline with pause time
        if resolved_at:
            comparison_time = resolved_at
        elif sla_paused_at:
            comparison_time = sla_paused_at
        else:
            comparison_time = datetime.now(timezone.utc)
        
        # Ensure comparison_time is timezone-aware
        if comparison_time.tzinfo is None:
            comparison_time = comparison_time.replace(tzinfo=timezone.utc)
            
        time_remaining = sla_deadline - comparison_time
        
        if time_remaining.total_seconds() < 0:
            return 'breached'
        elif not resolved_at and time_remaining.total_seconds() < 2 * 60 * 60:  # Warning only for active tickets
            return 'warning'
        else:
            return 'good'

    @staticmethod
    def get_sla_hours_for_ticket(priority_name, category_name=None):
        """Get SLA hours dynamically from Priority or SLAPolicy, falling back to defaults"""
        try:
            p_obj = Priority.query.filter(Priority.name.ilike(priority_name)).first() if priority_name else None
            c_obj = Category.query.filter(Category.name.ilike(category_name)).first() if category_name else None
            
            if p_obj and c_obj:
                policy = SLAPolicy.query.filter_by(priority_id=p_obj.id, category_id=c_obj.id).first()
                if policy:
                    return policy.resolution_time_hours
            
            if p_obj:
                policy = SLAPolicy.query.filter_by(priority_id=p_obj.id, category_id=None).first()
                if policy:
                    return policy.resolution_time_hours
            
            if c_obj:
                policy = SLAPolicy.query.filter_by(priority_id=None, category_id=c_obj.id).first()
                if policy:
                    return policy.resolution_time_hours
            
            if p_obj and p_obj.sla_hours:
                return p_obj.sla_hours
        except Exception as e:
            print(f"Error resolving dynamic SLA hours: {e}")
            
        # Hardcoded defaults fallback
        sla_hours_map = {'critical': 4, 'high': 8, 'medium': 24, 'low': 48}
        return sla_hours_map.get(priority_name.lower() if priority_name else 'medium', 24)

    @staticmethod
    def create_ticket(data, image_url=None, idempotency_key=None, is_authenticated=False, **kwargs):
        """
        Create a new ticket using the provided data and optional image URL.
        Implements ACID principles:
        - Atomicity: All operations (ticket + log) succeed or fail together.
        - Consistency: Validates data and uses transactions.
        - Isolation: Prevents duplicate creations via idempotency key.
        - Durability: Committed data is persistent.
        """
        import re

        # 1. Validation: Title / Subject
        title = data.get('title')
        if not title or not str(title).strip():
            raise ValueError("Subject/Title tidak boleh kosong atau hanya berisi spasi")
        title_clean = str(title).strip()
        if len(title_clean) < 3:
            raise ValueError("Subject/Title minimal 3 karakter")
        if len(title_clean) > 255:
            raise ValueError("Subject/Title maksimal 255 karakter")

        # 2. Validation: Submitter Name
        submitter_name = data.get('submitterName')
        if not submitter_name or not str(submitter_name).strip():
            raise ValueError("Submitter Name tidak boleh kosong atau hanya berisi spasi")
        submitter_name_clean = str(submitter_name).strip()
        if len(submitter_name_clean) > 100:
            raise ValueError("Submitter Name maksimal 100 karakter")

        # 3. Validation: Description
        desc = data.get('description')
        if not desc or not str(desc).strip():
            raise ValueError("Description tidak boleh kosong atau hanya berisi spasi")
        desc_clean = str(desc).strip()
        if len(desc_clean) > 5000:
            raise ValueError("Description maksimal 5000 karakter")

        # 4. Validation: Submitter Phone (Optional)
        phone = data.get('submitterPhone')
        phone_clean = None
        if phone and str(phone).strip():
            phone_clean = str(phone).strip()
            if not re.match(r"^[\d\s+\-()]{6,20}$", phone_clean):
                raise ValueError("Nomor telepon tidak valid (hanya angka, spasi, dan simbol +, -, ())")

        # 5. Validation: Submitter Email (Optional)
        email = data.get('submitterEmail')
        email_clean = None
        if email and str(email).strip():
            email_clean = str(email).strip()
            if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email_clean):
                raise ValueError("Format email tidak valid")

        # 6. Priority & Category
        priority = (data.get('priority') or 'medium').strip().lower()
        if priority not in ('critical', 'high', 'medium', 'low'):
            priority = 'medium'
        category = (data.get('category') or 'Uncategorized').strip()

        # 7. Mass Assignment Protection for unauthenticated creations
        if not is_authenticated:
            assigned_to_id = None
        else:
            assigned_to_id = data.get('assignedToId')
            # Guard: role Management TIDAK boleh jadi assignee (view-only).
            if assigned_to_id:
                target_user = User.query.get(assigned_to_id)
                if target_user and target_user.role == 'Management':
                    raise ValueError(
                        "Role Management tidak bisa menerima tiket (assignee) — Management bersifat view-only."
                    )

        # 8. Isolation: Check for existing ticket with same idempotency key
        if idempotency_key:
            existing = Ticket.query.filter_by(idempotency_key=idempotency_key).first()
            if existing:
                return existing

        # Transaction for Atomicity
        try:
            # SLA only runs when the ticket is claimed/assigned
            sla_deadline = None
            if assigned_to_id:
                hours = TicketService.get_sla_hours_for_ticket(priority, category)
                sla_deadline = datetime.now(timezone.utc) + timedelta(hours=hours)
                sla_taken_at = datetime.now(timezone.utc)
            else:
                sla_taken_at = None
            
            # Fetch department info
            dept_code = "TKT"
            dept_name = data.get('submitterDepartment')
            if dept_name:
                dept = Department.query.filter_by(name=dept_name).first()
                if dept and dept.code:
                    dept_code = dept.code
            
            # Generate ticket code (per department counter) — fix race condition with FOR UPDATE
            last_ticket = Ticket.query.filter(Ticket.ticket_code.like(f"{dept_code}-%"))\
                .order_by(Ticket.code_counter.desc())\
                .with_for_update()\
                .first()
            
            new_counter = 1
            if last_ticket and last_ticket.code_counter:
                new_counter = last_ticket.code_counter + 1
            
            ticket_code = f"{dept_code}-{str(new_counter).zfill(3)}"

            # Fetch default status from master data
            default_status = Status.query.filter_by(is_default=True).first()
            status_name = default_status.name if default_status else 'New'

            # ── Bisnis rule: New = belum diambil. Tiket yang dibuat langsung dengan
            # assignee (mis. via dialog create w/ Assignee) tidak boleh berstatus New —
            # dinormalisasi ke "Assigned" (konsisten dgn hasil take).
            if assigned_to_id:
                assigned_master = Status.query.filter(Status.name.ilike('assigned')).first()
                status_name = assigned_master.name if assigned_master else 'Assigned'

            ticket = Ticket(
                title=sanitize_html(title_clean),
                description=sanitize_html(desc_clean),
                status=status_name,
                priority=priority,
                category=category,
                submitter_name=sanitize_html(submitter_name_clean),
                submitter_email=sanitize_html(email_clean),
                submitter_phone=sanitize_html(phone_clean),
                submitter_department=sanitize_html(dept_name),
                image_url=image_url,
                idempotency_key=idempotency_key,
                sla_deadline=sla_deadline,
                sla_status='good',
                taken_at=sla_taken_at,
                ticket_code=ticket_code,
                code_counter=new_counter,
                assigned_to_id=assigned_to_id
            )
            
            db.session.add(ticket)
            
            # Note: We need to flush to get the ticket ID for the log, 
            # but we don't commit yet to maintain Atomicity.
            db.session.flush()

            # Log the activity (using auto_commit=False to maintain Atomicity)
            from app.utils.logging import log_activity
            log_activity(
                action="Ticket Created",
                details=f"Ticket {ticket.id} created by {ticket.submitter_name}",
                target_id=ticket.id,
                metadata={
                    "title": ticket.title,
                    "category": ticket.category,
                    "priority": ticket.priority,
                    "submitter": ticket.submitter_name
                },
                auto_commit=False
            )
            
            # If everything succeeded, commit the whole transaction
            db.session.commit()

            # Send email confirmation to submitter (non-blocking)
            try:
                from app.services.email_service import EmailService
                EmailService.send_ticket_confirmation(ticket)
            except Exception as email_err:
                # Email failure must NOT rollback or fail the ticket creation
                import logging
                logging.getLogger(__name__).error(
                    f"[Email] Unexpected error sending confirmation for "
                    f"{ticket.ticket_code}: {email_err}"
                )

            return ticket


        except Exception as e:
            db.session.rollback()
            # Handle specific database constraint errors
            error_msg = str(e).lower()
            if 'unique' in error_msg or 'duplicate' in error_msg:
                # If it's a duplicate, check if the ticket was actually created by a parallel request
                if idempotency_key:
                    existing = Ticket.query.filter_by(idempotency_key=idempotency_key).first()
                    if existing:
                        return existing
                print(f"Duplicate entry detected: {error_msg}")
            
            print(f"Transaction failed: {str(e)}")
            raise e

    @staticmethod
    def update_ticket(ticket_id, data, user_id=None):
        """Update a ticket's details.

        Admin override: Admin boleh mengubah assignee/status/kategori tiket yang sudah
        diambil staff lain, dengan alasan yang dikirim sebagai notifikasi ke:
        - perubahan assignee: pemilik LAMA + assignee BARU
        - perubahan status/kategori: pemilik tiket saja
        """
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return None

        priority_changed = False
        category_changed = False
        old_status_name = ticket.status
        old_category = ticket.category
        old_priority_name = ticket.priority
        old_assigned_id = ticket.assigned_to_id

        # Deteksi aktor & role-nya (untuk admin override notification)
        actor = User.query.get(user_id) if user_id else None
        is_admin = bool(actor) and actor.role == 'Administrator'

        # ── Otoritas kepemilikan: hanya Admin, PEMILIK tiket saat ini, atau
        # tiket tanpa pemilik yang boleh mengubah status/kategori/priority.
        # Staff non-pemilik (mis. sudah mengoper tiket ke orang lain) DILARANG.
        if actor and not is_admin and ticket.assigned_to_id:
            if int(actor.id) != int(ticket.assigned_to_id):
                forbidden = [k for k in ('status', 'category', 'priority') if k in data]
                if forbidden:
                    raise ValueError(
                        f"Unauthorized: tiket ini sudah dipegang/dioper ke "
                        f"'{ticket.assigned_user.full_name if ticket.assigned_user else 'staff lain'}'. "
                        "Hanya pemilik tiket atau Administrator yang bisa mengubah "
                        f"{', '.join(forbidden)}."
                    )

        # ── Kategori berubah:
        # Perubahan pertama kali (dari Uncategorized atau belum pernah diganti): GRATIS tanpa alasan.
        # Perubahan ke-2+: alasan WAJIB dari SEMUA role (admin & staff pemilik).
        category_really_changed = (
            'category' in data
            and str(data['category']).strip() != str(old_category).strip()
        )
        category_change_count = TicketNote.query.filter(
            TicketNote.ticket_id == ticket.id,
            TicketNote.content.ilike("%Kategori diganti dari%")
        ).count()
        is_first_category_change = (
            str(old_category).strip().lower() == 'uncategorized'
            or category_change_count == 0
        )
        category_change_reason = None
        if category_really_changed and not is_first_category_change:
            raw_reason = data.get('reason') or data.get('adminReason')
            if not (raw_reason and str(raw_reason).strip()):
                raise ValueError(
                    "Alasan wajib diisi: mengubah kategori tiket untuk kedua kalinya atau lebih. "
                    "Alasan akan tercatat di Ticket History"
                    + (" dan dikirim sebagai notifikasi ke pemilik tiket." if is_admin else ".")
                )
            category_change_reason = str(raw_reason).strip()

        # ── Prioritas berubah:
        # Perubahan pertama kali: GRATIS tanpa alasan.
        # Perubahan ke-2+: alasan WAJIB dari SEMUA role (admin & staff pemilik).
        priority_really_changed = (
            'priority' in data
            and str(data['priority']).strip().lower() in ('critical', 'high', 'medium', 'low')
            and str(data['priority']).strip().lower() != str(old_priority_name).strip().lower()
        )
        priority_change_count = TicketNote.query.filter(
            TicketNote.ticket_id == ticket.id,
            TicketNote.content.ilike("%Prioritas diganti dari%")
        ).count()
        is_first_priority_change = (priority_change_count == 0)
        priority_change_reason = None
        if priority_really_changed and not is_first_priority_change:
            raw_reason = data.get('reason') or data.get('adminReason')
            if not (raw_reason and str(raw_reason).strip()):
                raise ValueError(
                    "Alasan wajib diisi: mengubah prioritas tiket untuk kedua kalinya atau lebih. "
                    "Alasan akan tercatat di Ticket History"
                    + (" dan dikirim sebagai notifikasi ke pemilik tiket." if is_admin else ".")
                )
            priority_change_reason = str(raw_reason).strip()

        # ── Status berubah:
        # Singkron dengan flex checklist di Setting Status (requires_reason).
        # Admin override pada tiket milik staff lain juga wajib alasan.
        status_really_changed = (
            'status' in data
            and str(data['status']).strip().lower() != str(old_status_name).strip().lower()
        )
        status_change_reason = None
        if status_really_changed:
            new_status_obj = Status.query.filter(Status.name.ilike(str(data['status']).strip())).first()
            requires_reason = getattr(new_status_obj, 'requires_reason', False) if new_status_obj else False
            is_resolved_target = str(data['status']).strip().lower() in ('resolved', 'closed')
            has_summary = data.get('resolutionSummary') and str(data.get('resolutionSummary')).strip()
            is_admin_override_status = bool(
                is_admin and ticket.assigned_to_id and actor and int(actor.id) != int(ticket.assigned_to_id)
            )

            if (requires_reason or is_admin_override_status) and not (is_resolved_target and has_summary):
                raw_reason = data.get('reason') or data.get('adminReason')
                if not (raw_reason and str(raw_reason).strip()):
                    raise ValueError(
                        f"Alasan wajib diisi untuk status '{data['status']}'. "
                        "Alasan akan tercatat di Ticket History"
                        + (" dan dikirim sebagai notifikasi ke pemilik tiket." if is_admin_override_status else ".")
                    )
                status_change_reason = str(raw_reason).strip()

        # ── Admin override guard: Admin mengubah assignee/status/kategori/priority tiket
        # yang SUDAH DIAMBIL/DI-ASSIGN staff lain -> alasan WAJIB jika bukan first change.
        if is_admin and ticket.assigned_to_id and actor and int(actor.id) != int(ticket.assigned_to_id):
            admin_fields_changed = []
            if 'assignedToId' in data and data['assignedToId'] != old_assigned_id and old_assigned_id is not None:
                admin_fields_changed.append('assignedToId')
            if 'status' in data and str(data['status']).strip().lower() != old_status_name.lower():
                admin_fields_changed.append('status')
            if ('category' in data and str(data['category']).strip() != str(old_category).strip()
                    and not is_first_category_change):
                admin_fields_changed.append('category')
            if ('priority' in data and str(data['priority']).strip().lower() != str(old_priority_name).strip().lower()
                    and not is_first_priority_change):
                admin_fields_changed.append('priority')

            if admin_fields_changed:
                raw_reason = data.get('reason') or data.get('adminReason')
                if not (raw_reason and str(raw_reason).strip()):
                    raise ValueError(
                        f"Alasan wajib diisi: Admin mengubah {', '.join(admin_fields_changed)} "
                        "pada tiket yang sudah diambil/di-assign staff. "
                        "Alasan akan dikirim sebagai notifikasi ke staff terkait."
                    )
                admin_reason = str(raw_reason).strip()
            else:
                admin_reason = None
        else:
            admin_reason = data.get('reason') or data.get('adminReason')
        
        # Update fields if provided — with strict validation
        if 'title' in data:
            title = data['title']
            if not title or not str(title).strip():
                raise ValueError("Subject/Title tidak boleh kosong atau hanya berisi spasi")
            title_clean = str(title).strip()
            if len(title_clean) < 3:
                raise ValueError("Subject/Title minimal 3 karakter")
            if len(title_clean) > 255:
                raise ValueError("Subject/Title maksimal 255 karakter")
            ticket.title = sanitize_html(title_clean)

        if 'description' in data:
            desc = data['description']
            if not desc or not str(desc).strip():
                raise ValueError("Description tidak boleh kosong atau hanya berisi spasi")
            desc_clean = str(desc).strip()
            if len(desc_clean) > 5000:
                raise ValueError("Description maksimal 5000 karakter")
            ticket.description = sanitize_html(desc_clean)

        if 'status' in data:
            status = data['status']

            # ── Bisnis rule (LOCK New): tiket yang PERNAH diambil/di-assign
            # (indikator: taken_at terisi) TIDAK BOLEH dikembalikan ke status "New".
            # Jika sudah dipegang orang dan perlu berpindah, jalurnya adalah OPER
            # (assign ke staff lain via /assign dgn reason), bukan kembali ke pool.
            if ticket.taken_at and str(status).strip().lower() == 'new' and old_status_name.lower() != 'new':
                raise ValueError(
                    "Tiket yang sudah pernah diambil/di-assign tidak bisa dikembalikan ke status 'New'. "
                    "Gunakan fitur oper: assign tiket ini ke staff lain (dengan alasan) jika ingin berpindah tangan."
                )

            if old_status_name != status:
                old_status = Status.query.filter(Status.name.ilike(old_status_name)).first()
                new_status = Status.query.filter(Status.name.ilike(status)).first()
                
                # Check requires_reason validation
                if new_status and getattr(new_status, 'requires_reason', False):
                    raw_reason = data.get('reason')
                    is_resolved = new_status.name.lower() in ['resolved', 'closed']
                    has_summary = data.get('resolutionSummary') and str(data.get('resolutionSummary')).strip()
                    if not (raw_reason and str(raw_reason).strip()) and not (is_resolved and has_summary):
                        raise ValueError("Reason is required for this status")

                # SLA Logic
                if old_status and getattr(old_status, 'pauses_sla', False) and ticket.sla_paused_at and ticket.sla_deadline:
                    paused_at_aware = ticket.sla_paused_at
                    if paused_at_aware.tzinfo is None:
                        paused_at_aware = paused_at_aware.replace(tzinfo=timezone.utc)
                    time_paused = datetime.now(timezone.utc) - paused_at_aware
                    
                    sla_deadline_aware = ticket.sla_deadline
                    if sla_deadline_aware.tzinfo is None:
                        sla_deadline_aware = sla_deadline_aware.replace(tzinfo=timezone.utc)
                        
                    ticket.sla_deadline = sla_deadline_aware + time_paused
                    
                if new_status and getattr(new_status, 'pauses_sla', False):
                    ticket.sla_paused_at = datetime.now(timezone.utc)
                else:
                    ticket.sla_paused_at = None

                # Note Logic — tidy with proper Reason handling.
                # KHUSUS transisi ke Resolved/Closed: "Ticket resolved on <tanggal>"
                # TANPA reason (alasan sudah ada di Resolution Summary).
                if user_id:
                    is_resolved_via_put = str(status).strip().lower() in ('resolved', 'closed')
                    if is_resolved_via_put:
                        resolved_display = datetime.now(timezone.utc).strftime('%d %b %Y %H:%M UTC')
                        note_content = f"<p><strong>Ticket resolved on {resolved_display}</strong></p>"
                    else:
                        note_content = f"<p><strong>Status changed from {old_status_name} to {status}</strong></p>"
                        raw_reason = data.get('reason')
                        if raw_reason and str(raw_reason).strip():
                            clean_reason = sanitize_html(str(raw_reason).strip())
                            note_content += f"<p><em>Reason:</em> {clean_reason}</p>"

                    ticket.notes.append(TicketNote(
                        ticket_id=ticket.id,
                        content=sanitize_html(note_content, allowed_tags=NOTE_ALLOWED_TAGS),
                        author_id=user_id,
                        is_internal=True
                    ))

            ticket.status = status
            if status.lower() in ['resolved', 'closed']:
                ticket.resolved_at = datetime.now(timezone.utc)

        if 'priority' in data:
            priority_val = str(data['priority']).strip().lower()
            if priority_val in ('critical', 'high', 'medium', 'low'):
                if priority_val != str(ticket.priority).strip().lower():
                    # System note untuk Ticket History: "Prioritas diganti dari X menjadi Y — Reason: ..."
                    if user_id:
                        note_content = (
                            f"<p><strong>Prioritas diganti dari '{ticket.priority}' menjadi '{priority_val}'</strong></p>"
                        )
                        if priority_change_reason:
                            note_content += f"<p><em>Reason:</em> {sanitize_html(priority_change_reason)}</p>"
                        ticket.notes.append(TicketNote(
                            ticket_id=ticket.id,
                            content=sanitize_html(note_content, allowed_tags=NOTE_ALLOWED_TAGS),
                            author_id=user_id,
                            is_internal=True
                        ))
                    ticket.priority = priority_val
                priority_changed = True

        if 'category' in data:
            new_category_val = str(data['category']).strip()
            if new_category_val:
                if new_category_val != str(ticket.category).strip():
                    # System note untuk Ticket History: selalu catat setiap
                    # perubahan (alasan hanya wajib untuk tiket taken).
                    if user_id:
                        note_content = (
                            f"<p><strong>Kategori diganti dari '{ticket.category}' menjadi '{new_category_val}'</strong></p>"
                        )
                        if category_change_reason:
                            note_content += f"<p><em>Reason:</em> {sanitize_html(category_change_reason)}</p>"
                        ticket.notes.append(TicketNote(
                            ticket_id=ticket.id,
                            content=sanitize_html(note_content, allowed_tags=NOTE_ALLOWED_TAGS),
                            author_id=user_id,
                            is_internal=True
                        ))
                    ticket.category = new_category_val
                category_changed = True

        if 'resolutionSummary' in data:
            ticket.resolution_summary = sanitize_html(str(data['resolutionSummary']).strip())

        if 'resolutionImageUrl' in data:
            ticket.resolution_image_url = data['resolutionImageUrl']

        if 'resolvedAt' in data and data['resolvedAt']:
            try:
                clean_str = str(data['resolvedAt']).replace('Z', '+00:00')
                dt_parsed = datetime.fromisoformat(clean_str)
                now_utc = datetime.now(timezone.utc)
                if dt_parsed.tzinfo is not None:
                    if dt_parsed > now_utc + timedelta(minutes=2):
                        raise ValueError("Waktu penyelesaian (resolved at) tidak boleh di masa depan.")
                    ticket.resolved_at = dt_parsed.astimezone(timezone.utc).replace(tzinfo=None)
                else:
                    if dt_parsed > datetime.utcnow() + timedelta(minutes=2):
                        raise ValueError("Waktu penyelesaian (resolved at) tidak boleh di masa depan.")
                    ticket.resolved_at = dt_parsed
            except ValueError as ve:
                if "masa depan" in str(ve):
                    raise ve
                pass

        if 'assignedToId' in data:
            prev_assigned_id = ticket.assigned_to_id
            new_assigned_id = data['assignedToId']

            # Guard: role Management TIDAK boleh jadi assignee (view-only).
            if new_assigned_id:
                target_assignee = User.query.get(new_assigned_id)
                if target_assignee and target_assignee.role == 'Management':
                    raise ValueError(
                        "Role Management tidak bisa menerima tiket (assignee) — Management bersifat view-only."
                    )

            ticket.assigned_to_id = new_assigned_id
            
            # If assigned, change status from 'new' to master-data 'Assigned'
            # (exact case — dropdown Select cocok string persis; lowercase bikin
            # trigger kosong) + catat system note agar Ticket History terisi.
            if ticket.assigned_to_id and ticket.status.lower() == 'new':
                assigned_status = Status.query.filter(Status.name.ilike('%assigned%')).first()
                new_status_name = assigned_status.name if assigned_status else 'Assigned'
                assignee_user = User.query.get(ticket.assigned_to_id)
                assignee_name = assignee_user.full_name if assignee_user else 'staff'
                TicketService.add_note(
                    ticket_id=ticket.id,
                    content=(
                        f"<p><strong>Ticket assigned to {assignee_name}</strong></p>"
                        f"<p><small>Status changed from {old_status_name} to {new_status_name}</small></p>"
                    ),
                    author_id=user_id,
                    is_internal=True,
                    is_system_note=True
                )
                ticket.status = new_status_name
                
            if ticket.assigned_to_id:
                if not prev_assigned_id or not ticket.sla_deadline:
                    hours = TicketService.get_sla_hours_for_ticket(ticket.priority, ticket.category)
                    ticket.sla_deadline = datetime.now(timezone.utc) + timedelta(hours=hours)
                # Set taken_at only on first assignment
                if not prev_assigned_id and not ticket.taken_at:
                    ticket.taken_at = datetime.now(timezone.utc)
            else:
                ticket.sla_deadline = None
                ticket.taken_at = None
        elif (priority_changed or category_changed) and ticket.assigned_to_id:
            # Recalculate deadline from taken_at preserving elapsed time
            hours = TicketService.get_sla_hours_for_ticket(ticket.priority, ticket.category)
            base_time = ticket.taken_at or ticket.created_at or datetime.now(timezone.utc)
            ticket.sla_deadline = base_time + timedelta(hours=hours)
            
        if 'collaboratorIds' in data:
            # Clear existing collaborators and add new ones
            ticket.collaborators = []
            for uid in data['collaboratorIds']:
                user = User.query.get(uid)
                if user:
                    ticket.collaborators.append(user)

        ticket.updated_at = datetime.now(timezone.utc)
        ticket.sla_status = TicketService.calculate_sla_status(ticket.sla_deadline, ticket.resolved_at, ticket.sla_paused_at)
        db.session.commit()

        # ── Notifikasi Admin Override (best-effort, tidak memblokir update):
        # - assignee berubah: alasan dikirim ke pemilik LAMA + assignee BARU
        # - status / kategori berubah: alasan dikirim ke PEMILIK tiket saja
        if is_admin and ticket.taken_at and admin_reason:
            try:
                from app.services.notification_service import NotificationService

                assignee_changed = ticket.assigned_to_id != old_assigned_id

                # Perubahan assignee (tiket sudah diambil staff) -> dua pihak
                if assignee_changed:
                    NotificationService.notify_admin_assignee_change(
                        ticket, actor, old_assigned_id, ticket.assigned_to_id, admin_reason
                    )
                    ticket.transferred_at = datetime.now(timezone.utc)

                # Perubahan status -> pemilik tiket.
                # PENTING: jika assignee saja yang berubah, perubahan status
                # New->Assigned (atau Assigned tetap Assigned) adalah efek samping
                # oper, BUKAN override status terpisah — jangan kirim notif status ganda.
                status_changed_by_admin = ('status' in data and ticket.status != old_status_name)
                if status_changed_by_admin and not assignee_changed and ticket.assigned_to_id:
                    NotificationService.notify_admin_field_change(
                        ticket, actor, 'Status', old_status_name, ticket.status, admin_reason
                    )

                # Perubahan kategori (oleh admin) -> pemilik tiket.
                # System note untuk Ticket History sudah dibuat di blok update kategori.
                if str(ticket.category).strip() != str(old_category).strip() and ticket.assigned_to_id:
                    NotificationService.notify_admin_field_change(
                        ticket, actor, 'Kategori', old_category, ticket.category,
                        category_change_reason or admin_reason
                    )

                # Perubahan prioritas (oleh admin) -> pemilik tiket.
                # System note untuk Ticket History sudah dibuat di blok update priority.
                if str(ticket.priority).strip().lower() != str(old_priority_name).strip().lower() and ticket.assigned_to_id:
                    NotificationService.notify_admin_field_change(
                        ticket, actor, 'Prioritas', old_priority_name, ticket.priority,
                        priority_change_reason or admin_reason
                    )

                # Commit notifikasi (push hanya session.add tanpa commit)
                db.session.commit()
            except Exception as notif_err:
                db.session.rollback()
                print(f"Admin override notification failed: {notif_err}")

        return ticket

    @staticmethod
    def delete_ticket(ticket_id, user_id=None):
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return False

        # Hapus notifikasi terkait dulu — FK notifications.ticket_id tidak
        # cascade, tanpa ini DELETE tiket assigned selalu 500 (B7).
        from app.models.notification import Notification
        Notification.query.filter_by(ticket_id=ticket.id).delete(synchronize_session=False)

        # Log the activity atomically before deletion
        from app.utils.logging import log_activity
        log_activity(
            action="Ticket Deleted",
            details=f"Ticket {ticket.ticket_code} ({ticket.title}) was deleted",
            user_id=user_id,
            target_id=ticket.id,
            metadata={
                "ticket_code": ticket.ticket_code,
                "title": ticket.title,
                "submitter": ticket.submitter_name
            },
            auto_commit=False
        )

        db.session.delete(ticket)
        db.session.commit()
        return True

    @staticmethod
    def assign_ticket(ticket_id, user_id, transfer_reason=None, transferred_by_id=None):
        """Assign/take/oper tiket.

        - Take/assign biasa: user_id diisi, tiket belum punya assignee.
        - OPER (transfer): tiket sudah punya assignee (taken_at terisi) dan dioper
          ke user lain. Wajib disertai transfer_reason — alasan mengapa dioper.
          Reason tercatat sebagai note di Status History (timeline tiket).
        - Un-assign (user_id None): hanya boleh untuk tiket yang belum pernah
          diambil (taken_at kosong) dan belum selesai.
        """
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return None, 'Ticket tidak ditemukan'

        # Guard: ticket yang sudah selesai (resolved/closed/completed) tidak bisa di-take/di-assign.
        # Harus ubah statusnya dulu dari resolved ke status lain sebelum bisa diambil.
        if user_id and ticket.status.lower() in ('resolved', 'closed', 'completed'):
            return None, f"Ticket dengan status '{ticket.status}' tidak bisa di-take/di-assign. Ubah statusnya terlebih dahulu dari '{ticket.status}' ke status lain."

        if user_id:
            user = User.query.get(user_id)
            if not user:
                return None, 'User tidak ditemukan'

            # Guard: role Management TIDAK boleh jadi assignee — view-only,
            # tidak berkaitan dengan pengerjaan tiket.
            if user.role == 'Management':
                return None, "Role Management tidak bisa menerima tiket (assignee) — Management bersifat view-only."

            prev_assignee = User.query.get(ticket.assigned_to_id) if ticket.assigned_to_id else None
            is_transfer = bool(prev_assignee) and prev_assignee.id != int(user_id)

            # ── Otoritas oper: hanya PEMILIK tiket saat ini atau Administrator
            # yang boleh mengoper/mengubah assignee. Staff lain (non-pemilik,
            # non-admin) tidak boleh mengambil alih tiket milik orang lain.
            actor = User.query.get(transferred_by_id) if transferred_by_id else None
            if prev_assignee and actor and not (
                actor.role == 'Administrator' or int(actor.id) == int(prev_assignee.id)
            ):
                return None, (
                    f"Unauthorized: tiket ini dipegang oleh '{prev_assignee.full_name}'. "
                    "Hanya pemilik tiket atau Administrator yang bisa mengoper/mengubah assignee."
                )

            # OPER (transfer) wajib ada alasan
            if is_transfer and not (transfer_reason and str(transfer_reason).strip()):
                return None, 'Alasan oper wajib diisi — jelaskan mengapa tiket ini dioper ke staff lain.'

            ticket.assigned_to_id = user_id

            # Postpone SLA deadline calculation until it is assigned (taken)
            if not ticket.sla_deadline:
                hours = TicketService.get_sla_hours_for_ticket(ticket.priority, ticket.category)
                ticket.sla_deadline = datetime.now(timezone.utc) + timedelta(hours=hours)
            # Set taken_at only on first assignment (marker "pernah diambil" —
            # tidak pernah direset, karena dipakai oleh LOCK status New)
            if not ticket.taken_at:
                ticket.taken_at = datetime.now(timezone.utc)

            # Timestamp oper — dipakai notification bell assignee baru
            if is_transfer:
                ticket.transferred_at = datetime.now(timezone.utc)

            # Try to find an "Assigned" status in master data, otherwise use 'Assigned'
            assigned_status = Status.query.filter(Status.name.ilike('%assigned%')).first()
            old_status_name = ticket.status
            if assigned_status:
                ticket.status = assigned_status.name
            else:
                ticket.status = 'Assigned'

            # Catat ke Status History:
            # - take biasa: "Ticket taken by X"
            # - oper: "Ticket transferred from X to Y — Reason: ..."
            author_id = transferred_by_id or user_id
            if author_id:
                if is_transfer:
                    note_content = (
                        f"<p><strong>Ticket transferred from {prev_assignee.full_name} to {user.full_name}</strong></p>"
                    )
                    if transfer_reason and str(transfer_reason).strip():
                        clean_reason = sanitize_html(str(transfer_reason).strip())
                        note_content += f"<p><em>Reason:</em> {clean_reason}</p>"
                    if old_status_name != ticket.status:
                        note_content += f"<p><small>Status changed from {old_status_name} to {ticket.status}</small></p>"
                else:
                    note_content = f"<p><strong>Ticket taken by {user.full_name}</strong></p>"
                    if old_status_name != ticket.status:
                        note_content += f"<p><small>Status changed from {old_status_name} to {ticket.status}</small></p>"

                TicketService.add_note(
                    ticket_id=ticket.id,
                    content=note_content,
                    author_id=author_id,
                    is_internal=True,
                    is_system_note=True
                )

            # ── Notifikasi in-app:
            # - take biasa        -> assignee baru: "assigned"
            # - oper sesama staff -> assignee baru: "transferred"
            # - oper OLEH ADMIN   -> pemilik LAMA: "admin_override" (alasan admin)
            #                       + assignee baru: "transferred"
            try:
                from app.services.notification_service import NotificationService
                actor = User.query.get(transferred_by_id) if transferred_by_id else None
                if is_transfer and actor and actor.role == 'Administrator' and prev_assignee:
                    # Admin mengoper tiket: kirim notifikasi khusus admin override ke kedua pihak (pemilik lama & assignee baru)
                    NotificationService.notify_admin_assignee_change(
                        ticket, actor, prev_assignee.id, user.id,
                        transfer_reason or '(tanpa alasan)'
                    )
                else:
                    NotificationService.notify_assigned(ticket, user, transfer_reason if is_transfer else None)
            except Exception as notif_err:
                print(f"Notification push failed: {notif_err}")
        else:
            # Un-assign: hanya boleh untuk tiket yang BELUM PERNAH diambil
            # (taken_at kosong). Tiket yang sudah pernah diambil harus dioper,
            # bukan dilepas kembali ke pool New.
            if ticket.taken_at:
                return None, "Tiket ini sudah pernah diambil dan tidak bisa dilepas kembali ke pool unassigned. Gunakan fitur oper (assign ke staff lain dengan alasan)."
            if ticket.status.lower() in ('resolved', 'closed', 'completed'):
                return None, f"Ticket dengan status '{ticket.status}' tidak bisa diubah assigneenya. Ubah statusnya terlebih dahulu dari '{ticket.status}' ke status lain."
            ticket.assigned_to_id = None
            ticket.sla_deadline = None
            ticket.sla_status = 'good'
            ticket.taken_at = None
            # Revert to default status
            default_status = Status.query.filter_by(is_default=True).first()
            ticket.status = default_status.name if default_status else 'New'

        ticket.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        return ticket, None

    @staticmethod
    def update_ticket_status(ticket_id, status, resolution_summary=None, resolved_at_str=None, reason=None, user_id=None, resolution_image_url=None):
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return None

        # ── Guard: Waktu penyelesaian (resolved at) tidak boleh di masa depan
        if str(status).strip().lower() in ('resolved', 'closed') and resolved_at_str:
            try:
                clean_rs = str(resolved_at_str).replace('Z', '+00:00')
                dt_val = datetime.fromisoformat(clean_rs)
                now_utc = datetime.now(timezone.utc)
                if dt_val.tzinfo is not None:
                    if dt_val > now_utc + timedelta(minutes=2):
                        raise ValueError("Waktu penyelesaian (resolved at) tidak boleh di masa depan.")
                else:
                    if dt_val > datetime.utcnow() + timedelta(minutes=2):
                        raise ValueError("Waktu penyelesaian (resolved at) tidak boleh di masa depan.")
            except ValueError as ve:
                if "masa depan" in str(ve):
                    raise ve

        # ── Bisnis rule (LOCK New): tiket yang PERNAH diambil/di-assign
        # (indikator: taken_at terisi) TIDAK BOLEH dikembalikan ke status "New".
        # Jalur untuk berpindah tangan adalah OPER (assign ke staff lain dgn reason).
        if ticket.taken_at and ticket.status.lower() != 'new' and str(status).strip().lower() == 'new':
            raise ValueError(
                "Tiket yang sudah pernah diambil/di-assign tidak bisa dikembalikan ke status 'New'. "
                "Gunakan fitur oper: assign tiket ini ke staff lain (dengan alasan) jika ingin berpindah tangan."
            )

        # ── Admin override guard: Admin mengubah status tiket milik staff
        # (sudah diambil/di-assign) -> alasan WAJIB, dikirim sebagai notif ke pemilik.
        actor = User.query.get(user_id) if user_id else None
        is_admin = bool(actor) and actor.role == 'Administrator'
        old_status_name_snap = ticket.status

        # ── Otoritas kepemilikan: hanya Admin atau PEMILIK tiket saat ini yang
        # boleh mengubah status. Staff non-pemilik (sudah mengoper) DILARANG.
        if actor and not is_admin and ticket.assigned_to_id:
            if int(actor.id) != int(ticket.assigned_to_id):
                raise ValueError(
                    f"Unauthorized: tiket ini sudah dipegang/dioper ke "
                    f"'{ticket.assigned_user.full_name if ticket.assigned_user else 'staff lain'}'. "
                    "Hanya pemilik tiket atau Administrator yang bisa mengubah status."
                )

        if is_admin and ticket.taken_at and ticket.assigned_to_id and old_status_name_snap != status:
            if not (reason and str(reason).strip()):
                raise ValueError(
                    "Alasan wajib diisi: Admin mengubah status tiket yang sedang dipegang staff. "
                    "Alasan akan dikirim sebagai notifikasi ke pemilik tiket."
                )

        # ── Status berubah pada tiket taken oleh PEMILIK (non-admin) ->
        # alasan WAJIB (cermin update_ticket). Resolved/Closed dikecualikan
        # (summary berfungsi sebagai alasan; UI resolve selalu minta summary).
        if (not is_admin and ticket.taken_at and ticket.assigned_to_id
                and old_status_name_snap.lower() != str(status).strip().lower()
                and str(status).strip().lower() not in ('resolved', 'closed')):
            if not (reason and str(reason).strip()):
                raise ValueError(
                    "Alasan wajib diisi: mengubah status tiket yang sudah diambil/di-assign. "
                    "Alasan akan tercatat di Ticket History."
                )

        # Handle SLA Pausing
        old_status_name = ticket.status
        old_status = Status.query.filter(Status.name.ilike(old_status_name)).first()
        new_status = Status.query.filter(Status.name.ilike(status)).first()
        
        # If moving out of a paused state
        if old_status and getattr(old_status, 'pauses_sla', False) and ticket.sla_paused_at and ticket.sla_deadline:
            paused_at_aware = ticket.sla_paused_at
            if paused_at_aware.tzinfo is None:
                paused_at_aware = paused_at_aware.replace(tzinfo=timezone.utc)
            time_paused = datetime.now(timezone.utc) - paused_at_aware
            
            sla_deadline_aware = ticket.sla_deadline
            if sla_deadline_aware.tzinfo is None:
                sla_deadline_aware = sla_deadline_aware.replace(tzinfo=timezone.utc)
                
            ticket.sla_deadline = sla_deadline_aware + time_paused
            
        # If moving into a paused state
        if new_status and getattr(new_status, 'pauses_sla', False):
            ticket.sla_paused_at = datetime.now(timezone.utc)
        else:
            ticket.sla_paused_at = None
            
        # Log status change as note if status actually changed — tidy Reason.
        # KHUSUS transisi ke Resolved/Closed: format "Ticket resolved on <tanggal resolved>"
        # TANPA reason (alasan sudah ada di Resolution Summary), dan created_at note
        # mengikuti tanggal resolved custom (resolvedAt) bila diisi.
        if old_status_name != status and user_id:
            is_resolved_transition = str(status).strip().lower() in ('resolved', 'closed')
            resolved_note_at = None

            if is_resolved_transition:
                # Hitung resolved_at final (custom atau now) untuk timestamp note
                if resolved_at_str:
                    try:
                        clean_rs = resolved_at_str.replace('Z', '+00:00')
                        resolved_note_at = datetime.fromisoformat(clean_rs)
                    except ValueError:
                        resolved_note_at = None
                resolved_display = (
                    resolved_note_at.strftime('%d %b %Y %H:%M UTC') if resolved_note_at
                    else datetime.now(timezone.utc).strftime('%d %b %Y %H:%M UTC')
                )
                note_content = f"<p><strong>Ticket resolved on {resolved_display}</strong></p>"
                TicketService.add_note(
                    ticket_id=ticket.id,
                    content=note_content,
                    author_id=user_id,
                    is_internal=True,
                    is_system_note=True,
                    created_at=resolved_note_at,
                )
            else:
                note_content = f"<p><strong>Status changed from {old_status_name} to {status}</strong></p>"
                if reason and str(reason).strip():
                    clean_reason = sanitize_html(str(reason).strip())
                    note_content += f"<p><em>Reason:</em> {clean_reason}</p>"
                    
                TicketService.add_note(
                    ticket_id=ticket.id,
                    content=note_content,
                    author_id=user_id,
                    is_internal=True,
                    is_system_note=True
                )

        ticket.status = status

        # Check if status is resolved (case-insensitive)
        if status.lower() == 'resolved':
            if resolved_at_str:
                try:
                    # Handle Z suffix for UTC
                    clean_str = resolved_at_str.replace('Z', '+00:00')
                    dt_parsed = datetime.fromisoformat(clean_str)
                    if dt_parsed.tzinfo is not None:
                        ticket.resolved_at = dt_parsed.astimezone(timezone.utc).replace(tzinfo=None)
                    else:
                        ticket.resolved_at = dt_parsed
                except ValueError:
                    ticket.resolved_at = datetime.now(timezone.utc).replace(tzinfo=None)
            else:
                ticket.resolved_at = datetime.now(timezone.utc).replace(tzinfo=None)
                
            if resolution_summary:
                ticket.resolution_summary = resolution_summary
            if resolution_image_url:
                ticket.resolution_image_url = resolution_image_url

        ticket.updated_at = datetime.now(timezone.utc)
        ticket.sla_status = TicketService.calculate_sla_status(ticket.sla_deadline, ticket.resolved_at, ticket.sla_paused_at)
        db.session.commit()

        # ── Notifikasi Admin Override (via endpoint /status):
        # Admin mengubah status tiket milik staff -> alasan dikirim ke PEMILIK tiket.
        if is_admin and ticket.taken_at and ticket.assigned_to_id and old_status_name_snap != ticket.status:
            try:
                from app.services.notification_service import NotificationService
                NotificationService.notify_admin_field_change(
                    ticket, actor, 'Status', old_status_name_snap, ticket.status,
                    reason or '(tanpa alasan)'
                )
                db.session.commit()
            except Exception as notif_err:
                db.session.rollback()
                print(f"Admin override notification failed: {notif_err}")

        return ticket

    @staticmethod
    def add_note(ticket_id, content, author_id, is_internal=False, image_url=None, is_system_note=False, created_at=None):
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return None

        # System-generated notes (status changes) keep safe HTML formatting
        # User-written notes get all HTML stripped
        cleaned = sanitize_html(content, allowed_tags=NOTE_ALLOWED_TAGS if is_system_note else None)

        note = TicketNote(
            ticket_id=ticket_id,
            content=cleaned,
            author_id=author_id,
            image_url=image_url,
            is_internal=is_internal,
            **({"created_at": created_at} if created_at is not None else {})
        )
        
        db.session.add(note)
        ticket.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        return note

    @staticmethod
    def get_stats(user_id=None):
        """Get ticket statistics for dashboard, optionally filtered by user"""
        base_query = Ticket.query.filter(Ticket.category != DEV_CATEGORY)
        if user_id:
            base_query = base_query.filter(Ticket.assigned_to_id == user_id)
            
        total = base_query.count()
        # Grup status mengikuti filter_group master data (sinkron dengan 3 tombol
        # segmented filter Tickets: New / Progress / Done). Fallback infer dari nama.
        from app.services.master_data_service import _infer_filter_group
        all_statuses = Status.query.all()
        
        new_status_names = []
        progress_status_names = []
        done_status_names = []
        pending_status_names = []
        for s in all_statuses:
            group = s.filter_group or _infer_filter_group(s.name, s.is_default)
            if group == 'new':
                new_status_names.append(s.name.lower())
            elif group == 'done':
                done_status_names.append(s.name.lower())
            elif group == 'pending':
                pending_status_names.append(s.name.lower())
            else:
                progress_status_names.append(s.name.lower())
        
        new = base_query.filter(db.func.lower(Ticket.status).in_(new_status_names)).count() if new_status_names else 0
        resolved = base_query.filter(db.func.lower(Ticket.status).in_(done_status_names)).count() if done_status_names else 0
        # Progress badge = tiket dengan status grup progress
        worked_on = base_query.filter(db.func.lower(Ticket.status).in_(progress_status_names)).count() if progress_status_names else 0
        # Pending badge = tiket dengan status grup pending
        pending = base_query.filter(db.func.lower(Ticket.status).in_(pending_status_names)).count() if pending_status_names else 0
        assigned = total - new - resolved
        
        open_status_names = ['new', 'assign', 'assigned', 'inprogress', 'in progress']
        open_count = base_query.filter(db.func.lower(Ticket.status).in_(open_status_names)).count()
        
        # SLA stats
        breached = base_query.filter_by(sla_status='breached').count()
        warning = base_query.filter_by(sla_status='warning').count()
        
        # Priority breakdown
        by_priority = {
            'critical': base_query.filter(db.func.lower(Ticket.priority) == 'critical').filter(db.func.lower(Ticket.status).notin_(done_status_names)).count(),
            'high': base_query.filter(db.func.lower(Ticket.priority) == 'high').filter(db.func.lower(Ticket.status).notin_(done_status_names)).count(),
            'medium': base_query.filter(db.func.lower(Ticket.priority) == 'medium').filter(db.func.lower(Ticket.status).notin_(done_status_names)).count(),
            'low': base_query.filter(db.func.lower(Ticket.priority) == 'low').filter(db.func.lower(Ticket.status).notin_(done_status_names)).count(),
        }
        
        # Category breakdown
        cats_query = db.session.query(Ticket.category, db.func.count(Ticket.id)).filter(Ticket.category != DEV_CATEGORY)
        if user_id:
            cats_query = cats_query.filter(Ticket.assigned_to_id == user_id)
        cats = cats_query.group_by(Ticket.category).all()
        by_category = {cat: count for cat, count in cats if cat}
        
        # Department breakdown
        depts_query = db.session.query(Ticket.submitter_department, db.func.count(Ticket.id)).filter(Ticket.category != DEV_CATEGORY)
        if user_id:
            depts_query = depts_query.filter(Ticket.assigned_to_id == user_id)
        depts = depts_query.group_by(Ticket.submitter_department).all()
        by_department = {dept: count for dept, count in depts if dept}
        
        # Trend data (last 7 days)
        trend = []
        for i in range(6, -1, -1):
            date = (datetime.now(timezone.utc) - timedelta(days=i)).date()
            date_str = date.strftime('%a')
            
            start_of_day = datetime.combine(date, datetime.min.time()).replace(tzinfo=timezone.utc)
            end_of_day = datetime.combine(date, datetime.max.time()).replace(tzinfo=timezone.utc)
            
            created_q = Ticket.query.filter(Ticket.category != DEV_CATEGORY).filter(
                Ticket.created_at >= start_of_day, Ticket.created_at <= end_of_day
            )
            resolved_q = Ticket.query.filter(Ticket.category != DEV_CATEGORY).filter(
                Ticket.resolved_at >= start_of_day, Ticket.resolved_at <= end_of_day
            )
            
            if user_id:
                created_q = created_q.filter(Ticket.assigned_to_id == user_id)
                resolved_q = resolved_q.filter(Ticket.assigned_to_id == user_id)
                
            created = created_q.count()
            resolved_on_day = resolved_q.count()
            
            trend.append({
                'day': date_str,
                'created': created,
                'resolved': resolved_on_day
            })
        
        # All resolved tickets (for compliance)
        resolved_all_q = Ticket.query.filter(Ticket.category != DEV_CATEGORY).filter(db.func.lower(Ticket.status).in_(done_status_names))
        if user_id:
            resolved_all_q = resolved_all_q.filter(Ticket.assigned_to_id == user_id)
        
        resolved_all = resolved_all_q.all()
        res_times = []
        for t in resolved_all:
            if t.resolved_at:
                # Use taken_at (when ticket was first assigned) as start; fallback to created_at
                start_time = t.taken_at or t.created_at
                res_naive = t.resolved_at.replace(tzinfo=None)
                start_naive = start_time.replace(tzinfo=None)
                diff = (res_naive - start_naive).total_seconds() / 3600
                res_times.append(diff)
        
        avg_res_time = sum(res_times) / len(res_times) if res_times else 0
        
        return {
            'total': total,
            'open': open_count,
            'new': new,
            'assigned': assigned,
            'resolved': resolved,
            'workedOn': worked_on,
            'pending': pending,
            'avgResolutionTime': round(avg_res_time, 1),
            'sla': {
                'breached': breached,
                'warning': warning,
                'healthy': total - breached - warning
            },
            'byPriority': by_priority,
            'byCategory': by_category,
            'byDepartment': by_department,
            'trend': trend
        }
