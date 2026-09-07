"""Add Development category

Kategori 'Development' dipakai halaman Dev Board (filter category=Development)
tapi tidak pernah ada di master data — dropdown kategori halaman detail tidak
menawarkannya dan tiketnya tidak bisa dikembalikan ke board. Idempotent.

Revision ID: e5f8a2b4c6d7
Revises: d4e7f1a2b3c5
Create Date: 2026-09-03

"""
from alembic import op
import sqlalchemy as sa

revision = 'e5f8a2b4c6d7'
down_revision = 'd4e7f1a2b3c5'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    exists = conn.execute(
        sa.text("SELECT id FROM categories WHERE LOWER(TRIM(name)) = 'development'")
    ).first()
    if not exists:
        conn.execute(sa.text(
            "INSERT INTO categories (name, description) "
            "VALUES ('Development', 'Development tasks (Dev Board Kanban)')"
        ))


def downgrade():
    conn = op.get_bind()
    # Hanya hapus jika tidak dipakai tiket mana pun
    used = conn.execute(sa.text(
        "SELECT id FROM tickets WHERE LOWER(TRIM(category)) = 'development' LIMIT 1"
    )).first()
    if not used:
        conn.execute(sa.text(
            "DELETE FROM categories WHERE LOWER(TRIM(name)) = 'development'"
        ))
