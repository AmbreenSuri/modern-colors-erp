# Modern Colours — Phase 1 Build Progress (LIVING LOG)

> **Purpose:** Append-only-ish running log so context never breaks between sessions.
> **After completing any build step, update this file**: what was built, what was tested,
> what's next. Read this + [`ARCHITECTURE.md`](./ARCHITECTURE.md) at the start of every session.

**Legend:** ✅ done · 🔄 in progress · ⬜ not started

## Build order & status

| # | Step | Status | Notes |
|---|------|--------|-------|
| 0 | Discovery + structural decisions | ✅ | Frontend = Vite (not Next). Existing prototype was Phase-2-scoped; keep shell, rebuild domain. Monorepo `frontend/`+`backend/`. Storage = Cloudflare R2 (disk fallback for dev). |
| 1 | Repo restructure + living docs | ✅ | Monorepo done. ARCHITECTURE.md + PROGRESS.md + README + architecture.png created. |
| 1b | Backend scaffold (NestJS + Prisma + Docker + config) | ✅ | package.json, tsconfig, nest-cli, main.ts, app.module, PrismaModule/Service, .env.example, docker-compose.yml. `npm install` ok (715 pkgs). `nest build` ✅ exit 0. |
| 2 | Prisma schema (all entities) | ✅ | Users/Roles, Catalogue, PO, POLineItem, Material(+status), QrCode, Setting, AuditLog. `prisma validate` ✅, `prisma generate` ✅. Migration NOT yet run (needs live Postgres). |
| 3 | Auth + RBAC (JWT, guards, seed admin) | ✅ | `auth`/`users`/`audit` modules. JWT login, JwtAuthGuard + RolesGuard + `@Roles` + `@CurrentUser`. Seed admin (idempotent). Migration applied to **Neon**. Verified e2e (login/me/403/401) + jest test for I5 (5/5 pass). + Security: fail-fast env validation, no secret fallbacks. |
| 4 | Master Catalogue (import + CRUD + match) | ✅ | `catalogue` module. Column-tolerant CSV/Excel import (xlsx), CRUD (soft-delete), match (exact/similar/none, Levenshtein). RBAC: import/edit/delete=Admin, new-SKU create=Admin+Operator (daily new SKUs, provisional TMP- code). 11/11 jest pass; e2e verified (import 20, match 3 types, operator 201/403/200). |
| 4 | Master Catalogue (import + CRUD + match) | ⬜ | |
| 5 | Settings (API key encrypt/mask/validate) | ⬜ | Invariant I2 |
| 6 | PO upload + Claude extraction + fallback | ⬜ | Invariants I7 |
| 7 | Operator review/confirm + validation | ⬜ | Invariants I1, I6 (hard gate) |
| 8 | Material registration + unique IDs + QR + label PDFs | ⬜ | Invariants I3, I8 |
| 9 | QR scan + status lifecycle + manual weight + offline queue | ⬜ | Invariant I9 |
| 10 | Audit logging threaded through all modules | ⬜ | Invariant I4 |
| 11 | Dashboard (metrics, filters, search) | ⬜ | |
| 12 | Frontend rebuild to Phase 1 + wire to API | ⬜ | Park Phase 2 pages |
| 13 | End-to-end pass | ⬜ | PO → extract → confirm → QR → scan → weigh → Ready |

## Session log

### 2026-06-24 — Session 1
- **Discovery complete.** Read PRD v3.0. Scanned repo: existing Vite+React+TS+Tailwind+shadcn frontend
  prototype with good UI infra but Phase-2-scoped domain (Production/Warehouse/consumption). Backend: none.
