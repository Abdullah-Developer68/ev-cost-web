import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { checkUpload, readZipDirectory, UPLOAD_LIMITS } from './uploadGuard'

/**
 * Builds a ZIP with "stored" (uncompressed) entries. `declaredSize` lets a
 * test lie about an entry's uncompressed size in the central directory, the
 * way a zip bomb's headers describe gigabytes of output from a few bytes.
 * Safe test data: nothing large is ever allocated or inflated.
 */
function buildZip(
  entries: Array<{ name: string; data?: string; declaredSize?: number }>
): Uint8Array {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const e of entries) {
    const name = enc.encode(e.name)
    const data = enc.encode(e.data ?? '')
    const size = data.length
    const declared = e.declaredSize ?? size

    const local = new Uint8Array(30 + name.length + size)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint32(18, size, true)
    lv.setUint32(22, declared, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    local.set(data, 30 + name.length)
    locals.push(local)

    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, declared, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    central.set(name, 46)
    centrals.push(central)
    offset += local.length
  }
  const dirSize = centrals.reduce((s, c) => s + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, dirSize, true)
  ev.setUint32(16, offset, true)

  const out = new Uint8Array(offset + dirSize + 22)
  let p = 0
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, p)
    p += part.length
  }
  return out
}

const XLSX_PARTS = [
  { name: '[Content_Types].xml', data: '<Types/>' },
  { name: 'xl/workbook.xml', data: '<workbook/>' }
]

const file = (bytes: Uint8Array | string, name: string): File => new File([bytes as BlobPart], name)

async function realXlsx(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet1')
  ws.addRow(['Module Name', 'BAC', 'Planned %', 'Actual %', 'Actual Cost'])
  ws.addRow(['API', 1000, 50, 40, 500])
  return new Uint8Array(await wb.xlsx.writeBuffer())
}

describe('checkUpload: accepted files', () => {
  it('accepts a plain CSV', async () => {
    const r = await checkUpload(file('Module Name,BAC\nAPI,1000\n', 'costs.csv'))
    expect(r).toEqual({ ok: true, kind: 'csv' })
  })

  it('accepts a real workbook written by ExcelJS', async () => {
    const r = await checkUpload(file(await realXlsx(), 'costs.xlsx'))
    expect(r).toEqual({ ok: true, kind: 'xlsx' })
  })

  it('reads the central directory of a real workbook', async () => {
    const bytes = await realXlsx()
    const names = readZipDirectory(bytes.buffer as ArrayBuffer).map((e) => e.name)
    expect(names).toContain('xl/workbook.xml')
  })
})

describe('checkUpload: refused files (safe test data)', () => {
  it('refuses other extensions, including double extensions', async () => {
    for (const name of ['payload.exe', 'costs.csv.exe', 'costs.xlsm', 'costs.xls', 'costs']) {
      const r = await checkUpload(file('a,b\n1,2', name))
      expect(r.ok, name).toBe(false)
    }
  })

  it('refuses an empty file and one over the size limit', async () => {
    expect((await checkUpload(file('', 'empty.csv'))).ok).toBe(false)
    const big = { name: 'big.csv', size: UPLOAD_LIMITS.maxBytes + 1 } as File
    const r = await checkUpload(big)
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/larger than 10 MB/) })
  })

  it('refuses a Windows program renamed to .csv', async () => {
    const r = await checkUpload(file(new Uint8Array([0x4d, 0x5a, 0x90, 0, 3]), 'invoice.csv'))
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/Windows program/) })
  })

  it('refuses a PDF renamed to .csv, and binary data with NUL bytes', async () => {
    expect((await checkUpload(file('%PDF-1.7\n...', 'report.csv'))).ok).toBe(false)
    const r = await checkUpload(file(new Uint8Array([0x41, 0x2c, 0x00, 0x42]), 'data.csv'))
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/binary data/) })
  })

  it('refuses a text file renamed to .xlsx', async () => {
    const r = await checkUpload(file('Module Name,BAC\nAPI,1000', 'costs.xlsx'))
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/not an Excel workbook/) })
  })

  it('refuses a ZIP that is not a workbook', async () => {
    const r = await checkUpload(file(buildZip([{ name: 'readme.txt', data: 'hi' }]), 'x.xlsx'))
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/not an Excel workbook/) })
  })

  it('refuses a macro-enabled workbook renamed to .xlsx', async () => {
    const zip = buildZip([...XLSX_PARTS, { name: 'xl/vbaProject.bin', data: 'macro' }])
    const r = await checkUpload(file(zip, 'budget.xlsx'))
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/macros/) })
  })

  it('refuses a zip bomb by its declared size, without inflating it', async () => {
    const zip = buildZip([
      ...XLSX_PARTS,
      { name: 'xl/worksheets/sheet1.xml', data: 'x'.repeat(100), declaredSize: 900_000_000 }
    ])
    const r = await checkUpload(file(zip, 'bomb.xlsx'))
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/expands to 858 MB/) })
  })

  it('refuses an entry with a suspicious compression ratio', async () => {
    const zip = buildZip([
      ...XLSX_PARTS,
      { name: 'xl/worksheets/sheet1.xml', data: 'x'.repeat(10), declaredSize: 20 * 1024 * 1024 }
    ])
    const r = await checkUpload(file(zip, 'ratio.xlsx'))
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/zip bomb/) })
  })

  it('refuses path traversal entry names', async () => {
    const zip = buildZip([...XLSX_PARTS, { name: '../../evil.sh', data: 'x' }])
    const r = await checkUpload(file(zip, 'slip.xlsx'))
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/unsafe file paths/) })
  })

  it('refuses a truncated archive', async () => {
    const zip = await realXlsx()
    const r = await checkUpload(file(zip.slice(0, 200), 'cut.xlsx'))
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/not a valid Excel file/) })
  })
})
