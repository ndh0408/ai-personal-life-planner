# Kubernetes Worker Topology — Reference

**Status:** REFERENCE ONLY — round-18 ships example manifests under
`deploy/k8s/`. They are NOT applied automatically; treat them as a starting
point for your own GitOps repo.

## Topology

```
                ┌────────────────────────┐
       Internet ▶ Ingress (TLS)         │
                │  → Service             │
                │     → lifeos-api (×N)  │  ← HTTP only, no queue draining
                └────────────────────────┘
                            │
                  ┌─────────┴────────────┐
                  ▼                      ▼
        lifeos-postgres            lifeos-redis
                  ▲
                  │ shared by all pods
                  │
   ┌──────────────┼─────────────────┐
   │              │                 │
   ▼              ▼                 ▼
worker-           worker-          worker-
notification (×1) ai (×1)          report (×1)
worker-assistant (×1)
```

The API tier handles HTTP. Worker tiers drain the corresponding queue.
Today the worker binary is the same image as the API; the difference is
env (`PORT`, `METRICS_ENABLED=false`, no Service exposure).

## Files in `deploy/k8s/`

| File | Purpose |
|--|--|
| `configmap.example.yaml` | Non-secret config (NODE_ENV, locales, queue concurrency, OTel, …) |
| `secret.example.yaml` | Secret skeleton — REPLACE every `CHANGE_ME` before applying |
| `api-deployment.yaml` | API tier (2 replicas + HPA) |
| `service.yaml` | Cluster-internal service for the API |
| `hpa.example.yaml` | Horizontal pod autoscaler for the API tier |
| `worker-notification-deployment.yaml` | Notification queue worker |
| `worker-ai-deployment.yaml` | AI queue worker |
| `worker-report-deployment.yaml` | Report queue worker |
| `worker-assistant-deployment.yaml` | Assistant proactive sweep worker |
| `cronjob-backup.example.yaml` | Daily encrypted backup CronJob |

## How to use

1. Create the namespace: `kubectl create namespace lifeos`
2. Replace `CHANGE_ME` placeholders in `secret.example.yaml` (or wire up
   External Secrets Operator + delete that file).
3. `kubectl apply -f deploy/k8s/configmap.example.yaml`
4. `kubectl apply -f deploy/k8s/secret.example.yaml`
5. `kubectl apply -f deploy/k8s/service.yaml`
6. `kubectl apply -f deploy/k8s/api-deployment.yaml`
7. `kubectl apply -f deploy/k8s/hpa.example.yaml`
8. Apply each worker deployment.
9. `kubectl apply -f deploy/k8s/cronjob-backup.example.yaml` (after
   provisioning a `lifeos-backup-spool` PVC).

Add an Ingress + cert-manager separately — the manifests stop at the
Service level so you can use whatever Ingress controller (nginx, Traefik,
Contour, AWS LB Controller) your cluster prefers.

## What's intentional vs intentional limitations

**Intentional**
- API and worker share the same image — no separate worker entrypoint.
  When the operator runs the binary with `QUEUE_ENABLED=true` and the API
  HTTP listener on a non-public port, it drains queues just like a
  dedicated worker would.
- Resource requests are conservative — bump them after observing actual
  load.
- Liveness vs readiness probe split — `/api/health` is cheap (process
  ping); `/api/health/ready` does I/O (DB + Redis + queue depth).
- preStop hook on API pods — `sleep 10` gives the load balancer time to
  deregister before SIGTERM kills in-flight requests. Combined with
  `terminationGracePeriodSeconds: 30` and Round-11's `enableShutdownHooks`
  this drains cleanly.

**Limitations (intentional, deferred to future rounds)**
- `WORKER_ROLE` env is **informational only**. The binary doesn't filter
  queues by role yet; every worker pod drains every queue. Round-19
  candidate: gate worker module loading on `WORKER_ROLE` so a notification
  worker doesn't also bind the AI queue.
- No NetworkPolicy in the manifests — your cluster's default-deny posture
  decides what traffic is allowed.
- No PodDisruptionBudget — add one if your cluster's autoscaler is
  aggressive enough to drop both API replicas at once.
- No PVC manifest for `lifeos-backup-spool` — depends on your cloud's
  StorageClass.

## Promote API only after the smoke test

After `kubectl apply`, run the round-15 smoke test against the in-cluster
service:

```bash
kubectl run -n lifeos --rm -it smoke --image=curlimages/curl --restart=Never \
  -- /bin/sh -c "curl -fsS http://lifeos-api/api/health/ready"
```

Then point the Ingress at `lifeos-api`. Don't flip DNS until smoke
passes.
