import { spawn, type ChildProcess } from 'node:child_process'
import { cp, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { app } from 'electron'

/**
 * Privileged authoring host: runs a single Vite dev server for the Presenter so
 * the editor can show a live (HMR) preview while a presentation's code is edited.
 * Dev-only (needs the source tree); not available in a packaged build yet.
 */
let proc: ChildProcess | null = null
let url: string | null = null
let starting: Promise<string> | null = null

function presenterDir(): string {
  return resolve(app.getAppPath(), '../../tools/presenter')
}
function presentationsDir(): string {
  return join(presenterDir(), 'src/presentations')
}
function templateDir(): string {
  // Outside src/ so it isn't type-checked or globbed in place; copied into
  // src/presentations/<id>/ where its relative imports (../../engine) resolve.
  return join(presenterDir(), 'template')
}

const USER_PREFIX = 'u-'

/** Scaffold a new code presentation folder from the template. */
export async function createPresentation(name: string): Promise<{ id: string }> {
  const id = USER_PREFIX + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const dest = join(presentationsDir(), id)
  await cp(templateDir(), dest, { recursive: true })
  await writeFile(join(dest, 'presentation.json'), JSON.stringify({ id, name }, null, 2), 'utf8')
  return { id }
}

/** Remove a user presentation folder (only ids with the user prefix). */
export async function deletePresentation(id: string): Promise<void> {
  if (!id.startsWith(USER_PREFIX)) throw new Error('refusing to delete a non-user presentation')
  await rm(join(presentationsDir(), id), { recursive: true, force: true })
}

export function getPreviewUrl(): Promise<string> {
  if (url) return Promise.resolve(url)
  if (starting) return starting
  if (app.isPackaged)
    return Promise.reject(new Error('authoring dev server only available when running from source'))

  starting = new Promise<string>((res, rej) => {
    let settled = false
    const done = (u: string): void => {
      if (settled) return
      settled = true
      url = u
      res(u)
    }
    const fail = (e: Error): void => {
      if (settled) return
      settled = true
      starting = null
      rej(e)
    }

    const dir = presenterDir()
    const bin = join(dir, 'node_modules/.bin/vite')
    // No --strictPort: if 5199 is busy (e.g. an orphaned dev server) Vite picks
    // the next free port; we parse whatever URL it prints.
    proc = spawn(bin, ['--port', '5199'], { cwd: dir, env: process.env })

    const scan = (buf: Buffer): void => {
      const m = buf.toString().match(/(http:\/\/localhost:\d+\/)/)
      if (m) done(m[1])
    }
    proc.stdout?.on('data', scan)
    proc.stderr?.on('data', scan)
    proc.on('error', fail)
    proc.on('exit', (code) => {
      proc = null
      if (!settled) {
        fail(new Error(`dev server exited before starting (code ${code})`))
      } else {
        // Server died after running; allow a fresh start next time.
        url = null
        starting = null
      }
    })
    setTimeout(() => fail(new Error('dev server start timeout')), 25000)
  })
  return starting
}

export function stopAuthoring(): void {
  if (proc) proc.kill()
  proc = null
  url = null
  starting = null
}
