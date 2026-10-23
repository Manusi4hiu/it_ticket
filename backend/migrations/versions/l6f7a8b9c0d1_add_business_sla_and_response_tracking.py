"""add business sla and response tracking

Revision ID: l6f7a8b9c0d1
Revises: k5e6f7a8b9c0
Create Date: 2026-10-19

"""
from alembic import op
import sqlalchemy as sa

revision = 'l6f7a8b9c0d1'
down_revision = 'k5e6f7a8b9c0'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create holidays table
    op.create_table(
        'holidays',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('holiday_date', sa.Date(), nullable=False),
        sa.Column('is_recurring', sa.Boolean(), nullable=False, server_default='false'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_holidays_holiday_date'), 'holidays', ['holiday_date'], unique=True)

    # 2. Add columns to tickets table
    with op.batch_alter_table('tickets', schema=None) as batch_op:
        batch_op.add_column(sa.Column('response_deadline', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('first_responded_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('response_sla_status', sa.String(length=20), nullable=False, server_default='good'))


def downgrade():
    with op.batch_alter_table('tickets', schema=None) as batch_op:
        batch_op.drop_column('response_sla_status')
        batch_op.drop_column('first_responded_at')
        batch_op.drop_column('response_deadline')

    op.drop_index(op.f('ix_holidays_holiday_date'), table_name='holidays')
    op.drop_table('holidays')

