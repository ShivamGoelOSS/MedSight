import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function PATCH(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise
  const user = await getCurrentUser()
  if (!user || user.role !== 'DOCTOR') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const task = await prisma.rehabTask.findUnique({ where: { id: params.id } })
  if (!task || task.doctorId !== user.id) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const { active } = await request.json()
  const updated = await prisma.rehabTask.update({
    where: { id: task.id },
    data: { active: Boolean(active) },
  })

  return NextResponse.json({ task: updated })
}
