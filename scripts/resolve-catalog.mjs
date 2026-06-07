#!/usr/bin/env node
/**
 * Catalog resolver. Reads the thin authoring catalog (registry/index.json) and
 * expands every `native` app that declares a GitHub `source` into a concrete
 * entry — version, per-platform download URLs, release notes, screenshots and
 * metrics — using the GitHub API. Writes registry/resolved.json, which the
 * shell fetches at runtime (static = no rate limits, no token in the app).
 *
 * Run locally: `node scripts/resolve-catalog.mjs` (set GITHUB_TOKEN to lift the
 * 60 req/h unauthenticated limit). In CI a scheduled workflow runs it with the
 * built-in GITHUB_TOKEN (5000 req/h) and publishes the result.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'registry/index.json')
const OUT = join(root, 'registry/resolved.json')

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
const BADGE_HOSTS =
  /shields\.io|badgen\.net|badge\.fury|travis-ci|circleci|codecov|sonarcloud|api\.codacy|repology\.org|flathub\.org\/.*badge|snapcraft\.io\/.*badge|buymeacoffee|liberapay\.com\/.*badge|opencollective\.com\/.*badge|githubusercontent\.com\/.*\/workflows/i

// Only these GitHub API path shapes may be requested. The host is hardcoded
// and the path is allowlisted, so catalog-derived values (e.g. "owner/repo")
// can never redirect the request to an arbitrary URL — they are constrained to
// read-only metadata of a public repo.
const ALLOWED_PATH =
  /^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\/releases(\/latest)?|\/readme)?(\?per_page=\d+)?$/

async function gh(path) {
  if (!ALLOWED_PATH.test(path)) throw new Error(`refusing disallowed API path: ${path}`)
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'alberts-toolbox-resolver',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const remaining = res.headers.get('x-ratelimit-remaining')
    const hint = remaining === '0' ? ' (rate limit — set GITHUB_TOKEN)' : ''
    throw new Error(`GET ${path} -> HTTP ${res.status}${hint}`)
  }
  return res.json()
}

function extractImages(...markdowns) {
  const urls = new Set()
  for (const md of markdowns) {
    if (!md) continue
    for (const m of md.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) urls.add(m[1])
    for (const m of md.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi)) urls.add(m[1])
  }
  return [...urls].filter((u) => !BADGE_HOSTS.test(u)).slice(0, 6)
}

function assertRepo(repo) {
  if (typeof repo !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))
    throw new Error(`invalid source.github (expected "owner/repo"): ${repo}`)
  return repo
}

async function resolveGithub(source) {
  const repo = assertRepo(source.github)
  const repoData = await gh(`/repos/${repo}`)

  let release
  if (source.prereleases) {
    const list = await gh(`/repos/${repo}/releases?per_page=15`)
    release = list.find((r) => !r.draft)
  } else {
    release = await gh(`/repos/${repo}/releases/latest`)
  }
  if (!release) throw new Error(`no releases for ${repo}`)

  const downloads = {}
  const missing = []
  for (const [pa, rx] of Object.entries(source.assets)) {
    let re
    try {
      re = new RegExp(rx, 'i') // asset names are matched case-insensitively
    } catch {
      missing.push(`${pa}(bad regex)`)
      continue
    }
    const asset = (release.assets || []).find((a) => re.test(a.name))
    if (asset) downloads[pa] = { url: asset.browser_download_url }
    else missing.push(pa)
  }

  let readme = ''
  try {
    const r = await gh(`/repos/${repo}/readme`)
    readme = Buffer.from(r.content || '', r.encoding || 'base64').toString('utf8')
  } catch {
    /* no README — fine */
  }

  return {
    version: String(release.tag_name || '').replace(/^v/, '') || release.tag_name,
    downloads,
    notes: release.body || undefined,
    images: extractImages(readme, release.body),
    publishedAt: release.published_at || undefined,
    description: repoData.description || undefined,
    metrics: {
      repo: repoData.html_url,
      stars: repoData.stargazers_count,
      lastCommit: repoData.pushed_at,
    },
    resolvedFrom: repo,
    warning: missing.length ? `no asset matched: ${missing.join(', ')}` : undefined,
  }
}

async function main() {
  const catalog = JSON.parse(await readFile(SRC, 'utf8'))
  const apps = []

  for (const app of catalog.apps || []) {
    const base = {
      id: app.id,
      kind: app.kind || 'web',
      name: app.name,
      description: app.description,
      author: app.author,
      icon: app.icon,
      replaces: app.replaces,
      version: app.version,
      installers: app.installers,
      downloads: app.downloads,
      metrics: app.metrics,
      resolvedFrom: 'manual',
      resolvedAt: new Date().toISOString(),
    }

    if (app.source?.github) {
      try {
        const r = await resolveGithub(app.source)
        Object.assign(base, {
          version: r.version,
          downloads: { ...(app.downloads || {}), ...r.downloads },
          notes: r.notes,
          images: r.images,
          publishedAt: r.publishedAt,
          description: app.description || r.description,
          metrics: { ...(r.metrics || {}), ...(app.metrics || {}) },
          resolvedFrom: r.resolvedFrom,
          warning: r.warning,
        })
        console.log(`resolved ${app.id} <- ${app.source.github} @ ${base.version}` + (r.warning ? ` [${r.warning}]` : ''))
      } catch (e) {
        base.warning = String(e.message || e)
        console.warn(`WARN ${app.id}: ${base.warning}`)
      }
    } else {
      console.log(`passthrough ${app.id} (${base.resolvedFrom})`)
    }

    apps.push(base)
  }

  const out = { version: 1, generatedAt: new Date().toISOString(), apps }
  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(`\nwrote ${OUT} (${apps.length} apps)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
