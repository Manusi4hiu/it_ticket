"""Add push_subscriptions table

Web Push subscription storage. One user can have many subscriptions (multi-device).
Unique(user_id, endpoint) makes repeated subscribe calls idempotent.

Revision ID: j5e6f7a8b9c0
Revises: i4d5e6f7a8b9
Create Date: 2026-09-21

"""
from alembic import op
import sqlalchemy as sa


revision = 'j5e6f7a8b9c0'
down_revision = 'i4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'push_subscriptions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('endpoint', sa.Text(), nullable=False),
        sa.Column('p256dh', sa.Text(), nullable=False),
        sa.Column('auth', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('user_id', 'endpoint', name='uq_user_endpoint'),
    )


def downgrade():
    op.drop_table('push_subscriptions')
