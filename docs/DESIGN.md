# Alberts Toolbox — design

## Summary

**Setapp for open-source software.** A desktop app to discover, compare, install
and run high-quality open-source alternatives to paid/subscription software —
without the usual technical complexity.

The product is a **curated catalog** with one **Install** button and one **My
apps** view. An app is delivered in one of two ways, declared by its manifest
`kind` — and this single abstraction is what keeps the hybrid one product, not
two:

- **`native`** — installed on the user's machine by orchestrating the OS package
  manager (Homebrew / winget / Scoop / Flatpak). This covers the heavyweight
  desktop OSS (GIMP, LibreOffice, Blender…) that *is* the point of the vision.
  We do **not** build an installer from scratch; we wrap managers users already
  trust. Our value = curation + the "replaces paid app X" mapping + quality/
  security/maintenance metrics + one-click.
- **`web`** — a small app that runs *inside* the shell in a sandboxed
  `WebContentsView`, touching only the native capabilities it declares, brokered
  by the shell. The AI **Presenter** is the first `web` app and dogfoods the
  "publish your own app" pillar.

Chosen approach: **isolated views + git registry + package-manager orchestration**.
Isolated views are the only model that safely runs untrusted `web` apps (*public +
untrusted + native-capable + no backend*); package-manager orchestration is the
only realistic way for one team to deliver native cross-platform OSS install.

## Goals

- **One product, two backends.** A single catalog / Install / My-apps surface;
  `kind` picks `web` (broker) or `native` (package manager). The user never sees
  the seam.
- A `web` app is **fast to author** — minimum viable app is a `toolbox.json` +
  one HTML file, no build step required.
- `web` apps are **isolated** — an app cannot read another app's data, touch the
  shell, or reach native APIs it didn't declare.
- `native` install is **trustworthy and transparent** — show the exact
  package-manager command, detect the OS, stream progress, never run an opaque
  binary we fetched ourselves.
- The catalog needs **no server** — a JSON index in a GitHub repo, contribution
  via PR.
- Cross-platform packaged binaries (mac / win / linux) via automated releases.

## Non-goals (for now)

- Managed hosting, in-app creation, accounts/auth, donations/dev-portal,
  server-side search, paid listings — **later wedges**, not v1.
- Third-party `web` app install from day one — **first-party first**; arbitrary
  install lands once the broker is hardened and the capability-consent UI exists.
- Shipping our own copies of native OSS binaries — we orchestrate the user's
  package manager, we are not a mirror/CDN.
- Code signing / notarization of `web` app bundles (SHA-pinning + PR review for now).

## Architecture

Monorepo, pnpm workspaces + Turborepo:

```
apps/shell             Electron app (main + preload + Vue renderer)
packages/sdk           manifest schema, capability model, window.toolbox typings, IPC channel names
packages/tool-host     node-side app registry (scan folders, validate manifests)
tools/presenter        the AI presentation builder, first `web` app
templates/tool-starter copy-to-start minimal `web` app
registry/index.json    catalog (web + native entries; stub of the public registry)
```

### Processes & isolation

- **Main process** owns lifecycle, the tool manager, the capability broker, and
  all native implementations.
- **Shell renderer** (Vue) draws a fixed 248px sidebar + content area (home grid
  / marketplace). It talks to main through `window.shellApi` (a dedicated
  preload), never through the tool API.
- **Each tool** runs in its own `WebContentsView` with `sandbox: true`,
  `contextIsolation: true`, `nodeIntegration: false`. The view is positioned to
  the right of the sidebar; only one tool is visible at a time. The shell
  renderer (and thus the sidebar) is never covered, so navigation/close always
  works.

### The capability spine

1. A tool declares `capabilities` in `toolbox.json`. `[]` = pure web, can do
   nothing native.
2. The tool's preload injects `window.toolbox`; every method is async and
   `ipcRenderer.invoke`s a namespaced channel.
3. The **broker** in main maps each tool view's `webContents.id` → its manifest.
   On every call it looks up the manifest and rejects (`CAPABILITY_DENIED`) if
   the capability wasn't declared. This check is the single security spine.

Capabilities: `fs.read`, `fs.write`, `dialog`, `shell.open`, `clipboard`,
`storage`, `net` (domain-allowlisted), `notifications`, `gpu`.

- **`net`** requires an explicit `{ name: 'net', domains: [...] }` allowlist; the
  broker blocks any host not in it.
