"""add break_pre_status to users

Revision ID: 853d0528fe09
Revises: i4d5e6f7a8b9
Create Date: 2026-09-29 08:14:56.603916

Rebased onto upstream i4d5e6f7a8b9 after pull (was: h3c4d5e6f7a8).
Upstream tidak punya migrasi untuk kolom ini padahal model
User.break_pre_status memakainya (restore status saat end break);
tanpa file ini deploy fresh akan 500 di toggle break.

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '853d0528fe09'
down_revision = 'i4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade():
    # Only add the missing column. The tickets_*_backup_* tables are
    # intentionally preserved; do not drop them here.
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('break_pre_status', sa.String(length=20), nullable=True))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('break_pre_status')
