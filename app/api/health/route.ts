import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Liveness: the process is up and serving. Deliberately checks no dependencies,
// so a database or Gemini outage never causes Kubernetes to restart the pod.
export function GET() {
  return NextResponse.json({ status: 'ok' })
}
