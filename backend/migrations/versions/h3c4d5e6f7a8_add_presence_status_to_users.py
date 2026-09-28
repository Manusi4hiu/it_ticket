"""add presence_status to users

Revision ID: h3c4d5e6f7a8
Revises: g2b3c4d5e6f7
Create Date: 2026-09-28

"""
from alembic import op
import sqlalchemy as sa

revision = 'h3c4d5e6f7a8'
down_revision = 'g2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'users',
        sa.Column(
            'presence_status',
            sa.String(20),
            nullable=False,
            server_default='online',
        )
    )


def downgrade():
    op.drop_column('users', 'presence_status')
