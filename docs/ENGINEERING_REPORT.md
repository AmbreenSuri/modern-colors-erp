# Modern Colours ERP — Engineering Report

> **Report date:** 2026-07-22
> **Engagement window:** 2026-06-20 → 2026-07-22 (33 calendar days)
> **Status:** Live in production since 2026-07-03
> **Source of every date and figure below:** `git log`, the Prisma schema, the migration
> directory and the test runners — read at report time, not recalled. Where a statement
> comes from something other than a machine-readable source, it says so.

---

## 1. Executive summary

Modern Colours ERP is a paint-factory material and production control system. It tracks
a physical unit of raw material from the supplier's invoice, through a QR sticker on the
sack, into a department's batch, out as finished goods, and onto a dispatch truck — with
an append-only audit trail behind every movement.

In 33 days the system went from an empty repository to a live, three-phase production
deployment used by six role types on the factory floor.

| Measure | Value |
|---|---|
| Commits | 101 |
| Backend source | 15,831 lines TypeScript |
| Frontend source | 16,070 lines TypeScript/TSX |
| Database models | 16 |
| Applied migrations | 10 |
| HTTP routes | 104 (57 GET, 36 POST, 5 PATCH, 5 DELETE, 1 PUT) |
| Distinct audited actions | 47 |
| Backend tests | 371 across 42 suites — all passing |
| Frontend tests | 29 across 2 suites — all passing |
| Days from first commit to production | 13 |

The work divides into three delivered phases plus a continuous stream of client-driven
refinement:

- **Phase 1 — Material inward.** Invoice upload, AI extraction with mandatory human
  confirmation, per-unit QR minting, label printing, receiving.
- **Phase 2 — Requests and stock.** Department production requests, Store issue desk,
  live stock levels, append-only movement ledger, FIFO guidance, role isolation.
- **Phase 3 — Finished goods and dispatch.** Batches, production output, finished-goods
  QRs, dispatch scanning, returns, traceability from drum back to supplier invoice.

---

## 2. Timeline

Dates and times are local (IST) commit timestamps from `git log`. Commit counts per day
are exact. Narrative for the earlier period is reconstructed from commit messages and the
committed documentation; narrative for 20–22 July is from direct working record.

### 2.1 Prototype — 20–21 June (5 commits)

| Time | Commit | Event |
|---|---|---|
| 06-20 15:58 | `a4e3299` | Initial frontend prototype |
| 06-20 16:28–16:37 | `4c07fac`…`ef6f0b0` | TypeScript corrections to reports/CSV export |
| 06-21 10:46 | `84dcc98` | Build fixes |

A throwaway UI prototype to agree shape with the client before committing to an
architecture.

### 2.2 Phase 1 foundation — 24 June (10 commits)

| Time | Commit | Event |
|---|---|---|
| 05:44 | `314cb2a` | Monorepo restructure, living docs, NestJS + Prisma scaffold |
| 05:49 | `67776f8` | Phase 2 excised from the active app; database switched to Neon, Docker dropped |
| 05:59 | `713f900` | Auth + RBAC + audit foundation; first Neon migration applied |
| 06:04 | `e12300a` | **Security:** fail-fast environment validation, hardcoded secret fallbacks removed |
| 14:44 | `07c0f9a` | Master Catalogue — import, CRUD, matching, daily-new-SKU handling |
| 14:52 | `4e761ad` | Settings (Claude API key) + technical README |
| 15:05 | `bbd773c` | Invoice upload + Claude AI extraction + manual fallback |
| 15:08 | `0a8151a` | **Security:** invoice filename sanitised (Content-Disposition header injection) |
| 20:17 | `0697288` | Confirm gate, material + QR registration, receiving, dashboard |
| 20:21 | `f7b1a8c` | **Security:** `poId` sanitised in the labels Content-Disposition header |

