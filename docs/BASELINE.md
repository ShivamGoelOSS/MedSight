# Baseline

- Name: Shivam Goel
- Student ID: 23BCS10131
- Project: MedSight, a medical report analysis platform
- Repository: https://github.com/ShivamGoelOSS/MedSight
- Baseline commit: [adc316cbcaeea0e8e202d0726e0f202a5151a785](https://github.com/ShivamGoelOSS/MedSight/tree/adc316cbcaeea0e8e202d0726e0f202a5151a785) (main before this work)

## Application

MedSight is a Next.js web app. Patients upload a medical report (PDF or image), Gemini turns it into a
structured summary, and the patient's doctor reviews it and sends feedback. Data is stored in SQLite through
Prisma, and uploaded files are stored on local disk. Login is email and password with sessions in the database.

## Existing DevOps features at the baseline

- No Dockerfile or container setup
- No Kubernetes or deployment config
- No CI/CD workflows
- No automated tests
- No health checks
- No metrics or tracing, only plain console.log output
- No security scanning
- Secrets in a git-ignored .env file (kept as is)
- Run by hand with `npm run dev`

Everything else in the pull request is new.
