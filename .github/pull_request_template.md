## What

<!-- What does this PR change, and why? -->

## How to test

<!-- Steps to verify locally. -->

## Checklist

- [ ] Targets `develop` (not `main`).
- [ ] `pnpm build`, `pnpm typecheck`, and `pnpm lint` pass locally.
- [ ] No new tool bypasses the capability broker; isolation flags unchanged
      (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`).
- [ ] Docs updated if behaviour or the tool contract changed.
