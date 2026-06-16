# features/

Feature-first modules live here. Each feature is **self-contained** and follows clean
architecture internally:

```
features/<feature>/
├── data/            # DTOs (json_serializable), datasources (Dio calls), repository impl
├── domain/          # entities, repository interfaces, (optional) use cases
└── presentation/    # screens, widgets, and Riverpod controllers/providers
```

Rules:
- Presentation depends on domain; data implements domain; **domain depends on nothing**.
- Repositories return `Result<T>` (see `core/network/result.dart`) — never throw to the UI.
- A feature exposes its routes (attached under the matching role branch in `routes/`)
  and its providers; it never reaches into another feature's internals.

Planned features (NOT generated in the foundation):
`auth`, `customer_booking`, `technician_jobs`, `payments`, `subscriptions`, `chat`,
`notifications`, `tracking`, `service_reports`, `reviews`, `profile`.
