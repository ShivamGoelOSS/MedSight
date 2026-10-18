# Operations

Notes on how MedSight is built, deployed and run, and why.

## Components

- Next.js app: UI, API, login and report analysis. One container, port 3000 for traffic and 9464 for metrics.
- migrate init container: runs `prisma migrate deploy` before the app starts.
- PVC medsight-data: holds the SQLite database and uploaded files, so they survive restarts and releases.
- Gemini API: external dependency, only used when a patient uploads a report.
- Prometheus and Grafana: metrics, SLO rules and a dashboard.
- Jaeger: traces, kept in memory.
- Argo CD: keeps the cluster in sync with the Helm chart in git.
- GitHub Actions: tests, scans, builds the image and creates the release commit.

Namespaces: medsight (app), monitoring (Prometheus, Grafana, Jaeger), argocd.

## Request path

1. The browser opens http://localhost:8080. kind publishes this on 127.0.0.1 only and forwards it to port 30080 on the node.
2. kube-proxy sends NodePort 30080 to the medsight Service, which only includes pods that are Ready, and on to the pod on port 3000.
3. Next.js handles the request. Signed-in requests read the session cookie and query SQLite at /data/medsight.db on the PVC.
4. On upload, the file is saved under /data/reports and sent to Gemini over HTTPS.
5. Each request writes one JSON log line with a trace_id, updates the request duration metric and sends a trace to Jaeger.

## Failure boundaries

- Gemini down, out of quota or no key: uploads fail with an error, everything else works. Readiness does not check Gemini on purpose, so the pod keeps serving. Seen in the Gemini dashboard panel and the MedSightGeminiErrors alert.
- Database not usable: /api/ready returns 503 and the pod is taken out of the Service. Liveness does not check the database, so it does not go into a restart loop.
- App process hangs or crashes: the liveness probe fails and the kubelet restarts the container.
- Bad release: the new pod never becomes Ready, the old pod keeps serving because maxUnavailable is 0. MedSightRolloutStuck fires after 3 minutes.
- Node or cluster lost: full outage. This is a single node setup and the volume only exists on that node.
- Monitoring or Argo CD down: users are not affected. We lose visibility or new releases wait.

## From commit to running version

1. A push to any branch runs .github/workflows/ci-cd.yml.
2. verify: npm ci, lint, typecheck, unit tests, helm lint.
3. security-scan: Trivy checks dependencies, committed secrets and the Dockerfile and chart. Fixable HIGH or CRITICAL findings fail the run.
4. build: builds the image with APP_VERSION set to the commit SHA, scans it with Trivy, then pushes ghcr.io/shivamgoeloss/medsight:<sha>.
5. deploy (devops and main only): waits for approval on the production environment, then commits the new image tag to charts/medsight/values.yaml.
6. Argo CD picks up the commit (it polls every 3 minutes) and applies the chart. The new pod runs migrations and has to pass its probes before the old pod is removed.
7. Check with `make status` and `make smoke`.

Everything up to a scanned image is automatic. Changing what users run needs an approval, because there is only one environment, it holds real data, and migrations only go forward.

The running version can be traced through the commit SHA. It is the image tag, the APP_VERSION env var, the /api/version response, the service_version label on metrics and traces, the version field in logs and the app.kubernetes.io/version label on the pod. Argo CD shows the synced git revision, and each release commit links to its pipeline run.

## Releases and rollback

- Strategy: rolling update with maxSurge 1 and maxUnavailable 0. No downtime, and a version that fails readiness never gets traffic.
- Why not canary or blue-green: both need two versions running against the same SQLite file, which is not safe. With Postgres I would use Argo Rollouts with a canary.
- Rollback: `git revert` the bad commit (or just the release commit) and push, then approve. Git stays the source of truth.
- Emergency rollback: Argo CD history and rollback, after turning off auto-sync.
- Drift: selfHeal undoes manual changes in the cluster, prune removes things deleted from git. The PVC is excluded from pruning.
- Migrations are forward only. Undoing a schema change means restoring the volume, so schema changes should stay backward compatible.

## SLOs and alerts

Healthy means the pod is Ready, /api/ready returns 200, `make smoke` passes, at least 99% of requests are not 5xx and p95 GET latency is under 500 ms. Probe requests are left out of the metrics.

- Availability SLO: 99% of requests are not 5xx. Recording rule medsight:request_error_ratio:rate1h.
- Latency SLO: p95 of GET requests under 500 ms. Recording rule medsight:get_latency_p95:rate5m. Uploads are POST and wait on Gemini for 30 to 60 seconds, so they are not part of this.

After any fix, recovery is confirmed when the alert clears, the pod is Ready with the expected /api/version, the error ratio on the dashboard is back under 1% and `make smoke` passes.