The whole audit and RBAC spine was laid on day one of real development, before any
feature depended on it. Two header-injection issues were found and fixed the same day
they were introduced.

### 2.3 Frontend and mobile — 26–27 June (5 commits)

| Time | Commit | Event |
|---|---|---|
| 06-26 05:10 | `c8bba70` | Frontend rebuilt against the real API |
| 06-26 05:22 | `21ace7b` | Mobile: off-canvas sidebar, touch menus, modal gutters |
| 06-26 14:53 | `ad590f1` | Resilient DB connect — retry `$connect` for Neon cold starts |
| 06-27 01:57 | `cc91228` | **Camera-first scanning:** live QR scan + invoice photo capture |
| 06-27 20:42 | `f879cd4` | **Security:** dependency vulnerabilities patched, upload size capped |

Camera-first scanning was a decisive product call: the factory floor uses phones, not
tethered scanners, so the camera became the primary input with keyboard entry as fallback.

### 2.4 Deployment preparation — 1 July (3 commits)

Vercel + Render configuration (`8ba40ab`), an on-premise self-hosting guide for the
factory's own server (`c6f1a27`), and a sample invoice for demos (`f12aaee`).

### 2.5 Go-live — 3 July (11 commits)

The single hardest day of infrastructure work in the engagement. The backend host was
switched from Render to Railway mid-flight, and four separate platform-level defects had
to be diagnosed against a live deployment:

| Time | Commit | Problem solved |
|---|---|---|
| 01:40 | `b3b32ac` | Railway boot: `railway.json`, idempotent seed |
| 01:52 | `00e01ba` | "Application failed to respond" — bind to `0.0.0.0` |
| 02:06 | `28d8167` | Build needed dev dependencies for the Nest/Prisma CLIs |
| 02:16 | `3ef9da0` | Build-time deps moved to `dependencies`; production install was OOM-ing |
| 08:46 | `6fa0330` | **Nixpacks abandoned for a Dockerfile** — cache-mount EBUSY and a Node 18 engine mismatch |
| 09:09 | `d0dba20` | **`prisma migrate deploy` hangs on Neon's pooled endpoint** (PgBouncer has no advisory locks) — removed from container start |
| 09:21 | `de64340` | **Railway's healthcheck is IPv6** — bind dual-stack `::` with IPv4 fallback |
| 09:47 | `353378f` | Env robustness: trim values, self-heal names with stray whitespace, safe diagnostics |
| 10:01 | `b78be57` | Redeploy to apply environment variables |
| 10:33 | `762b8b4` | `VITE_API_URL` normalisation — a misconfigured value could fall back to the frontend origin |
| 10:51 | `d252228` | Undecryptable stored Claude key treated as "not configured" rather than a 500 |

Two of these — the pooled-endpoint migration hang and the IPv6 healthcheck — are the kind
of defect that costs hours precisely because nothing in the error message points at the
cause. Both are documented so they are never re-learned.

**System live: 2026-07-03.**

### 2.6 Post-demo client revisions — 4 July (4 commits)

Twelve client fixes in three priority groups (`17dfedb`, `9b7148c`, `bafbdc6`): corrected
invoice field mapping (quantity is the physical package count, not bulk kg; dedicated HSN
code; per-package weight), manual invoice entry, document preview on review, catalogue CSV
preview, and the **3×1.5 inch QR sticker layout**. Plus mobile-data resilience for API
calls after login failures were reported in the field (`e674645`).

### 2.7 Naming and label refinements — 6–9 July (7 commits)

- 07-06 `fe34a00` — "Purchase Order" renamed to "Invoice" throughout the UI, matching how
  the factory actually speaks.
- 07-07 `86c822b` — **Label PDF becomes one 3×1.5in label per page** for the roll printer,
  so page count equals unit count. This geometry has been treated as frozen ever since.
