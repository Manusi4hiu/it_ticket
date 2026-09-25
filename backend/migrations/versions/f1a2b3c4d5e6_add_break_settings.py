"""Add break_settings table + users.break_total_date

Tabel setting batas waktu break (menit, default 60) untuk Settings > Break,
dan penanda hari milik total break harian (reset otomatis).

Revision ID: f1a2b3c4d5e6
Revises: b2c3d4e5f6a7
Create Date: 2026-09-24

"""
from alembic import op
import sqlalchemy as sa


revision = 'f1a2b3c4d5e6'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'break_settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('max_break_minutes', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('break_total_date', sa.Date(), nullable=True))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('break_total_date')
    op.drop_table('break_settings')
