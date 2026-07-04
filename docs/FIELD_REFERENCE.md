# Field Reference — Modern Colours Phase 1

A complete reference for every database column, for Phase 2 integration (weighing
machine + production system). Source of truth: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).
Update this file whenever the schema changes.

**Source** legend: **PO** = read from the purchase-order document · **User** = entered by
an operator/admin · **System** = generated/derived by the backend.

---

## User — application accounts

| Field | Purpose | Source | Type | Workflow |
|---|---|---|---|---|
| `id` | Primary key | System | UUID | Referenced by audit, PO, weighing records |
| `email` | Login identity (unique) | User | String | Login |
| `passwordHash` | Bcrypt hash of password | System | String | Login (never returned) |
| `name` | Display name | User | String | Shown in header / audit |
| `role` | `ADMIN` \| `SUPERVISOR` \| `OPERATOR` | User | Enum | Server-side RBAC on every route |
| `active` | Soft enable/disable | User | Boolean | Deactivated users cannot log in |
| `createdAt` / `updatedAt` | Timestamps | System | DateTime | Audit |

## MasterCatalogueItem — the SKU master list

| Field | Purpose | Source | Type | Workflow |
|---|---|---|---|---|
| `id` | Primary key | System | UUID | — |
| `materialName` | Canonical material name | User (CSV/manual) | String | Fuzzy-matched against PO lines (informational, never gates) |
| `sku` | Unique item/product code | User (CSV/manual) | String (unique) | Match key; auto-generated `TMP-xxxx` if blank |
| `hsnCode` | HSN/SAC tax code | User (CSV/manual) | String? | Reference; **own column** (never merged into `sku`) |
| `category` | Grouping (Binder, Pigment…) | User | String? | Display / filter |
| `unit` | Default measure (KG, LTR…) | User | String? | Display |
| `standardPackaging` | e.g. "25 Kg Bag" | User | String? | Display / packing reference |
| `metadata` | Extra unmapped CSV columns | System | JSON? | Preserved for Phase 2 |
| `active` | Soft-delete flag | User | Boolean | Only active items are matched |
| `createdAt` / `updatedAt` | Timestamps | System | DateTime | Audit |

## PurchaseOrder — the document (one per uploaded/typed PO)

| Field | Purpose | Source | Type | Workflow |
|---|---|---|---|---|
| `id` | Primary key | System | UUID | — |
| `poNumber` | Supplier PO/invoice number | PO / User | String? | Display, search |
| `supplier` | Vendor name | PO / User | String? | Copied onto each Material |
| `fileKey` | Storage key of the document (R2/disk) | System | String? | Null for manual (fileless) POs |
| `fileName` | Original filename | User | String? | Preview / download |
| `status` | `PO_UPLOADED`→`AI_EXTRACTED`→`OPERATOR_VERIFIED`→`REGISTERED` | System | Enum | Drives the review/confirm gate |
| `source` | `AI` \| `MANUAL` | System | Enum | How the data was produced |
| `extractedJson` | Raw Claude output | System | JSON? | Audit / debugging |
| `deliveryDate` | Stated delivery/due date | PO / User | DateTime? | Display |
| `uploadedById` | Who created it | System | UUID | Audit |
| `confirmedById` / `confirmedAt` | Who confirmed & when | System | UUID? / DateTime? | The hard gate (I1) |
| `createdAt` / `updatedAt` | Timestamps | System | DateTime | Audit |

## POLineItem — editable working set BEFORE confirmation (never auto-promoted, I1)

| Field | Purpose | Source | Type | Workflow |
|---|---|---|---|---|
| `id` | Primary key | System | UUID | — |
| `poId` | Parent PO | System | UUID | Cascade-deleted with the PO |
| `materialName` | Material description | PO / User | String | Becomes each Material's name |
| `hsnCode` | HSN/SAC tax code | PO / User | String? | **Own column** (fixed post-demo; was wrongly under `sku`) |
| `sku` | Supplier item/product code | PO / User | String? | Match key; **never** the HSN or quantity |
| `quantity` | **Number of physical packages** (bags/drums) | PO / User | Int | One QR/Material created per unit on confirm |
| `unit` | Package type (Bag/Drum) or bulk measure | PO / User | String? | Display; carried to Material |
| `weight` | PO-stated weight **per package** (kg) | PO / User | Float? | Reference; carried to Material |
| `batchNumber` | Batch/lot number | PO / User | String? | **Kept in DB, hidden in UI** — see note below |
| `matchType` | `EXACT`\|`SIMILAR`\|`NONE` catalogue match | System | Enum | Informational only (I6) |
| `matchedCatalogueId` | Linked catalogue item | System | UUID? | Informational |
| `edited` | Operator changed this row | System | Boolean | Audit |
| `createdAt` / `updatedAt` | Timestamps | System | DateTime | Audit |