- 07-09 `5217344`, `186423b` — CSV label export, hardened against formula injection.
- 07-09 `306db96`, `c157f40`, `13bb26f` — three consecutive camera defects on real phones:
  `focusMode` in `getUserMedia` constraints made `start()` fail; mobile browsers block
  camera access without a user gesture; a failed start left the scanner instance stuck.

### 2.8 Phase 2 — 9–10 July (13 commits)

| Time | Commit | Step |
|---|---|---|
| 07-09 16:36 | `0b67620` | Schema + additive migration for requests and the stock ledger |
| 07-09 16:55 | `bd9bf27` | Idempotent role setup script |
| 07-09 17:01 | `9e785f1` | Role script hardened after security review |
| 07-09 21:29 | `e8c14ca` | **Role auth + server-side department isolation** |
| 07-09 22:02 | `c78e5a6` | Production-head request + scoped dashboard |
| 07-09 22:43 | `14c125c` | Multi-material requests (parent + line items) |
| 07-10 00:12 | `c06a497` | Store request inbox — per-line accept / partial / reject |
| 07-10 00:33 | `e0ba46f` | Scan & stock movement (Add / Deduct / Discard) |
| 07-10 11:44 | `23f1c91` | Live stock levels + append-only movement ledger |
| 07-10 12:44 | `de2c423` | Admin oversight dashboard |
| 07-10 12:47 | `1574958` | End-to-end UAT script |
| 07-10 13:38–14:11 | `6a5f0da`, `d997ee3` | Analytics dashboards per role |

Phase 2 introduced the role model that everything since has had to respect: `OVERSIGHT`
is a factory-wide **view-only** role, and `PRODUCTION_HEAD` is scoped to one department
at the data layer, not the UI.

### 2.9 FIFO and the 2600-QR defect — 13 July (3 commits)

- `d1022fc` — **Bulk-weight invoice lines minted one QR per kilogram.** A 2,600 kg bulk
  line produced 2,600 QR codes instead of the correct package count. Fixed at the
  extraction/registration boundary.
- `810c8ee` — No-match SKUs can be added to the catalogue from an invoice, with a
  provisional-SKU lifecycle.
- `0625aa2` — **FIFO consumption guidance**: deducting a newer unit while older stock
  exists warns and records a `FIFO_OVERRIDE` audit row, but never blocks — the floor
  sometimes has a legitimate reason.

### 2.10 Phase 3 — 19–20 July (2 + 18 commits)

| Time | Commit | Event |
|---|---|---|
| 07-19 21:52 | `f31dc74` | Schema + additive migration for finished goods and dispatch |
| 07-19 23:20 | `df2349c` | Batches, production output, FG QRs, dispatch, traceability |
| 07-20 01:12 | `afae3d6` | Client feedback: In-Hand rename, stock ageing, **3.35× faster QR**, explicit label flow, issue review gate |
| 07-20 01:35 | `0c214d6` | Test proving Phase 1 access survived the DISPATCH role gating |
| 07-20 01:50 | `cb788e6` | **UPI-style continuous scan loop** across all three scanning screens |
| 07-20 02:30 | `d4e4014` | Mobile: Stock Levels overflow fixed, 44px touch targets |
| 07-20 04:03 | `76b0c13` | **Paint Chip design system** — tokens, motion, brand assets |
| 07-20 11:45 | `8f2fb5a` | Design system rolled out across every remaining screen |
| 07-20 13:21 | `3a7e25a` | **Fix 500 on FG label generation** — broken since Phase 3 shipped |
| 07-20 15:00 | `8ecc000` | Receiving: weighing removed, rapid-fire scanning; balance comes from the invoice |
| 07-20 15:28 | `b20e5f4` | Scanner mode toggle — camera or external scanner, every screen |
| 07-20 16:05 | `51ba3d4` | Catalogue import: template + AI-assisted validation + partial import |
| 07-20 16:37–16:50 | `52ae1cf`, `4170bbf`, `a7c56c4` | Storage diagnosability; **auth required on the storage health probe (was public)** |
| 07-20 22:40 | `142b009` | Extraction degrades to manual entry when storage is unavailable |
| 07-20 22:50 | `44df396` | **Security:** infrastructure identifiers stripped from storage errors |
| 07-20 23:32 | `35e0917` | Handover: pack-weight backfill + guarded flush script |

