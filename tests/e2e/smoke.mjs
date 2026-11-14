/**
 * End-to-end smoke test for the built web app.
 *
 *   npm run test:e2e      (builds first, then runs this file)
 *
 * Serves dist/ on a free local port like a static host, drives the cached
 * Chromium (playwright-core, no browser download; CHROMIUM_PATH overrides the
 * auto-detected one), checks the main flows and every responsive layout, then
 * shuts the server down. Each browser context starts with empty storage, so
 * your own saved data is never touched. Screenshots land in test-results/.
 * Exits non-zero on any failed check, console error or CSP violation.
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { findChromium, outDir, serveDist, sleep } from './harness.mjs'

const STORAGE_KEY = 'ev-cost:data:v1'
const results = []
const consoleErrors = []

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail })
  process.stdout.write(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? `  (${detail})` : ''}\n`)
}
function section(title) {
  process.stdout.write(`\n${title}\n`)
}

fs.mkdirSync(outDir, { recursive: true })
const server = await serveDist()
const executablePath = findChromium()
let browser
try {
  browser = await chromium.launch({ executablePath })
} catch (err) {
  await server.close()
  console.error(`Could not launch the cached Chromium at ${executablePath}:\n${err.message}`)
  process.exit(1)
}
process.stdout.write(`Serving ${server.url} · Chromium ${browser.version()}\n`)

/** A fresh browser profile (empty localStorage) with console and CSP watching. */
async function newPage(options = {}) {
  const context = await browser.newContext({ acceptDownloads: true, ...options })
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error(`CSP violation: ${e.violatedDirective} blocked ${e.blockedURI}`)
    )
  })
  const page = await context.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(`Uncaught: ${err.message}`))
  return { context, page }
}

function helpers(page) {
  const js = (fn, arg) => page.evaluate(fn, arg)
  return {
    js,
    shot: (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) }),
    text: () => js(() => document.body.textContent),
    /** Clicks the first element matching `selector` whose text starts with `label`. */
    click: (selector, label) =>
      js(
        ([sel, txt]) => {
          const el = [...document.querySelectorAll(sel)].find((e) =>
            e.textContent.trim().startsWith(txt)
          )
          if (!el) return false
          el.click()
          return true
        },
        [selector, label]
      ),
    type: (selector, value) =>
      js(
        ([sel, val]) => {
          const el = document.querySelector(sel)
          if (!el) return false
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, val)
          el.dispatchEvent(new Event('input', { bubbles: true }))
          return true
        },
        [selector, value]
      ),
    packageRows: () =>
      js(() => document.querySelectorAll('table[class*="min-w-"] tbody tr').length),
    dialogOpen: () =>
      js(() => !!document.querySelector('[role=dialog]:not([aria-label="Navigation"])')),
    stored: () => js((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY),
    hash: () => js(() => location.hash),
    activeNav: () =>
      js(() => document.querySelector('nav button[aria-current=page]')?.textContent.trim() ?? '')
  }
}

