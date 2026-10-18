import { describe, expect, it } from 'vitest'
import { buildTestProgressions, extractNumericValue } from '@/lib/analytics'

describe('extractNumericValue', () => {
  it('prefers the numeric value field', () => {
    expect(extractNumericValue({ testName: 'Hb', result: '12 g/dL', value: 13.5 })).toBe(13.5)
  })

  it('parses a number out of the result text', () => {
    expect(extractNumericValue({ testName: 'Hb', result: '11.2 g/dL' })).toBe(11.2)
  })

  it('returns null when there is no number', () => {
    expect(extractNumericValue({ testName: 'Urine', result: 'Negative' })).toBeNull()
  })
})

describe('buildTestProgressions', () => {
  const report = (createdAt: string, value: number) => ({
    createdAt,
    analysis: { testResults: [{ testName: 'Hemoglobin', result: `${value} g/dL`, unit: 'g/dL' }] },
  })

  it('orders points oldest first and computes the trend', () => {
    const [hb] = buildTestProgressions([report('2026-03-01', 13), report('2026-01-01', 11), report('2026-02-01', 12)])
    expect(hb.points.map((p) => p.value)).toEqual([11, 12, 13])
    expect(hb.trend).toBe('up')
  })

  it('skips tests with a single reading', () => {
    expect(buildTestProgressions([report('2026-01-01', 11)])).toEqual([])
  })
})
