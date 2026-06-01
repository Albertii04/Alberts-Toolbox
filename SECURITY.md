# Security policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Instead, use GitHub's
private vulnerability reporting:

- Go to the repository's **Security** tab → **Report a vulnerability**.

Include reproduction steps and the affected version/commit. You'll get an
acknowledgement and a fix timeline.

## Scope

This project runs untrusted, user-installed tools. The core of its security model
is the **capability broker** (`apps/shell/src/main/broker.ts`) and per-tool
isolation (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`).
Reports that demonstrate a tool escaping its declared capabilities, reaching the
shell, or reading another tool's data are especially valuable.
