# Baseline

| | |
|---|---|
| Name | Shivam Goel |
| Student ID | 23BCS10131 |
| Project | MedSight — Medical Report Analysis Platform |
| Repository | https://github.com/ShivamGoelOSS/MedSight |
| Baseline commit | [`adc316cbcaeea0e8e202d0726e0f202a5151a785`](https://github.com/ShivamGoelOSS/MedSight/tree/adc316cbcaeea0e8e202d0726e0f202a5151a785) (tip of `main` before this work) |

## Application

MedSight is a Next.js web app. Patients upload a medical report (PDF or image), Google Gemini turns it into
a structured summary, and the patient's doctor reviews it and sends feedback. Data is stored in SQLite (via
Prisma) and uploaded files on local disk. Sign-in uses email and password with sessions stored in the database.

## DevOps features already in the baseline

| Area | At the baseline commit |
|---|---|
| Containerisation | None (no Dockerfile) |
| Kubernetes / deployment config | None |
| CI/CD | None (no workflows) |
| Automated tests | None (README: "No automated test suite") |
| Health checks | None |
| Metrics, logs and traces | Unstructured `console.log` only |
| Security scanning | None |
| Secrets | `.env` file, git-ignored (kept) |
| How it ran | `npm run dev` on a developer machine |

Everything else in [the PR](../README.md#devops-run-on-kubernetes) is new work.
