/**
 * Catalog fetch for the storefront. Reads the resolved catalog the resolver
 * publishes to the `catalog-data` branch (concrete versions, downloads, notes,
 * metrics). In dev it prefers a locally-generated registry/resolved.json so you
 * can iterate without a round-trip; in production it fetches the published file.
 */
import { app, net } from 'electron'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ResolvedApp, ResolvedCatalog } from '@toolbox/sdk'

const CATALOG_URL =
  'https://raw.githubusercontent.com/Albertii04/Alberts-Toolbox/catalog-data/registry/resolved.json'

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolveP, reject) => {
    const req = net.request(url)
    req.on('response', (res) => {
      const status = res.statusCode ?? 0
      if (status >= 400) {
        reject(new Error(`HTTP ${status}`))
        return
      }
      let body = ''
      res.on('data', (d: Buffer) => (body += d.toString()))
      res.on('end', () => {
        try {
          resolveP(JSON.parse(body))
        } catch (e) {
          reject(e as Error)
        }
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

export async function getCatalog(): Promise<ResolvedApp[]> {
  // dev: a locally-resolved catalog (run scripts/resolve-catalog.mjs) wins.
  if (!app.isPackaged) {
    try {
      const local = resolve(app.getAppPath(), '../../registry/resolved.json')
      const raw = await readFile(local, 'utf8')
      return (JSON.parse(raw) as ResolvedCatalog).apps ?? []
    } catch {
      /* no local file — fall through to the published catalog */
    }
  }
  try {
    const data = (await fetchJson(CATALOG_URL)) as ResolvedCatalog
    return data.apps ?? []
  } catch {
    return []
  }
}
