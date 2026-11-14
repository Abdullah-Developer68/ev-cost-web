import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { generateSampleCsvTemplate, matchHeader, parseCsvFile, parseExcelFile } from './fileParser'

const csv = (text: string): File => new File([text], 'sheet.csv', { type: 'text/csv' })

describe('matchHeader', () => {
  it.each([
    ['Module Name', 'taskName'],
    ['Task / Module', 'taskName'],
    ['Work Package', 'taskName'],
    ['Category', 'category'],
    ['Budget at Completion (BAC)', 'bac'],
    ['BAC / Planned Budget', 'bac'],
    ['Budget', 'bac'],
    ['Planned % Complete', 'plannedPercent'],
    ['Planned %', 'plannedPercent'],
    ['Actual % Complete', 'actualPercent'],
    ['% Complete', 'actualPercent'],
    ['Actual Cost (AC)', 'actualCost'],
    ['AC', 'actualCost'],
    ['Spent', 'actualCost'],
    ['Notes', 'notes'],
    ['Something else', null]
  ])('maps "%s" to %s', (header, field) => {
    expect(matchHeader(header)).toBe(field)
  })
})

describe('parseCsvFile', () => {
  it('round-trips the downloadable sample template with every value intact', async () => {
    const result = await parseCsvFile(csv(generateSampleCsvTemplate()))
    expect(result.errors).toEqual([])
    expect(result.items).toHaveLength(5)
    expect(result.items[0]).toMatchObject({
      taskName: 'Live Runtime Error Listener & Code Auto-Patching System',
      category: 'Core Engineering',
      bac: 10000,
      plannedPercent: 50,
      actualPercent: 40,
      actualCost: 5000
    })
  })

  it('parses currency formatting and percent signs', async () => {
    const result = await parseCsvFile(
      csv('Task,Budget,Planned %,Actual %,Actual Cost\n"API","$12,500.50",50%,40%,"$6,000"')
    )
    expect(result.items[0]).toMatchObject({
      bac: 12500.5,
      plannedPercent: 50,
      actualPercent: 40,
      actualCost: 6000
    })
  })

  it('sanitizes formula injection and counts it', async () => {
    const result = await parseCsvFile(
      csv('Task,Category,BAC,Planned %,Actual %,AC\n=HYPERLINK("x"),@Ops,100,10,10,10')
    )
    expect(result.items[0].taskName).toBe('HYPERLINK("x")')
    expect(result.items[0].category).toBe('Ops')
    expect(result.sanitizedCount).toBe(2)
  })

  it('reports invalid rows with their spreadsheet line number and keeps valid ones', async () => {
    const result = await parseCsvFile(
      csv('Task,BAC,Planned %,Actual %,AC\nGood,100,10,10,10\n,100,10,10,10\nBad,100,150,10,10')
    )
    expect(result.items).toHaveLength(1)
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toMatch(/^Row 3: Missing/)
    expect(result.errors[1]).toMatch(/^Row 4 \(Bad\): Planned % cannot exceed 100%/)
  })
})

describe('parseExcelFile', () => {
  it('reads percent-formatted cells (stored as 0.5) as 50%', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Packages')
    sheet.addRow([
      'Module Name',
      'Budget at Completion (BAC)',
      'Planned %',
      'Actual %',
      'Actual Cost (AC)'
    ])
    const row = sheet.addRow(['Payments API', 20000, 0.5, 0.25, 6000])
    row.getCell(3).numFmt = '0%'
    row.getCell(4).numFmt = '0%'
    sheet.addRow(['Search', 10000, 60, 70, 5000]) // plain numbers stay as written

    const buffer = await workbook.xlsx.writeBuffer()
    const file = new File([buffer], 'packages.xlsx')
    const result = await parseExcelFile(file)

    expect(result.errors).toEqual([])
    expect(result.items[0]).toMatchObject({
      taskName: 'Payments API',
      bac: 20000,
      plannedPercent: 50,
      actualPercent: 25,
      actualCost: 6000
    })
    expect(result.items[1]).toMatchObject({ plannedPercent: 60, actualPercent: 70 })
  })
})
