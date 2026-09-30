"""add custom status fields to users

Revision ID: i4d5e6f7a8b9
Revises: h3c4d5e6f7a8
Create Date: 2026-09-30

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'i4d5e6f7a8b9'
down_revision = 'h3c4d5e6f7a8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'users',
        sa.Column('custom_status_message', sa.String(255), nullable=True, default=None)
    )
    op.add_column(
        'users',
        sa.Column('custom_status_expires_at', sa.DateTime(timezone=True), nullable=True, default=None)
    )
    op.add_column(
        'users',
        sa.Column('custom_status_pre_status', sa.String(20), nullable=True, default=None)
    )


def downgrade():
    op.drop_column('users', 'custom_status_pre_status')
    op.drop_column('users', 'custom_status_expires_at')
    op.drop_column('users', 'custom_status_message')
