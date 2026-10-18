import { mkdir, writeFile, readFile, unlink } from 'fs/promises'
import path from 'path'
import { randomBytes } from 'crypto'

/**
 * Uploaded reports are kept outside /public so they are never served
 * statically — access always goes through an authenticated route.
 */
const STORAGE_ROOT = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage', 'reports')

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
}

export function isSupportedMimeType(mimeType: string) {
  return mimeType in EXTENSION_BY_MIME
}

/** Saves the bytes and returns an opaque storage key. */
export async function saveReportFile(buffer: Buffer, mimeType: string): Promise<string> {
  const extension = EXTENSION_BY_MIME[mimeType] ?? 'bin'
  const key = `${randomBytes(16).toString('hex')}.${extension}`
  await mkdir(STORAGE_ROOT, { recursive: true })
  await writeFile(resolveKey(key), buffer)
  return key
}

export async function readReportFile(key: string): Promise<Buffer> {
  return readFile(resolveKey(key))
}

export async function deleteReportFile(key: string): Promise<void> {
  await unlink(resolveKey(key)).catch(() => {})
}

/**
 * Resolves a storage key to an absolute path, rejecting anything that
 * escapes the storage root (path traversal via a tampered key).
 */
function resolveKey(key: string): string {
  const resolved = path.resolve(STORAGE_ROOT, key)
  if (resolved !== path.join(STORAGE_ROOT, path.basename(resolved))) {
    throw new Error('Invalid storage key')
  }
  return resolved
}
