# DevDash

A local Kubernetes observability dashboard — real-time pod metrics, service health, and p50 latency, all in one place.

Built with a **Go backend** (Prometheus instrumented) and a **React/Vite frontend** that queries Prometheus and the Go service directly. Designed to run alongside a local Kubernetes cluster (kind/minikube) with kube-state-metrics and cAdvisor.

> **Note:** This project runs fully locally — it requires a live Kubernetes cluster and Prometheus. There's no cloud deployment because the data sources (Prometheus, kube-state-metrics) are only accessible within the cluster. See [Running Locally](#running-locally) to get it going on your machine.

---

## What It Does

| Section | Data Source | What You See |
|---|---|---|
| **Overview** | Prometheus + Go `/health` | Healthy services, running pods, live projects, p50 latency |
| **Kubernetes Services** | Go `/health` endpoint | Per-service health status and response latency |
| **Kubernetes Pods** | `kube_pod_info`, `container_cpu_usage_seconds_total`, `container_memory_usage_bytes` | Per-pod CPU %, memory (Mi), restart count, phase |
| **Deployed Projects** | Live HTTP ping | Uptime status + iframe preview for external services |

The frontend polls every **15 seconds** and shows a live/offline indicator in the topbar.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Local Machine                       │
│                                                      │
│   React/Vite UI  ──────────────────────────────────┐ │
│   (devdash-ui)   │ fetch /api/v1/query              │ │
│        │         ▼                                  │ │
│        │    Prometheus :9090                        │ │
│        │    (kube-state-metrics + cAdvisor)         │ │
│        │                                            │ │
│        │ fetch /health & /metrics                   │ │
│        ▼                                            │ │
│   Go Backend :8080  ──── /metrics ──► Prometheus    │ │
│   (devdash-app)                                     │ │
│        │                                            │ │
│        └────── deployed in Kubernetes ──────────────┘ │
│                 (deployment.yaml + service.yaml)     │
└─────────────────────────────────────────────────────┘
```

The Go backend exposes three endpoints:

- `GET /` — health check landing
- `GET /health` — JSON health response `{"status":"ok","service":"devdash-app"}`
- `GET /metrics` — Prometheus metrics (request count, duration histogram)

Every request is instrumented via the `instrument()` middleware, which records `http_requests_total` and `http_request_duration_seconds` counters.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.24, `prometheus/client_golang` |
| Frontend | React 19, Vite 8, Recharts |
| Containerisation | Docker (multi-stage build) |
| Orchestration | Kubernetes — `deployment.yaml`, `service.yaml`, `configmap.yaml` |
| Observability | Prometheus, kube-state-metrics, cAdvisor |
| CI | GitHub Actions — test → build → push to GHCR |

---

## Repository Structure

```
devdash/
├── main.go                  # Go HTTP server with Prometheus instrumentation
├── main_test.go             # Unit tests for /health endpoint
├── Dockerfile               # Multi-stage build (golang:1.24-alpine → alpine)
├── go.mod / go.sum
├── deployment.yaml          # K8s Deployment (2 replicas, resource limits)
├── service.yaml             # K8s ClusterIP Service on :8080
├── configmap.yaml           # K8s ConfigMap (APP_ENV, LOG_LEVEL, APP_NAME)
├── grafana-dashboard.json   # Importable Grafana dashboard definition
├── .github/
│   └── workflows/ci.yml     # CI: go test → docker build → push to GHCR
└── devdash-ui/              # React/Vite frontend
    ├── src/
    │   └── App.jsx          # Main dashboard (pods, services, projects, latency)
    ├── package.json
    └── vite.config.js
```

---

## Running Locally

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [kind](https://kind.sigs.k8s.io/docs/user/quick-start/) or [minikube](https://minikube.sigs.k8s.io/docs/start/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Helm](https://helm.sh/docs/intro/install/) (for kube-prometheus-stack)
- [Node.js](https://nodejs.org/) 18+

---

### Step 1 — Create a local cluster

```bash
kind create cluster --name devdash
```

### Step 2 — Install Prometheus (kube-prometheus-stack)

This brings in Prometheus, kube-state-metrics, cAdvisor, and Grafana in one shot.

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace
```

Verify everything is running:

```bash
kubectl get pods -n monitoring
```

### Step 3 — Build and load the Go backend image

```bash
docker build -t devdash-app:latest .

# Load into kind (skip if using minikube)
kind load docker-image devdash-app:latest --name devdash
```

If using minikube:
```bash
eval $(minikube docker-env)
docker build -t devdash-app:latest .
```

### Step 4 — Deploy to Kubernetes

```bash
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

Check the pods:

```bash
kubectl get pods -n default
```

### Step 5 — Port-forward the services

Open two terminals:

```bash
# Terminal 1 — Go backend
kubectl port-forward svc/devdash-svc 8080:8080

# Terminal 2 — Prometheus (Server)
kubectl port-forward -n monitoring svc/prometheus-server 9090:80
```

Optional — Grafana:
```bash
kubectl port-forward svc/grafana -n monitoring 3000:80
# Default credentials: admin / prom-operator
```

### Step 6 — Run the frontend

```bash
cd devdash-ui
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The dashboard will start pulling live data.

---

## Running Tests

```bash
go test ./...
```

The test suite covers the `/health` endpoint — verifying a `200 OK` response and the expected JSON body.

---

## CI / CD

The GitHub Actions pipeline (`.github/workflows/ci.yml`) runs on every push and PR to `main`:

1. **Go Test** — `go test ./...`
2. **Build & Push** — builds the Docker image and pushes it to GitHub Container Registry (GHCR) as:
   - `ghcr.io/<owner>/devdash-app:latest`
   - `ghcr.io/<owner>/devdash-app:<commit-sha>`

The image can be pulled and deployed to any Kubernetes cluster with access to a Prometheus instance.

---

## Grafana Dashboard

`grafana-dashboard.json` contains a pre-built dashboard definition. To import it:

1. Open Grafana at [http://localhost:3000](http://localhost:3000)
2. Go to **Dashboards → Import**
3. Upload `grafana-dashboard.json`

The dashboard visualises the same metrics the UI surfaces — request rate, duration, and pod resource usage.

---

## Configuration

The Go backend reads its port from the `PORT` environment variable, defaulting to `8080`. Additional config is injected via the Kubernetes ConfigMap:

| Key | Default | Description |
|---|---|---|
| `APP_ENV` | `production` | Runtime environment |
| `LOG_LEVEL` | `info` | Log verbosity |
| `APP_NAME` | `devdash-app` | Service identifier |

The frontend has two hardcoded constants at the top of `App.jsx` — update these if your ports differ:

```js
const PROM = "http://localhost:9090";
const DEVDASH_API = "http://localhost:8080";
```

---

## Skills Demonstrated

- **Kubernetes** — Deployment, Service, ConfigMap, resource limits, multi-replica setup
- **Prometheus** — Custom metrics via `client_golang`, PromQL queries for pod CPU/memory/restarts
- **Go** — HTTP server, middleware instrumentation, unit testing with `net/http/httptest`
- **Docker** — Multi-stage builds for minimal production images
- **CI/CD** — GitHub Actions pipeline with GHCR image publishing
- **React** — Real-time polling, component composition, inline styling system

---

## Related Projects

- [Cron Job Manager](https://github.com/TashuChoudhary/cron-job-manager) - Go-based scheduled job runner with live Grafana Cloud integration
- [PasteLite-Pastebin-clone](https://github.com/TashuChoudhary/pastelite) - A minimalist paste-sharing application built with a Go backend