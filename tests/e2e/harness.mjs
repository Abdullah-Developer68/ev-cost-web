/**
 * Shared pieces for the end-to-end scripts: a static file server for dist/ on a
 * free port, and the locally cached Chromium (never downloaded).
 */
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const distDir = path.join(root, 'dist')
export const outDir = path.join(root, 'test-results')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon'
}

/** Serves dist/ like a plain static host. Resolves with { url, close }. */
export function serveDist() {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('dist/index.html is missing: run "npm run build" first')
  }
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let file = path.normalize(path.join(distDir, urlPath))
    if (!file.startsWith(distDir)) {
      res.writeHead(403).end()
      return
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found')
      return
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store'
    })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({
        url: `http://127.0.0.1:${port}/`,
        close: () =>
          new Promise((r) => {
            server.closeAllConnections?.()
            server.close(() => r())
          })
      })
    })
  })
}

/**
 * The Chromium to drive: $CHROMIUM_PATH, else the newest build cached by
 * Playwright under ~/.cache/ms-playwright (full Chromium first, then the
 * headless shell). Throws rather than downloading one.
 */
export function findChromium() {
  const fromEnv = process.env.CHROMIUM_PATH?.trim()
  if (fromEnv) {
    if (!fs.existsSync(fromEnv)) throw new Error(`CHROMIUM_PATH does not exist: ${fromEnv}`)
    return fromEnv
  }
  const cache =
    process.env.PLAYWRIGHT_BROWSERS_PATH?.trim() ||
    path.join(os.homedir(), '.cache', 'ms-playwright')
  const candidates = []
  if (fs.existsSync(cache)) {
    for (const dir of fs.readdirSync(cache)) {
      const build = Number(dir.split('-').pop()) || 0
      const shapes = dir.startsWith('chromium_headless_shell-')
        ? [
            ['chrome-headless-shell-linux64', 'chrome-headless-shell'],
            ['chrome-mac', 'headless_shell']
          ]
        : dir.startsWith('chromium-')
          ? [
              ['chrome-linux64', 'chrome'],
              ['chrome-linux', 'chrome'],
              ['chrome-mac', 'Chromium.app/Contents/MacOS/Chromium'],
              ['chrome-win', 'chrome.exe']
            ]
          : []
      for (const parts of shapes) {
        const exe = path.join(cache, dir, ...parts)
        if (fs.existsSync(exe)) candidates.push({ exe, build, full: dir.startsWith('chromium-') })
      }
    }
  }
  candidates.sort((a, b) => b.build - a.build || Number(b.full) - Number(a.full))
  if (candidates.length === 0) {
    throw new Error(
      `No cached Chromium found under ${cache}. Set CHROMIUM_PATH to a Chromium executable.`
    )
  }
  return candidates[0].exe
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