/** Contrast ratio of the primary "Work package" button's text on its fill. */
const primaryContrast = () => {
  const b = [...document.querySelectorAll('header button')].find((x) =>
    x.textContent.includes('Work package')
  )
  const cs = getComputedStyle(b)
  const lum = (c) => {
    const [r, g, bl] = c
      .match(/\d+(\.\d+)?/g)
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const a = lum(cs.color)
  const z = lum(cs.backgroundColor)
  return (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05)
}

const PAGES = [
  { hash: '#/overview', nav: 'Overview', file: 'overview' },
  { hash: '#/packages', nav: 'Work packages', file: 'packages' },
  { hash: '#/actions', nav: 'Next actions', file: 'actions' },
  { hash: '#/report', nav: 'Report', file: 'report' }
]

// ───────────────────────────── Desktop flows at 1440x900 ─────────────────────────────
{
  const { context, page } = await newPage({ viewport: { width: 1440, height: 900 } })
  const h = helpers(page)
  try {
    section('Overview')
    await page.goto(server.url)
    await page.waitForSelector('#status-headline')
    await sleep(300)
    const body = await h.text()
    check('overview shows the project verdict', body.includes('Over budget and behind schedule.'))
    check(
      'worked sheet highlights all 8 derived answers',
      (await h.js(
        () =>
          document.querySelectorAll('section[aria-labelledby="worked-sheet-title"] .answer').length
      )) === 8
    )
    check('benchmark-consistent project CPI is shown', body.includes('0.93'))
    check(
      'suggestions panel lists actions',
      body.includes('What to do next') && body.includes('Re-scope Enterprise SSO')
    )
    check('where the data is saved is disclosed', body.includes('Saved in this browser'))
    const first = await h.stored()
    check(
      'first run writes the demo project to browser storage',
      first?.version === 1 && first.items.length === 5 && first.projects.length === 1
    )
    check('the bare URL lands on #/overview', (await h.hash()) === '#/overview')
    check(
      'the browser tab title names the page',
      (await page.title()).startsWith('Overview · Autonomous Code Patching')
    )
    check(
      'theme-color follows the active theme',
      (await h.js(() => document.querySelector('meta[name=theme-color]').content)) ===
        (await h.js(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--plane').trim()
        ))
    )

    section('Work packages: table, sort, search, drawer')
    await page.keyboard.press('2')
    await sleep(300)
    check('"2" opens Work packages and updates the URL', (await h.hash()) === '#/packages')
    check('table lists the 5 demo work packages', (await h.packageRows()) === 5)
    await h.click('thead button', 'CPI')
    await sleep(200)
    check(
      'sorting by CPI puts the weakest package first',
      (await h.js(() => document.querySelector('tbody tr th')?.textContent ?? '')).startsWith(
        'Enterprise SSO'
      )
    )
    await page.keyboard.press('/')
    await sleep(200)
    check(
      '"/" focuses the search box',
      (await h.js(() => document.activeElement?.id)) === 'package-search'
    )
    await page.keyboard.press('1')
    await sleep(100)
    check('digits typed in the search box do not switch pages', (await h.hash()) === '#/packages')
    await h.type('#package-search', 'no-such-package')
    await sleep(200)
    check(
      'a search with no matches shows the empty state',
      (await h.text()).includes('No work packages match')
    )
    await h.click('button', 'Clear filters')
    await sleep(200)
    await page.click('tbody tr th button')
    await sleep(400)
    check(
      'selecting a row opens the inspector drawer',
      (await h.dialogOpen()) &&
        (await h.js(() => document.querySelector('[role=dialog]').textContent)).includes(
          'Worked solution'
        )
    )
    await h.shot('drawer-1440')
    await page.keyboard.press('Escape')
    await sleep(300)
    check('Escape closes the drawer', !(await h.dialogOpen()))

    section('Add, validate, edit, delete, undo')
    await page.keyboard.press('n')
    await sleep(400)
    check(
      '"n" opens the new work package form',
      (await h.js(() => document.querySelector('[role=dialog] h2')?.textContent)) ===
        'New work package'
    )
    await h.js(() => document.querySelector('[role=dialog] form button[type=submit]').click())
    await sleep(300)
    check(
      'submitting an empty form shows validation errors',
      (await h.text()).includes('Module name is required')
    )
    await h.type('[role=dialog] input[placeholder="e.g. Payments API integration"]', 'E2E Package')
    await h.type('[role=dialog] input[placeholder="10000"]', '9000')
    await h.type('[role=dialog] input[placeholder="5000"]', '6300')
    await h.type('[role=dialog] input[placeholder="50"]', '70')
    await h.type('[role=dialog] input[placeholder="40"]', '55')
    await sleep(300)
    check(
      'live preview computes CPI as you type',
      (await h.js(() => document.querySelector('[role=dialog] aside')?.textContent ?? '')).includes(
        '0.79'
      )
    )
    await h.js(() => document.querySelector('[role=dialog] form button[type=submit]').click())
    await sleep(600)
    check('saving adds the row', (await h.packageRows()) === 6)
    await h.js(() =>
      [...document.querySelectorAll('tbody tr')]
        .find((r) => r.textContent.includes('E2E Package'))
        .querySelector('button[aria-label^="Edit"]')
        .click()
    )
    await sleep(300)
    await h.type('[role=dialog] input[placeholder="5000"]', '4000')
    await h.js(() => document.querySelector('[role=dialog] form button[type=submit]').click())
    await sleep(500)
    const editedRow = await h.js(
      () =>
        [...document.querySelectorAll('tbody tr')].find((r) =>
          r.textContent.includes('E2E Package')
        )?.textContent ?? ''
    )
    check('editing recalculates the metrics', editedRow.includes('1.24'), 'CPI = 4,950 / 4,000')
    await h.js(() =>
      [...document.querySelectorAll('tbody tr')]
        .find((r) => r.textContent.includes('E2E Package'))
        .querySelector('button[aria-label^="Delete"]')
        .click()
    )
    await sleep(300)
    check('delete asks for confirmation', (await h.text()).includes('Delete this work package?'))
    await h.click('[role=dialog] button', 'Delete')
    await sleep(500)
    check('confirming deletes the row', (await h.packageRows()) === 5)
    await h.click('[role=status] button', 'Undo')
    await sleep(700)
    check(
      'undo restores the deleted row',
      (await h.packageRows()) === 6 && (await h.text()).includes('E2E Package')
    )
    const afterUndo = await h.stored()
    const restoredId = afterUndo.items.find((i) => i.taskName === 'E2E Package')?.id
    check(
      'the restored row gets a new id, never a reused one',
      restoredId === 7,
      `id ${restoredId}`
    )

    section('Import with sanitisation and row errors')
    await h.click('header button', 'Import')
    await sleep(300)
    const csv = [
      'Module Name,Category,Budget at Completion (BAC),Planned % Complete,Actual % Complete,Actual Cost (AC),Notes',
      'Mobile Offline Sync,Core Engineering,"$7,500",30%,20%,"$2,400",=HYPERLINK(1)',
      ',Broken,1,1,1,1,',
      'Bad Percent,QA,100,150,10,10,'
    ].join('\n')
    await h.js((text) => {
      const dt = new DataTransfer()
      dt.items.add(new File([text], 'import.csv', { type: 'text/csv' }))
      const zone = [...document.querySelectorAll('[role=dialog] button')].find((b) =>
        b.textContent.includes('Drop a CSV')
      )
      zone.dispatchEvent(
        new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })
      )
    }, csv)
    await sleep(800)
    const importSummary = await h.js(
      () => document.querySelector('[role=dialog] [aria-live]')?.textContent ?? ''
    )
    check(
      'import keeps valid rows and reports bad ones',
      importSummary.includes('1 ready') && importSummary.includes('2 rows skipped'),
      importSummary.replace(/\s+/g, ' ').slice(0, 80)
    )
    check('import strips spreadsheet formulas', importSummary.includes('1 formula prefix removed'))
    const templateDownload = page.waitForEvent('download', { timeout: 5000 })
    await h.click('[role=dialog] button', 'Sample template')
    const template = await templateDownload.catch(() => null)
    check(
      'the CSV template downloads',
      template?.suggestedFilename() === 'ev-cost-template.csv',
      template?.suggestedFilename() ?? 'no download'
    )
    await h.click('[role=dialog] footer button', 'Import 1')
    await sleep(700)
    check('confirming the import adds the row', (await h.packageRows()) === 7)
    const saved = await h.stored()
    const importedRow = saved.items.find((i) => i.taskName === 'Mobile Offline Sync')
    check(
      'every change is saved to browser storage',
      saved.items.length === 7 &&
        saved.items.some((i) => i.taskName === 'E2E Package') &&
        importedRow?.bac === 7500 &&
        importedRow?.notes === 'HYPERLINK(1)',
      `${saved.items.length} items stored`
    )

    const csvDownload = page.waitForEvent('download', { timeout: 5000 })
    await h.click('header button', 'Export CSV')
    const csvFile = await csvDownload.catch(() => null)
    const csvText = csvFile ? fs.readFileSync(await csvFile.path(), 'utf8') : ''
    check(
      'Export CSV downloads every work package',
      csvFile?.suggestedFilename().endsWith('-work-packages.csv') &&
        csvText.trim().split(/\r?\n/).length === 8,
      csvFile?.suggestedFilename() ?? 'no download'
    )

    section('Next actions and report')
    await page.keyboard.press('3')
    await sleep(400)
    const actions = await h.text()
    check(
      'next actions page ranks critical items first',
      actions.includes('Critical') && actions.includes('The rules')
    )
    await page.keyboard.press('4')
    await sleep(400)
    check(
      'report preview renders every section',
      (await h.text()).includes('Recommended actions') &&
        (await h.text()).includes('Forecast range')
    )
    const pdfDownload = page.waitForEvent('download', { timeout: 15000 })
    await h.click('button', 'Download PDF')
    const pdf = await pdfDownload.catch(() => null)
    const pdfHead = pdf
      ? fs
          .readFileSync(await pdf.path())
          .subarray(0, 5)
          .toString()
      : ''
    check(
      'the PDF report downloads (jsPDF loaded on demand)',
      pdf?.suggestedFilename().endsWith('-evm-report.pdf') && pdfHead === '%PDF-',
      pdf?.suggestedFilename() ?? 'no download'
    )

    section('Routing: shortcuts, back and forward, deep links')
    await page.keyboard.press('Alt+1')
    await sleep(200)
    check('Alt+1 is left to the browser', (await h.hash()) === '#/report')
    await page.goBack()
    await sleep(300)
    check(
      'Back returns to the previous page',
      (await h.hash()) === '#/actions' && (await h.activeNav()).startsWith('Next actions')
    )
    await page.goForward()
    await sleep(300)
    check(
      'Forward goes to the next page again',
      (await h.hash()) === '#/report' && (await h.activeNav()).startsWith('Report')
    )
    await h.click('nav button', 'Overview')
    await sleep(300)
    check('clicking the sidebar updates the URL', (await h.hash()) === '#/overview')
    await page.goto(`${server.url}#/nowhere`)
    await sleep(500)
    check('an unknown hash falls back to a real page', (await h.hash()) === '#/overview')
    section('What-if forecast')
    await h.click('nav button', 'Next actions')
    await page.waitForSelector('input[type=range]')
    await sleep(300)
    const whatIf = () =>
      h.js(
        () =>
          [...document.querySelectorAll('h2')]
            .find((x) => x.textContent.trim() === 'What if?')
            ?.closest('section')?.textContent ?? ''
      )
    const projectEac = await h.js(
      () => [...document.querySelectorAll('td .answer')].map((e) => e.textContent.trim())[0] ?? ''
    )
    check(
      'what-if starts from the current forecast',
      projectEac.startsWith('$') && (await whatIf()).includes(projectEac),
      projectEac
    )
    // Expected answers from the saved data: EAC = AC + (BAC - EV) / CPI
    const totalsData = await h.stored()
    const own = totalsData.items.filter((i) => i.projectId === totalsData.projects[0].id)
    const sum = (f) => own.reduce((t, i) => t + f(i), 0)
    const bac = sum((i) => i.bac)
    const ev = sum((i) => (i.bac * i.actualPercent) / 100)
    const ac = sum((i) => i.actualCost)
    const dollars = (n) => `$${Math.round(n).toLocaleString('en-US')}`
    await h.click('section button', 'On plan')
    await sleep(300)
    const onPlan = dollars(ac + (bac - ev))
    check(
      'the "On plan" preset recalculates the forecast',
      (await whatIf()).includes(onPlan),
      `CPI 1.00 gives ${onPlan}`
    )
    await page.focus('input[type=range]')
    await page.keyboard.press('End')
    await sleep(300)
    const best = dollars(ac + (bac - ev) / 1.5)
    check(
      'the efficiency slider works from the keyboard',
      (await whatIf()).includes(best),
      `End: CPI 1.50 gives ${best}`
    )
    await h.click('section button', 'Reset')
    await sleep(200)
    check('Reset returns to the current forecast', (await whatIf()).includes(projectEac))

    section('Command menu')
    const menuOpen = () =>
      h.js(() => !!document.querySelector('[role=dialog][aria-label="Command menu"]'))
    const selected = () =>
      h.js(() => document.querySelector('[role=option][aria-selected=true]')?.textContent ?? '')
    await page.keyboard.press('Control+k')
    await sleep(300)
    check(
      'Ctrl+K opens the command menu with focus in its search box',
      (await menuOpen()) &&
        (await h.js(() => document.activeElement?.getAttribute('role'))) === 'combobox'
    )
    await h.shot('command-menu-1440')
    await page.keyboard.press('ArrowDown')
    check('arrow keys move through the commands', (await selected()).includes('Work packages'))
    await page.keyboard.type('2')
    await sleep(150)
    check('digits typed in the menu do not switch pages', (await h.hash()) === '#/actions')
    await page.fill('[role=combobox]', 'sso')
    await sleep(150)
    check('the menu finds a work package by name', (await selected()).includes('Enterprise SSO'))
    await page.keyboard.press('Enter')
    await sleep(400)
    check(
      'Enter runs the command: the package opens in the inspector',
      !(await menuOpen()) &&
        (await h.hash()) === '#/packages' &&
        (await h.js(() => document.querySelector('[role=dialog]')?.textContent ?? '')).includes(
          'Enterprise SSO'
        )
    )
    await page.keyboard.press('Escape')
    await sleep(300)
    await h.click('aside button', 'Search or jump to')
    await sleep(250)
    check('the sidebar search button opens the menu', await menuOpen())
    await page.keyboard.type('report')
    await page.keyboard.press('Enter')
    await sleep(400)
    check('a page command navigates and updates the URL', (await h.hash()) === '#/report')
    await page.keyboard.press('Control+k')
    await sleep(200)
    await page.keyboard.type('backup')
    const menuBackup = page.waitForEvent('download', { timeout: 5000 })
    await page.keyboard.press('Enter')
    const backupFile = await menuBackup.catch(() => null)
    check(
      'the menu downloads a backup',
      backupFile?.suggestedFilename().startsWith('ev-cost-backup-') ?? false,
      backupFile?.suggestedFilename() ?? 'no download'
    )
    await page.keyboard.press('Control+k')
    await sleep(200)
    await page.keyboard.press('Escape')
    await sleep(200)
    check('Escape closes the command menu', !(await menuOpen()))
    // Leave the app where the next section expects it.
    await h.click('nav button', 'Overview')
    await sleep(300)
  } catch (err) {
    check('desktop flows ran without throwing', false, err?.message ?? String(err))
  }

  try {
    section('Theme and reload')
    for (const mode of ['Light', 'Dark']) {
      await h.js((m) => document.querySelector(`[role=radio][title="${m} theme"]`).click(), mode)
      await sleep(300)
      check(
        `${mode.toLowerCase()} theme applies`,
        (await h.js(() => document.documentElement.dataset.theme)) === mode.toLowerCase()
      )
      const ratio = await h.js(primaryContrast)
      check(
        `primary button text is readable in ${mode.toLowerCase()} theme`,
        ratio >= 4.5,
        `${ratio.toFixed(1)}:1`
      )
    }
    await page.reload()
    await page.waitForSelector('#status-headline')
    check(
      'theme choice survives a reload',
      (await h.js(() => document.documentElement.dataset.theme)) === 'dark'
    )
    await page.goto(`${server.url}#/packages`)
    await page.reload()
    await page.waitForSelector('tbody tr')
    check('a deep link opens the right page', (await h.activeNav()).startsWith('Work packages'))
    check('work packages survive a reload', (await h.packageRows()) === 7)
    await h.js(() => document.querySelector('[role=radio][title="System theme"]').click())
  } catch (err) {
    check('theme checks ran without throwing', false, err?.message ?? String(err))
  }

  try {
    section('Backup, restore, reset, cross-tab sync')
    await h.click('aside button', 'Saved in this browser')
    await sleep(200)
    const backupDownload = page.waitForEvent('download', { timeout: 5000 })
    await h.click('aside button', 'Download backup')
    const backup = await backupDownload.catch(() => null)
    const backupText = backup ? fs.readFileSync(await backup.path(), 'utf8') : '{}'
    const backupJson = JSON.parse(backupText)
    check(
      'Download backup saves every project and work package as JSON',
      backup?.suggestedFilename().startsWith('ev-cost-backup-') &&
        backupJson.app === 'ev-cost' &&
        backupJson.items.length === 7,
      backup?.suggestedFilename() ?? 'no download'
    )

    await h.click('aside button', 'Reset demo data')
    await sleep(300)
    check('Reset demo data asks first', (await h.text()).includes('Reset to the demo data?'))
    await h.click('[role=dialog] footer button', 'Reset demo data')
    await sleep(700)
    check('reset brings back the 5 demo work packages', (await h.packageRows()) === 5)

    await page.setInputFiles('[data-testid=restore-input]', {
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backupText)
    })
    await sleep(400)
    check(
      'restore asks before replacing anything',
      (await h.text()).includes('Restore from backup?')
    )
    await h.click('[role=dialog] footer button', 'Replace my data')
    await sleep(700)
    check('restoring the backup brings back all 7 work packages', (await h.packageRows()) === 7)

    await page.setInputFiles('[data-testid=restore-input]', {
      name: 'not-a-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"hello":"world"}')
    })
    await sleep(400)
    check(
      'a file that is not a backup is refused without asking',
      (await h.text()).includes('not an EV-COST backup') && !(await h.dialogOpen())
    )

    // A second tab in the same profile shares localStorage.
    const other = await context.newPage()
    other.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
    await other.goto(`${server.url}#/packages`)
    await other.waitForSelector('tbody tr')
    await h.js(() =>
      [...document.querySelectorAll('tbody tr')]
        .find((r) => r.textContent.includes('Mobile Offline Sync'))
        .querySelector('button[aria-label^="Delete"]')
        .click()
    )
    await sleep(300)
    await h.click('[role=dialog] button', 'Delete')
    await sleep(800)
    check(
      'another open tab picks up the change',
      (await helpers(other).packageRows()) === 6 &&
        (await helpers(other).text()).includes('Updated with changes made in another tab')
    )
    await other.close()

    section('A change that cannot be saved')
    await h.js(() => {
      window.__realSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = function () {
        throw new DOMException('full', 'QuotaExceededError')
      }
    })
    const before = await h.packageRows()
    await page.keyboard.press('n')
    await sleep(300)
    await h.type('[role=dialog] input[placeholder="e.g. Payments API integration"]', 'Will not fit')
    await h.type('[role=dialog] input[placeholder="10000"]', '100')
    await h.type('[role=dialog] input[placeholder="5000"]', '10')
    await h.type('[role=dialog] input[placeholder="50"]', '10')
    await h.type('[role=dialog] input[placeholder="40"]', '10')
    await h.js(() => document.querySelector('[role=dialog] form button[type=submit]').click())
    await sleep(500)
    check(
      'a full storage rejects the change with a clear error toast',
      (await h.js(() => document.querySelector('[role=status]')?.textContent ?? '')).includes(
        'storage for EV-COST is full'
      ),
      (await h.js(() => document.querySelector('[role=status]')?.textContent ?? '')).slice(0, 90)
    )
    await page.keyboard.press('Escape')
    await sleep(300)
    check('and the change is not applied', (await h.packageRows()) === before)
    await h.js(() => {
      Storage.prototype.setItem = window.__realSetItem
    })

    section('Recovering from unreadable storage')
    await h.js((key) => localStorage.setItem(key, '{ this is not json'), STORAGE_KEY)
    await page.reload()
    await page.waitForSelector('tbody tr')
    await sleep(300)
    check(
      'unreadable data is kept aside and the demo loads, with a notice',
      (await h.packageRows()) === 5 &&
        (await h.text()).includes('could not be read') &&
        (await h.js(() =>
          Object.keys(localStorage).some((k) => k.startsWith('ev-cost:data:unreadable:'))
        ))
    )
  } catch (err) {
    check('data tools ran without throwing', false, err?.message ?? String(err))
  }
  await context.close()
}

