from app import db


# Association table: user <-> team (many-to-many).
# Satu user boleh jadi anggota lebih dari satu team.
user_teams = db.Table(
    'user_teams',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('team_id', db.Integer, db.ForeignKey('teams.id'), primary_key=True)
)


class Team(db.Model):
    """Workspace/board pemilik ticket (IT, Graphic Design, ...).

    BUKAN department submitter — Department adalah identitas pemohon.
    `code` dipakai sebagai penanda kolom `Ticket.team_id` (mis. 'IT', 'COC').
    """
    __tablename__ = 'teams'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    code = db.Column(db.String(20), unique=True, nullable=False, index=True)
    slug = db.Column(db.String(100), unique=True, nullable=True)
    description = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True)

    # Members (many-to-many). lazy='select' (bukan dynamic) agar backref
    # User.teams berupa list yang bisa di-set langsung (user.teams = [...]).
    members = db.relationship('User', secondary=user_teams, backref=db.backref('teams', lazy='select'))

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'slug': self.slug,
            'description': self.description,
            'isActive': self.is_active if self.is_active is not None else True,
        }

    def __repr__(self):
        return f'<Team {self.code}>'