The FG label 500 (`3a7e25a`) is worth noting: the label renderer had been written for the
raw-material payload and silenced with an `as never` cast, so every finished-goods label
roll threw at runtime. The cast was replaced with a real type, and a dedicated spec now
locks the behaviour.

### 2.11 Analytics, units and controls — 21 July (17 commits)

| Time | Commit | Event |
|---|---|---|
| 00:14 | `114f1d8` | Dispatch analytics + **Company Brain** factory-flow view |
| 00:30 | `8db8edc` | Company Brain becomes the Oversight landing view |
| 00:51 | `1edfabd` | Docs versioned, archived and brought current |
| 03:30 | `6a755fd` | Scan department defect fixed; label text on PNGs; recent-receipt seeding |
| 09:03 | `9939799` | **Raw materials support litres alongside kilograms** |
| 12:57 | `503a955` | **Aggregates never blend kg and litres** — every total split by unit |
| 14:04 | `8619cea` | Receiving Start/Done sessions, closing summary, printable slip, CSV |
| 15:32 | `dac1996` | Dispatch batch cards with progress, returned goods, min/max stock levels |
| 15:59 | `a48a3fb` | **Admin corrections behind a named permission**; handover readiness panel |
| 16:53 | `b86be09` | **Central refresh layer** — focus, reconnect, mutation, targeted polls |
| 17:19 | `462d07a` | **Received material must be findable everywhere, immediately** |
| 17:31 | `998434b` | Company Brain: headline numbers in plain factory words |
| 18:16 | `28ad071` | **User management** — Admin creates production head and dispatch logins |
| 21:58 | `26bc9f7` | User management readable on a phone |
| 23:02 | `c4bafed` | Seeded logins labelled; renaming a login |
| 23:27 | `4adcfeb` | Docs: user management and the second named door |
| 23:29 | `6883b6d` | Seeded badge hidden when the API has not caught up |

Three items from this day deserve expansion, in §6.

### 2.12 Navigation and the reprint lock — 22 July (3 commits)

| Time | Commit | Event |
|---|---|---|
| 12:40 | `8a92c34` | **Back/forward navigation on every screen** |
| 13:18 | `bc5755b` | **Label reprints need approval; the first print is untouched** |
| 13:35 | `840fb23` | Docs: the reprint lock and the free-print window |

---

## 3. Architecture as built

### 3.1 Topology

```
  Phone / desktop browser
        │  HTTPS
        ▼
  Vercel  ──────────────►  Railway (Singapore)  ──────►  Neon PostgreSQL 18.4
  React 19 / Vite 6         NestJS 11 / Prisma 6         ap-southeast-1
  Tailwind 3 / shadcn                │
                                     └──────────────►  Cloudflare R2
                                                        (invoice documents)
```

- **Frontend:** Vercel, auto-deploys on push to `main`. Typically live in ~30 seconds.
- **Backend:** Railway, Singapore region, built from `backend/Dockerfile` (Node 20).
  Build times vary widely — observed between 28 seconds and over 30 minutes.
- **Database:** Neon PostgreSQL 18.4. **Two URLs by necessity** — `DATABASE_URL` (pooled)
  for the application, `DIRECT_URL` (non-pooled) for migrations, because `prisma migrate`
  hangs forever on PgBouncer, which has no advisory locks.
- **Object storage:** Cloudflare R2 for invoice documents.

### 3.2 Repository

A monorepo: `backend/` (NestJS 11, Prisma 6), `frontend/` (Vite 6, React 19, TypeScript,
Tailwind 3, shadcn/ui, recharts), `docs/` (living documentation).

