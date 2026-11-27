# Mobile + IT/Corcom integration

Integration branch: `integration/mobile-it-corcom`.
Baseline: `origin/dev` (`9f96c060`), then mobile (`117b8bc7`), then revised IT/COC (`363fdc6e`).
No merge into dev, push, deployment, or live database operation is part of this work.

## Preserved behavior

- IT request at `/submit-ticket`; Corcom request at `/corcom/submit-ticket`; one shared form and server-owned destination.
- Two home entry buttons, shared tracking by ticket code, legacy team-link redirects.
- Public tracking keeps mobile privacy guards: numeric enumeration blocked, contacts/department redacted, internal chat hidden.
- Requester department still determines the stored ticket-code prefix; team determines ownership.
- IT uses business-hours SLA after assignment; Corcom retains its explicit deadline and does not pause for staff breaks.
- Team memberships coexist with request-local SSR JWT isolation, mobile layout, PWA, background push, and auto-end break.
- Integration repairs include scoped analytics breakdowns, break response variables/daily quota notifications, dynamic team IDs in calendar/detail, and revision-aware offline precache lookup.

## Migration reconciliation

`k5e6f7a8b9c0` was shipped with different parents on mobile and COC. The integration retains its mobile parent and merges the independent team revision with the mobile history at `m7a8b9c0d1e2`.

`j1e2f3a4b5c6` now recognizes a complete pre-existing team schema and leaves its ownership/memberships untouched. A partial team schema fails closed rather than overwriting records. On a mobile/dev schema without teams, it creates the original team schema and backfills existing users/tickets to IT.

`backend/tests/test_integration_migrations.py` starts a private temporary PostgreSQL cluster using Unix sockets, constructs representative schemas from each source branch's models, stamps only those disposable fixtures at their source head, then runs the actual integrated Alembic upgrade. It verifies a single head, preserved users/tickets/COC memberships, IT backfill, and repeat upgrades. These are NOT production-database copies and do not establish the deployed schema's state.

Historical clean-install blocker: running the complete migration chain on an empty PostgreSQL database fails at `33a2f60380ef`, which alters `priorities` before the migration history creates that table. This predates the integration and is NOT repaired here. Do not call an empty-database install verified or use `stamp` as a production fix.

Before deployment: obtain the target's `alembic_version` and schema state, take a database backup, rehearse the upgrade against a restored copy, and separately validate SMTP and real-device Web Push. Downgrading team migrations deletes team schema; use a reviewed backup/restore rollback, not an unreviewed downgrade.

## Runnable checks

From repository root, after installing the existing backend requirements:

    PYTHONPATH=backend DATABASE_URL=sqlite:// DISABLE_BREAK_AUTO_END=1 ENABLE_HOLIDAY_SCHEDULER=0 JWT_SECRET_KEY=integration-test-secret-at-least-32-characters backend/venv/bin/python -m pytest backend/tests -q
    backend/venv/bin/python backend/tests/test_submit_routing.py
    backend/venv/bin/python backend/tests/test_integration_migrations.py

From `frontend`:

    npm run typecheck
    npm run build
    TZ=UTC NODE_ENV=production SESSION_SECRET=integration-test-session-secret node tests/submit-routing.mjs
    node tests/submit-browser.mjs

Browser checks use the production frontend, Chromium and actual Flask routes/services with disposable SQLite. They exercise both submissions, spoofed destination inputs, shared tracking, production basename redirects, mobile buttons, active service-worker cache cleanup and offline fallback. SMTP is stubbed. The push scheduler tests generate and verify VAPID payloads with the outbound HTTP transport mocked; they do not deliver notifications to real devices.

Build warnings remain for Recharts circular chunks, mixed static/dynamic push imports, and existing unused icon imports. SQLAlchemy legacy API warnings remain. No application dependency was added.
