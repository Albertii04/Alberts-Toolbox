# Alberts Toolbox

An open-source **Electron toolbox** — a desktop shell that hosts many small,
independent **web tools**. Each tool is sandboxed in its own view and can only
use native capabilities it declares; a git-based marketplace lets anyone publish
a tool by pull request. The first tool is a presentation deck (`primlux.deck`).

> Status: **phase 1**. The shell boots, lists tools, and runs the deck in an
> isolated view with the capability broker wired. Marketplace install of
> third-party tools comes in a later phase. See [`docs/DESIGN.md`](docs/DESIGN.md)
> and [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Monorepo layout

```
apps/shell              Electron shell (main + preload + Vue renderer)
packages/sdk            @toolbox/sdk — manifest schema, capabilities, window.toolbox typings
packages/tool-host      @toolbox/tool-host — node-side tool registry
tools/deck              the presentation deck, as tool #1
templates/tool-starter  copy-to-start minimal tool (build-free)
registry/index.json     marketplace catalog (stub of the future public registry)
docs/                   specs and design docs
```

## Develop

```bash
pnpm install
pnpm build            # turbo: sdk → tool-host → tools → shell
pnpm dev              # launch the Electron shell (loads built tools)
```

Tools are loaded as **built artifacts**, so build the workspace before
`pnpm dev`. To iterate on the deck's own UI in a browser: `pnpm dev:deck`.

## Write a tool in two minutes

1. Copy `templates/tool-starter/` into `tools/<your-tool>/`.
2. Edit `toolbox.json` (`id`, `name`, `entry`) and `index.html`.
3. Need native features (files, network, notifications…)? Add them to
   `capabilities` in the manifest and call `window.toolbox`. Anything not
   declared is denied by the broker.
4. `pnpm build && pnpm dev` — your tool shows up in the sidebar.

A pure-web tool (`"capabilities": []`) is fully sandboxed and needs no build
tooling at all — just a manifest and an HTML file.

## Package desktop binaries

```bash
pnpm --filter @toolbox/shell package   # dmg / zip / nsis / AppImage
```

Or tag a release (`v0.1.0`) on `main` and CI builds all platforms — see
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT.
