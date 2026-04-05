# FastAPI + Vue Replatform Design

Date: 2026-04-05
Status: Approved for planning
Scope: Full runtime replacement of the current Next.js monolith with a FastAPI backend and Vue frontend, delivering a reduced first release focused on core accounting flows plus dashboard summaries and CSV import/export

## Summary

Rebuild TaxHacker in this repository as a contract-first modular monorepo with a strict backend/frontend boundary. Replace the current Next.js runtime with:

- a FastAPI backend responsible for business logic, persistence, validation, AI orchestration, and CSV processing
- a Vue 3 frontend responsible for rendering, form state, route navigation, and API consumption

The first release is intentionally smaller than the current product. It covers the core accounting workflow:

- authentication
- dashboard summaries
- file upload and unsorted review queue
- AI-assisted analysis
- transaction CRUD
- categories, projects, currencies, and LLM settings
- CSV import/export

Billing, backups, invoice apps, self-hosted setup flows, and other secondary features remain out of scope for the initial replatform.

## Goals

- Replace the current Next.js runtime with a true backend/frontend split.
- Establish a contract-first monorepo architecture that keeps business rules in the backend only.
- Deliver a reduced first release that supports the main accounting workflow end to end.
- Use a clean-slate schema optimized for the new architecture.
- Start with a bare skeleton and implement features incrementally with tests first.
- Enforce unit test line coverage greater than 95% for backend and frontend code.

## Non-Goals

- Preserving the current PostgreSQL schema or data model.
- Delivering full feature parity with the existing app in the first release.
- Supporting Stripe, subscription billing, or membership logic in the first release.
- Porting backups, invoice app features, self-hosted setup flows, or multilingual UI in the first release.
- Reusing the old server runtime or preserving Next.js server actions and route handlers.

## Current Codebase Constraints

- The current application is a Next.js 15 monolith combining UI, routing, server actions, route handlers, Prisma access, and AI orchestration in one runtime.
- Domain logic is mixed across React components, app routes, model helpers, and AI provider utilities.
- The current persistence model is PostgreSQL via Prisma, with a broad schema designed for both current and future features.
- Automated testing infrastructure is minimal today, so the new architecture needs to introduce coverage gates from the start instead of retrofitting them after features land.
- The current codebase contains useful domain knowledge and extraction logic, but direct file-by-file runtime migration would carry coupling into the new system.

## Proposed Architecture

### Repository Layout

Reorganize the repository into a modular monorepo:

- `backend/`
  - FastAPI application
  - feature routers, services, repositories, schemas, and tests
- `frontend/`
  - Vue 3 application
  - routes, stores, composables, components, and tests
- `docs/`
  - architecture, specs, and implementation plans
- generated client output directory
  - TypeScript API client generated from the backend OpenAPI schema

The old Next.js app remains in the repository only as source reference during migration and is removed from the active runtime path once the replacement is ready.

### Architectural Rule

The backend owns:

- authentication and authorization
- persistence and schema management
- file storage metadata
- AI provider orchestration
- CSV parsing, mapping, and export formatting
- dashboard aggregations
- validation and permission checks

The frontend owns:

- route rendering
- user interaction and form handling
- local UI state
- API calls through the generated client
- optimistic UI behavior where appropriate

No business rule should be duplicated in Vue if it already exists in FastAPI.

### Technology Choices

Backend:

- FastAPI
- Pydantic v2
- SQLAlchemy 2.0
- Alembic
- SQLite for the first release
- pytest and pytest-cov

Frontend:

- Vue 3
- Vite
- Vue Router
- Pinia
- TanStack Query for Vue
- Vitest
- Vue Testing Library

API contract:

- versioned REST API under `/api/v1`
- OpenAPI-generated TypeScript client used by the frontend

### Backend Module Shape

Organize the backend by feature modules, not generic layers:

- `auth`
- `dashboard`
- `documents`
- `analysis`
- `transactions`
- `settings`
- `categories`
- `projects`
- `currencies`
- `import_export`

Each module should contain:

- router definitions
- request/response schemas
- service logic
- repository interfaces and implementations
- focused unit tests

