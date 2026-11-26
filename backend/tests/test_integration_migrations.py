"""Exercise real Alembic upgrades on an isolated temporary PostgreSQL cluster.

Run: backend/venv/bin/python backend/tests/test_integration_migrations.py
Requires local initdb/pg_ctl binaries; never reads project .env or a live DB.
"""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from unittest.mock import patch

import sqlalchemy as sa
from flask import Flask
from flask_migrate import Migrate, upgrade, stamp
from alembic.config import Config
from alembic.script import ScriptDirectory

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
with patch('dotenv.load_dotenv'):
    from app import db


def run(*args):
    return subprocess.run(args, cwd=ROOT, check=True, capture_output=True, text=True).stdout


def check():
    candidates = sorted(Path('/usr/lib/postgresql').glob('*/bin/initdb'))
    initdb = shutil.which('initdb') or (str(candidates[-1]) if candidates else None)
    if not initdb:
        raise RuntimeError('PostgreSQL initdb is required for this check')
    pg_ctl = str(Path(initdb).with_name('pg_ctl'))
    config = Config()
    config.set_main_option('script_location', str(ROOT / 'backend/migrations'))
    assert ScriptDirectory.from_config(config).get_heads() == ['m7a8b9c0d1e2']
    with tempfile.TemporaryDirectory(prefix='it-ticket-pg-') as folder:
        temp = Path(folder)
        data = temp / 'data'
        run(initdb, '-D', str(data), '-A', 'trust', '--no-locale', '-U', 'tester')
        # Private Unix socket only: no TCP port or existing server touched.
        run(pg_ctl, '-D', str(data), '-l', str(temp / 'postgres.log'), '-o',
            f"-k {folder} -c listen_addresses=''", '-w', 'start')
        try:
            url = sa.URL.create('postgresql+psycopg2', username='tester', database='postgres',
                               query={'host': folder})
            for label, ref in [('dev', 'origin/dev'),
                               ('mobile', 'origin/mobile-app'), ('coc', 'test-it-and-coc')]:
                engine = sa.create_engine(url)
                with engine.begin() as conn:
                    conn.execute(sa.text('DROP SCHEMA public CASCADE'))
                    conn.execute(sa.text('CREATE SCHEMA public'))
                engine.dispose()
                app = Flask(label)
                app.config.update(TESTING=True, SQLALCHEMY_DATABASE_URI=url)
                db.init_app(app)
                Migrate(app, db)
                with app.app_context():
                    has_teams = False
                    if ref:
                        original = temp / label
                        for name in run('git', 'ls-tree', '-r', '--name-only', ref, 'backend/app', 'backend/migrations').splitlines():
                            path = original / Path(name).relative_to('backend')
                            path.parent.mkdir(parents=True, exist_ok=True)
                            path.write_text(run('git', 'show', f'{ref}:{name}'))
                        # Historical migrations cannot bootstrap an empty DB (priorities
                        # is altered before it is created). Build a representative source-
                        # branch schema from its models, stamp ONLY this disposable fixture,
                        # then exercise the real integrated upgrade from that starting state.
                        fixture = """import sys, pkgutil, importlib
from unittest.mock import patch
sys.path.insert(0, sys.argv[1])
with patch('dotenv.load_dotenv'):
    from app import db
import app.models
for mod in pkgutil.iter_modules(app.models.__path__):
    importlib.import_module('app.models.' + mod.name)
from flask import Flask
app = Flask('source-schema')
app.config['SQLALCHEMY_DATABASE_URI'] = sys.argv[2]
db.init_app(app)
with app.app_context():
    db.create_all()
"""
                        run(sys.executable, '-c', fixture, str(original), url.render_as_string(hide_password=False))
                        source_config = Config()
                        source_config.set_main_option('script_location', str(original / 'migrations'))
                        source_head, = ScriptDirectory.from_config(source_config).get_heads()
                        stamp(directory=str(ROOT / 'backend/migrations'), revision=source_head)
                        db.session.execute(sa.text("INSERT INTO users (id,username,password_hash,full_name,role,is_active,presence_status) VALUES (900,'migration-user','unused','Preserve Me','Staff',true,'online')"))
                        has_teams = sa.inspect(db.engine).has_table('teams')
                        if has_teams:
                            db.session.execute(sa.text("INSERT INTO teams(id,name,code,is_active) VALUES (7,'IT','IT',true),(12,'Corcom','COC',true)"))
                            db.session.execute(sa.text("INSERT INTO user_teams(user_id,team_id) SELECT 900,id FROM teams WHERE code='COC'"))
                        team_column = ',team_id' if has_teams else ''
                        team_value = ',12' if has_teams else ''
                        db.session.execute(sa.text(
                            "INSERT INTO tickets (id,ticket_code,code_counter,title,description,status,priority,category,submitter_name" + team_column + ") "
                            "VALUES (901,'FIN-901',901,'Preserve Ticket','Details','New','medium','Other','Requester'" + team_value + ")"
                        ))
                        db.session.commit()
                    upgrade(directory=str(ROOT / 'backend/migrations'))
                    inspector = sa.inspect(db.engine)
                    assert inspector.has_table('teams') and inspector.has_table('user_teams')
                    for table in ('tickets', 'categories', 'statuses'):
                        assert 'team_id' in {c['name'] for c in inspector.get_columns(table)}
                    assert db.session.execute(sa.text('SELECT version_num FROM alembic_version')).scalars().all() == ['m7a8b9c0d1e2']
                    if ref:
                        assert db.session.execute(sa.text('SELECT full_name FROM users WHERE id=900')).scalar() == 'Preserve Me'
                        codes = db.session.execute(sa.text('SELECT code FROM teams JOIN user_teams ON teams.id=team_id WHERE user_id=900')).scalars().all()
                        assert codes == (['COC'] if has_teams else ['IT']), codes
                        ticket = db.session.execute(sa.text('SELECT title,code FROM tickets JOIN teams ON teams.id=tickets.team_id WHERE tickets.id=901')).one()
                        assert tuple(ticket) == ('Preserve Ticket', 'COC' if has_teams else 'IT'), ticket
                    upgrade(directory=str(ROOT / 'backend/migrations'))
                    print(f'PASS: PostgreSQL {label} -> integrated single head; schema, data, memberships and repeat upgrade preserved')
                    db.session.remove()
                    db.engine.dispose()
        finally:
            run(pg_ctl, '-D', str(data), '-m', 'fast', '-w', 'stop')


if __name__ == '__main__':
    check()
