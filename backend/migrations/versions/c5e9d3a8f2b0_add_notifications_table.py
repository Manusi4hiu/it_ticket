"""Add notifications table

Notifikasi in-app: assigned, transferred, admin_override (alasan dari admin
untuk pemilik lama & assignee baru saat assignee diganti; pemilik saja saat
status/kategori diubah admin).

Revision ID: c5e9d3a8f2b0
Revises: b4d8e2f7a1c9
Create Date: 2026-09-02

"""
from alembic import op
import sqlalchemy as sa

revision = 'c5e9d3a8f2b0'
down_revision = 'b4d8e2f7a1c9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('ticket_id', sa.Integer(), sa.ForeignKey('tickets.id'), nullable=True),
        sa.Column('ticket_code', sa.String(20), nullable=True),
        sa.Column('type', sa.String(30), nullable=False, server_default='assigned'),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('is_read', sa.Boolean(), server_default=sa.text('false'), index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )


def downgrade():
    op.drop_table('notifications')
