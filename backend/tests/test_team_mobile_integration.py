"""Combined workspace/SLA/deadline/break regression on disposable SQLite."""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app import create_app, db
from app.models.team import Team
from app.models.user import User
from app.models.ticket import Ticket
from app.models.master_data import Category, Department, Status, BreakSetting, BreakLog
from app.models.notification import Notification
from app.services.ticket_service import TicketService
from app.services.notification_service import NotificationService
from app.services.break_service import auto_end_expired_breaks


def test_combined_workspace_flow():
    app = create_app('development', config_overrides={
        'TESTING': True, 'SQLALCHEMY_DATABASE_URI': 'sqlite://', 'SQLALCHEMY_ECHO': False,
        'JWT_SECRET_KEY': 'integration-test-secret-at-least-32-characters',
    })
    client = app.test_client()
    with app.app_context(), patch('app.services.email_service.EmailService.send_ticket_confirmation'), patch('app.services.push_service.dispatch_push_async') as push:
        db.create_all()
        it = Team(id=2, name='IT', code='IT', is_active=True)
        coc = Team(id=7, name='Corcom', code='COC', is_active=True)
        users = []
        for username, role, teams in [('it', 'Staff', [it]), ('coc', 'Staff', [coc]),
                                      ('admin', 'Administrator', []), ('none', 'Staff', [])]:
            user = User(username=username, full_name=username, role=role, teams=teams)
            user.set_password('test-password')
            users.append(user)
        db.session.add_all(users + [
            Department(name='Finance', code='FIN'),
            Category(name='Hardware', team_id=2, is_active=True),
            Category(name='Artwork', team_id=7, is_active=True),
            Status(name='New', is_default=True, filter_group='new'),
            Status(name='Assigned', filter_group='progress'),
            Status(name='In Progress', filter_group='progress'),
            Status(name='Resolved', filter_group='done'),
            BreakSetting(name='Default', work_start_time='08:00', work_end_time='17:00', daily_max_minutes=20),
        ])
        db.session.commit()
        headers = {}
        for user in users:
            response = client.post('/api/auth/login', json={'username': user.username, 'password': 'test-password'})
            assert response.status_code == 200, response.json
            headers[user.username] = {'Authorization': f"Bearer {response.json['token']}"}
        tickets = {}
        for code, category in [('IT', 'Hardware'), ('COC', 'Artwork')]:
            response = client.post('/api/tickets', json={
                'title': f'{code} integration', 'description': 'Combined regression',
                'submitterName': 'Requester', 'submitterDepartment': 'Finance',
                'category': category, 'teamCode': code, 'deadline': '2099-12-01T12:30:00+07:00',
            })
            assert response.status_code == 201, response.json
            tickets[code] = response.json['ticket']
        for username, code in [('it', 'IT'), ('coc', 'COC')]:
            own, other = tickets[code], tickets['COC' if code == 'IT' else 'IT']
            response = client.get('/api/tickets', headers=headers[username])
            assert [t['teamCode'] for t in response.json['tickets']] == [code]
            response = client.get('/api/tickets/stats', headers=headers[username])
            assert response.status_code == 200, response.json
            stats = response.json['stats']
            assert stats['total'] == 1 and sum(stats['byCategory'].values()) == 1, stats
            assert set(stats['byCategory']) == {own['category']}, stats
            assert client.get(f"/api/tickets?teamId={other['teamId']}", headers=headers[username]).status_code == 403
            assert client.put(f"/api/tickets/{other['id']}", headers=headers[username], json={'title': 'blocked'}).status_code == 403
            public = client.get(f"/api/tickets/{other['ticketCode']}", headers=headers[username]).json['ticket']
            assert public['hasStaffAccess'] is False and public['submitterDepartment'] is None
            response = client.put(f"/api/tickets/{own['id']}/assign", headers=headers[username], json={'userId': users[0 if code == 'IT' else 1].id})
            assert response.status_code == 200, response.json
            assigned = response.json['ticket']
            assert assigned['slaDeadline']
            if code == 'COC':
                assert assigned['slaDeadline'] == own['slaDeadline']
            else:
                assert assigned['takenAt'] and assigned['firstRespondedAt']
        assert client.get('/api/tickets', headers=headers['none']).json['total'] == 0
        assert client.get('/api/tickets/stats', headers=headers['none']).json['stats']['byCategory'] == {}
        assert client.get('/api/users/performance', headers=headers['none']).json['performance'] == []
        assert client.get('/api/tickets', headers=headers['admin']).json['total'] == 2
        # COC countdown must continue despite staff break and a stale SLA pause.
        creative = db.session.get(Ticket, tickets['COC']['id'])
        creative.sla_deadline = datetime.now(timezone.utc) + timedelta(minutes=5)
        creative.sla_paused_at = datetime.now(timezone.utc) - timedelta(hours=3)
        users[1].is_on_break = True
        users[1].break_started_at = datetime.now(timezone.utc) - timedelta(hours=2)
        db.session.commit()
        NotificationService.check_and_generate_sla_notifications(force=True, cooldown_seconds=0)
        assert Notification.query.filter_by(ticket_id=creative.id, type='deadline_warning').count() == 1
        NotificationService.check_and_generate_sla_notifications(force=True, cooldown_seconds=0)
        assert Notification.query.filter_by(ticket_id=creative.id, type='deadline_warning').count() == 1
        assert any(call.args[2]['type'] == 'deadline_warning' for call in push.call_args_list)
        # A stale IT break is capped at its own day's shift end, with one log only.
        users[1].is_on_break = False
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        started = yesterday.replace(hour=9, minute=0, second=0, microsecond=0)
        users[0].is_on_break = True
        users[0].break_started_at = started
        db.session.commit()
        assert auto_end_expired_breaks() == 1
        assert auto_end_expired_breaks() == 0
        log = BreakLog.query.filter_by(user_id=users[0].id).one()
        assert log.duration_seconds == 3600
        assert not users[0].is_on_break
        print('PASS: login, team isolation, stats, shared tracking, IT assignment SLA, COC deadline/push dedupe, break cap')
        db.session.remove()
        db.drop_all()
