"""Add filter_group to statuses

Mapping status ke tombol segmented filter Tickets: 'new' | 'progress' | 'done'.
Dipakai halaman Settings (3 flex dropdown) dan Tickets (fallback dinamis).

Revision ID: a7c3f91e2d5b
Revises: 1ef70501e7bb
Create Date: 2026-08-31

"""
from alembic import op
import sqlalchemy as sa

revision = 'a7c3f91e2d5b'
down_revision = '1ef70501e7bb'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('statuses', schema=None) as batch_op:
        batch_op.add_column(sa.Column('filter_group', sa.String(20), nullable=True))

    # Backfill infer otomatis berdasarkan nama status:
    # - default/'new' -> new | resolve/done/closed/completed -> done | sisanya -> progress
    op.execute("""
        UPDATE statuses SET filter_group = 'new'
        WHERE LOWER(TRIM(name)) = 'new' OR is_default = true
    """)
    op.execute("""
        UPDATE statuses SET filter_group = 'done'
        WHERE filter_group IS NULL
          AND (LOWER(TRIM(name)) LIKE '%resolve%'
               OR LOWER(TRIM(name)) LIKE '%done%'
               OR LOWER(TRIM(name)) LIKE '%closed%'
               OR LOWER(TRIM(name)) = 'completed')
    """)
    op.execute("""
        UPDATE statuses SET filter_group = 'progress' WHERE filter_group IS NULL
    """)


def downgrade():
    with op.batch_alter_table('statuses', schema=None) as batch_op:
        batch_op.drop_column('filter_group')
