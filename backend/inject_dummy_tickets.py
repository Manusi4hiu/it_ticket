"""
Inject 50 dummy IT tickets for testing.

Usage:
    python inject_dummy_tickets.py
    python inject_dummy_tickets.py --clear
"""

from __future__ import annotations

import argparse
import random
from datetime import datetime, timedelta

from app import create_app, db
from app.models.master_data import Department, Status
from app.models.ticket import Ticket, TicketNote
from app.models.user import User
from app.services.ticket_service import TicketService


TITLES = [
    "Laptop tidak bisa booting",
    "Email tidak terkirim",
    "VPN gagal connect",
    "Akses aplikasi ditolak",
    "Printer kantor offline",
    "Jaringan lambat di lantai 3",
    "Password akun perlu reset",
    "Aplikasi error saat login",
    "Monitor flickering",
    "File server tidak bisa diakses",
]

DESCRIPTIONS = [
    "User mengalami kendala saat bekerja dan membutuhkan bantuan segera.",
    "Permintaan pengecekan untuk memastikan layanan kembali normal.",
    "Masalah terjadi sejak pagi dan mengganggu operasional harian.",
    "Mohon bantuan untuk investigasi dan perbaikan secepatnya.",
    "Tim membutuhkan tindak lanjut agar pekerjaan dapat dilanjutkan.",
]

SUBMITTERS = [
    ("Andi Pratama", "andi.pratama@company.com", "081234567801"),
    ("Budi Santoso", "budi.santoso@company.com", "081234567802"),
    ("Citra Lestari", "citra.lestari@company.com", "081234567803"),
    ("Dewi Anggraini", "dewi.anggraini@company.com", "081234567804"),
    ("Eko Saputra", "eko.saputra@company.com", "081234567805"),
    ("Fajar Nugroho", "fajar.nugroho@company.com", "081234567806"),
]

PRIORITIES = ["low", "medium", "high", "critical"]
CATEGORIES = ["Hardware", "Software", "Network", "Access", "Other"]
RESOLVED_STATUSES = {"resolved", "closed"}
ACTIVE_STATUSES = {"new", "triaged", "assigned", "in progress", "in-progress"}


def pick_status(statuses):
    if not statuses:
        return random.choice(["New", "Assigned", "In Progress", "Resolved", "Closed"])

    names = [s.name for s in statuses]
    lower_map = {s.name.lower(): s.name for s in statuses}

    if random.random() < 0.35:
        for key in ("resolved", "closed", "in progress", "in-progress", "assigned", "triaged", "new"):
            if key in lower_map:
                return lower_map[key]

    return random.choice(names)


def next_ticket_counter(prefix: str) -> int:
    max_counter = (
        db.session.query(db.func.max(Ticket.code_counter))
        .filter(Ticket.ticket_code.like(f"{prefix}-%"))
        .scalar()
    )
    return (max_counter or 0) + 1


def build_sla_deadline(created_at: datetime, priority: str) -> datetime:
    sla_hours = {"critical": 4, "high": 8, "medium": 24, "low": 48}
    return created_at + timedelta(hours=sla_hours.get(priority.lower(), 24))


def seed_dummy_tickets(total: int = 50, clear_existing: bool = False) -> None:
    app = create_app()

    with app.app_context():
        db.create_all()

        if clear_existing:
            TicketNote.query.delete()
            Ticket.query.delete()
            db.session.commit()

        users = User.query.order_by(User.id.asc()).all()
        departments = Department.query.filter(Department.is_active.is_(True)).order_by(Department.id.asc()).all()
        statuses = Status.query.order_by(Status.order.asc(), Status.id.asc()).all()

        created = 0
        for _ in range(total):
            dept = random.choice(departments) if departments else None
            dept_code = (dept.code if dept and dept.code else "TKT").upper()
            counter = next_ticket_counter(dept_code)
            ticket_code = f"{dept_code}-{counter:03d}"

            submitter_name, submitter_email, submitter_phone = random.choice(SUBMITTERS)
            priority = random.choice(PRIORITIES)
            category = random.choice(CATEGORIES)
            status = pick_status(statuses)

            created_at = datetime.utcnow() - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
            resolved_at = None
            resolution_summary = None
            if status.lower() in RESOLVED_STATUSES:
                resolved_at = created_at + timedelta(hours=random.randint(1, 72))
                resolution_summary = random.choice(
                    [
                        "Masalah berhasil diidentifikasi dan diperbaiki.",
                        "Konfigurasi layanan sudah disesuaikan dan divalidasi.",
                        "Perangkat diganti dan user sudah dapat bekerja kembali.",
                    ]
                )

            sla_deadline = build_sla_deadline(created_at, priority)
            sla_status = TicketService.calculate_sla_status(sla_deadline, resolved_at)

            ticket = Ticket(
                ticket_code=ticket_code,
                code_counter=counter,
                title=random.choice(TITLES),
                description=random.choice(DESCRIPTIONS),
                status=status,
                priority=priority,
                category=category,
                submitter_name=submitter_name,
                submitter_email=submitter_email,
                submitter_phone=submitter_phone,
                submitter_department=dept.name if dept else "IT",
                assigned_to_id=random.choice(users).id if users and random.random() < 0.7 else None,
                sla_deadline=sla_deadline,
                sla_status=sla_status,
                resolution_summary=resolution_summary,
                resolved_at=resolved_at,
                created_at=created_at,
                updated_at=resolved_at or datetime.utcnow(),
            )

            db.session.add(ticket)
            db.session.flush()

            if users and random.random() < 0.5:
                note_count = random.randint(1, 2)
                for _ in range(note_count):
                    note_created_at = created_at + timedelta(hours=random.randint(1, 48))
                    db.session.add(
                        TicketNote(
                            ticket_id=ticket.id,
                            content=random.choice(
                                [
                                    "Sudah dicek awal, masih perlu follow-up ke user.",
                                    "Sedang menunggu konfirmasi tambahan dari pelapor.",
                                    "Issue sudah direplikasi dan sedang dianalisis.",
                                ]
                            ),
                            author_id=random.choice(users).id,
                            is_internal=random.choice([True, False]),
                            created_at=note_created_at,
                        )
                    )

            created += 1

        db.session.commit()
        print(f"Inserted {created} dummy tickets.")


def main():
    parser = argparse.ArgumentParser(description="Inject dummy IT ticket data")
    parser.add_argument("--clear", action="store_true", help="Delete existing tickets and notes first")
    parser.add_argument("-n", "--count", type=int, default=50, help="Number of dummy tickets to create")
    args = parser.parse_args()

    seed_dummy_tickets(total=args.count, clear_existing=args.clear)


if __name__ == "__main__":
    main()
