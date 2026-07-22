# Knowledge Graph Report — Modern Colours ERP

> Narrative index for [`KNOWLEDGE_GRAPH.md`](./KNOWLEDGE_GRAPH.md). Read that file for
> the diagrams, this one for what they mean and where to go next. Together they're the
> fastest path from "never seen this repo" to "know what's load-bearing" — for a human
> or an AI agent.

## How to use these two files

1. Skim [`KNOWLEDGE_GRAPH.md`](./KNOWLEDGE_GRAPH.md) top to bottom — six diagrams, ~2 minutes.
2. Open [`knowledge-graph-interactive.html`](./knowledge-graph-interactive.html) in a
   browser to explore the same graph as a live force-directed visualization — drag to
   pan, scroll to zoom, click any of the 2,035 nodes for its file, line count, and full
   import / imported-by list, grouped into 152 labeled subsystems.
3. Come back here for the god-node explanations, the subsystem table, and the
   navigation playbook below.
4. For invariants, exact endpoints, and field-level detail, the standing docs are
   still authoritative: [`ARCHITECTURE.md`](./ARCHITECTURE.md) (structure + invariants)
   and [`FIELD_REFERENCE.md`](./FIELD_REFERENCE.md) (every DB column). This report
   doesn't duplicate them — it's the map that tells you which of them to open.

## Corpus stats

Static analysis of the full repo (tree-sitter AST, deterministic, no LLM):

| Metric | Value |
|---|---|
| Code files analyzed | 276 (backend + frontend, `.ts`/`.tsx`) |
| Graph nodes (functions, classes, types, components...) | 2,035 |
| Graph edges (calls, imports, extends...) | 5,089 |
| Detected communities (Leiden clustering) | 152 |
| Backend modules | 19 |
| Frontend pages | 19 |
| Prisma models / enums | 16 / 12 |
| Backend tests | 261 across 28 suites (`ARCHITECTURE.md` §10) |

## God nodes — the load-bearing abstractions

Ranked by connection count in the extracted call graph. These are the things you touch
carefully, because a change ripples widely.

| Node | Edges | What it is | Why it's a hub |
|---|---|---|---|
| `AuthUser` | 123 | Type describing the authenticated JWT user (id, role, department) | Referenced by almost every controller/service that needs to know who's calling |
| `Roles()` | 87 | `@Roles(...)` decorator, backend `common/decorators/` | Attached to nearly every protected route for RBAC |
| `cn()` | 81 | Tailwind class-merge utility, `frontend/src/lib/utils.ts` | Used by nearly every UI component — a UI-plumbing hub, not a domain one |
| `CurrentUser` | 80 | `@CurrentUser()` param decorator, injects `AuthUser` into handlers | Paired with `Roles()` on protected endpoints |
| `PrismaService` | 69 | The Prisma client wrapper, `backend/src/prisma/` | Injected into virtually every `*.service.ts` for DB access |
| `toast()` | 46 | Frontend notification helper | UI-plumbing hub |
| `useAutoRefresh()` | 41 | Frontend polling hook | Used across dashboards to keep data live |
| `AuditService` | 40 | Append-only audit log writer, `modules/audit/` | Every write endpoint calls it (invariant I4) |
| `useAuth()` | 31 | Frontend auth context hook | Read by every role-gated page/component |
| `Button` / `Card*` | 27–30 | shadcn/ui primitives | UI-plumbing hubs |

Two different kinds of hub here, worth telling apart: **`AuthUser`, `Roles()`,
`CurrentUser`, `PrismaService`, `AuditService`, `RolesGuard`, `JwtAuthGuard`** are
*domain-architectural* hubs — they encode the security and persistence model, and live
in `backend/src/common/` and `backend/src/prisma/`. **`cn()`, `toast()`,
`useAutoRefresh()`, `useAuth()`, `Button`, `Card*`** are *UI-plumbing* hubs — high
fan-out because nearly every component imports them, but changing them is a styling/UX
concern, not an architecture one.

## Subsystem index

The 19 backend modules, grouped by the phase they serve (matches
[`ARCHITECTURE.md`](./ARCHITECTURE.md) §6, cross-referenced against the module import
graph in `KNOWLEDGE_GRAPH.md` §2):

| Phase | Modules | Serves |
|---|---|---|
| **Cross-cutting** | `auth`, `users`, `settings`, `audit`, `qr`, `label-reprint`, `analytics`, `dashboard`, `handover` | Login/RBAC, user admin, encrypted API key, append-only log, QR generation, reprint approvals, dashboards, factory handover |
| **Phase 1 — inward** | `catalogue`, `ai-extraction`, `purchase-order`, `material`, `receiving` | Supplier PO upload → AI/manual extraction → operator confirm → Material rows + QR + label print → scan-in |
| **Phase 2 — requests & stock** | `production-request`, `stock` | Department requests → Store line review → scan-issue → append-only ledger (`StockTransaction`) → FIFO advisory |
| **Phase 3 — batches & dispatch** | `batch`, `production-output`, `finished-goods` | Batch → output (confirm gate) → FG QR minting → dispatch scan |

Frontend mirrors this: `frontend/src/pages/` has one page per phase-1/2/3 screen (see
`KNOWLEDGE_GRAPH.md` §6), `frontend/src/components/` is organized by domain
(`catalogue/`, `dashboard/`, `labels/`, `scan/`) plus a shared `ui/` (shadcn) and
`common/` layer.