### 3.3 Design system

"Paint Chip" — brand red `#EB0102`, a `chip-*` neutral ramp deliberately biased toward
the brand hue, and severity tokens (healthy / warning / critical) kept separate from the
accent so a red alarm never competes with red branding. Touch targets are 44px minimum on
coarse pointers, for gloved hands.

---

## 4. Security and access model

### 4.1 The twelve invariants

The system is built around twelve invariants that are enforced in code and asserted in
tests, not merely documented:

| # | Invariant |
|---|---|
| I1 | No auto-save of AI output — materials persist only after explicit operator confirm |
| I2 | Claude API key encrypted at rest, never returned in full |
| I3 | QR is 1:1 with physical units, not line items |
| I4 | **Audit log is append-only** — corrections are new rows referencing the original |
| I5 | RBAC enforced server-side on every protected endpoint, not just UI hiding |
| I6 | Master Catalogue never gates operations |
| I7 | Any extraction failure degrades to manual entry — the operator is never blocked |
| I8 | Unique IDs sequential and zero-padded, from separate Postgres sequences |
| I9 | Scans tolerate offline, queue locally, sync on reconnect |
| I10 | **Department isolation is server-side** |
| I11 | Stock can never go negative |
| I12 | FG QRs require a confirmed output and can be minted only once |

### 4.2 The six roles

| Role | UI label | Capability |
|---|---|---|
| `ADMIN` | **Store** | Phase 1 full access; the issue desk in Phase 2 |
| `OPERATOR` | Operator | Phase 1 inward operations |
| `SUPERVISOR` | Supervisor | Phase 1 + audit log |
| `OVERSIGHT` | **Admin** | Factory-wide **view-only** |
| `PRODUCTION_HEAD` | *Dept* Head | Scoped to one department at the data layer |
| `DISPATCH` | Dispatch | Finished goods only — never raw stock or requests |

The naming is a deliberate client-facing translation and a standing source of confusion:
the internal `ADMIN` role is the **Store** desk, and what the factory owner calls "Admin"
is the internal `OVERSIGHT` role.

### 4.3 The named-door pattern

`OVERSIGHT` is structurally view-only. Rather than weaken that as business needs arrived,
each write the owner genuinely needs was given its own **named door**: a dedicated
decorator and a two-sided guard, on its own controller, using no `@Roles` at all.

"Two-sided" means the guard refuses an unmarked handler *even for OVERSIGHT* — attaching
it to a route locks that route rather than opening it. Because no door uses `@Roles`, the
statement *"OVERSIGHT appears in no mutating `@Roles` list anywhere"* stays literally true
and is asserted by a test that sweeps every controller in the application.

Three doors exist, and the sweep asserts the complete set — a fourth cannot appear quietly:

| # | Door | Added | Grants |
|---|---|---|---|
| 1 | `@AllowCorrection` | 21 Jul, `a48a3fb` | Correct a finished-goods record (never identity or status) |
| 2 | `@AllowUserAdmin` | 21 Jul, `28ad071` | Create / rename / reset / deactivate non-privileged logins |
| 3 | `@AllowReprintApproval` | 22 Jul, `bc5755b` | Approve or reject a label reprint — **not** print one |

### 4.4 Escalation prevention

User creation is capped to `PRODUCTION_HEAD` and `DISPATCH`; privileged roles remain
seed-only. The email domain is composed server-side, so a smuggled `evil@gmail.com` local
part is rejected by the charset rule. Store's pre-existing creation path accepted any role
and was capped at the same time. Store and Admin logins cannot be deactivated — locking
the factory out would be unrecoverable. No password or hash is ever logged, returned in an
API response, or written to the audit trail.

---

## 5. Data model and migrations

Sixteen models. Ten migrations (dated by their directory timestamp), all additive — **no destructive schema change has ever
been applied to production.**