- **`storage`** is always scoped to the tool's id (one JSON file per tool under
  `userData/tool-storage/`); tools cannot read each other's keys.

### Tool loading

`tool-host` scans a directory of tool folders, validates each `toolbox.json`
against the schema, resolves the built `entry` to a `file://` URL. Builtin tools
live in `tools/` (dev) or `resources/tools/` (packaged). Installed tools (future)
live in `userData/tools/`.

### Catalog (git-based, no backend)

- Catalog = `registry/index.json`, eventually its own public repo. Every entry is
  an **app** with a `kind`. Shared fields: id, name, version, description, author,
  icon URL, `replaces` (the paid product this is an alternative to), `metrics`
  (GitHub stars, last commit, open CVEs — refreshed out of band).
- **`web` entry** adds: `capabilities`, download URL (a GitHub Release zip of the
  built app), sha256.
- **`native` entry** adds: `installers` — a per-OS map of package-manager refs,
  e.g. `{ "brew": "gimp", "winget": "GIMP.GIMP", "flatpak": "org.gimp.GIMP" }`.
- Discover: shell fetches the index, renders one grid; filter by "replaces X".
- Install:
  - `web` → download zip → verify SHA → unzip into `userData/tools/<id>/` → read
    manifest → capability-consent prompt → enable.
  - `native` → detect OS → resolve the installer ref → run the package manager as
    a child process, streaming progress; show the exact command first.
- My apps: installed `web` apps + detected `native` installs; update / uninstall
  through the same backend that installed them.
- Publish: contributor PRs an entry. `web` apps attach a release; `native` apps
  just reference existing package-manager ids. Merge = listed.

### Native installer service

Lives in main. Responsibilities: detect the platform and which managers are
present; map an `installers` entry to a concrete command; spawn `brew` /
`winget` / `scoop` / `flatpak` and stream stdout/stderr as progress; report
installed/updatable state for "My apps". Security posture: only ever runs a known
package manager with a catalog-vetted package id — never an arbitrary fetched
binary — and surfaces the command to the user before running it.

## Build, dev, packaging

- `pnpm build` → Turborepo builds `sdk` → `tool-host` → `tools/*` → `shell`.
- Shell uses `electron-vite` (main / preload / renderer in one config). Two
  preload entries: `shell` (window.shellApi) and `tool` (window.toolbox).
  Sandboxed preloads must be emitted as CommonJS.
- Tools are loaded as **built artifacts** (`file://` to `dist/index.html`) — a
  tool's Vite `base` must be `./` so assets resolve under `file://`.
- `pnpm --filter @toolbox/shell package` → electron-builder produces
  dmg/zip/nsis/AppImage; builtin tools ship via `extraResources`.

## Gitflow & CI

- Branches: `main` (release), `develop` (integration, default), `feature/*`.
- `.github/workflows/ci.yml` — on PR and pushes to main/develop: install, build,
  typecheck, lint.
- `.github/workflows/release.yml` — on `v*` tag: matrix-build packaged binaries
  for mac/win/linux and attach to a GitHub Release.

## Phasing

**Done:** monorepo + Turborepo + gitflow + CI/release workflows; SDK + tool-host
contracts; Electron shell that boots, lists apps, and loads `web` apps in
isolated views with the full broker wired; the AI Presenter (`web` app) working
end-to-end; catalog as a read-only stub; tool-starter template.

**Wedge v1 — desktop one-click install (now):** extend the manifest/registry with
`kind`, `replaces`, `installers`, `metrics`; native installer service
(start with `brew`, then `winget`/`flatpak`); discovery grid with "replaces X"
filter; Install button; "My apps" (installed / update / uninstall). Seed ~10–30
real OSS apps mapped to the paid products they replace.

**Next:** live catalog fetch from the public registry repo; third-party `web`
install (download → SHA verify → capability consent → enable); metric refresh.

**Later wedges:** developer portal (publish, donations, support/services);
managed hosting; in-app creation; signing/notarization + auto-update.

## Risks / open questions

- **WebContentsView layout** across multi-DPI / fullscreen / devtools — needs
  testing on real hardware.
- **fs.read/write** currently trust the path the tool passes (gated only by the
  capability). A later phase may narrow this to dialog-granted paths only.
- electron-vite ↔ Vite major-version alignment with the deck's Vite 8 — isolated
  per package by pnpm, but watch for hoisting issues.
