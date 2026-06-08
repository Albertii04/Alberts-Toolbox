import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { storageDir } from './paths.js'

/**
 * Per-tool key-value storage. Each tool gets its own JSON file keyed by tool id,
 * so tools can never read each other's data. Loaded lazily and cached.
 */
const cache = new Map<string, Record<string, unknown>>()

function safeFile(toolId: string): string {
  // tool ids are validated (lowercase, dotted) so this is already filesystem-safe.
  return join(storageDir(), `${toolId}.json`)
}

async function load(toolId: string): Promise<Record<string, unknown>> {
  const cached = cache.get(toolId)
  if (cached) return cached
  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(await readFile(safeFile(toolId), 'utf8'))
  } catch {
    data = {}
  }
  cache.set(toolId, data)
  return data
}

async function persist(toolId: string, data: Record<string, unknown>): Promise<void> {
  await mkdir(storageDir(), { recursive: true })
  await writeFile(safeFile(toolId), JSON.stringify(data), 'utf8')
}

export const toolStorage = {
  async get(toolId: string, key: string): Promise<unknown> {
    const data = await load(toolId)
    return key in data ? data[key] : null
  },
  async set(toolId: string, key: string, value: unknown): Promise<void> {
    const data = await load(toolId)
    data[key] = value
    await persist(toolId, data)
  },
  async keys(toolId: string): Promise<string[]> {
    return Object.keys(await load(toolId))
  },
  async remove(toolId: string, key: string): Promise<void> {
    const data = await load(toolId)
    delete data[key]
    await persist(toolId, data)
  },
}
