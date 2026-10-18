# Local environment: kind + Argo CD + Prometheus/Grafana + Jaeger.
# Run `make up` once, then `make secret` and `make app`.
ARGOCD_VERSION := v3.5.5
KPS_VERSION    := 92.10.1
CLUSTER        := medsight

.PHONY: up cluster platform secret app smoke status urls down

up: cluster platform

cluster:
	kind get clusters | grep -qx $(CLUSTER) || kind create cluster --config deploy/kind-config.yaml

platform:
	kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -n argocd --server-side --force-conflicts \
	  -f https://raw.githubusercontent.com/argoproj/argo-cd/$(ARGOCD_VERSION)/manifests/install.yaml
	helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null
	helm upgrade --install kps prometheus-community/kube-prometheus-stack --version $(KPS_VERSION) \
	  -n monitoring --create-namespace -f deploy/monitoring/kube-prometheus-stack-values.yaml \
	  --set grafana.adminPassword=$$(openssl rand -hex 12) --wait --timeout 10m
	kubectl apply -f deploy/monitoring/jaeger.yaml
	kubectl -n argocd rollout status deploy/argocd-server --timeout=5m

# Creates the app Secret from the local, git-ignored .env (GEMINI_API_KEY is optional:
# without it the app runs and serves sample mode, but uploads cannot be analysed).
secret:
	kubectl create namespace medsight --dry-run=client -o yaml | kubectl apply -f -
	set -a; [ -f .env ] && . ./.env; set +a; \
	kubectl -n medsight create secret generic medsight-secrets \
	  --from-literal=GEMINI_API_KEY="$${GEMINI_API_KEY:-}" --dry-run=client -o yaml | kubectl apply -f -

# Registers the app with Argo CD; from here on, deployments come from git.
app:
	kubectl apply -f deploy/argocd/application.yaml

smoke:
	./scripts/smoke-test.sh http://localhost:8080

status:
	kubectl -n argocd get application medsight -o jsonpath='{.status.sync.status} {.status.health.status} rev={.status.sync.revision}{"\n"}'
	kubectl -n medsight get deploy,pods,pvc,svc -o wide
	curl -s http://localhost:8080/api/version; echo

urls:
	@echo "MedSight:   http://localhost:8080"
	@echo "Argo CD:    kubectl -n argocd port-forward svc/argocd-server 8443:443   -> https://localhost:8443 (user: admin)"
	@echo "            password: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"
	@echo "Grafana:    kubectl -n monitoring port-forward svc/kps-grafana 3000:80       -> http://localhost:3000 (user: admin)"
	@echo "            password: kubectl -n monitoring get secret kps-grafana -o jsonpath='{.data.admin-password}' | base64 -d"
	@echo "Prometheus: kubectl -n monitoring port-forward svc/kps-kube-prometheus-stack-prometheus 9090 -> http://localhost:9090"
	@echo "Jaeger:     kubectl -n monitoring port-forward svc/jaeger 16686                -> http://localhost:16686"

down:
	kind delete cluster --name $(CLUSTER)
