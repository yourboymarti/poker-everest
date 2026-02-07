# TODO

## Next (P1.3)

- Add request correlation IDs (`request_id`, `socket_id`, `room_id`) to all structured logs.
- Add optional Prometheus scrape config example and Grafana import instructions.
- Add Alertmanager routing examples (Slack/email).

## Product Readiness

- Add Sentry DSN + env vars in production deployment config.
- Wire Prometheus/Grafana in the target environment and verify dashboard data.
- Define ownership/on-call for alerts listed in `OPERATIONS.md`.

## Engineering

- Add focused tests for `/healthz`, `/readyz`, `/metrics` response contracts.
- Add load test scenario for socket churn and voting latency.
- Replace Redis `KEYS` usage with scalable room index strategy.