- **Decisions confirmed with client:** keep frontend shell + rebuild domain; monorepo `frontend/`+`backend/`;
  Cloudflare R2 storage (with local disk fallback so dev isn't blocked).
- **Restructured repo** into `frontend/` (moved existing app) + reserved `backend/`. Added root `.gitignore`.
- **Created living docs:** ARCHITECTURE.md (architecture map + invariants I1–I9), this PROGRESS.md, README, architecture.png.
- **Backend scaffolded & verified:** NestJS 11 + Prisma 6 + config. `npm install` (715 pkgs), `nest build` exit 0,
  `prisma validate` + `prisma generate` pass. Dev `.env` created with random JWT_SECRET + ENCRYPTION_KEY (gitignored).
- **Prisma schema complete** (8 models, 4 enums) — see `backend/prisma/schema.prisma`. Encodes invariants
  I1–I4, I8 at the data layer (POLineItem working set vs Material; append-only AuditLog w/ self-reference; encrypted Setting).
- **ENV finding:** Docker is **not on PATH** in this shell. `docker-compose.yml` is provided (Postgres) but the
  user must have Docker Desktop running to `docker compose up -d`, OR point `DATABASE_URL` at any reachable Postgres.
  Migration (`prisma migrate dev`) is **deferred** until a DB is reachable. Building/compiling does not need it.
- **Next:** Step 3 — Auth + RBAC (JWT, guards, `@Roles`, seed admin), then Catalogue, Settings, etc.

### 2026-06-24 — Session 1 (cont.) — client corrections applied
- **Phase 2 excision (client correction).** Confirmed the prototype domain was Phase-2-modeled across
  27/40 files. Preserved the full prototype on the **`phase2-draft` git branch** (forked at commit cca9bfa),
  then on `phase-1` removed ALL Phase 2 code from the active app: pages (Dashboard/MaterialInward/Inventory/
  QRScanner/Production/Warehouse/Reports), domain hooks, mock services, and domain components (charts/inventory/
  material/qr). Stripped `types/index.ts` to generic types. App reduced to the reusable shell (ui/, common/,
  layout/) + Phase 1 nav + placeholder pages. **No Phase 2 route/type/component is reachable.**
  `npm run build` (tsc + vite) ✅ exit 0.
- **Database = Neon (client correction).** Docker dropped entirely: removed `docker-compose.yml`,
  updated `.env.example` + `.env` to Neon connection string format (`sslmode=require`), and documented in
  ARCHITECTURE.md §4 that Docker-Postgres must NOT be reintroduced. Awaiting the client's Neon `DATABASE_URL`.
- **Git:** working on `phase-1` branch (not main). `phase2-draft` preserves the prototype.
- **GATE:** Step 3 (Auth + RBAC) begins once the Neon `DATABASE_URL` is pasted into `backend/.env`
  (migrations + seed need a reachable DB). Auth code can be written meanwhile; verification needs the DB.

### 2026-06-24 — Session 1 (cont.) — Step 3: Auth + RBAC
- **Neon connected.** Client pasted the Neon `DATABASE_URL`. `prisma migrate dev --name init` applied the full
  schema to Neon (migration `20260624002144_init`). DB live.
- **Built `auth` + `users` + `audit` modules.** JWT login (`POST /api/auth/login`, `GET /api/auth/me`);
  `JwtStrategy` (re-checks user active on every request); `JwtAuthGuard` + `RolesGuard` + `@Roles()` +
  `@CurrentUser()`. Users CRUD is Admin-only. `AuditService` is append-only (no update/delete — I4); global.
  bcryptjs for hashing (pure-JS, no native build).
- **Seed admin** (`npm run seed`, idempotent) → `admin@moderncolours.local`. Created in Neon + audit row.
- **Verified end-to-end (curl):** admin login→JWT ✅, `/me` ✅, bad password→401 ✅, admin create operator→201 ✅,
  operator→`GET /users`→**403** ✅ (server-side RBAC I5), admin→200 ✅, no token→401 ✅, audit shows
  LOGIN/USER_CREATED/SEED_ADMIN_CREATED ✅. **Jest:** `roles.guard.spec.ts` 5/5 pass (locks I5).
- **Housekeeping:** added `.gitattributes` (LF normalization). `nest build` exit 0.
- **Next:** Step 4 — Master Catalogue module (Excel/CSV import + CRUD + match lookup for AI validation).

### 2026-06-24 — Session 1 (cont.) — Step 4: Master Catalogue
- **Built `catalogue` module.** Column-tolerant import (xlsx handles .csv/.xlsx; maps header variants,
  unknown cols → metadata, upsert by SKU). CRUD with soft-delete. Match util (Levenshtein similarity):
  EXACT (sku/name) / SIMILAR (≥0.82) / NONE — informational only, never gates (I6).
- **Client requirement baked in:** new SKUs arrive daily → operators can add a new SKU from a No-Match
  (with UI confirmation), additive + audited; provisional `TMP-XXXXXX` code auto-generated if no official
  SKU. Bulk import + edit/delete remain Admin-only.
- **Verified:** `nest build` exit 0; jest 11/11 (incl. match.util.spec); e2e curl — import sample CSV = 20 created,
  EXACT (score 1) / SIMILAR (0.94) / NONE; operator new-SKU → 201, operator bulk-import → 403, operator match → 200,
  provisional SKU + metadata confirmed.
- Sample CSV at `backend/prisma/sample-catalogue.csv` (20 realistic paint SKUs). Client's real ~70–600 SKU CSV
  to be dropped in when provided (importer should handle as-is).
- **Next:** Step 5 — Settings module (Claude API key: AES-256-GCM encrypt at rest, masked to FE, validate on save).

---
_Update this log after every step. Newest entries at the bottom of the session log._
