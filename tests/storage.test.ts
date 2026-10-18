import { beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

let storage: typeof import('@/lib/storage')

beforeAll(async () => {
  process.env.STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'medsight-'))
  storage = await import('@/lib/storage')
})

describe('report storage', () => {
  it('round-trips a saved file', async () => {
    const key = await storage.saveReportFile(Buffer.from('report'), 'application/pdf')
    expect(key).toMatch(/^[0-9a-f]{32}\.pdf$/)
    expect((await storage.readReportFile(key)).toString()).toBe('report')
  })

  it('rejects keys that escape the storage directory', async () => {
    await expect(storage.readReportFile('../../etc/passwd')).rejects.toThrow('Invalid storage key')
  })

  it('only accepts PDF and image uploads', () => {
    expect(storage.isSupportedMimeType('image/png')).toBe(true)
    expect(storage.isSupportedMimeType('text/html')).toBe(false)
  })
})
