import { beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

let storage: typeof import('@/lib/storage')

beforeAll(async () => {
  process.env.STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'medsight-'))
  storage = await import('@/lib/storage')
})

describe('storage', () => {
  it('saves and reads a file', async () => {
    const key = await storage.saveReportFile(Buffer.from('hi'), 'application/pdf')
    expect((await storage.readReportFile(key)).toString()).toBe('hi')
  })

  it('blocks path traversal', async () => {
    await expect(storage.readReportFile('../../etc/passwd')).rejects.toThrow()
  })

  it('only accepts PDF and images', () => {
    expect(storage.isSupportedMimeType('image/png')).toBe(true)
    expect(storage.isSupportedMimeType('text/html')).toBe(false)
  })
})