### MedSightDown

No healthy scrape target for 2 minutes. Run `kubectl -n medsight get pods` and `kubectl -n medsight describe pod -l app.kubernetes.io/name=medsight`. Look for CrashLoopBackOff, Pending or ImagePullBackOff, and check `kubectl -n medsight logs deploy/medsight --previous`. If it started with a release, roll back.

### MedSightErrorBudgetBurn

The 5xx ratio is above 14.4% over both 1 hour and 5 minutes, which uses 2% of the monthly error budget per hour. If the errors are on POST /api/analyze-report and the Gemini panel shows failures, see MedSightGeminiErrors. Otherwise find the failing paths with `kubectl -n medsight logs deploy/medsight | grep '"status":5'` and look up the trace_id in Jaeger.

### MedSightLatencySLO

p95 GET latency above 500 ms for 10 minutes. Check pod CPU and memory on the dashboard, then look for slow spans in Jaeger.

### MedSightRolloutStuck

A new version did not become Ready within 3 minutes. Users are still on the old pod. Check `kubectl -n medsight logs <new pod> -c migrate` and `-c medsight`, then fix forward or revert the release commit.

### MedSightGeminiErrors

More than half of Gemini calls failing for 5 minutes. 429 means quota, 403 means the key or project is blocked, no status code means a network problem. Update the key with `make secret` and `kubectl -n medsight rollout restart deploy/medsight`.

## Security

- Secrets: the Gemini key only lives in a Kubernetes Secret created from the local .env file, which is git-ignored. It is not in git, the image or CI. The Grafana password is generated at install time. CI only uses the built-in GITHUB_TOKEN.
- Pipeline: read-only permissions by default, package write only in build, contents write only in deploy. Actions are pinned to commit SHAs and the Trivy image to a digest. Releases need an approval.
- Scanning: Trivy on dependencies, secrets, config and the final image. It found critical issues in the original dependencies, which is why Next.js went from 14 to 15 and jspdf from 2 to 4, and why the image installs OS updates.
- Container: runs as a non-root user with a read-only root filesystem, no capabilities, no privilege escalation and the default seccomp profile. npm is removed from the image.
- Kubernetes API: the app has its own service account with no permissions and no token mounted.
- Network: the app is only on 127.0.0.1:8080. Metrics are cluster-internal. Grafana, Prometheus, Argo CD and Jaeger are only reachable with port-forward. The NetworkPolicy allows inbound traffic on 3000 (and 9464 from monitoring), and outbound only to DNS, Jaeger and public HTTPS.

## Linux and networking

- The app runs as an unprivileged user. Image files are owned by root and read-only. The only writable paths are volumes: /data, /tmp and .next/cache.
- Node is PID 1 in the container. On SIGTERM it flushes telemetry and exits, and Kubernetes waits up to 30 seconds.
- Traffic goes through Docker port publishing on loopback, kube-proxy iptables rules for the NodePort and Service, and cluster DNS names like jaeger.monitoring.svc.
- The NetworkPolicy acts as a firewall. Outbound HTTPS is limited to public addresses by excluding the private ranges 10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16.
- Deployment is pull based: GitHub never needs to reach the laptop, Argo CD pulls from GitHub and GHCR.

## Decisions

- Deployment with one replica and no autoscaling, because SQLite only supports one writer. With Postgres and object storage I would run 2 or more replicas with an HPA and a PodDisruptionBudget.
- Deployment instead of StatefulSet, because there is one volume and no need for a stable pod identity. A StatefulSet also stops the old pod before starting the new one, which means downtime.
- A ReadWriteOnce volume with a surge rollout works here because kind has one node. On several nodes I would switch to the Recreate strategy or move the data out of the pod.
- NodePort on loopback instead of an Ingress, because there is one service and it is local. With more services or TLS I would add a Gateway or Ingress.
- Helm with one values file, so there are no copied manifests. More environments would get their own values file.
- Argo CD instead of CI running kubectl, because GitHub cannot reach a local cluster and Argo CD also gives drift detection and history.
- Manual approval before release, because it is the only environment. With a staging environment I would deploy there automatically and keep the approval for production.
- Logs through kubectl logs, in JSON with trace_id. With more services I would add Loki.

## Known limitations

- Single node and single replica, so a node failure is a full outage. The volume is not backed up.
- The Secret is created by hand. A shared setup should use Sealed Secrets or an external secret manager.
- Alerts show in Prometheus and Grafana, but nobody gets paged.
- Jaeger and Prometheus lose their data if their pods restart.
- Argo CD follows the devops branch until the PR is merged.
- The app's own limitations listed in the README (no encryption at rest, no CSRF protection or rate limiting) are out of scope.
