import { describe, expect, it } from 'vitest'
import { buildTestProgressions, extractNumericValue } from '@/lib/analytics'

describe('extractNumericValue', () => {
  it('reads a number from the result text', () => {
    expect(extractNumericValue({ testName: 'Hb', result: '11.2 g/dL' })).toBe(11.2)
  })
  it('returns null when there is no number', () => {
    expect(extractNumericValue({ testName: 'Urine', result: 'Negative' })).toBeNull()
  })
})

describe('buildTestProgressions', () => {
  const report = (createdAt: string, value: number) => ({
    createdAt,
    analysis: { testResults: [{ testName: 'Hemoglobin', result: `${value} g/dL` }] },
  })

  it('sorts oldest first and finds the trend', () => {
    const [hb] = buildTestProgressions([report('2026-03-01', 13), report('2026-01-01', 11)])
    expect(hb.points.map((p) => p.value)).toEqual([11, 13])
    expect(hb.trend).toBe('up')
  })

  it('skips tests with only one reading', () => {
    expect(buildTestProgressions([report('2026-01-01', 11)])).toEqual([])
  })
})
