# MedSight — Medical Report Analysis Platform

MedSight turns complex medical reports into clear, actionable summaries using Google's Gemini AI, and connects patients with a doctor who can review those reports and send feedback.

> **Demo / educational project.** It stores real medical data in a local SQLite file with no encryption at rest, and has not been reviewed for HIPAA/GDPR compliance. See [Limitations](#limitations) before using it with anyone's real health data.

## Features

### For patients
- **Upload reports** — PDF or image (PNG/JPG), up to 10MB, analyzed by Gemini
- **AI summary** — key findings, test results, suggested medications, and questions to ask your doctor
- **Connect with a doctor** — search by name, email, or ID; switch doctors at any time
- **Report history** — every report you've uploaded, with your doctor's feedback
- **Daily rehabilitation** — check off tasks your doctor assigned, with a 7-day streak view

### For doctors
- **Review queue** — pending-review count, with the AI summary and the original document
- **Give feedback** — written feedback per report, visible to the patient immediately
- **Patient history** — search your patients, then see a chronological timeline of their visits
- **Health analytics** — trend sparklines per test value across visits (e.g. hemoglobin rising over three visits)
- **Assign rehab tasks** — per patient, with adherence tracking

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: SQLite via Prisma 7 (`@prisma/adapter-better-sqlite3`)
- **Auth**: email + password (bcrypt), DB-backed sessions in an httpOnly cookie
- **AI**: Google Generative AI (Gemini)
- **Styling**: Tailwind CSS · Material Symbols icons · Inter

## DevOps: run on Kubernetes

This branch adds a container image, Kubernetes deployment, CI/CD, monitoring and security checks on top of the
[baseline](docs/BASELINE.md). Design notes, failure handling, SLOs and the runbook are in
[docs/OPERATIONS.md](docs/OPERATIONS.md). Test results are in [docs/EVIDENCE.md](docs/EVIDENCE.md).

What was added:

- `Dockerfile`: multi-stage build, runs as non-root, APP_VERSION set to the git SHA
- `charts/medsight/`: Helm chart (Deployment, PVC, Service, NetworkPolicy, probes, ServiceMonitor, alerts, dashboard)
- `.github/workflows/ci-cd.yml`: lint, typecheck, tests, Trivy scans, image build and push, approved release
- `deploy/argocd/application.yaml`: Argo CD app that deploys the chart from git
- `deploy/kind-config.yaml`, `deploy/monitoring/`: local cluster, Prometheus/Grafana settings, Jaeger
- `observability/otel.js`: metrics on port 9464, traces to Jaeger, JSON request logs
- `scripts/smoke-test.sh`: checks a basic user journey against the running app

### Prerequisites

Docker with at least 6 GB of memory, kind, kubectl, helm, make and openssl (`brew install kind helm kubectl`).
A Gemini API key is optional. Without it the app still runs and shows sample mode, but uploads can't be analysed.

### Build and deploy

```bash
make up        # kind cluster, Argo CD, Prometheus/Grafana and Jaeger (about 5 minutes)
cp .env.example .env   # optional: add GEMINI_API_KEY
make secret    # creates the Kubernetes Secret from .env
make app       # registers the app with Argo CD, which deploys it from git
make status    # Argo CD sync state, pods and running version
make smoke     # sign up, session, patient API and logout against http://localhost:8080
```

To release a change, push to `devops` (or `main`). The pipeline tests, scans and builds
`ghcr.io/shivamgoeloss/medsight:<sha>`, then waits for approval on the `production` environment
(open the run, Review deployments, Approve). After approval it commits the new image tag and Argo CD
rolls it out within about 3 minutes.

To build the image locally: `docker build --build-arg APP_VERSION=$(git rev-parse HEAD) -t medsight .`

### Access

- MedSight: http://localhost:8080
- Argo CD, Grafana, Prometheus and Jaeger: run `make urls` for the port-forward commands and how to get the passwords
- Grafana dashboard: "MedSight service health"

### Known limitations

Single node and single replica because of SQLite, no volume backups, the Secret is created by hand, no alert
paging, and traces are kept in memory. See [docs/OPERATIONS.md](docs/OPERATIONS.md#known-limitations).

## Getting Started (local development)

### Prerequisites

- Node.js 20+
- A Google Gemini API key — see [Getting a Gemini API key](#getting-a-gemini-api-key)

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

   Prisma and `better-sqlite3` need their install scripts to run. If npm reports them as
   blocked, approve them and rebuild:

   ```bash
   npm install-scripts approve prisma @prisma/engines better-sqlite3
   npm rebuild prisma @prisma/engines better-sqlite3
   ```

2. Create your environment file from the template and add your Gemini API key:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and replace `your_gemini_api_key_here` with your real key. It already
   contains the SQLite connection string (`DATABASE_URL="file:./dev.db"`), which Prisma needs.

   Environment files are gitignored, so a fresh clone starts with **no accounts, reports, or
   uploaded files** — you create your own on first run.

3. Create the database and generate the client:

   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000), then **Sign up** — choose *Patient*
   or *Doctor*. To try the full flow, create one of each: sign up as a doctor first, then as a
   patient, connect the patient to that doctor, and upload a report.

### Getting a Gemini API key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in and create an API key

Newly issued keys start with `AQ.` — Google retired the older `AIzaSy…` format in 2026, so an
`AQ.` key is expected and correct.

## Project Structure

```
app/
├── api/
│   ├── analyze-report/          # Upload + Gemini analysis (patient-only)
│   ├── auth/                    # signup, login, logout, me
│   ├── doctors/                 # list doctors (for the patient picker)
│   ├── doctor/
│   │   ├── reports/             # review queue + per-report feedback
│   │   ├── patients/            # patient list, per-patient history, rehab tasks
│   │   └── rehab-tasks/[id]/    # activate / deactivate a task
│   ├── patient/                 # own reports, doctor selection, rehab tasks
│   └── reports/[id]/file/       # authenticated original-document download
├── dashboard/                   # split-pane report viewer
├── doctor/                      # doctor dashboard + /doctor/patients
├── patient/                     # patient dashboard
├── upload/                      # upload page (login required)
└── health-profile/              # the patient's own report history
components/                      # AppNav, pickers, lists, charts, viewers
lib/
├── auth.ts                      # password hashing + session helpers
├── prisma.ts                    # Prisma client singleton
├── storage.ts                   # original-file storage on disk
├── analytics.ts                 # test-value progression / trends
└── dates.ts
prisma/schema.prisma             # User, Session, Report, RehabTask, RehabCompletion
storage/reports/                 # uploaded files (gitignored)
```

## Roles and access control

| Route | Who can access |
|---|---|
| `/`, `/login`, `/signup`, `/dashboard` | anyone (`/dashboard` shows sample data when not signed in) |
| `/upload`, `/health-profile`, `/patient` | patients only |
| `/doctor`, `/doctor/patients` | doctors only |
| `POST /api/analyze-report` | patients only |
| `GET /api/reports/[id]/file` | the owning patient, or the doctor the report was sent to |

Signing in as the wrong role redirects to that role's own dashboard rather than erroring.

## Data model

- **User** — email, bcrypt password hash, name, `PATIENT` or `DOCTOR`; patients have an
  optional `doctorId`
- **Session** — random token, expiry (7 days), stored server-side and referenced by cookie
- **Report** — owning patient, assigned doctor, filename/mime/storage key for the original
  file, the AI analysis as JSON, `PENDING`/`REVIEWED` status, and the doctor's feedback
- **RehabTask** / **RehabCompletion** — assigned tasks and one completion row per task per day

Uploaded files are written to `storage/reports/` (outside `public/`) and are only reachable
through the authenticated route above. A report uploaded before file storage was added has no
original on disk; the viewer says so instead of implying the rendered values are the source
document.

## Customization

### Colors

Defined in `tailwind.config.js`:

```js
colors: {
  'primary': '#37ec13',              // Main brand color (green)
  'background-light': '#f6f8f6',     // Light mode background
  'background-dark': '#132210',      // Dark mode background
  'slate-custom': '#475569',         // Custom slate
  'sage-custom': '#688961',          // Custom sage
}
```

### Gemini model

`app/api/analyze-report/route.ts` tries `gemini-3.6-flash` first and falls back to
`gemini-2.5-flash`, then `gemini-1.5-flash`, if a model isn't available to your key:

```typescript
let model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build (also type-checks and lints)
- `npm start` — start the production server (with metrics, tracing and JSON logs)
- `npm run lint` — run ESLint
- `npm run typecheck` — TypeScript check
- `npm test` — unit tests (Vitest)
- `npx prisma studio` — browse the local database

## Supported File Types

- **PDF**: `.pdf` (sent directly to the model; no local parsing)
- **Images**: `.png`, `.jpg`, `.jpeg`
- **Max size**: 10MB, enforced both in the browser and on the server

## Troubleshooting

**"You must be logged in as a patient to upload a report"**
Uploading requires a signed-in patient account. Doctors are redirected to their own dashboard.

**"Gemini API key not configured"**
Check that `.env.local` exists and contains `GEMINI_API_KEY`, then restart the dev server —
env files are only read at startup.

**"Model not available or not permitted for your key"**
The configured Gemini model was rejected. The server automatically tries older models; if all
fail, check the terminal for the underlying error, which is more specific than the UI message.

**Analysis is slow**
30–60 seconds is normal; large PDFs and rate-limited keys can take longer.

**`PrismaClientInitializationError: ... driver adapter is required`**
Run `npx prisma generate`. Prisma 7 needs the generated client and the SQLite driver adapter.

**Port 3000 in use**
Next.js will offer the next free port, or free it with
`lsof -ti:3000 | xargs kill`.

## Limitations

Known gaps, listed so they aren't mistaken for finished work:

- **No encryption at rest** — the SQLite file and uploaded documents are stored unencrypted
- **No CSRF protection** on state-changing requests, and **no rate limiting** on login
- **No password reset or email verification**
- **Limited automated tests** — unit tests cover analytics and file storage; API routes are checked by `scripts/smoke-test.sh`, not unit tests
- **No email delivery** — reports reach doctors through the dashboard only
- **Symptoms and treatments aren't recorded** — the visit timeline shows AI-extracted lab
  values and doctor feedback, not what the patient reported or what was prescribed
- **Vitals** (BP, pulse, weight) can't be entered directly; charts only cover values the AI
  extracted from uploaded reports
- **No cross-report AI synthesis** — individual values get trend lines, but nothing narrates
  how findings relate to each other
- **SQLite only** — fine locally, but it would need Postgres and object storage to deploy

## License

For educational/demonstration purposes. Not a medical device, and not a substitute for
professional medical advice.

## Acknowledgments

- Icons from Google Material Symbols
- AI powered by Google Gemini
- Built with Next.js, Prisma, and Tailwind CSS
