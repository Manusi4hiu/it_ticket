"""merge sla milestone and push subscriptions heads

Revision ID: 081858ba8401
Revises: j5e6f7a8b9c0, l6f7a8b9c0d1
Create Date: 2026-11-16 08:41:25.844468

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '081858ba8401'
down_revision = ('j5e6f7a8b9c0', 'l6f7a8b9c0d1')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
