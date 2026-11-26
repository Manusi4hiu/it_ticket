"""Merge mobile and team histories without replaying already-applied work hours.

k5e6f7a8b9c0 shipped with different parents. Keep the mobile parent and run
j1e2f3a4b5c6 independently; its upgrade preserves a complete existing team schema.
"""
revision = 'm7a8b9c0d1e2'
down_revision = ('081858ba8401', 'j1e2f3a4b5c6')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
