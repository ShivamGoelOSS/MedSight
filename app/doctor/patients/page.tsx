import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import AppNav from '@/components/AppNav'
import PatientHistoryExplorer from '@/components/PatientHistoryExplorer'

export default async function DoctorPatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>
}) {
  const { patient } = await searchParams
  const user = await getCurrentUser()

  if (!user) redirect('/login')
  if (user.role !== 'DOCTOR') redirect('/patient')

  return (
    <div className="min-h-screen bg-background-light">
      <AppNav />

      <main className="max-w-3xl mx-auto px-6 py-16 flex flex-col gap-6">
        <Link href="/doctor" className="flex items-center gap-1 text-sm font-semibold text-slate-custom hover:text-background-dark transition-colors w-fit">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to Dashboard
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 p-8">
          <h2 className="text-2xl font-black text-background-dark mb-1">Patient History</h2>
          <p className="text-sm text-slate-custom mb-8">Review a patient&apos;s full report timeline.</p>
          <PatientHistoryExplorer initialPatientId={patient ?? null} />
        </div>
      </main>
    </div>
  )
}
