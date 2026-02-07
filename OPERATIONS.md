# Operations & SLO

## Runtime Endpoints

- `GET /healthz`  
  Lightweight liveness check. Returns process uptime, version and timestamp.

- `GET /readyz`  
  Readiness check for traffic. Returns storage health and degraded mode marker.

- `GET /metrics`  
  Prometheus-compatible metrics for sockets, rooms, votes, timers and Redis readiness.

## Sentry

- Enable by setting `SENTRY_DSN`.
- Optional tracing sample rate: `SENTRY_TRACES_SAMPLE_RATE` (default: `0.1`).
- Captures:
  - uncaught exceptions
  - unhandled rejections
  - server interval/request/runtime failures

## Initial SLO Targets

- Availability: `99.9%` monthly successful `GET /readyz`.
- Realtime quality: `99%` of vote events propagated to room clients in `< 500ms` (p95).
- Session durability: `< 0.1%` of active rooms lost unexpectedly during normal operations.

## Alerting (Minimum)

- High error rate: socket handler errors > `2%` for 5 minutes.
- Realtime degradation: p95 vote propagation latency > `500ms` for 10 minutes.
- Redis health: `poker_redis_ready == 0` for 2 minutes in production.
- Availability: repeated `GET /readyz` failures for 2 minutes.

Reference templates:

- Prometheus alerts: `observability/alerts/prometheus-rules.yml`
- Grafana dashboard: `observability/dashboards/poker-everest-overview.json`

## Runbook

1. If `readyz` fails because Redis is down:
   - Verify Redis connectivity and credentials (`REDIS_URL`).
   - Confirm app is in fallback mode and rooms are still serving.
   - Restore Redis and monitor readiness recovery.
2. If socket errors spike:
   - Check deploy diff and rolling restarts.
   - Inspect active socket count (`poker_active_socket_connections`) and room churn.
   - Roll back if regression started after the latest release.
3. If vote propagation slows:
   - Check host CPU and event loop lag.
   - Check websocket transport stability and network saturation.
   - Reduce noisy logs and restart with autoscaling if needed.
