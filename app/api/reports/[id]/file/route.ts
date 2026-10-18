import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { readReportFile } from '@/lib/storage'

export async function GET(_request: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const report = await prisma.report.findUnique({
    where: { id: params.id },
    select: { patientId: true, doctorId: true, fileName: true, mimeType: true, storageKey: true },
  })

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  // Only the patient who owns the report, or the doctor it was sent to.
  const isOwningPatient = user.role === 'PATIENT' && report.patientId === user.id
  const isAssignedDoctor = user.role === 'DOCTOR' && report.doctorId === user.id
  if (!isOwningPatient && !isAssignedDoctor) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  if (!report.storageKey || !report.mimeType) {
    return NextResponse.json({ error: 'No original file stored for this report' }, { status: 404 })
  }

  try {
    const buffer = await readReportFile(report.storageKey)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': report.mimeType,
        // inline so it renders in the viewer rather than downloading
        'Content-Disposition': `inline; filename="${encodeURIComponent(report.fileName)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Stored file could not be read' }, { status: 404 })
  }
}
