"""Add break_logs table + period limits on break_settings

Revision ID: g2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-09-24

- Tabel break_logs: satu baris per sesi END (sumber agregasi
  harian/mingguan/bulanan sub-page Break di Performance).
- Kolom batas periode di break_settings (default 60/300/1200).
"""
from alembic import op
import sqlalchemy as sa


revision = 'g2b3c4d5e6f7'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'break_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('duration_seconds', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('log_date', sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('break_logs', schema=None) as batch_op:
        batch_op.create_index('ix_break_logs_user_id', ['user_id'])
        batch_op.create_index('ix_break_logs_log_date', ['log_date'])

    with op.batch_alter_table('break_settings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('daily_max_minutes', sa.Integer(), nullable=False, server_default='60'))
        batch_op.add_column(sa.Column('weekly_max_minutes', sa.Integer(), nullable=False, server_default='300'))
        batch_op.add_column(sa.Column('monthly_max_minutes', sa.Integer(), nullable=False, server_default='1200'))


def downgrade():
    with op.batch_alter_table('break_settings', schema=None) as batch_op:
        batch_op.drop_column('monthly_max_minutes')
        batch_op.drop_column('weekly_max_minutes')
        batch_op.drop_column('daily_max_minutes')
    with op.batch_alter_table('break_logs', schema=None) as batch_op:
        batch_op.drop_index('ix_break_logs_log_date')
        batch_op.drop_index('ix_break_logs_user_id')
    op.drop_table('break_logs')