## Non-negotiable invariants (I1–I12)

Full text and enforcement points are in `ARCHITECTURE.md` §3 — don't change any of
these without reading that table first:

- No auto-save of AI-extracted data before explicit operator confirm (I1)
- QR is 1:1 with physical units, never with line items (I3)
- Audit log is append-only, corrections are new entries (I4)
- RBAC is enforced server-side on every route, never just hidden in the UI (I5)
- Any AI extraction failure falls back to manual entry, operator never blocked (I7)
- Unique IDs (`MC-######`, `FG-######`) are sequential and zero-padded (I8)
- Scans queue offline and sync on reconnect, idempotent on retry (I9)
- Department isolation is enforced server-side (I10)
- Stock balance can never go negative (I11)
- FG QRs require a confirmed output, minted exactly once (I12)

## Entry points

| File | Role |
|---|---|
| `backend/src/main.ts` | Backend bootstrap — global `/api` prefix, validation pipe, CORS, dual-stack listen |
| `backend/src/app.module.ts` | Root NestJS module — wires all 19 feature modules |
| `backend/prisma/schema.prisma` | Canonical data model — 16 models, 12 enums |
| `frontend/src/App.tsx` | Route table + role gates (`RequireRole`) |
| `frontend/src/lib/api.ts` | Typed REST client — every backend call goes through here |
| `frontend/src/lib/auth.tsx` | `AuthProvider` / `useAuth()` — JWT storage, 401 handling |
| `backend/src/common/` | Auth types, guards, decorators, department scoping, crypto, storage |

## Navigation playbook

- **Touching auth/RBAC?** Start at `backend/src/common/auth/` and `common/guards/`.
  Every protected controller depends on these (see god-node list above). Run
  `dispatch-isolation.spec.ts` and `phase1-access.spec.ts` after any guard change.
- **Touching the material lifecycle (PO → QR → stock → batch → FG)?** Read
  `KNOWLEDGE_GRAPH.md` §4 first, then the matching module in §2, then
  `ARCHITECTURE.md` §8 for the exact endpoint sequence.
- **Touching the data model?** Cross-check `KNOWLEDGE_GRAPH.md` §3 against
  `FIELD_REFERENCE.md` before writing a migration — the invariants table above almost
  always constrains what a schema change is allowed to do.
- **Adding a frontend page?** Follow the pattern in `KNOWLEDGE_GRAPH.md` §6 —
  add the route in `App.tsx`, gate it with `RequireRole`, lazy-load it if it pulls in
  `recharts` (see the existing dashboard pages for the pattern).
- **Adding a backend module?** Register it in `app.module.ts`, and check whether it
  needs `PrismaModule` and/or `AuditModule` (every write path emits an audit entry —
  see I4).

## Provenance — how to regenerate

The diagrams in `KNOWLEDGE_GRAPH.md` and the stats above were built by:

1. Running [Graphify](https://github.com/Graphify-Labs/graphify)'s deterministic,
   local, no-LLM AST pass over the repo:
   ```bash
   pip install graphifyy   # or: uv tool install graphifyy
   graphify extract . --code-only                     # tree-sitter AST → graph.json (2035 nodes, 5089 edges)
   graphify cluster-only . --backend claude-cli        # Leiden communities, named via the local `claude` CLI
   graphify god-nodes --top 25 --graph graphify-out/graph.json
   ```
   This writes `graphify-out/graph.json`, `graphify-out/graph.html` (interactive,
   force-directed, vis-network) and `graphify-out/GRAPH_REPORT.md`. `graphify-out/` is
   gitignored — it's regenerable and machine-oriented — but `graph.html` was copied to
   [`docs/knowledge-graph-interactive.html`](./knowledge-graph-interactive.html) with
   its one CDN script (`vis-network`) inlined, so it's a single self-contained file that
   opens straight from the repo, offline, no build step. Regenerate + re-inline after
   structural changes:
   ```bash
   graphify cluster-only . --backend claude-cli
   python3 -c "
   import re
   html = open('graphify-out/graph.html').read()
   lib = open('vis-network.min.js').read()   # curl -sL -o vis-network.min.js https://unpkg.com/vis-network@9.1.6/standalone/umd/vis-network.min.js
   pattern = re.compile(r'<script src=\"https://unpkg\.com/vis-network[^>]*></script>')
   open('docs/knowledge-graph-interactive.html', 'w').write(pattern.sub(lambda m: f'<script>\n{lib}\n</script>', html))
   "
   ```
   Or run `graphify query "<question>"` / `graphify explain "<Node>"` /
   `graphify path "A" "B"` against `graphify-out/graph.json` directly for ad-hoc queries.
2. Cross-referencing the extracted module-import graph, Prisma schema relations, and
   route table directly against the source (not inferred) to build the Mermaid
   diagrams in `KNOWLEDGE_GRAPH.md`.
3. Grounding the domain narrative (phases, invariants, roles) in the repo's own
   `ARCHITECTURE.md`, which remains the canonical source — this report summarizes it
   for graph navigation, it does not replace it.

**Keep it current:** when a module's imports change, a Prisma model changes shape, or
a route is added/removed, regenerate the affected diagram section. These two files are
meant to be a living map, same as `ARCHITECTURE.md`.

---
_Generated 2026-07-22 from a clean clone of the repo._
