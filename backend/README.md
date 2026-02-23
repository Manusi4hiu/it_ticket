# IT Ticket System - Flask Backend

Backend Flask dengan PostgreSQL untuk sistem IT Ticket.

## Prerequisites

- Python 3.10+
- PostgreSQL 12+

## Quick Setup

### 1. Buat Database PostgreSQL

```bash
# Login ke PostgreSQL
sudo -u postgres psql

# Di dalam psql shell, jalankan:
CREATE DATABASE it_ticket_db;

# Jika perlu, buat user baru (opsional):
CREATE USER your_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE it_ticket_db TO your_user;

# Exit psql
\q
```

### 2. Konfigurasi Environment

Edit file `.env` dan sesuaikan dengan kredensial PostgreSQL Anda:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/it_ticket_db
JWT_SECRET_KEY=your-super-secret-key
```

### 3. Setup Virtual Environment & Install Dependencies

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Initialize Database & Run Migrations

```bash
# Initialize alembic migrations
flask db init

# Generate migration
flask db migrate -m "Initial migration"

# Apply migration
flask db upgrade

# Seed database dengan data awal
python seed.py
```

### 5. Jalankan Server

```bash
python run.py
```

Server akan berjalan di `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user info

### Tickets
- `GET /api/tickets` - Get all tickets
- `GET /api/tickets/<id>` - Get ticket by ID
- `POST /api/tickets` - Create new ticket
- `PUT /api/tickets/<id>` - Update ticket
- `DELETE /api/tickets/<id>` - Delete ticket
- `PUT /api/tickets/<id>/assign` - Assign ticket
- `PUT /api/tickets/<id>/status` - Update status
- `POST /api/tickets/<id>/notes` - Add note
- `GET /api/tickets/stats` - Get statistics

### Users
- `GET /api/users` - Get all users
- `GET /api/users/<id>` - Get user by ID
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/<id>` - Update user
- `DELETE /api/users/<id>` - Delete user (admin only)
- `GET /api/users/<id>/performance` - Get user performance

## Default Users (after seeding)

| Email | Password | Role |
|-------|----------|------|
| john.smith@company.com | john123 | Administrator |
| jane.doe@company.com | jane123 | Management |
| mike.wilson@company.com | mike123 | Staff |
| sarah.connor@company.com | sarah123 | Staff |

## Example API Calls

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "john.smith@company.com", "password": "john123"}'
```

### Get Tickets (with token)
```bash
curl http://localhost:5000/api/tickets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```
