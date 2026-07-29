"""add resolution_image_url to tickets

Revision ID: 1ef70501e7bb
Revises: 8e9a7f6b5c4d
Create Date: 2026-07-29 13:19:01.103351

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '1ef70501e7bb'
down_revision = '8e9a7f6b5c4d'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('tickets', schema=None) as batch_op:
        batch_op.add_column(sa.Column('resolution_image_url', sa.String(length=255), nullable=True))


def downgrade():
    with op.batch_alter_table('tickets', schema=None) as batch_op:
        batch_op.drop_column('resolution_image_url')
