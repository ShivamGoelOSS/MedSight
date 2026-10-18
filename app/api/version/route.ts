import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// APP_VERSION is set to the git commit SHA when the image is built.
export function GET() {
  return NextResponse.json({ version: process.env.APP_VERSION || 'dev' })
}