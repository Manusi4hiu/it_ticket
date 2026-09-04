"""Add Pending status

Status 'Pending' (grup filter 'pending') untuk tombol segmented ke-4 di halaman
Tickets. Idempotent: hanya insert jika belum ada; menggeser order Resolved/Closed.

Revision ID: d4e7f1a2b3c5
Revises: c5e9d3a8f2b0
Create Date: 2026-09-03

"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e7f1a2b3c5'
down_revision = 'c5e9d3a8f2b0'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    exists = conn.execute(
        sa.text("SELECT id FROM statuses WHERE LOWER(TRIM(name)) = 'pending'")
    ).first()
    if not exists:
        # Geser Resolved/Closed agar Pending duduk di antara In Progress & Resolved
        conn.execute(sa.text(
            "UPDATE statuses SET \"order\" = \"order\" + 1 "
            "WHERE LOWER(TRIM(name)) IN ('resolved', 'closed')"
        ))
        conn.execute(sa.text(
            "INSERT INTO statuses (name, color, \"order\", filter_group, "
            "is_default, requires_reason, pauses_sla, show_on_devboard, "
            "show_on_it_helpdesk) "
            "VALUES ('Pending', '#A855F7', 5, 'pending', false, false, false, "
            "false, true)"
        ))


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM statuses WHERE LOWER(TRIM(name)) = 'pending'"))
    conn.execute(sa.text(
        "UPDATE statuses SET \"order\" = \"order\" - 1 "
        "WHERE LOWER(TRIM(name)) IN ('resolved', 'closed') AND \"order\" > 5"
    ))
