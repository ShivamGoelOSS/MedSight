import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Readiness: only receive traffic when the database is reachable. Gemini is not
// checked. Without it the app still serves logins, history and sample mode.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ready' })
  } catch (error: any) {
    console.error('Readiness check failed:', error.message)
    return NextResponse.json({ status: 'unavailable', reason: 'database' }, { status: 503 })
  }
}