// ─────────────────────────────── Screenshots ───────────────────────────────
section('Screenshots')
async function capture(width, height, theme, pages, suffix) {
  const { context, page } = await newPage({
    viewport: { width, height },
    colorScheme: theme,
    hasTouch: width < 1024
  })
  for (const p of pages) {
    await page.goto(`${server.url}${p.hash}`)
    await page.reload()
    await page.waitForSelector('#root main header h1')
    await sleep(700)
    await page.screenshot({ path: path.join(outDir, `${p.file}-${suffix}.png`) })
  }
  await context.close()
}
try {
  await capture(1440, 900, 'light', PAGES, '1440-light')
  await capture(1440, 900, 'dark', PAGES, '1440-dark')
  await capture(820, 1180, 'light', PAGES, '820-light')
  await capture(820, 1180, 'dark', PAGES.slice(0, 1), '820-dark')
  await capture(390, 844, 'light', PAGES, '390-light')
  await capture(390, 844, 'dark', PAGES.slice(0, 1), '390-dark')
  check('screenshots captured', true, outDir)
} catch (err) {
  check('screenshots captured', false, err?.message ?? String(err))
}

// ───────────────────────────── Phones and tablets ─────────────────────────────
{
  section('Phone at 390x844')
  const { context, page } = await newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  })
  const h = helpers(page)
  try {
    await page.goto(server.url)
    await page.waitForSelector('#status-headline')
    const navHidden = await h.js(() => {
      const nav = document.getElementById('app-navigation')
      return nav.inert && nav.getBoundingClientRect().right <= 0
    })
    check('the sidebar is off-canvas and inert until opened', navHidden)
    await page.click('[aria-label="Open navigation"]')
    await sleep(400)
    const drawer = await h.js(() => {
      const nav = document.getElementById('app-navigation')
      return {
        visible: nav.getBoundingClientRect().left >= 0 && !nav.inert,
        modal: nav.getAttribute('aria-modal') === 'true',
        focusInside: nav.contains(document.activeElement),
        scrim: !!document.querySelector('[data-testid=nav-scrim]')
      }
    })
    check(
      'the menu button opens the navigation drawer with a scrim and focus inside',
      drawer.visible && drawer.modal && drawer.focusInside && drawer.scrim,
      JSON.stringify(drawer)
    )
    for (let i = 0; i < 25; i++) await page.keyboard.press('Tab')
    check(
      'Tab stays trapped inside the drawer',
      await h.js(() => document.getElementById('app-navigation').contains(document.activeElement))
    )
    await page.screenshot({ path: path.join(outDir, 'drawer-390-open.png') })
    await page.keyboard.press('Escape')
    await sleep(350)
    check(
      'Esc closes the drawer and returns focus to the menu button',
      (await h.js(() => document.getElementById('app-navigation').inert)) &&
        (await h.js(() => document.activeElement?.getAttribute('aria-label'))) === 'Open navigation'
    )
    await page.click('[aria-label="Open navigation"]')
    await sleep(300)
    await page.click('[data-testid=nav-scrim]', { position: { x: 370, y: 400 } })
    await sleep(300)
    check(
      'tapping the scrim closes the drawer',
      await h.js(() => document.getElementById('app-navigation').inert)
    )
    await page.click('[aria-label="Open navigation"]')
    await sleep(300)
    await page.click('#app-navigation nav button:has-text("Work packages")')
    await sleep(400)
    check(
      'choosing a page navigates and closes the drawer',
      (await h.hash()) === '#/packages' &&
        (await h.js(() => document.getElementById('app-navigation').inert)) &&
        (await h.js(() => document.querySelector('[data-testid=app-bar]').textContent)).includes(
          'Work packages'
        )
    )
    const pinned = await h.js(() => {
      const scroller = document.querySelector('table[class*="min-w-"]').parentElement
      const cell = document.querySelector('tbody tr th')
      const before = cell.getBoundingClientRect().left
      scroller.scrollLeft = 400
      const after = cell.getBoundingClientRect().left
      const total = document.querySelector('tfoot th')
      const r = total.getBoundingClientRect()
      return {
        scrolled: scroller.scrollLeft > 0,
        stays: Math.abs(after - before) < 1,
        totalsVisible: r.bottom <= scroller.getBoundingClientRect().bottom + 1
      }
    })
    check(
      'the table scrolls in its card with the first column pinned and totals visible',
      pinned.scrolled && pinned.stays && pinned.totalsVisible,
      JSON.stringify(pinned)
    )

    await page.click('[data-testid=app-bar] button:has-text("Work package")')
    await sleep(400)
    const sheet = await h.js(() => {
      const d = document.querySelector('[role=dialog]:not(#app-navigation)')
      const r = d.getBoundingClientRect()
      return { top: r.top, height: r.height, width: r.width }
    })
    check(
      'the app bar action opens the form as a full-height sheet',
      sheet.top <= 1 && sheet.height >= 843 && sheet.width >= 389,
      JSON.stringify(sheet)
    )
    await page.screenshot({ path: path.join(outDir, 'modal-390.png') })
    const smallText = await h.js(() =>
      [
        ...document.querySelectorAll(
          ':is(main, [role=dialog]:not(#app-navigation)) :is(input, select, textarea)'
        )
      ]
        .filter((el) => el.type !== 'checkbox' && el.getBoundingClientRect().width > 0)
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
        .map((el) => el.name || el.id || el.type)
    )
    check(
      'form fields use 16px or larger text, so iOS does not zoom in',
      smallText.length === 0,
      smallText.slice(0, 5).join(' | ')
    )
    await page.keyboard.press('Escape')
    await sleep(300)

    const small = await h.js(() =>
      [
        ...document.querySelectorAll(
          'main button, main select, main input, [data-testid=app-bar] button'
        )
      ]
        .filter((el) => {
          const r = el.getBoundingClientRect()
          const style = getComputedStyle(el)
          return r.width > 0 && style.visibility !== 'hidden' && el.type !== 'checkbox'
        })
        .filter((el) => el.getBoundingClientRect().height < 44)
        .map((el) => el.getAttribute('aria-label') || el.textContent.trim().slice(0, 20))
    )
    check(
      'touch targets are at least 44px tall on a coarse pointer',
      small.length === 0,
      small.slice(0, 5).join(' | ')
    )
    await page.click('[data-testid=app-bar] [aria-label="Search or jump to"]')
    await sleep(350)
    const menu = await h.js(() => {
      const d = document.querySelector('[role=dialog][aria-label="Command menu"]')
      if (!d) return null
      const r = d.getBoundingClientRect()
      const close = d.querySelector('[aria-label="Close the command menu"]')
      return {
        left: r.left,
        right: r.right,
        bottom: r.bottom,
        searchFont: parseFloat(getComputedStyle(d.querySelector('[role=combobox]')).fontSize),
        option: d.querySelector('[role=option]').getBoundingClientRect().height,
        close: close ? close.getBoundingClientRect().width : 0
      }
    })
    check(
      'the app bar search opens a finger-sized command menu inside the screen',
      menu &&
        menu.left >= 0 &&
        menu.right <= 390 &&
        menu.bottom <= 844 &&
        menu.searchFont >= 16 &&
        menu.option >= 44 &&
        menu.close >= 40,
      JSON.stringify(menu)
    )
    await page.screenshot({ path: path.join(outDir, 'command-menu-390.png') })
    await page.fill('[role=combobox]', 'next')
    await page.click('[role=option]:has-text("Next actions")')
    await sleep(400)
    check(
      'tapping a command runs it',
      (await h.hash()) === '#/actions' &&
        !(await h.js(() => !!document.querySelector('[aria-label="Command menu"]')))
    )
    await h.js(() =>
      [...document.querySelectorAll('h2')]
        .find((x) => x.textContent.trim() === 'What if?')
        ?.scrollIntoView({ block: 'start' })
    )
    await sleep(200)
    await page.screenshot({ path: path.join(outDir, 'what-if-390.png') })
    const smallWhatIf = await h.js(() => {
      const panel = [...document.querySelectorAll('h2')]
        .find((x) => x.textContent.trim() === 'What if?')
        ?.closest('section')
      return [...(panel?.querySelectorAll('button, input') ?? [])]
        .filter((el) => el.getBoundingClientRect().height < 44)
        .map((el) => el.getAttribute('aria-label') || el.textContent.trim().slice(0, 20))
    })
    check(
      'what-if sliders and presets are finger-sized',
      smallWhatIf.length === 0,
      smallWhatIf.slice(0, 5).join(' | ')
    )
  } catch (err) {
    check('phone checks ran without throwing', false, err?.message ?? String(err))
  }
  await context.close()
}

