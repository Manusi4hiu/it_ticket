"""add teams, user_teams, and team_id scoping

Revision ID: j1e2f3a4b5c6
Revises: 853d0528fe09
Create Date: 2026-10-08

Memperkenalkan konsep Team (workspace/board pemilik ticket):
- teams          : master team (IT, COC/Design, ...)
- user_teams     : many-to-many user <-> team (1 user boleh N team)
- tickets.team_id    : penanda team pemilik ticket
- categories.team_id : scoping kategori per team (NULL = global)
- statuses.team_id   : scoping status per team (NULL = global)

Backfill:
- team IT + COC dibuat
- semua user existing -> team IT
- semua ticket existing -> team IT (team_id NOT NULL setelah backfill)
- kategori/status lama dibiarkan NULL (global)
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'j1e2f3a4b5c6'
down_revision = '853d0528fe09'
branch_labels = None
depends_on = None


def upgrade():
    # 1. teams table
    op.create_table(
        'teams',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('slug', sa.String(100), nullable=True),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
    )
    op.create_index('ix_teams_code', 'teams', ['code'], unique=True)
    op.create_index('ix_teams_name', 'teams', ['name'], unique=True)
    op.create_index('ix_teams_slug', 'teams', ['slug'], unique=True)

    # 2. user_teams association table
    op.create_table(
        'user_teams',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('team_id', sa.Integer(), sa.ForeignKey('teams.id'), primary_key=True),
    )

    # 3. tickets.team_id (nullable dulu, diisi lalu NOT NULL)
    op.add_column('tickets', sa.Column('team_id', sa.Integer(), sa.ForeignKey('teams.id'), nullable=True))
    op.create_index('ix_tickets_team_id', 'tickets', ['team_id'])

    # 4. categories.team_id (NULL = global)
    op.add_column('categories', sa.Column('team_id', sa.Integer(), sa.ForeignKey('teams.id'), nullable=True))
    op.create_index('ix_categories_team_id', 'categories', ['team_id'])

    # 5. statuses.team_id (NULL = global)
    op.add_column('statuses', sa.Column('team_id', sa.Integer(), sa.ForeignKey('teams.id'), nullable=True))
    op.create_index('ix_statuses_team_id', 'statuses', ['team_id'])

    # 6. Backfill: buat team IT + COC, assign semua user & ticket -> IT.
    bind = op.get_bind()
    # Insert teams, capture their ids.
    bind.execute(sa.text(
        "INSERT INTO teams (name, code, slug, description, is_active) VALUES "
        "('IT', 'IT', 'it', 'Information Technology', TRUE)"
    ))
    bind.execute(sa.text(
        "INSERT INTO teams (name, code, slug, description, is_active) VALUES "
        "('Graphic Design', 'COC', 'coc', 'Graphic Design / Creative', TRUE)"
    ))
    it_id = bind.execute(sa.text("SELECT id FROM teams WHERE code = 'IT'")).scalar()

    # Assign semua user existing -> team IT.
    bind.execute(sa.text(
        "INSERT INTO user_teams (user_id, team_id) "
        "SELECT id, :tid FROM users WHERE id NOT IN (SELECT user_id FROM user_teams)"
    ), {"tid": it_id})

    # Assign semua ticket existing -> team IT.
    bind.execute(sa.text("UPDATE tickets SET team_id = :tid WHERE team_id IS NULL"), {"tid": it_id})


def downgrade():
    op.drop_index('ix_statuses_team_id', table_name='statuses')
    op.drop_column('statuses', 'team_id')
    op.drop_index('ix_categories_team_id', table_name='categories')
    op.drop_column('categories', 'team_id')
    op.drop_index('ix_tickets_team_id', table_name='tickets')
    op.drop_column('tickets', 'team_id')
    op.drop_table('user_teams')
    op.drop_index('ix_teams_slug', table_name='teams')
    op.drop_index('ix_teams_name', table_name='teams')
    op.drop_index('ix_teams_code', table_name='teams')
    op.drop_table('teams')
