import { spawn, type ChildProcess } from 'node:child_process'
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

const PORT = '5199'

function presenterDir(): string {
  return resolve(app.getAppPath(), '../../tools/presenter')
}

export function getPreviewUrl(): Promise<string> {
  if (url) return Promise.resolve(url)
  if (starting) return starting
  if (app.isPackaged)
    return Promise.reject(new Error('authoring dev server only available when running from source'))

  starting = new Promise<string>((res, rej) => {
    const dir = presenterDir()
    const bin = join(dir, 'node_modules/.bin/vite')
    proc = spawn(bin, ['--port', PORT, '--strictPort'], { cwd: dir, env: process.env })
    const scan = (buf: Buffer): void => {
      const m = buf.toString().match(/(http:\/\/localhost:\d+\/)/)
      if (m && !url) {
        url = m[1]
        res(url)
      }
    }
    proc.stdout?.on('data', scan)
    proc.stderr?.on('data', scan)
    proc.on('error', (e) => {
      starting = null
      rej(e)
    })
    proc.on('exit', () => {
      proc = null
      url = null
      starting = null
    })
    setTimeout(() => {
      if (!url) {
        starting = null
        rej(new Error('dev server start timeout'))
      }
    }, 25000)
  })
  return starting
}

export function stopAuthoring(): void {
  if (proc) proc.kill()
  proc = null
  url = null
  starting = null
}
