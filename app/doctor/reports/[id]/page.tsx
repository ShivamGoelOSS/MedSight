import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AppNav from '@/components/AppNav'
import OriginalDocument from '@/components/OriginalDocument'
import ReportAnalysisPanel from '@/components/ReportAnalysisPanel'
import DoctorFeedbackPanel from '@/components/DoctorFeedbackPanel'

export default async function DoctorReportPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise
  const user = await getCurrentUser()

  if (!user) redirect('/login')
  if (user.role !== 'DOCTOR') redirect('/patient')

  const report = await prisma.report.findUnique({
    where: { id: params.id },
    include: { patient: { select: { id: true, name: true, email: true } } },
  })

  // Only the doctor this report was actually sent to
  if (!report || report.doctorId !== user.id) notFound()

  const analysis = JSON.parse(report.analysisJson)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <AppNav />

      <main className="flex-1 flex flex-col min-w-0 bg-background-light overflow-hidden">
        {/* Patient context header */}
        <header className="bg-white border-b border-primary/10 px-4 sm:px-8 py-3 shrink-0 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/doctor"
              className="flex items-center gap-1 text-sm font-semibold text-slate-custom hover:text-background-dark transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              <span className="hidden sm:inline">Queue</span>
            </Link>
            <div className="h-8 w-px bg-stone-200 shrink-0" />
            <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
              <span className="material-symbols-outlined text-primary">personal_injury</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-background-dark truncate">{report.patient.name}</p>
              <p className="text-xs text-stone-500 truncate">{report.patient.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <p className="text-xs text-stone-500 hidden sm:block">
              Uploaded {new Date(report.createdAt).toLocaleDateString('en-US')}
            </p>
            <Link href={`/doctor/patients?patient=${report.patient.id}`}>
              <button className="flex items-center gap-2 bg-background-dark text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-all">
                <span className="material-symbols-outlined text-lg">history</span>
                <span className="hidden sm:inline">Full history</span>
              </button>
            </Link>
          </div>
        </header>

        {/* Same split-pane view the patient sees */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          <div className="w-full lg:w-1/2 p-4 sm:p-6 lg:overflow-y-auto custom-scrollbar border-b lg:border-b-0 lg:border-r border-primary/10 flex flex-col bg-stone-100">
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-widest flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-lg">attachment</span>
              Original Document
            </h3>
            <OriginalDocument
              reportId={report.storageKey ? report.id : null}
              mimeType={report.mimeType}
              fileName={report.fileName}
              testResults={analysis.testResults ?? []}
              reportDate={analysis.reportDate}
              reportType={analysis.reportType}
            />
          </div>

          <ReportAnalysisPanel
            analysis={analysis}
            reportType={analysis.reportType}
            generatedOn={new Date(report.createdAt).toLocaleDateString('en-US')}
            questionsTitle="Questions the patient wants to ask"
            interactiveQuestions={false}
            footer={
              <DoctorFeedbackPanel
                reportId={report.id}
                status={report.status}
                existingFeedback={report.feedback}
              />
            }
          />
        </div>
      </main>
    </div>
  )
}