| # | Dated | Migration | Content |
|---|---|---|---|
| 1 | 2026-06-24 | `init` | Users, roles, audit, invoices, materials, QR, catalogue, settings |
| 2 | 2026-07-04 | `add_hsn_and_weight` | HSN code + per-package weight |
| 3 | 2026-07-09 | `phase2_stock_and_requests` | Production requests, stock ledger |
| 4 | 2026-07-09 | `multi_material_requests` | Parent request + line items |
| 5 | 2026-07-19 | `phase3_finished_goods_dispatch` | Batches, output, FG, FG QR, dispatch |
| 6 | 2026-07-21 | `add_raw_material_units` | Litres alongside kilograms |
| 7 | 2026-07-21 | `returns_and_stock_levels` | Returns lifecycle, min/max levels |
| 8 | 2026-07-21 | `fg_qr_reprint_flag` | `qrReprintNeeded` |
| 9 | 2026-07-22 | `user_last_login` | `lastLoginAt` |
| 10 | 2026-07-22 | `label_reprint_approvals` | Reprint lock — 2 columns, 1 table, 2 enums, 2 CHECKs |

### 5.1 Units are never blended

Raw materials can be denominated in kilograms or litres. **No view anywhere produces a
single summed number across different units.** Totals are returned as `{unit, total}[]`,
and yield returns `null` rather than a confident wrong number when output is in litres and
input in kilograms. Dedicated tests insert mixed-unit data and assert no view ever blends
them.

### 5.2 Handover flush

A guarded flush script wipes transactional data for handover while preserving every user
account, the encrypted Claude key and (by default) the catalogue. It requires **both** an
environment flag and an exactly-typed confirmation phrase; either alone produces a dry run.

`flush-plan.spec.ts` derives its assertions *from the schema*, so adding a model that
breaks the flush fails a test rather than the handover. It checks that every model is
either deleted or explicitly preserved, that every child is deleted before its parent, and
that both ID sequences reset.

---

## 6. Selected engineering detail

### 6.1 Stale dashboards — the central refresh layer (21 Jul, `b86be09`)

Dashboards were showing stale data. The cause was diagnosed by reproduction rather than
inspection: a two-session API test proved the **server** was returning fresh data in
189 ms, so the staleness was entirely client-side — screens fetched once on mount and
never again.

The fix is one central refresh bus subscribed to focus, `visibilitychange`, reconnect and
local mutations, with opt-in visibility-gated polling for the few screens that genuinely
change without user action. Deliberately not aggressive polling everywhere: the factory
runs on mobile data, so battery and payload matter. Focus and reconnect are throttled;
mutations and interval ticks never are.

### 6.2 Material visibility incident (21 Jul, `462d07a`)

Material scanned in at the Store could not be found afterwards. Database-first diagnosis
proved the **data was correct** — 38 units, all `READY_FOR_PRODUCTION`. Two independent
derivation defects were hiding it:

1. Company Brain counted rows in the ADD ledger (3 all-time) instead of physical arrivals
   (38 that day).
2. Stock levels filtered on `balanceKg NOT NULL`, hiding 3 units that had arrived without
   a usable pack weight.

Both were fixed at the query layer, and the units with no weight are now *surfaced as a
flagged queue* rather than silently omitted. Verified live afterwards: 670 kg across 35
units received, 3 flagged units named, and Store and Admin views identical at 13,747.8 kg.

### 6.3 Multi-head departments (21 Jul, `28ad071`)

Multiple heads can now share one department: they see the same data and can continue each
other's batches, while every action stays attributed to the individual login. Proven live
— PU and PU2 returned identical batch lists, escalation attempts returned 400, domain
smuggling returned 400, and all four forbidden surfaces returned 403.

### 6.4 Navigation (22 Jul, `8a92c34`)

