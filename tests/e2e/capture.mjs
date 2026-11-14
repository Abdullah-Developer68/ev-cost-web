/**
 * Captures the screenshots used in the project report, from the deployed site
 * (TARGET_URL) or the local build. Also downloads the CSV and the PDF report.
 *
 *   TARGET_URL=https://ev-cost-web.vercel.app node tests/e2e/capture.mjs <out-dir>
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { findChromium, serveDist, sleep } from './harness.mjs'

const out = path.resolve(process.argv[2] ?? 'test-results/report')
fs.mkdirSync(out, { recursive: true })
const target = process.env.TARGET_URL?.trim()
const local = target ? null : await serveDist()
const url = target ? target.replace(/\/?$/, '/') : local.url

const browser = await chromium.launch({ executablePath: findChromium() })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  acceptDownloads: true
})
const page = await context.newPage()
const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) })
/** Scrolls the element whose text starts with `text` to the top of its scroll container. */
const scrollTo = (text, offset = 16) =>
  page.evaluate(
    ([t, off]) => {
      const el = [...document.querySelectorAll('h2, h3, header')].find((e) =>
        e.textContent.trim().startsWith(t)
      )
      if (!el) return false
      el.scrollIntoView({ block: 'start' })
      let p = el.parentElement
      while (p && p.scrollHeight <= p.clientHeight) p = p.parentElement
      if (p) p.scrollTop -= off
      return true
    },
    [text, offset]
  )

await page.goto(url)
await page.waitForSelector('#status-headline')
await sleep(800)
await shot('01-overview')
await scrollTo('Budget, plan, earned and spent')
await sleep(500)
await shot('02-charts-performance')
await scrollTo('Variance by package')
await sleep(500)
await shot('03-charts-variance')

await page.goto(`${url}#/packages`)
await sleep(800)
await shot('04-work-packages')

await page.evaluate(() =>
  [...document.querySelectorAll('header button')]
    .find((b) => b.textContent.includes('Work package'))
    .click()
)
await sleep(500)
await shot('05-data-entry-form')
await page.keyboard.press('Escape')
await sleep(300)

await page.evaluate(() =>
  [...document.querySelectorAll('header button')]
    .find((b) => b.textContent.includes('Import'))
    .click()
)
await sleep(300)
const csv = fs.readFileSync(
  path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures', 'sample-import.csv'),
  'utf8'
)
await page.evaluate((text) => {
  const dt = new DataTransfer()
  dt.items.add(new File([text], 'sample-import.csv', { type: 'text/csv' }))
  document
    .querySelector('[role=dialog] button.border-dashed')
    .dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
}, csv)
await sleep(800)
await shot('06-csv-import-preview')
await page.keyboard.press('Escape')
await sleep(300)

await page.goto(`${url}#/actions`)
await sleep(800)
await shot('07-ai-unusual-spend')

await page.goto(`${url}#/report`)
await sleep(800)
await shot('08-report-preview')
await scrollTo('Unusual spend (anomaly detection)', 40)
await sleep(400)
await shot('09-report-anomalies')

const pdfDownload = page.waitForEvent('download')
await page.evaluate(() =>
  [...document.querySelectorAll('button')]
    .find((b) => b.textContent.includes('Download PDF'))
    .click()
)
const pdf = await pdfDownload
await pdf.saveAs(path.join(out, 'sample-report.pdf'))

await page.goto(`${url}#/packages`)
await sleep(600)
const csvDownload = page.waitForEvent('download')
await page.evaluate(() =>
  [...document.querySelectorAll('header button')]
    .find((b) => b.textContent.includes('Export CSV'))
    .click()
)
const csvFile = await csvDownload
await csvFile.saveAs(path.join(out, 'sample-export.csv'))

await browser.close()
await local?.close()
process.stdout.write(`Saved to ${out}\n`)
