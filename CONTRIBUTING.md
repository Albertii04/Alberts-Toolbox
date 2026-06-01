# Contributing

## Gitflow

- `main` — release branch. Always green. Tags are cut here.
- `develop` — integration branch. Features merge here first.
- `feature/<short-name>` — one branch per change, off `develop`.

```bash
git switch develop
git switch -c feature/my-thing
# ...work...
git push -u origin feature/my-thing
# open a PR into develop
```

CI (`.github/workflows/ci.yml`) runs install → build → typecheck → lint on every
PR and on pushes to `main`/`develop`. PRs must be green to merge.

When `develop` is ready to ship, open a PR `develop → main`. After it merges, tag:

```bash
git switch main && git pull
git tag v0.1.0
git push origin v0.1.0
```

The tag triggers `.github/workflows/release.yml`, which builds packaged Electron
binaries (mac/win/linux) and attaches them to a GitHub Release.

## Publishing a tool to the marketplace (future phase)

1. Build your tool to static files with a `toolbox.json`.
2. Attach the built bundle as a zip to a GitHub Release.
3. PR an entry into `registry/index.json` with the download URL and its sha256.
4. On merge, the tool appears in the shell's marketplace.

Until third-party install ships, only first-party tools in `tools/` are loaded.

## Code conventions

- TypeScript, strict. Shared contracts live in `@toolbox/sdk` — change them there.
- Never bypass the capability broker (`apps/shell/src/main/broker.ts`).
- Keep tools isolated: `sandbox: true`, `contextIsolation: true`,
  `nodeIntegration: false`. No exceptions.
