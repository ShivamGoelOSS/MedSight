import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise
  const user = await getCurrentUser()
  if (!user || user.role !== 'DOCTOR') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { feedback } = await request.json()
  if (!feedback || !feedback.trim()) {
    return NextResponse.json({ error: 'Feedback text is required' }, { status: 400 })
  }

  const report = await prisma.report.findUnique({ where: { id: params.id } })
  if (!report || report.doctorId !== user.id) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  const updated = await prisma.report.update({
    where: { id: report.id },
    data: { feedback, status: 'REVIEWED', reviewedAt: new Date() },
  })

  return NextResponse.json({
    success: true,
    report: { id: updated.id, status: updated.status, feedback: updated.feedback, reviewedAt: updated.reviewedAt },
  })
}
