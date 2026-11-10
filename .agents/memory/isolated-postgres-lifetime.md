---
name: Isolated PostgreSQL lifetime
description: Reliable disposable PostgreSQL certification in the Replit execution environment.
---

Keep disposable PostgreSQL startup, certification commands and cleanup in the same shell lifetime.

**Why:** A standalone startup reported success, but the database process disappeared before the subsequent test task connected. Starting PostgreSQL and running certification in one shell with an exit cleanup trap succeeded.

**How to apply:** Use only an explicitly isolated test database and loopback port. Start the database, run the guarded tests, and stop it with an exit trap in the same foreground or background shell task. Never substitute the workspace or production connection.
