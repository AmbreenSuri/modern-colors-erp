# Knowledge Graph — Modern Colours ERP

> **Purpose:** a visual map of the codebase for a developer or AI agent seeing this
> repo for the first time. Every diagram below renders natively in GitHub (Mermaid) —
> no tooling required, just open this file.
>
> **Companion doc:** [`KNOWLEDGE_GRAPH_REPORT.md`](./KNOWLEDGE_GRAPH_REPORT.md) — the
> narrative index (god nodes, subsystem table, navigation playbook).
> **Want to explore instead of read?** Open
> [`knowledge-graph-interactive.html`](./knowledge-graph-interactive.html) in a browser —
> a force-directed, zoomable, searchable graph of every module in the repo (152 labeled
> subsystems), click any node for its file, line count, and full import/imported-by list.
> **Source of truth for prose/invariants:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) — this
> graph is derived from it plus a static-analysis pass over the code (see
> [Provenance](./KNOWLEDGE_GRAPH_REPORT.md#provenance--how-to-regenerate)).

---

## 1. System context

```mermaid
flowchart LR
    UI["React 19 SPA\nVite + Tailwind + shadcn/ui\n(frontend/)"]

    subgraph Backend["NestJS 11 API — prefix /api (backend/)"]
        Guards["JwtAuthGuard + RolesGuard"]
        Controllers["Controllers (19 modules)"]
        Services["Services"]
    end

    DB[("Postgres — Neon\nvia Prisma 6")]
    R2[("Cloudflare R2\nfile storage, S3 API")]
    Claude[["Anthropic Claude API\nPO field extraction"]]

    UI -- "JWT Bearer / JSON" --> Guards
    Guards --> Controllers --> Services
    Services --> DB
    Services --> R2
    Services -- "ai-extraction module only" --> Claude
```

No Docker, no GraphQL. Database is hosted Neon Postgres (not local); file storage is
Cloudflare R2 with a local-disk fallback when R2 credentials are absent.

---

## 2. Backend module graph

19 NestJS modules, grouped by the phase they serve. Arrows are real `imports: []`
edges from each `*.module.ts` — this is the actual dependency graph, not a guess.

```mermaid
flowchart TD
    subgraph Infra["Cross-cutting infrastructure"]
        Prisma[PrismaModule]
        AuditM[AuditModule]
        Storage[StorageModule]
        Settings[SettingsModule]
        Qr[QrModule]
        LabelReprint[LabelReprintModule]
    end

    subgraph Phase1["Phase 1 — Raw material inward"]
        Auth[AuthModule] --> Users[UsersModule]
        Catalogue[CatalogueModule] --> Settings
        AiExtraction[AiExtractionModule] --> Settings
        PO[PurchaseOrderModule] --> Catalogue
        PO --> AiExtraction
        PO --> Material[MaterialModule]
        Material --> Qr
        Material --> LabelReprint
        Receiving[ReceivingModule]
        Dashboard[DashboardModule]
    end

    subgraph Phase2["Phase 2 — Requests & stock"]
        ProdRequest[ProductionRequestModule] --> Prisma
        ProdRequest --> AuditM
        ProdRequest --> Stock[StockModule]
        Stock --> Prisma
        Stock --> AuditM
    end

    subgraph Phase3["Phase 3 — Batches, output, dispatch"]
        Batch[BatchModule] --> Prisma
        Batch --> AuditM
        ProdOutput[ProductionOutputModule] --> Prisma
        ProdOutput --> AuditM
        FG[FinishedGoodsModule] --> Prisma
        FG --> AuditM
        FG --> Qr
        FG --> LabelReprint
    end

    Analytics[AnalyticsModule] --> Prisma
    LabelReprint --> Prisma
    LabelReprint --> AuditM
```

`AppModule` (`backend/src/app.module.ts`) is the root that wires all 19 modules
together plus `HealthController` — it isn't drawn above because every node in this
diagram is a child of it.

---

## 3. Domain data model (16 Prisma models)

```mermaid
erDiagram
    User {
        string id
        string email
        Role role
        Department department
    }
    MasterCatalogueItem {
        string sku
        string materialName
        boolean active
    }
    PurchaseOrder {
        string poNumber
        POStatus status
        Source source
    }
    POLineItem {
        string materialName
        MatchType matchType
    }
    Material {
        string uniqueId "MC-000001..."
        MaterialStatus status
        float balanceKg
    }
    QrCode {
        json payload
    }
    ProductionRequest {
        Department department
        RequestStatus status
    }
    ProductionRequestItem {
        float requestedKg
        float issuedKg
    }
    StockTransaction {
        StockTxnType type
        float quantityKg
        float balanceAfter
    }
    Batch {
        string batchNumber
        BatchStatus status
    }
    ProductionOutput {
        int packageCount
        boolean confirmed
    }
    FinishedGood {
        string uniqueId "FG-000001..."
        FgStatus status
    }
    FinishedGoodQr {
        json payload
    }
    LabelReprintRequest {
        string reason
    }
    AuditLog {
        string action
    }
    Setting {
        string key
    }

    User ||--o{ PurchaseOrder : "uploads / confirms"
    User ||--o{ AuditLog : "acts as"
    User ||--o{ ProductionRequest : "requests / reviews"
    User ||--o{ StockTransaction : "acts as"
    User ||--o{ Batch : creates
    User ||--o{ ProductionOutput : "records / confirms"
    User ||--o{ FinishedGood : "dispatches / returns"
    User ||--o{ LabelReprintRequest : "requests / decides"

    PurchaseOrder ||--o{ POLineItem : contains
    POLineItem }o--o| MasterCatalogueItem : matches
    PurchaseOrder ||--o{ Material : registers

    Material ||--|| QrCode : has
    Material ||--o{ StockTransaction : moves
    Material ||--o{ LabelReprintRequest : "re-print of"

    ProductionRequest ||--o{ ProductionRequestItem : lines
    ProductionRequestItem }o--o| Batch : "for batch"
    ProductionRequestItem ||--o{ StockTransaction : issues

    Batch ||--o{ ProductionOutput : produces
    ProductionOutput ||--o{ FinishedGood : mints
    Batch ||--o{ FinishedGood : "belongs to"
    FinishedGood ||--|| FinishedGoodQr : has
    FinishedGood ||--o| FinishedGood : "refurbished from / into"

    ProductionOutput ||--o{ LabelReprintRequest : "re-print of"
    FinishedGood ||--o{ LabelReprintRequest : "re-print of"
```

`LabelReprintRequest` is polymorphic — it optionally references a `PurchaseOrder`,
`Material`, `ProductionOutput`, or `FinishedGood` depending on which label is being
reprinted, all behind an approval workflow (`label-reprint` module).

---

## 4. Material lifecycle — Phase 1 → 2 → 3

The single most important flow in the system. Every ⬦ is a **hard gate**: nothing
downstream happens without an explicit human confirm.

```mermaid
flowchart TD
    A[Operator uploads PO file] --> B["AI Extraction\nClaude API parses PO fields"]
    B -->|success| C[Lines matched against\nMaster Catalogue]
    B -->|"failure (no key / API down)"| C2[Manual entry fallback\noperator never blocked]
    C --> D[Operator reviews and corrects]
    C2 --> D
    D --> E{"Operator confirms?\nHARD GATE — I1"}
    E -->|yes| F["N Material rows created\none per physical unit, MC-000001..."]
    F --> G[N QR codes + 3x1.5in label roll PDF]
    G --> H[Truck arrives, scan each QR]
    H --> I[Unit: READY_FOR_PRODUCTION]

    I --> J[Production head raises\nmulti-material request]
    J --> K["Store reviews each line\naccept / partial / reject"]
    K --> L[Store scans unit, QR-verifies,\nreviews, confirms]
    L --> M["StockTransaction ledger row\nADD / DEDUCT / DISCARD"]
    M --> N["Material.balanceKg updated\nrow-locked, never negative — I11"]

    N --> O[Head opens a Batch]
    O --> P[Requests raw materials against\nthe batch — top-ups allowed]
    P --> Q[Head records ProductionOutput]
    Q --> R{"Head confirms output?\nHARD GATE"}
    R -->|yes| S["FinishedGood minted per drum\nFG-000001..., QR + label — I12"]
    S --> T["Dispatch scans FG QRs\nor bulk-dispatches the batch"]
```

FIFO is **advisory, never blocking**: scanning a non-oldest unit warns and logs a
`FIFO_OVERRIDE` audit entry, but the operator may proceed (not shown above to keep
the happy path readable — see `ARCHITECTURE.md` §8).

---

## 5. Cross-cutting "god nodes"

Nodes with disproportionately many edges in the extracted call graph — the load-bearing
abstractions that touch almost everything.

```mermaid
flowchart LR
    AuthUser["AuthUser type"] --> Controllers["Every protected controller\n(19 modules)"]
    CurrentUser["@CurrentUser() decorator"] --> Controllers
    RolesDec["@Roles() decorator"] --> Controllers
    JwtGuard[JwtAuthGuard] --> Controllers
    RolesGuard[RolesGuard] --> Controllers
    Prisma[PrismaService] --> Services["Nearly every *.service.ts"]
    Audit[AuditService] --> Services
    Services --> Prisma
    Services -.write-only.-> Audit
```

All five auth primitives live in `backend/src/common/` (`auth/`, `guards/`,
`decorators/`) — that directory is the single point of change for anything touching
authentication or authorization. See the report for the full ranked list, including
the frontend-side god nodes (`cn()`, `toast()`, `useAuth()`, `Button`, `Card`).

---

## 6. Frontend route map by role

```mermaid
flowchart TD
    Login["LoginPage — /login"] --> Landing{"Role-aware landing"}
    Landing -->|"ADMIN (Store) / OPERATOR / SUPERVISOR"| Dashboard["DashboardPage — /"]
    Landing -->|PRODUCTION_HEAD| Requests
    Landing -->|DISPATCH| Dispatch

    subgraph P1["Phase 1 — ADMIN, OPERATOR, SUPERVISOR"]
        PO["PurchaseOrdersPage — /purchase-orders"]
        Review["ReviewPage — /review, /review/:poId"]
        Labels["LabelsPage — /labels"]
        Receiving["ReceivingPage — /receiving"]
        Catalogue["CataloguePage — /catalogue"]
    end

    subgraph P2["Phase 2"]
        Requests["RequestsPage — /requests\nHEAD, OVERSIGHT, ADMIN"]
        Stock["StockPage — /stock\nADMIN"]
        StockLevels["StockLevelsPage — /stock-levels\nADMIN, OVERSIGHT"]
    end

    subgraph P3["Phase 3"]
        Batches["BatchesPage — /batches\nHEAD, ADMIN, OVERSIGHT"]
        ProdOutput["ProductionOutputPage — /production-output\nHEAD"]
        Dispatch["DispatchPage — /dispatch\nDISPATCH only"]
    end

    subgraph Dashboards["Role dashboards (lazy-loaded, recharts)"]
        Oversight["OversightPage — /oversight\nOVERSIGHT"]
        Store["StoreDashboardPage — /store\nADMIN"]
        Head["HeadDashboardPage — /my\nPRODUCTION_HEAD"]
    end

    Settings["SettingsPage — /settings"]
    Audit["AuditPage — /audit"]
```

Role gates are UI convenience only — the real enforcement is server-side (`RolesGuard`
+ `@Roles()` on every controller), see `dispatch-isolation.spec.ts` and
`phase1-access.spec.ts`.

---

_Generated 2026-07-22. Regenerate after structural changes — see
[Provenance](./KNOWLEDGE_GRAPH_REPORT.md#provenance--how-to-regenerate)._
