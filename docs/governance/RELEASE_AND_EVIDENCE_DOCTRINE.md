# Release and Evidence Doctrine

`If it was not run, it cannot be claimed.`

Evidence must identify command, working directory, Node/npm versions where relevant, environment, start/end time, exit code, result as PASS/FAIL/BLOCKED, important warnings, and log path. Static inspection can support architecture claims but cannot be represented as runtime proof. Blocked commands remain BLOCKED; do not substitute a different command.

Evidence file types: `.md`, `.txt`, `.log`, `.json`, `.csv`, and small redacted `.png` screenshots when they prove UI state. Do not commit large binaries or uncontrolled traces. Command logs should be concise and may redact secrets. Every evidence item must link to a source commit or branch and must avoid private farm data.