## Material — one row per physical unit, created on confirm (I3)

| Field | Purpose | Source | Type | Workflow |
|---|---|---|---|---|
| `id` | Primary key | System | UUID | — |
| `uniqueId` | `MC-000001` sequential ID | System | String (unique) | Encoded in the QR; scanned at receiving |
| `poId` | Parent PO | System | UUID | — |
| `materialName` | Copied from the line item | System | String | Label + scan display |
| `sku` | Copied from the line item | System | String? | Label |
| `hsnCode` | Copied from the line item | System | String? | Label / Phase 2 reference |
| `supplier` | Copied from the PO | System | String? | Label |
| `batchNumber` | Copied from the line item | System | String? | Kept for Phase 2 traceability |
| `unit` | Copied from the line item | System | String? | Display |
| `weight` | PO-stated per-package weight | System | Float? | Reference (distinct from `receivedWeight`) |
| `status` | `REGISTERED`→`ARRIVED`→`SCANNED`→`WEIGHED`→`READY_FOR_PRODUCTION` | System | Enum | Receiving lifecycle |
| `receivedWeight` | Actual weight at receiving | User | Float? | Entered on scan; **Phase 2 weighing machine target** |
| `weighedById` / `weighedAt` | Who weighed & when | System | UUID? / DateTime? | Audit |
| `arrivedAt` / `scannedAt` | Lifecycle timestamps | System | DateTime? | Audit |
| `createdAt` / `updatedAt` | Timestamps | System | DateTime | Audit |

## QrCode — one per Material

| Field | Purpose | Source | Type | Workflow |
|---|---|---|---|---|
| `id` | Primary key | System | UUID | — |
| `materialId` | Owning material (unique) | System | UUID | 1:1 with Material |
| `payload` | JSON encoded in the QR (`uniqueId`, name, sku, hsnCode, supplier, poNumber, batch, date) | System | JSON | Read on scan |
| `imageRef` | Rendered QR PNG (data URL) | System | String? | Label rendering |
| `createdAt` | Timestamp | System | DateTime | — |

## Setting — encrypted key/value (Claude API key, I2)

| Field | Purpose | Source | Type | Workflow |
|---|---|---|---|---|
| `id` | Primary key | System | UUID | — |
| `key` | e.g. `CLAUDE_API_KEY` (unique) | System | String | Lookup |
| `valueEncrypted` | AES-256-GCM ciphertext | System | String | Never returned to the frontend |
| `valueMasked` | e.g. `sk-ant-…x9f2` | System | String | Safe to display |
| `iv` / `authTag` | GCM nonce + tag | System | String | Decryption |
| `updatedById` / `updatedAt` / `createdAt` | Audit | System | — | — |

## AuditLog — append-only history (I4)

| Field | Purpose | Source | Type | Workflow |
|---|---|---|---|---|
| `id` | Primary key | System | UUID | — |
| `entityType` / `entityId` | What was acted on | System | String | Trace |
| `action` | e.g. `AI_EXTRACTED`, `MATERIALS_REGISTERED`, `WEIGHT_ENTERED` | System | String | Trace |
| `actorId` | Who did it | System | UUID? | Trace |
| `beforeJson` / `afterJson` | State snapshots | System | JSON? | Corrections reference the original row |
| `device` | Source device | System | String? | Trace |
| `correctionOfId` | Points to a corrected row | System | UUID? | Corrections never mutate history |
| `createdAt` | Timestamp | System | DateTime | — |

---

## Note — Batch column decision (post-demo item 9)

The **Batch** field was removed from all UI tables (PO review, labels) per the client's
request, **but the `batchNumber` column is intentionally retained** on `POLineItem` and
`Material` (and in the QR `payload`). Rationale: batch/lot tracking is a strong candidate
for Phase 2 production traceability, and dropping the column would lose data and force a
Phase 2 rework. It is simply not displayed or captured in the Phase 1 UI. Re-surfacing it
later is a UI-only change — no migration required.