The application's routes are flat sidebar destinations, so "back" could not come from the
URL shape alone. Back resolves in three steps — a recorded origin, then a declared parent,
then the role's home — and **every candidate is filtered through a role map** so a back
navigation can never land someone on a screen they cannot open. That map is parsed out of
`App.tsx` by a test, so it cannot drift from the real guards.

Tabs, open details and list filters moved into the URL, which is what makes browser and
Android gesture back work correctly: opening a batch trace is now a history entry that
back closes, rather than an invisible state change that back escapes entirely.

Two defects were found by driving a real browser rather than reading the code:

- **One tab tap created two history entries.** Radix activates a tab on both pointer-down
  and the focus that follows, and both calls land in the same tick before React re-renders,
  so a snapshot-based guard still saw the pre-click value and both pushed. The guard now
  reads the live URL. Left in place, the user's next Back visibly did nothing.
- **Catalogue and Batches loaded with a hardcoded empty filter on mount** — invisible while
  the filter always started empty, wrong the moment filters could arrive from the URL.

### 6.5 The label reprint lock (22 Jul, `bc5755b`)

The client asked for label generation to be a one-time act. Reading the code first changed
the shape of the fix: **minting already happened exactly once and was already guarded** —
`QrCode.materialId` is unique, and `fgGeneratedAt` returns 409 on a second finished-goods
mint. What was unguarded was **printing**: every label route was a stateless `GET` that
re-rendered the stored payload, and nothing recorded that a print had happened.

So the delivered feature is a lock on reprints. The first print of any label set is free
and silent; a later print needs an approved request carrying a reason, and the approval
carries a **quota** the factory Admin chooses. Each print spends one; the request re-locks
when the quota is gone.

Design decisions worth recording:

- **Oversight approves, not Store.** Store is itself the main printer of raw-material
  labels, so letting Store approve would have made the commonest case self-approval and
  the lock decoration exactly where it is used most. Because Oversight *can* print
  raw-material labels, self-approval is refused outright.
- **All four raw-material export formats share one allowance.** The CSV feeds label-design
  software that prints the same stickers, so switching format is not a way round the lock.
- **A correction-driven reprint carries its own single-use allowance.** `qrReprintNeeded`
  is set only when a correction changed a printed field — itself an Oversight act — and
  demanding a second approval to fix a label Oversight just invalidated would leave wrong
  stickers on drums while someone waited. Clearing that flag now happens inside the same
  transaction that records the print; previously they were separate writes that could
  disagree.
- **Reprints use the same renderer**, never a copy, so the 216×108pt one-label-per-page
  geometry cannot drift between first print and reprint.

---

## 7. Testing

| Suite | Count | Nature |
|---|---|---|
| Backend | 371 tests / 42 suites | Unit + structural, no live database required |
| Frontend | 29 tests / 2 suites | Pure logic (navigation resolution, refresh bus) |

Beyond conventional unit tests, several **structural** tests assert properties of the
codebase itself, so a future edit fails a test rather than production:

- The complete Oversight write surface is exactly the three named doors.
- The navigation role map matches the actual `<RequireRole>` guards in `App.tsx`.
- Minting never consults the reprint lock, and `fgGeneratedAt` is still what stops a
  double mint.
- Every schema model is either in the flush delete order or explicitly preserved, and
  every child is deleted before its parent.
- DISPATCH reaches exactly one analytics route and is denied stock, store, department and
  flow analytics.

---

## 8. Production verification

The following were verified against the **running production system**, not only in tests:

