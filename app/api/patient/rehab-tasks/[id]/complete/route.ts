import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export async function POST(_request: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise
  const user = await getCurrentUser()
  if (!user || user.role !== 'PATIENT') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const task = await prisma.rehabTask.findUnique({ where: { id: params.id } })
  if (!task || task.patientId !== user.id) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const date = today()
  const existing = await prisma.rehabCompletion.findUnique({
    where: { taskId_date: { taskId: task.id, date } },
  })

  if (existing) {
    await prisma.rehabCompletion.delete({ where: { id: existing.id } })
    return NextResponse.json({ completed: false })
  }

  await prisma.rehabCompletion.create({ data: { taskId: task.id, date } })
  return NextResponse.json({ completed: true })
}
