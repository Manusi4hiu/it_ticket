"""Add requires_reason/pauses_sla to statuses, sla_paused_at to tickets

These columns were originally added via raw ALTER TABLE in app startup
(now removed). This migration makes them official via Alembic.

Revision ID: 8e9a7f6b5c4d
Revises: 2c49b81b3ffa
Create Date: 2026-07-29

"""
from alembic import op
import sqlalchemy as sa


revision = '8e9a7f6b5c4d'
down_revision = '2c49b81b3ffa'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Add requires_reason to statuses if not exists
    if not _has_column(conn, 'statuses', 'requires_reason'):
        with op.batch_alter_table('statuses', schema=None) as batch_op:
            batch_op.add_column(sa.Column('requires_reason', sa.Boolean(), server_default=sa.text('false'), nullable=True))
        # Set default on existing rows then make non-nullable
        op.execute("UPDATE statuses SET requires_reason = false WHERE requires_reason IS NULL")
        with op.batch_alter_table('statuses', schema=None) as batch_op:
            batch_op.alter_column('requires_reason', nullable=False)

    # Add pauses_sla to statuses if not exists
    if not _has_column(conn, 'statuses', 'pauses_sla'):
        with op.batch_alter_table('statuses', schema=None) as batch_op:
            batch_op.add_column(sa.Column('pauses_sla', sa.Boolean(), server_default=sa.text('false'), nullable=True))
        op.execute("UPDATE statuses SET pauses_sla = false WHERE pauses_sla IS NULL")
        with op.batch_alter_table('statuses', schema=None) as batch_op:
            batch_op.alter_column('pauses_sla', nullable=False)

    # Add sla_paused_at to tickets if not exists
    if not _has_column(conn, 'tickets', 'sla_paused_at'):
        with op.batch_alter_table('tickets', schema=None) as batch_op:
            batch_op.add_column(sa.Column('sla_paused_at', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('tickets', schema=None) as batch_op:
        batch_op.drop_column('sla_paused_at')
    with op.batch_alter_table('statuses', schema=None) as batch_op:
        batch_op.drop_column('pauses_sla')
        batch_op.drop_column('requires_reason')


def _has_column(conn, table, column):
    """Check if a column already exists (works for PostgreSQL and SQLite)."""
    import sqlalchemy as sa
    insp = sa.inspect(conn)
    columns = [c['name'] for c in insp.get_columns(table)]
    return column in columns
