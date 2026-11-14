import { describe, it, expect } from 'vitest'
import { buildWorkPackagesCsv, csvTextCell, slugify } from './csvExport'
import { parseCsvFile } from './fileParser'

describe('csv export', () => {
  it('neutralises formulas and escapes quotes in text cells', () => {
    expect(csvTextCell('=1+1')).toBe(`"'=1+1"`)
    expect(csvTextCell(' @cmd')).toBe(`"' @cmd"`)
    expect(csvTextCell('Say "hi"')).toBe('"Say ""hi"""')
  })

  it('writes the full EVM breakdown, with negative variances as plain numbers', () => {
    const csv = buildWorkPackagesCsv([
      {
        taskName: 'Benchmark',
        category: 'Core',
        bac: 10000,
        plannedPercent: 50,
        actualPercent: 40,
        actualCost: 5000
      }
    ])
    const [header, row] = csv.split('\r\n')
    expect(header).toContain('"TCPI"')
    expect(row).toBe(
      '"Benchmark","Core",10000,50,40,5000,5000,4000,-1000,-1000,0.8,0.8,12500,7500,-2500,1.2,-25,-20,-25,""'
    )
  })

  it('leaves percentage variances empty when their base is zero', () => {
    const csv = buildWorkPackagesCsv([
      {
        taskName: 'Not started',
        category: 'Core',
        bac: 0,
        plannedPercent: 0,
        actualPercent: 0,
        actualCost: 0
      }
    ])
    expect(csv.split('\r\n')[1].endsWith(',,,,""')).toBe(true)
  })

  it('round-trips through the importer', async () => {
    const csv = buildWorkPackagesCsv([
      {
        taskName: 'API',
        category: 'Core',
        bac: 1200,
        plannedPercent: 25,
        actualPercent: 20,
        actualCost: 300
      }
    ])
    const parsed = await parseCsvFile(new File([csv], 'export.csv'))
    expect(parsed.errors).toEqual([])
    expect(parsed.items[0]).toMatchObject({
      taskName: 'API',
      bac: 1200,
      plannedPercent: 25,
      actualPercent: 20,
      actualCost: 300
    })
  })

  it('slugifies file names', () => {
    expect(slugify('Autonomous Code Patching & Telemetry!')).toBe(
      'autonomous-code-patching-telemetry'
    )
    expect(slugify('***')).toBe('project')
  })
})
