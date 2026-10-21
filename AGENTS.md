# AGENTS.md — EcoMove Developer & AI Agent Guide

Welcome to the **EcoMove** monorepo (UPX IV — Centro Universitário Facens). Every human developer and AI coding agent working in this repository MUST follow the domain language, architectural boundaries, and technical conventions defined below.

---

## 1. Domain Language & Source of Truth

- **Always read [`GLOSSARY.md`](./GLOSSARY.md) before writing or modifying code.**
- **Code & Database in English, UI in Portuguese**:
  - All identifiers, database tables/columns, API routes, BLoC states/events, and TypeScript types MUST use the exact canonical English terms from [`GLOSSARY.md`](./GLOSSARY.md).
  - Never use banned synonyms (`User`, `Student`, `Admin`, `Route`, `Modal`, `Occurrence`, `Coins`, `Benefit`). Use:
    - Actors: `Commuter`, `MobilityManager`, `Partner`
    - Mobility: `Trip`, `TransportMode` (`WALK`, `BICYCLE`, `PUBLIC_TRANSIT`, `CARPOOL`), `CarpoolSession`, `CampusZone`
    - Urban Maintenance: `HazardReport`, `HazardCategory` (`SIDEWALK_DAMAGE`, `BIKE_LANE_OBSTRUCTION`, `POOR_LIGHTING`, `BUS_STOP_ISSUE`, `OTHER`), `HazardEndorsement`
    - Economy: `EcoPoints`, `PointTransaction`, `Reward`, `Redemption`
    - Intelligence: `MobilityInsight`
  - All user-facing text in `/apps/mobile` and `/apps/web` must be in **Brazilian Portuguese (pt-BR)**.

---

## 2. Monorepo Structure & Ownership

```text
/
├── GLOSSARY.md                  # Canonical Ubiquitous Language
├── AGENTS.md                    # Instructions for AI agents & contributors
├── docker-compose.yml           # Local PostgreSQL 16 + PostGIS 3.4
├── docs/
│   ├── ARCHITECTURE_AND_BPMN.md # Mermaid system & BPMN process diagrams
│   └── adr/                     # Architectural Decision Records (0001-0005)
└── apps/
    ├── api/                     # Fastify + TypeScript + Prisma + PostGIS + Zod
    ├── web/                     # Next.js (App Router) + Tailwind + shadcn/ui + React-Leaflet
    └── mobile/                  # Flutter + BLoC + Provider + flutter_map (OSM) + SQLite
```

---

## 3. Core Architectural Rules (See [`docs/adr/`](./docs/adr/))

1. **Geospatial Operations in PostGIS ([ADR-0002](./docs/adr/0002-postgis-geospatial-engine.md))**:
   - Do not implement Haversine distance or polygon containment in application JavaScript/Dart when querying the database.
   - Use PostGIS spatial functions (`ST_Intersects`, `ST_DWithin`, `ST_Length`, `ST_MakeLine`) with SRID `4326` (`geography` cast for meter-accurate measurements).
   - `HazardReport` creation must check `ST_DWithin` within **30 meters** for active reports of the same `HazardCategory` and prompt for a `HazardEndorsement` rather than inserting a duplicate.

2. **Immutable `EcoPoints` Ledger ([ADR-0003](./docs/adr/0003-immutable-ecopoints-ledger.md))**:
   - Never mutate `Commuter.ecoPointsBalance` directly without inserting a corresponding `PointTransaction` record inside the same database `$transaction`.
   - Enforce the **100 `EcoPoints`/day** cap on validated `Trip` earnings (`WALK`: 10/km, `BICYCLE`: 8/km, `CARPOOL`: 5/km, `PUBLIC_TRANSIT`: 4/km; minimum distance `300m`).
   - Award **+25 `EcoPoints`** only when a `HazardReport` transitions from `PENDING` to `APPROVED` by a `MobilityManager`.
   - `Redemption` vouchers expire after **7 days** (`ACTIVE` → `EXPIRED`), restoring `Reward.stock` and inserting a refund `PointTransaction`.

3. **Pluggable AI `InsightEngine` Facade ([ADR-0004](./docs/adr/0004-pluggable-ai-insight-facade.md))**:
   - Never hardcode Gemini SDK or Ollama HTTP calls directly inside route handlers, controllers, or Flutter widgets.
   - Always program against the `InsightEngine` / `CommuterAiService` interface so the provider can be switched between **Gemini API** (cloud) and **Ollama / local phone models** via configuration or dependency injection (`Provider`).

4. **Firebase Spark Plan Compliance ([ADR-0005](./docs/adr/0005-firebase-spark-auth-and-media-storage.md))**:
   - Authentication uses Firebase Auth ID tokens verified by `firebase-admin` in `apps/api`.
   - Automatically flag `Commuter.isInstitutional = true` when the verified email ends with `@facens.br`.
   - Always compress `HazardReport` images on the client to **WebP (<300 KB)** before upload, and route storage through `MediaStorageService` so local development and Spark-plan deployments never require paid cloud storage tiers.

---

## 4. App-Specific Conventions

### `apps/api` (Backend — Node.js / Fastify / TypeScript)
- Validate all request bodies, query params, and responses with **Zod**.
- Keep spatial SQL isolated in repository/service methods using Prisma `$queryRaw` with parameterized inputs (never string-interpolate coordinates).
- Ensure every state transition (`Trip`, `HazardReport`, `Redemption`) validates the current status before updating.

### `apps/mobile` (Mobile — Flutter)
- **State Management**: Use `flutter_bloc` (`Bloc` / `Cubit`) for feature state and `provider` for dependency injection of repositories and facades (such as `CommuterAiService` and `LocationQueueService`).
- **Maps & Location**: Use `flutter_map` with OpenStreetMap tiles and `geolocator`. Buffer active `Trip` GPS coordinates in a local SQLite/Hive queue so cellular drops around campus never lose a trajectory.

### `apps/web` (Manager Portal — Next.js App Router)
- Use Server Components where appropriate and Client Components for interactive maps (`react-leaflet`) and charts (`recharts`).
- Protect all dashboard routes behind `MobilityManager` role checks.


---

## Agent skills

### Issue tracker

Issues and specs are tracked in GitHub Issues (`LuizJarduli/Ecomove`). See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default five canonical triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` and `docs/adr/` at the repo root). See `docs/agents/domain.md`.
