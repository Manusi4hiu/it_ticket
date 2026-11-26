"""Run: backend/venv/bin/python backend/tests/test_submit_routing.py.

Real Flask routes/services and disposable in-memory SQLite; no app factory,
schedulers, live database, SMTP, or push notifications.
"""
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from flask import Flask
from flask_jwt_extended import JWTManager
# Importing app.config normally loads a local .env; tests must not read it.
with patch('dotenv.load_dotenv'):
    from app import db
from app.models import notification, system_log
from app.models.team import Team
from app.models.master_data import Category, Department
from app.routes.tickets import tickets_bp
from app.services.email_service import EmailService


def check():
    app = Flask(__name__)
    app.config.update(TESTING=True, SQLALCHEMY_DATABASE_URI='sqlite://', JWT_SECRET_KEY='test-only-secret')
    db.init_app(app)
    JWTManager(app)
    app.register_blueprint(tickets_bp, url_prefix='/api/tickets')
    from app.routes.settings import settings_bp
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
    with app.app_context(), patch.object(EmailService, 'send_ticket_confirmation'):
        db.create_all()
        db.session.add_all([
            Team(id=2, code='IT', name='IT', is_active=True),
            Team(id=7, code='COC', name='Graphic Design', is_active=True),
            Team(id=8, code='OFF', name='Inactive', is_active=False),
            Department(name='Finance', code='FIN'),
            Category(name='Other', team_id=None, is_active=True),
            Category(name='Hardware', team_id=2, is_active=True),
            Category(name='Graphic Design', team_id=7, is_active=True),
            Category(name='Old', team_id=None, is_active=False),
        ])
        db.session.commit()
        client = app.test_client()
        def post(**fields):
            return client.post('/api/tickets', json={
                'title': 'Routing check', 'description': 'Details', 'submitterName': 'Requester',
                'submitterDepartment': 'Finance', 'category': 'Other', **fields,
            })
        for fields in [{'teamCode': 'missing'}, {'teamId': 999}, {'teamId': 'bad'}, {'teamCode': 'OFF'}, {'teamId': 2, 'teamCode': 'COC'}]:
            response = post(**fields)
            assert response.status_code == 400, (fields, response.status_code, response.json)
        print('PASS: explicit unknown/inactive/malformed teams rejected')
        for fields in [
            {'teamCode': 'IT', 'category': 'Graphic Design'},
            {'teamCode': 'COC', 'category': 'Hardware', 'deadline': '2099-12-01T12:30:00+07:00'},
            {'category': 'Old'}, {'category': 'missing'},
        ]:
            response = post(**fields)
            assert response.status_code == 400, (fields, response.status_code, response.json)
        print('PASS: category ownership/active master enforced')
        for deadline in [None, '', 'invalid', '2000-01-01T00:00:00Z']:
            response = post(teamCode='COC', deadline=deadline)
            assert response.status_code == 400, (deadline, response.status_code, response.json)
        response = post(teamCode='COC', deadline='2099-12-01T12:30:00+07:00')
        assert response.status_code == 201, response.json
        coc = response.json['ticket']
        assert coc['slaDeadline'] == '2099-12-01T05:30:00Z', coc
        assert coc['submitterDepartment'] == 'Finance' and coc['ticketCode'] == 'FIN-001'
        assert coc['teamId'] == 7 and coc['teamCode'] == 'COC'
        response = post(teamCode='IT', deadline='2099-12-01T12:30:00Z')
        assert response.status_code == 201, response.json
        it = response.json['ticket']
        assert it['slaDeadline'] is None and it['takenAt'] is None, it
        assert it['responseDeadline'] and it['ticketCode'] == 'FIN-002'
        assert it['teamId'] == 2
        from app.services.ticket_service import TicketService
        from app.models.ticket import Ticket
        assert not TicketService.is_graphic_design_ticket(db.session.get(Ticket, it['id']))
        assert TicketService.is_graphic_design_ticket(db.session.get(Ticket, coc['id']))
        for ticket in [it, coc]:
            tracked = client.get(f"/api/tickets/{ticket['ticketCode']}")
            assert tracked.status_code == 200, tracked.json
            assert tracked.json['ticket']['teamCode'] == ticket['teamCode']
            assert tracked.json['ticket']['hasStaffAccess'] is False
            assert client.get(f"/api/tickets/{ticket['id']}").status_code == 404
        from app.models.user import User
        staff = User(username='test-staff', full_name='Test Staff', password_hash='unused', role='Staff')
        db.session.add(staff)
        db.session.commit()
        with app.test_request_context():
            assigned = TicketService.create_ticket({
                'title': 'Assigned IT', 'description': 'Details', 'submitterName': 'Staff',
                'category': 'Other', 'assignedToId': staff.id,
            }, is_authenticated=True)
            assert assigned.team.code == 'IT' and assigned.status == 'Assigned'
            assert assigned.sla_deadline and assigned.taken_at and assigned.first_responded_at
            expected = TicketService.calculate_business_deadline(assigned.taken_at, hours=24)
            assert assigned.sla_deadline == expected.replace(tzinfo=None)
        print('PASS: COC deadline, IT SLA (unassigned/assigned), department numbering, public tracking by code, numeric enumeration blocked')
        if '--serve' in sys.argv:
            from app.models.master_data import Priority
            db.session.add(Priority(name='Medium', level=3, sla_hours=24, response_time_minutes=60, is_active=True))
            db.session.commit()
            app.run(host='127.0.0.1', port=int(sys.argv[-1]), use_reloader=False)



if __name__ == '__main__':
    check()
