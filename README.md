# Alberts Toolbox

**Setapp for open-source software.** A desktop app that helps you *discover,
compare, install and run* high-quality open-source alternatives to paid apps and
subscription services — without the usual technical complexity.

One curated catalog. One **Install** button. One **My apps** view. Behind that
single surface, an app is delivered one of two ways:

- **`native`** — installed on your machine through the OS package manager you
  already trust (Homebrew on macOS, winget/Scoop on Windows, Flatpak on Linux).
  This is how you get the heavyweight desktop OSS — GIMP, LibreOffice, Inkscape,
  Blender, Obsidian…
- **`web`** — lightweight tools that run *inside* the shell in a sandboxed view,
  using only the native capabilities they declare (brokered by the shell). The
  bundled AI **Presenter** is the first such app.

The value isn't the bits (they're free) — it's **curation, discovery, the
"replace paid app X with OSS Y" mapping, quality/security/maintenance metrics,
and one-click setup**.

> **Status: wedge in progress.** The shell boots, lists apps, and runs `web`
> apps in isolated views with the capability broker wired (the AI Presenter
> works end-to-end). The `native` install path (package-manager orchestration),
> the discovery grid, and "My apps" are the current build. See
> [`docs/DESIGN.md`](docs/DESIGN.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Product north star

A curated marketplace of open-source software that lets users replace
proprietary, paid tools with open alternatives in one click, and lets developers
publish their apps, surface quality/maintenance/security metrics, take donations,
and reach a wider audience. Long term: discovery + one-click install + managed
hosting + app creation, in one place.

**Sequencing — one wedge at a time:**

1. **Wedge v1 (now): desktop one-click install.** Curated catalog + install via
   the native package managers + "My apps". Hybrid `web`+`native` under one
   unified app model.
2. Live registry fetch + third-party publish by PR.
3. Developer side: metrics, donations, support/services.
4. Managed hosting + in-app creation.

## Monorepo layout

```
apps/shell              Electron shell (main + preload + Vue renderer)
packages/sdk            @toolbox/sdk — manifest schema, capabilities, window.toolbox typings
packages/tool-host      @toolbox/tool-host — node-side app registry
tools/presenter         the AI presentation builder, first `web` app
templates/tool-starter  copy-to-start minimal web app (build-free)
registry/index.json     catalog (stub of the future public registry)
docs/                   specs and design docs
```

## Develop

```bash
pnpm install
pnpm build            # turbo: sdk → tool-host → tools → shell
pnpm dev              # launch the Electron shell (loads built apps)
```

`web` apps are loaded as **built artifacts**, so build the workspace before
`pnpm dev`. To iterate on the Presenter's own UI in a browser: `pnpm dev:presenter`.

## App kinds

Every catalog entry is an **app** whose manifest declares an install `kind`:

- **`web`** — write one in two minutes: copy `templates/tool-starter/` into
  `tools/<your-app>/`, edit `toolbox.json` (`id`, `name`, `entry`) and
  `index.html`. Need native features (files, network, notifications…)? Declare
  them in `capabilities` and call `window.toolbox`; anything not declared is
  denied by the broker. A pure-web app (`"capabilities": []`) is fully sandboxed
  and needs no build tooling at all.
- **`native`** — an entry that maps the app to the paid product it *replaces* and
  to per-OS install commands (`brew` / `winget` / `flatpak`). The shell detects
  the OS and orchestrates the right package manager; nothing runs inside the
  shell.

## Package desktop binaries

```bash
pnpm --filter @toolbox/shell package   # dmg / zip / nsis / AppImage
```

Or tag a release (`v0.1.0`) on `main` and CI builds all platforms — see
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT.