{
  section('No horizontal scroll at 360px')
  const { context, page } = await newPage({ viewport: { width: 360, height: 740 }, hasTouch: true })
  try {
    for (const p of PAGES) {
      await page.goto(`${server.url}${p.hash}`)
      await page.reload()
      await page.waitForSelector('#root main header h1')
      await sleep(500)
      const o = await page.evaluate(() => {
        const main = document.querySelector('main')
        return {
          main: main.scrollWidth - main.clientWidth,
          doc: document.documentElement.scrollWidth - window.innerWidth
        }
      })
      check(
        `${p.nav} fits 360px with no sideways scroll`,
        o.main <= 0 && o.doc <= 0,
        JSON.stringify(o)
      )
    }
  } catch (err) {
    check('360px checks ran without throwing', false, err?.message ?? String(err))
  }
  await context.close()
}

{
  section('Reduced motion')
  const { context, page } = await newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce'
  })
  try {
    await page.goto(server.url)
    await page.waitForSelector('#status-headline')
    const ms = await page.evaluate(() => {
      const nav = document.getElementById('app-navigation')
      return parseFloat(getComputedStyle(nav).transitionDuration) * 1000
    })
    check('prefers-reduced-motion turns transitions off', ms <= 0.01, `${ms}ms`)
  } catch (err) {
    check('reduced motion check ran without throwing', false, err?.message ?? String(err))
  }
  await context.close()
}

check(
  'no console errors or CSP violations',
  consoleErrors.length === 0,
  consoleErrors.slice(0, 3).join(' | ')
)

await browser.close()
await server.close()
const failed = results.filter((r) => !r.ok)
process.stdout.write(
  `\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${outDir}\n`
)
process.exit(failed.length ? 1 : 0)
