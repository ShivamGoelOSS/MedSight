import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// APP_VERSION is baked into the image at build time (the git commit SHA),
// so the running version can be traced back to its source commit.
export function GET() {
  return NextResponse.json({ version: process.env.APP_VERSION || 'dev' })
}
