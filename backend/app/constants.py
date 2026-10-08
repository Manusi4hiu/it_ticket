"""
Application-wide constants.

Centralizing magic strings here prevents silent failures when values
change — update once and all usages break loudly at import time.
"""

# ---------------------------------------------------------------------------
# Ticket Categories
# ---------------------------------------------------------------------------
# The name of the internal development category.  Tickets in this category
# are treated differently (e.g. hidden from the helpdesk view).
DEV_CATEGORY = "Development"

# ---------------------------------------------------------------------------
# Ticket Statuses
# ---------------------------------------------------------------------------
# Statuses that are considered "resolved / completed" for SLA calculations
# and reporting purposes.
RESOLVED_STATUSES = ["resolved", "closed", "completed"]

# ---------------------------------------------------------------------------
# SLA defaults (hours) — used as a last-resort fallback when no SLAPolicy
# record is found for a given priority/category combination.
# ---------------------------------------------------------------------------
SLA_HOURS_DEFAULT: dict[str, int] = {
    "critical": 4,
    "high": 8,
    "medium": 24,
    "low": 48,
}
SLA_HOURS_FALLBACK = 24  # used when priority name is unknown

# ---------------------------------------------------------------------------
# User Roles
# ---------------------------------------------------------------------------
ROLE_ADMINISTRATOR = "Administrator"
ROLE_MANAGEMENT = "Management"
ROLE_STAFF = "Staff"

ROLES_ALL = [ROLE_ADMINISTRATOR, ROLE_MANAGEMENT, ROLE_STAFF]

# ---------------------------------------------------------------------------
# Teams (workspace/board pemilik ticket — BUKAN department submitter)
# ---------------------------------------------------------------------------
# `code` adalah identitas team (IT / COC) untuk penanda kolom Ticket.team_id.
# TIDAK dipakai untuk membuat ticket_code (ticket_code = counter global).
TEAM_IT_CODE = "IT"
TEAM_COC_CODE = "COC"   # graphic design team
TEAM_DEFAULT_CODE = TEAM_IT_CODE

# ---------------------------------------------------------------------------
# Ticket Code — SATU master counter global untuk semua team.
# Format: TCK-000001 (prefix tetap + counter global 6 digit).
# Kode lama ({dept_code}-{counter}) dibiarkan historis, tidak dinormalisasi.
# ---------------------------------------------------------------------------
TICKET_CODE_PREFIX = "TCK"
TICKET_CODE_PADDING = 6
