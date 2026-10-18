import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(_request: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise
  const user = await getCurrentUser()
  if (!user || user.role !== 'DOCTOR') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const patient = await prisma.user.findUnique({ where: { id: params.id } })
  if (!patient || patient.role !== 'PATIENT' || patient.doctorId !== user.id) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const reports = await prisma.report.findMany({
    where: { patientId: patient.id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    patient: { id: patient.id, name: patient.name, email: patient.email },
    reports: reports.map((r) => ({
      id: r.id,
      fileName: r.fileName,
      status: r.status,
      feedback: r.feedback,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      hasFile: Boolean(r.storageKey),
      mimeType: r.mimeType,
      analysis: JSON.parse(r.analysisJson),
    })),
  })
}
