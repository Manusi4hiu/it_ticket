"""Add transferred_at to tickets

Timestamp terakhir tiket di-OPER (transfer assignee). Dipakai notification bell
untuk menampilkan notifikasi "Ticket Transferred to You" pada assignee baru.

Revision ID: b4d8e2f7a1c9
Revises: a7c3f91e2d5b
Create Date: 2026-09-01

"""
from alembic import op
import sqlalchemy as sa

revision = 'b4d8e2f7a1c9'
down_revision = 'a7c3f91e2d5b'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('tickets', schema=None) as batch_op:
        batch_op.add_column(sa.Column('transferred_at', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('tickets', schema=None) as batch_op:
        batch_op.drop_column('transferred_at')
