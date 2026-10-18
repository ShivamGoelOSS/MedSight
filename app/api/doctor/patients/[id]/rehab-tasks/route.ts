import { NextRequest, NextResponse } from 'next/server'
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

  const tasks = await prisma.rehabTask.findMany({
    where: { patientId: patient.id },
    include: { completions: { orderBy: { date: 'desc' }, take: 7 } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      active: t.active,
      createdAt: t.createdAt,
      recentCompletions: t.completions.map((c) => c.date),
    })),
  })
}

export async function POST(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise
  const user = await getCurrentUser()
  if (!user || user.role !== 'DOCTOR') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const patient = await prisma.user.findUnique({ where: { id: params.id } })
  if (!patient || patient.role !== 'PATIENT' || patient.doctorId !== user.id) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const { title, description } = await request.json()
  if (!title || !title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const task = await prisma.rehabTask.create({
    data: { patientId: patient.id, doctorId: user.id, title, description: description || null },
  })

  return NextResponse.json({ task })
}