| Date | Verification |
|---|---|
| 07-21 | Received-material visibility: 670 kg / 35 units, Store and Admin identical at 13,747.8 kg |
| 07-21 | Multi-head: PU and PU2 identical batch lists; escalation 400; domain smuggling 400; four forbidden surfaces 403 |
| 07-21 | Live refresh: a head's progress bar moving 1→2→3 of 10 with zero interaction |
| 07-21 | Audited rename of the test login; full lifecycle intact in the audit trail |
| 07-22 | Navigation: back target role-correct per role, one history entry per tab, deep link cannot exit the app, 44px targets, zero horizontal overflow at 412px |
| 07-22 | Reprint lock: first print 200 → second 403 → CSV/ZIP 403 → request → Store approval 403 → Oversight approval → reprint 200 → third attempt 403, with four matching audit rows |

### 8.1 Migration of 22 July

The final migration was applied to production under an explicit safety procedure:

1. **Backup.** A Neon API branch was unavailable (no API key) and `pg_dump` 17.6 refused
   the 18.4 server. A full schema snapshot, per-table row counts and complete row exports
   of both altered tables (278 Material, 127 FinishedGood) were taken via raw SQL instead.
2. **Host confirmed** before applying: `ap-southeast-1`, non-pooled, exactly 1 pending.
3. **Applied**, then verified: both CHECK constraints present, row counts unchanged at
   278 and 127, no existing row rewritten.

The backup step produced an incidental proof of the deployment hazard: the freshly
generated Prisma client threw `P2022 — Material.labelPrintedAt does not exist` against the
un-migrated database. Because Prisma selects all scalar columns, deploying that code before
the migration would have broken **every raw-material screen**, not just labels. The code
push was held until the migration was confirmed applied.

---

## 9. Known limitations and open items

Recorded honestly, because each is a decision rather than an oversight:

1. **All six seeded logins still use the published default password** (`ChangeMe123!`,
   printed in `PHASE2_UAT.md`), including the owner's own Admin account. The Users tab now
   flags this prominently, but flagging is not fixing. **This is the highest-priority item
   before handover.**
2. **One free print per pre-existing label.** Nothing was backfilled on 22 July, so every
   unit that existed before then gets one more approval-free print and the lock bites from
   the second. Deliberate — nothing in the data recorded whether a label had been printed,
   so any backfill would have been a guess capable of blocking a genuine first print. It
   becomes moot after the handover flush.
3. **Browser back cannot be intercepted on an unsaved Review & Confirm line.** React
   Router's `useBlocker` requires a data router; this application uses `BrowserRouter`.
   The in-app Back control and tab-close are both guarded. Closing the gap means migrating
   all 18 routes to `createBrowserRouter` — worth doing as its own change, not as a
   side-effect.
4. **Reprint approval has no fallback approver.** By choice: the door stays narrow. If the
   owner's availability becomes a bottleneck, allowing Store to approve *finished-goods*
   reprints only is a one-line guard change plus a test.
5. **`READY` finished-goods status is a known no-op**, documented as such.
6. **Migrations are applied manually** before deploying code. Configuring
   `prisma migrate deploy` as a Railway pre-deploy command would make the deploy fail
   closed and remove this entire class of ordering hazard. Recommended.
7. **Railway build times are unpredictable** — 28 seconds to 30+ minutes for equivalent
   commits. Because Vercel deploys in ~30 seconds, there is a real window where the new UI
   talks to the old API; new API fields must therefore always tolerate being absent.

---

## 10. Standing constraints observed throughout

Every change in this engagement was made under the following non-negotiables:

- Phases 1, 2, FIFO and 3 remain fully intact — no functional regression across any phase.
- Server-side role isolation preserved on every query path.
- Append-only audit trail extended to every new action.
- Additive, non-destructive migrations only; SQL reviewed before application.
- Guards, stock logic and label geometry (216×108pt exact) not touched without explicit
  instruction.
- `prefers-reduced-motion` respected; performance work not regressed.
- Passwords never logged, never returned in an API response, never echoed to stdout.
- Real supplier invoices (containing GSTIN and bank details) never committed.
- Mobile-first: the factory works one-handed on phones, on mobile data, in gloves.

---

*Prepared 2026-07-22. All figures read from the repository and live system at report time.*
