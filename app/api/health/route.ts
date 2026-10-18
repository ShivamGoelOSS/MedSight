import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Liveness: is the process up.
export function GET() {
  return NextResponse.json({ status: 'ok' })
}