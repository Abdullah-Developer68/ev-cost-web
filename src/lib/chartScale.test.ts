import { describe, it, expect } from 'vitest'
import { niceScale } from './chartScale'

describe('niceScale', () => {
  it('rounds the axis to clean steps that cover the data', () => {
    expect(niceScale(13750)).toEqual({ max: 15000, ticks: [0, 5000, 10000, 15000] })
    expect(niceScale(51000)).toEqual({ max: 60000, ticks: [0, 20000, 40000, 60000] })
    expect(niceScale(1700).ticks).toEqual([0, 500, 1000, 1500, 2000])
    expect(niceScale(9).max).toBeGreaterThanOrEqual(9)
  })

  it('never returns an empty or zero-width scale', () => {
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] })
    expect(niceScale(NaN)).toEqual({ max: 1, ticks: [0, 1] })
  })
})
