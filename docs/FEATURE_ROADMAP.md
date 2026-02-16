# Feature Roadmap

This roadmap sequences the next major features in a way that keeps data integrity and UX quality high.

## Phase 1: Core Finance Workflow

### 1) Monthly Budgets (with rollover + threshold alerts)
- Scope:
  - Per-category monthly budget amount.
  - Optional rollover of unused amount to next month.
  - Warning levels at configurable thresholds (for example 80%, 100%, 120%).
- Data model:
  - `budgets`: `{ id, categoryId, amount, monthKey, rolloverEnabled, alertThresholds[] }`
- Success criteria:
  - Dashboard shows budget progress bars.
  - Overspend states visible in Transactions and Dashboard.

### 2) Recurring Transactions
- Scope:
  - Rules for weekly/monthly custom recurrences.
  - Auto-create pending transactions when due.
  - “Mark as done” and “skip this cycle”.
- Data model:
  - `recurring_rules`: `{ id, type, amount, categoryId, accountId, frequency, nextRunOn, isActive }`
- Success criteria:
  - Users can create/edit/disable rules.
  - Due items are surfaced and one-click posted.

### 3) Savings Goals
- Scope:
  - Named goals with target amount/date.
  - Progress tracking based on tagged transactions or manual contributions.
- Data model:
  - `goals`: `{ id, name, targetAmount, targetDate, linkedAccountIds[], currentAmount }`
- Success criteria:
  - Goal card and details page.
  - Progress and projection shown on dashboard.

## Phase 2: Import + Automation

### 4) CSV/OFX Import + Reconciliation
- Scope:
  - Upload statement file, parse preview, map columns, deduplicate.
  - Match imported entries against existing transactions.
- Data model:
  - `imports`: `{ id, accountId, sourceType, importedAt, rowCount, matchedCount }`
- Success criteria:
  - Import wizard with preview and conflict resolution.
  - Reconciliation summary after import.

### 5) Transaction Rules Engine
- Scope:
  - Rule conditions: merchant text, amount range, account, direction.
  - Actions: set category, note template, mark transfer candidate.
- Data model:
  - `transaction_rules`: `{ id, priority, conditions, actions, enabled }`
- Success criteria:
  - Auto-categorization applied at create/import time.
  - Rule debug trace visible when needed.

## Phase 3: Collaboration + Documents

### 6) Shared Household Mode
- Scope:
  - Shared workspace with members and roles.
  - Permissions: owner/editor/viewer.
  - Audit trail for critical edits/deletes.
- Data model:
  - `households`, `household_members`, `audit_events`
- Success criteria:
  - Invite/accept flow.
  - Role-based access enforcement in UI and backend rules.

### 7) Receipt/Attachment Support
- Scope:
  - Attach image/PDF to transaction.
  - Thumbnail preview + download.
- Data model:
  - `transaction_attachments`: `{ id, transactionId, storagePath, contentType, uploadedAt }`
- Success criteria:
  - Upload from transaction form/details.
  - Storage rules enforce owner access.

## Phase 4: Accounting Controls

### 8) Monthly Close Workflow (immutable snapshots)
- Scope:
  - “Close month” action that locks period edits.
  - Snapshot totals by account/category.
  - Re-open with explicit permission + audit event.
- Data model:
  - `month_closures`: `{ id, monthKey, closedAt, closedBy, snapshot }`
- Success criteria:
  - Locked month indicator in transactions.
  - Reports can be generated from snapshot data.

## Technical Prerequisites

- Move local-first entities toward optional Firestore sync model with conflict strategy.
- Add store-level test coverage for every new write path.
- Add migration strategy for persisted local data shape changes.
- Enforce lint/test/build checks in CI for every PR.