### Frontend Module Shape

Organize the frontend by user-facing feature areas:

- auth
- dashboard
- documents
- transactions
- settings
- import/export

Each feature should compose:

- route views
- small focused components
- Pinia stores only where shared state is justified
- composables for API interactions and form logic
- feature-specific tests

### Storage Strategy

For the first release:

- SQLite stores relational application data
- local filesystem stores uploaded file contents

Storage and repository interfaces should be explicit so future upgrades to PostgreSQL or object storage do not require feature-level rewrites.

## First Release Feature Boundary

### Included

- email/password authentication
- login/logout/current-user session handling
- dashboard summary metrics
- document upload
- unsorted document listing and review flow
- AI analysis with cached extraction result
- transaction list, filters, detail, create, edit, and delete
- settings for categories, projects, currencies, and LLM provider configuration
- CSV import
- CSV export

### Excluded

- Stripe and subscription workflows
- self-hosted setup wizard flows
- backups
- invoice app functionality
- multilingual UI
- third-party OAuth providers
- mandatory background workers
- broad custom dynamic field parity with the old app

## Clean-Slate Data Model

The new schema should be smaller and shaped around the first-release workflow.

### Core Tables

#### `users`

- `id`
- `email`
- `password_hash`
- `display_name`
- `created_at`
- `updated_at`

#### `sessions`

- `id`
- `user_id`
- `token_hash`
- `expires_at`
- `created_at`

#### `settings`

Per-user validated key/value settings store for:

- default transaction values
- LLM provider selection
- provider credentials and model configuration

#### `categories`

- `id`
- `user_id`
- `code`
- `name`
- `color`
- `llm_prompt`
- `is_system`

#### `projects`

- `id`
- `user_id`
- `code`
- `name`
- `color`
- `llm_prompt`
- `is_system`

#### `currencies`

- `id`
- `user_id`
- `code`
- `symbol`
- `name`
- `is_system`

#### `documents`

Replaces the current `files` model.

- `id`
- `user_id`
- `filename`
- `storage_path`
- `mime_type`
- `size_bytes`
- `status`
- `cached_analysis_json`
- `reviewed_at`
- `created_at`

#### `transactions`

- `id`
- `user_id`
- `document_id` nullable
- `name`
- `description`
- `merchant`
- `amount_minor`
- `currency_code`
- `transaction_type`
- `category_code`
- `project_code`
- `issued_at`
- `note`
- `source`
- `raw_text`
- `created_at`
- `updated_at`

#### `transaction_items`

Optional extracted line items associated with a transaction.

#### `transaction_extra_fields`

Simple extensibility point for selected extra values without rebuilding the full dynamic field system in the first release.

#### `import_jobs`

Minimal audit trail for CSV imports:

- filename
- status
- created transaction count
- skipped row count
- error summary
- created_at

### Intentional Simplifications

- Use a single nullable `document_id` on a transaction for the first release instead of many-to-many file attachments.
- Keep AI analysis synchronous through the API in the first cut.
- Keep settings as validated key/value records rather than expanding many fields into top-level typed columns.
- Do not port full custom dynamic field behavior in the first release.

## API Contract

The backend should expose a versioned REST API under `/api/v1`.

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### Dashboard

- `GET /dashboard/summary`

### Documents

- `POST /documents`
- `GET /documents`
- `GET /documents/{id}`
- `POST /documents/{id}/analyze`
- `POST /documents/{id}/mark-reviewed`

### Transactions

- `GET /transactions`
- `POST /transactions`
- `GET /transactions/{id}`
- `PATCH /transactions/{id}`
- `DELETE /transactions/{id}`

### Settings And Master Data

- `GET /settings`
- `PUT /settings`
- `GET/POST/PATCH/DELETE /categories`
- `GET/POST/PATCH/DELETE /projects`
- `GET/POST/PATCH/DELETE /currencies`

### Import And Export

- `POST /import/csv`
- `GET /import/{job_id}`
- `GET /export/csv`

The frontend must consume these endpoints through a generated TypeScript client rather than handwritten ad hoc fetch wrappers.

## Frontend Route Model

Initial Vue routes:

