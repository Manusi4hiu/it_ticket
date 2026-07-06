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
