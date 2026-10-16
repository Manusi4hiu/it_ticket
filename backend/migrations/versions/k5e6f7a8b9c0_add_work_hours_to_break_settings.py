"""add work hours to break settings

Revision ID: k5e6f7a8b9c0
Revises: i4d5e6f7a8b9
Create Date: 2026-10-16

"""
from alembic import op
import sqlalchemy as sa

revision = 'k5e6f7a8b9c0'
down_revision = 'i4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'break_settings',
        sa.Column('work_start_time', sa.String(5), nullable=False, server_default='08:00')
    )
    op.add_column(
        'break_settings',
        sa.Column('work_end_time', sa.String(5), nullable=False, server_default='17:00')
    )
    op.add_column(
        'break_settings',
        sa.Column('auto_end_on_shift_end', sa.Boolean(), nullable=False, server_default='true')
    )


def downgrade():
    op.drop_column('break_settings', 'auto_end_on_shift_end')
    op.drop_column('break_settings', 'work_end_time')
    op.drop_column('break_settings', 'work_start_time')