- `/login`
- `/dashboard`
- `/documents`
- `/transactions`
- `/transactions/:id`
- `/settings`
- `/import`
- `/export`

The frontend should use route guards for authenticated pages and keep cross-feature data fetching in composables backed by the generated client.

## Testing Strategy

Testing is a hard architecture requirement, not a final-phase cleanup step.

### Backend

- Use `pytest` and `pytest-cov`
- Enforce coverage with `--cov-fail-under=95`
- Focus unit tests on:
  - services
  - validators
  - auth helpers
  - CSV import/export mappers
  - AI orchestration
  - repository boundary behavior where custom logic exists
- Add smaller API integration tests for routers using dependency overrides and test databases

### Frontend

- Use `vitest`
- Use `@testing-library/vue`
- Enforce line coverage at greater than 95%
- Focus unit tests on:
  - composables
  - Pinia stores
  - route guards
  - request adapters
  - form transforms and validators
  - critical components with real user interactions

### Coverage Discipline

To keep coverage above 95% without artificial tests:

- favor small modules with clear interfaces
- isolate framework glue behind thin adapters
- exclude generated API client code from coverage
- add new features test-first and keep coverage thresholds active from the skeleton stage onward

## Incremental Delivery Path

### Phase 1: Skeleton

Create the monorepo structure and toolchain:

- backend app factory
- frontend app bootstrap
- lint, typecheck, and test scripts
- backend and frontend coverage gates
- CI entry points
- OpenAPI client generation flow

Write failing tests first for:

- backend app creation and health endpoint
- backend auth service primitives
- frontend router bootstrap
- frontend auth store behavior

Only then implement the minimum code to make those tests pass.

### Phase 2: Auth Vertical Slice

Implement:

- user registration
- login
- logout
- current-user lookup
- session persistence
- protected frontend routing

### Phase 3: Documents

Implement:

- local file storage
- document upload
- unsorted document listing
- document detail view

### Phase 4: AI Analysis

Implement:

- analysis provider abstraction
- backend analysis orchestration
- cached result persistence
- frontend analyze/retry/review interactions

### Phase 5: Transactions

Implement:

- transaction list and filters
- transaction detail page
- create and edit flows
- delete flow
- document-to-transaction handoff

### Phase 6: Settings And Master Data

Implement:

- categories
- projects
- currencies
- LLM provider settings

### Phase 7: Dashboard And CSV

Implement:

- dashboard summary API and UI
- CSV import workflow
- CSV export workflow

### Phase 8: Runtime Cutover

Once the new FastAPI + Vue stack runs the supported first-release workflow end to end and the test suites are green:

- switch project scripts and documentation to the new runtime
- remove the old Next.js runtime from the active application path

## Migration Rules

- Reuse domain knowledge and selected algorithms from the existing codebase where helpful.
- Do not port runtime structure from Next.js into the new stack.
- Keep backend rules authoritative even when frontend validation mirrors some constraints for UX.
- Avoid large compatibility layers that preserve old abstractions unnecessarily.
- Favor clean seams and smaller units over rapid file-by-file translation.

## Risks And Mitigations

### Risk: Coverage target becomes expensive if large framework files accumulate

Mitigation:

- keep files small
- isolate framework setup
- test service and composable layers directly

### Risk: AI analysis blocks request/response latency

Mitigation:

- start with synchronous orchestration for simplicity
- keep the provider abstraction and service boundary ready for future async job extraction

### Risk: Clean-slate schema omits an edge case from the current app

Mitigation:

- constrain the first-release scope explicitly
- validate each planned feature against the selected v1 workflow only

### Risk: Frontend duplicates backend rules over time

Mitigation:

- use generated API types
- keep validation ownership in the backend
- treat frontend validation as convenience, not source of truth

## Acceptance Criteria For The Replatform Foundation

The foundation is considered complete when:

- the repository contains separate FastAPI and Vue applications
- the frontend uses a generated client from the backend OpenAPI schema
- backend and frontend coverage gates are active and fail below 95% line coverage
- the initial auth and skeleton tests are written before implementation code
- the architecture supports incremental delivery of the agreed first-release scope
