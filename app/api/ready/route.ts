import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Only take traffic if the database works. Gemini is not checked.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ready' })
  } catch (error: any) {
    console.error('Readiness check failed:', error.message)
    return NextResponse.json({ status: 'unavailable' }, { status: 503 })
  }
}