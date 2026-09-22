# Antigravity Continuation Prompt — Unified Governance Flow & Real RBAC

**Project:** Intellifusion — SIH26024 | **This is a continuation, not a restart.**
Repo: `github.com/harivarman-007/SIH` (`backend/`, `dashboard/`, `mobile/`, `plan.md`, `task.md`). Last completed phase in `task.md` is **Phase 23**; this work is **Phases 24–31**.
Read the existing code before writing anything. Do not scaffold from zero.

**Attached with this prompt:** the RBAC specification ("RBAC spec"). Save it into the repo as `docs/RBAC_SPEC.md` in Phase 24 step 1. It is the source of truth for the permission matrix, per-role sidebars, dashboards, button-level rules and acceptance tests. **This prompt overrides the RBAC spec only where Section 3 ("Binding Decisions") says so.**

---

## 0. How You Must Work

Same rules as the earlier prompts (`Intellifusion-Antigravity-Prompt.md`, `Intellifusion-RBAC-Fix-Prompt.md`), restated because they matter:

- **One phase at a time.** End every phase with the report in Section 9, then **STOP and wait for my explicit "go"**. Never chain phases.
- **Never mark a `task.md` item done without running it.** Paste real command output. No invented pass counts, KPI numbers or "should work".
- **Never claim done while something is stubbed.** Mark stubs `[~] stubbed: <what>` in `task.md`.
- **Never invent APIs or package versions.** Check installed versions (`pip show`, `npm ls`) before using a library.
- **Never edit an existing verify script assertion silently.** If a change in this prompt makes an old assertion wrong (Section 3, D9), list it in the phase report and change only that assertion.
- **No auto-browsing, no automatic screenshots**, unless I ask.
- **UI rule (refined):** reuse the existing design system, `dashboard/src/components/ui/` and existing components. Do **not** introduce new colors, fonts, animations or a new layout language on your own. For a genuinely new visual pattern (sidebar shell, action timeline, evidence uploader, permission-matrix editor, 403 screen) post **one batched list of questions with 2 options each before that phase's UI work**, then wait. Functional structure (which pages exist, what each role sees) is already specified here and in the RBAC spec — do not ask about that.
- Checkpoint `task.md` after every meaningful step, not only at phase ends.
- If blocked or the scope is bigger than expected, say so plainly. Do not quietly narrow scope.

---

## 1. Why This Work Exists (verified against the current code)

The pieces exist but the **flow is broken**: an observation can be closed with one click and no proof of work. The RBAC spec describes the intended lifecycle:

`OBSERVE → DETECT → EXPLAIN → ACT → VERIFY → CLOSE → AUDIT`

| # | Gap | Where it shows |
|---|---|---|
| G1 | No **Inspection** entity. Managers cannot schedule/assign inspections; observations just carry `inspector_id`. | `models/__init__.py` |
| G2 | No **CorrectiveAction** entity. `ContractorAssignment` only links contractor↔observation. A contractor cannot accept, start, upload evidence or submit; nobody can reject. | `models/__init__.py`, `api/observations.py` (`assign-contractor`) |
| G3 | Closure is a single `PATCH /observations/{id}/close` by `mine_official` **or `super_admin`**. No evidence, no verify/reject loop. | `api/observations.py` |
| G4 | Authorization is `require_roles(...)` plus ad-hoc mine filters copy-pasted per endpoint. No permission layer, no shared scope helper. `super_admin` can assign and close, which the RBAC spec forbids. | `services/auth.py`, `api/*.py` |
| G5 | JWT is stateless: no session record, no logout, no "session expired" vs "account disabled" distinction, no `last_login`. | `services/auth.py`, `api/auth.py` |
| G6 | No `ACCESS_DENIED`, login, logout or session events in the audit ledger. Audit entries carry `action`, `payload`, `actor_id` only. | `audit/chain.py`, callers |
| G7 | Dashboard is one SPA with tab state. **No URL routes, no route guards, no 403 page**, no dynamic sidebar (`PillNav` + role `if`s). | `dashboard/src/App.tsx`, `PillNav.tsx` |
| G8 | Only mine_official / corporate / regulator have real views. Super Admin, Contractor and Inspector-web have none. | `dashboard/src/components/` |
| G9 | Mobile is one-way. Inspectors cannot see assigned inspections or what happened to their observations. | `mobile/src/sync/`, `screens/` |
| G10 | `ObservationStatus` is `open / in_progress / closed / escalated`. The target has `under_review` and `action_required`. `enrichment/service.py` counts "unresolved zone hazards" with `status == open` only. | `models/__init__.py`, `enrichment/service.py` |
| G11 | `POST /auth/register` still allows open self-signup as `inspector` / `contractor`. | `api/auth.py` |

### Must-preserve invariants (do not break)

- The 6 DB role values stay exactly: `super_admin, corporate_management, mine_official, inspector, contractor, regulator`. **No enum rename.**
- Hash-chained audit ledger stays append-only and `/audit/verify` must still pass over old and new entries. Always write via `append_audit_entry`.
- Offline-first mobile flow, the on-device scoring engine and the connectivity demo toggle keep working.
- Edge/cloud ML (`app/edge`, `app/enrichment/engine.py`) is **out of scope**, except the unresolved-status fix in G10.
- All Phase 8–23 verify scripts (138 checks) keep passing except the owner-approved assertion changes in D9.
- `docker-compose up` stays the one-command start. Alembic migrations are forward-only with a working `downgrade()`, one per phase (`006_…` onward).

---

## 2. Canonical End-to-End Flow (build exactly this)

```
MINE MANAGER ──assign inspection──▶ FIELD INSPECTOR ──start / observe / edge-AI risk card──▶ (offline OK)
        ▲                                   │ sync (store-and-forward)
        │                                   ▼
        └────────────── review risk ◀── SERVER (cloud enrichment, audit)
MINE MANAGER ──create corrective action + assign contractor──▶ CONTRACTOR
CONTRACTOR: accept → start → upload before/after evidence + note + geo-tag → submit
MINE MANAGER: review evidence ──approve──▶ VERIFIED → CLOSED (case closed)
                             └─reject (reason required)──▶ back to contractor (IN_PROGRESS, new evidence round)
CLOSED ──▶ CORPORATE (KPIs/analytics)   and   REGULATOR (compliance + audit)
```

| Step | Actor | Endpoint (target) | Observation state | Action state | Audit event | Alert to |
|---|---|---|---|---|---|---|
| 1 | Manager | `POST /inspections` | — | — | `INSPECTION_ASSIGNED` | inspector |
| 2 | Inspector | `POST /inspections/{id}/start` | — | — | `INSPECTION_STARTED` | manager |
| 3 | Inspector | `POST /observations` / `POST /sync/batch` | `open` (=SYNCED) | — | `OBSERVATION_CREATED`, `RISK_GENERATED` | manager |
| 4 | Inspector | `POST /inspections/{id}/complete`, `/submit` | — | — | `INSPECTION_SUBMITTED` | manager |
| 5 | Manager | `POST /observations/{id}/review` | `under_review` | — | `OBSERVATION_REVIEWED` | — |
| 6 | Manager | `POST /actions` (creates **and** assigns) | `action_required` | `ASSIGNED` | `ACTION_CREATED`, `ACTION_ASSIGNED` | contractor |
| 7 | Contractor | `POST /actions/{id}/accept` | | `ACCEPTED` | `ACTION_ACCEPTED` | manager |
| 8 | Contractor | `POST /actions/{id}/start` | `in_progress` | `IN_PROGRESS` | `ACTION_STARTED` | manager |
| 9 | Contractor | `POST /actions/{id}/evidence` (multipart) | | `IN_PROGRESS` | `EVIDENCE_UPLOADED` | — |
| 10 | Contractor | `POST /actions/{id}/submit` | | `PENDING_VERIFICATION` | `ACTION_SUBMITTED` | manager |
| 11a | Manager | `POST /actions/{id}/verify` | `closed` when all its actions are closed | `VERIFIED` → `CLOSED` (atomic) | `ACTION_APPROVED`, `CASE_CLOSED` | contractor, corporate |
| 11b | Manager | `POST /actions/{id}/reject` `{reason}` | unchanged | `REJECTED` → `IN_PROGRESS` | `ACTION_REJECTED` | contractor |
| 12 | Corporate / Regulator | read-only endpoints, `POST /reports`, export | | | `REPORT_EXPORTED` | — |

Also required: SLA scheduler keeps escalating observations; **overdue corrective actions** raise alerts to manager + corporate (alert only, no state change).

Write this diagram and table into `docs/FLOW.md` and a short "Governance Flow" section in `README.md` in Phase 31. It is what we show the jury.

---

## 3. Binding Decisions (already made — do not re-ask)

The RBAC spec has internal contradictions and gaps. These are the resolutions:

| ID | Decision |
|---|---|
| D1 | **Role naming.** Keep DB values. Add `ROLE_LABELS` and route prefixes: `super_admin→SUPER_ADMIN /admin`, `corporate_management→CORPORATE_MANAGER /corporate`, `mine_official→MINE_MANAGER /manager`, `inspector→FIELD_INSPECTOR /inspector`, `contractor→CONTRACTOR /contractor`, `regulator→REGULATORY_AUTHORITY /regulator`. |
| D2 | **One role per user.** Skip the `user_roles` M:N table. **No role inheritance** — the hierarchy picture in the spec is an org picture, not permission inheritance. |
| D3 | **Permissions.** A code registry `app/authz/permissions.py` holds the default role→permission matrix (from spec §10 and §29 plus the extra permissions in D4). It seeds `permissions` + `role_permissions` tables; **the DB is what is enforced at runtime** (cached, invalidated on change). A code-level `HARD_DENY[role]` set can never be granted by any DB row (e.g. contractor can never hold `ACTION_VERIFY`). Super Admin cannot remove their own `USER_*`/`ROLE_*` permissions (lock-out guard). |
| D4 | **Extra permissions** beyond spec §29: `INSPECTION_ASSIGN`, `INSPECTION_START`, `INSPECTION_SUBMIT`, `OBSERVATION_REVIEW`, `RISK_ESCALATE`, `ACTION_ACCEPT`, `ACTION_PROGRESS`, `ACTION_SUBMIT`, `AUDIT_EXPORT`. |
| D5 | **Ambiguous matrix cells.** Inspector *Inspections C/E* = edit status fields of **assigned** inspections only; inspectors cannot create scheduled inspections, but **may still create ad-hoc observations** (`inspection_id` nullable) inside their mine's authorized zones so the current mobile flow keeps working. Inspector *Evidence C* = photos on their **own observations**, not on corrective actions. Contractor *Corrective Actions C/E* = act on **assigned** actions only (accept/start/progress/submit), never create. Corporate/Regulator *Users V* = API-only scoped directory (name, role, mine), no sidebar page. Inspector/Contractor *Audit V* = timeline of **their own resources** only, no sidebar page. |
| D6 | **Action creation = creation + assignment in one call.** Contractor is required; state starts `ASSIGNED`. Re-assign allowed only while `ASSIGNED`. |
| D7 | **Approve is atomic:** `PENDING_VERIFICATION → VERIFIED → CLOSED` in one transaction (two transition rows). The observation moves to `closed` only when **all** its actions are `CLOSED`. |
| D8 | **Observation states.** Keep `open` (means SYNCED), `in_progress`, `escalated`, `closed`; **add** `under_review`, `action_required` (`ALTER TYPE … ADD VALUE`; handle Alembic's autocommit requirement). `DRAFT / SUBMITTED / AI_ANALYZED / SYNC_PENDING` are **mobile-local** states in SQLite and map to server `open` on sync. Transition table: `open→under_review`; `under_review→action_required` (first action created) or `→closed` (manager, "no action required", reason mandatory); `action_required→in_progress` (first linked action reaches `IN_PROGRESS`); `in_progress→closed` (last linked action closed); any non-closed `→escalated` (scheduler or `RISK_ESCALATE`); `escalated→under_review/action_required/in_progress/closed` by the same rules. Implement as a **data table**, not scattered `if`s. Everything that means "unresolved" (scheduler, KPIs, `_fetch_context`) must use the set `{open, under_review, action_required, in_progress, escalated}`. |
| D9 | **Super Admin is not an operator.** Remove `super_admin` from `assign-contractor`, `close`, and any verify/close path. Old assertions in `verify_phase9_roles.py` (or others) that expect otherwise are updated **only for that**, and listed in the phase report. |
| D10 | **Legacy `PATCH /observations/{id}/close`** stays only for the "no action required" closure by `mine_official`, reason required, blocked if any linked action is not `CLOSED`. Audit `CASE_CLOSED` with `no_action_required: true`. |
| D11 | **Evidence rules.** Submit requires ≥1 `after_photo` and a completion note in the current round; geo-tag (lat/lng) captured when available. Verify requires a submitted round. Reject requires a reason of ≥10 chars and increments `submission_round`. Contractor sees the rejection reason. |
| D12 | **Separation of duties + human-in-the-loop.** Transitions to `VERIFIED`/`CLOSED` require a **human actor with `ACTION_VERIFY`**. The state machine takes an `actor_type` (`user`/`system`); `system` (scheduler, AI/enrichment) is rejected for those transitions, and there is a test proving it. Corporate/Regulator/Admin/Contractor/Inspector cannot verify. |
| D13 | **Sessions.** New `sessions` table (`jti`, `user_id`, `created_at`, `expires_at`, `revoked_at`, `ip`, `user_agent`). The JWT carries `jti`; every request checks the session is live. `POST /auth/logout` revokes. Standard error body `{code, message}` with codes `UNAUTHENTICATED`, `SESSION_EXPIRED`, `ACCOUNT_DISABLED`, `FORBIDDEN`. `users` gets `last_login_at` and `department`. |
| D14 | **Audit envelope.** Do not change the hash inputs. Put a standard envelope in the existing `payload`: `{event, actor:{id,name,role}, resource:{type,id}, meta:{ip,user_agent}, previous, new}`. Old entries must still verify. `ACCESS_DENIED` is written through a **separate session/transaction** so it survives the request rollback, and deduplicated (same user + resource + 30 s window) so 403 spam cannot bloat the ledger. Also log `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `SESSION_EXPIRED`. Never log passwords or tokens. |
| D15 | **Registration.** `POST /auth/register` is disabled unless `DEMO_MODE=true`. Users are created by Super Admin (existing admin-create endpoint, moved behind `USER_CREATE`). |
| D16 | **Demo accounts.** Add (idempotently) the six `*@intellifusion.demo` accounts from spec §22 **in addition to** existing seeds, only when `DEMO_MODE=true` (default true in `docker-compose.yml` dev, never in a production compose). The persona switcher becomes: logout → login as demo user → **full store reset** (auth, permissions, cached queries). |
| D17 | **Inspector surfaces.** The Expo app is the primary inspector UI. `/inspector/dashboard` on the web is a mobile-first single-column layout (spec test 4). Contractor is a desktop web dashboard (spec test 5). |
| D18 | **Contractor visibility.** A contractor may view the observation summary and risk card **only for observations linked to their own actions** — never other contractors' data. |
| D19 | **Notifications.** Extend `alerts` with nullable `recipient_user_id` and `action_id`. Keep existing role-based alerts. Workflow events in Section 2 create targeted alerts. |
| D20 | **Feature 6 in `SYSTEM_ARCHITECTURE_AND_ROADMAP.md`** (inspector sign-off before closure) is **superseded** by the RBAC spec: the Mine Manager verifies and closes. An optional inspector re-inspection step is out of scope. |
| D21 | **Human-readable IDs:** `INS-0001`, `ACT-0001` (DB sequences), shown in UI, alerts and audit. |
| D22 | **Scope helpers are mandatory.** No endpoint may hand-roll its own mine/contractor filter after Phase 24. **Fail closed:** missing `mine_site_id`, missing assignment or unknown role means no data. |

---

## 4. Target Data Model (new / changed)

New tables (SQLAlchemy 2.0 async models + Alembic):

- `permissions(code PK, description, resource, operation)`, `role_permissions(role, permission_code)`
- `sessions` (D13)
- `inspections(id, code, mine_site_id, zone_id, title, assigned_inspector_id, created_by_id, scheduled_for, due_at, status[SCHEDULED, IN_PROGRESS, COMPLETED, SUBMITTED, CANCELLED], started_at, completed_at, submitted_at, notes, updated_at)`
- `corrective_actions(id, code, observation_id, mine_site_id, contractor_id, created_by_id, title, description, priority[low, medium, high, critical], deadline, status[ASSIGNED, ACCEPTED, IN_PROGRESS, PENDING_VERIFICATION, REJECTED, VERIFIED, CLOSED], submission_round, rejection_reason, accepted_at, started_at, submitted_at, verified_by_id, verified_at, closed_at, updated_at)` — prefill `description` from `observations.suggested_action`.
- `action_evidence(id, action_id, round, kind[before_photo, after_photo, document, note], file_path, notes, lat, lng, uploaded_by_id, uploaded_at)` — reuse the existing photo storage path and MIME/size validation from the photo upload code.
- `workflow_transitions(id, entity_type, entity_id, from_state, to_state, actor_id, actor_role, actor_type, reason, at)` — powers timelines and tests.
- `compliance_rules(id, category, code, description, default_severity, statutory_ref, is_active)`
- `system_settings(key PK, value JSONB, updated_by_id, updated_at)` — SLA hours and risk-flag thresholds (currently hard-coded) become readable/editable here, with the existing values as defaults.
- `reports(id, type, scope JSONB, payload JSONB, generated_by_id, generated_at)`
- `contractor_profiles(user_id PK, company_name, license_no, cert_expiry, is_active)`

Changed: `observations.inspection_id` (nullable FK), `alerts.recipient_user_id` + `alerts.action_id`, `users.last_login_at` + `users.department`, `ObservationStatus` (D8). Reuse `corporate_mine_access` for the **regulator's authorized mines** too (legacy table name; add a code alias `UserMineAssignment`).
Keep `ContractorAssignment` readable for old data; new work goes through `corrective_actions`. Write a one-off data migration that turns existing assignments into `corrective_actions` in state `ASSIGNED`, with no data loss.

---

## 5. Authorization Architecture

**Backend** (`backend/app/authz/`):

- `permissions.py` — `Permission` enum, default matrix, `HARD_DENY`, `ROLE_LABELS`.
- `deps.py` — FastAPI dependencies: `authenticate` (token + live session + active account) → `require_permission(P)` → scope resolution. Keep `require_roles` as a thin wrapper for compatibility, but migrate all routers to `require_permission`.
- `scope.py` — `visible_mine_ids(user)`, `apply_observation_scope(stmt, user)`, `apply_inspection_scope`, `apply_action_scope`, `assert_can_access(resource, user)`. Rules: admin → all; corporate/regulator → their assigned mines; manager → own mine; inspector → assigned inspections + observations they created + their mine's zones; contractor → own actions. Anything else → empty / 403 (D22).
- `state_machine.py` — pure functions plus transition tables for observations, actions, inspections. Each transition declares: required permission, guard (e.g. evidence present, reason present, `actor_type`), side effects (alerts, audit, cascade to observation). Every transition writes `workflow_transitions` and an audit entry in the **same transaction**.
- `errors.py` — `{code, message}` responses; the 403 message must not leak implementation detail (spec §25).

**Frontend** (`dashboard/src/`):

- Add `react-router-dom` (check the version compatible with React 18 in `package.json`). Keep Zustand as the store; add `AuthProvider`, `PermissionProvider` (`can(permission)`, `scope`), `ProtectedRoute`, `RoleGuard`, `PermissionGuard`.
- `GET /auth/me` returns `{user, role, permissions[], scope{mine_ids}, status}`. The UI gets permissions **from the server**, never derived from the JWT alone.
- One `NAV_REGISTRY` (`id, label, path, requires: Permission, roles`) drives the sidebar. **No hard-coded per-role sidebars** (spec §16). `PermissionGuard` wraps every action button (spec §17).
- Routes use the prefixes in D1. Wrong-role URL → the **403 page** (spec §3 / §25 copy), not a silent redirect. Unauthenticated → `/login`. Also render the LOADING, SESSION EXPIRED and ACCOUNT DISABLED states.
- UI guards are convenience only; the server is the authority.

---

## 6. Phase Plan

Each phase: implement → migration → verify script → update `task.md` → report (Section 9) → **STOP**.

### Phase 24 — Authorization Foundation (backend only)

1. Save the RBAC spec to `docs/RBAC_SPEC.md`; add `docs/FLOW.md` skeleton (Section 2).
2. Migration `006`: `permissions`, `role_permissions`, `sessions`, `users.last_login_at/department`, `alerts.recipient_user_id/action_id`. Seed matrix from the registry (D3, D4).
3. Build `app/authz/*`. Implement sessions (D13), `POST /auth/logout`, `GET /auth/me`.
4. Migrate **every existing router** from `require_roles` to `require_permission` + shared scope helpers. Behavior stays identical except D9 (Super Admin no longer operates) and D15 (registration disabled outside `DEMO_MODE`).
5. Audit envelope + `ACCESS_DENIED`, login, logout and session events (D14).
6. Update the enrichment `_fetch_context` unresolved-status set now (G10), even before new statuses exist.
7. **Verify:** `scripts/verify_phase24_authz.py`
   - **Data-driven matrix test:** generate cases from the registry — for every role × resource × operation with a representative endpoint, assert allowed vs 403. Do not hand-write 100 cases.
   - Cross-mine (manager A vs mine B), cross-contractor, inspector without assignment, null `mine_site_id` fails closed.
   - `HARD_DENY` cannot be overridden via DB row; admin lock-out guard.
   - Session revoke → 401 `SESSION_EXPIRED`; disabled user → 403 `ACCOUNT_DISABLED`.
   - `ACCESS_DENIED` appears in audit, deduped; `/audit/verify` passes on old + new entries.
   - Full regression of all earlier verify scripts.

### Phase 25 — Workflow Engine + Inspections

1. Migration `007`: `inspections`, `workflow_transitions`, `observations.inspection_id`, new `ObservationStatus` values (D8).
2. `state_machine.py` with the three transition tables. Inspection API: create/list/get/assign/start/complete/submit/cancel with scope + permissions + alerts + audit.
3. Observation `review` endpoint and status handling (D8). Wire `inspection_id` through `POST /observations` and `/sync/batch` (optional field; old mobile payloads still work).
4. Scheduler and KPI queries use the unresolved set (D8).
5. **Verify:** `verify_phase25_inspections.py` — every legal transition passes, every illegal one is rejected (build the illegal set from the table's complement), inspector sees only assigned inspections, old payloads without `inspection_id` still sync, scheduler still escalates.

### Phase 26 — Corrective Actions, Evidence, Verify/Reject/Close

1. Migration `008`: `corrective_actions`, `action_evidence`, data migration from `contractor_assignments`.
2. Endpoints from Section 2 steps 6–11 including multipart evidence upload (validate type/size, store under the photo path, never trust client filenames). Overdue-action alerts in the scheduler.
3. Enforce D7, D10, D11, D12. Retire the old direct-close behavior per D10.
4. KPI additions: closure time (observation created → case closed), overdue actions, rejection rate, contractor on-time %, per mine and fleet.
5. **Verify:** `verify_phase26_actions.py`
   - Scripted **full lifecycle** = the jury flow (inspection → observation → action → evidence → verify → closed), API-level, with the audit chain verified at the end.
   - Reject loop (reason required, round increments, contractor sees reason, resubmission works).
   - Negative tests from RBAC spec §13/§32: contractor→VERIFIED denied, inspector→CLOSED denied, corporate/regulator/admin approval denied, `system` actor cannot verify/close, submit without after-photo denied, manager cannot verify an action from another mine.

### Phase 27 — Frontend Routing, Guards, Dynamic Sidebar  *(design checkpoint first)*

Post the one batched design-question list (sidebar shell, 403 screen, loading/expired/disabled screens). **Wait.** Then: install router, providers and guards, `NAV_REGISTRY`, 403 page, route table for all six roles (pages may be placeholders that render a titled empty state, marked `[~] stubbed` in `task.md`, until Phase 28). Move existing views (`ObservationTable`, `MineMap`, `CorporateManagementView`, `OcrQueueView`, `AuditTrailView`) behind their proper routes.
**Verify:** `npm run build` with 0 TS errors; guard unit tests (check whether Vitest is set up; if not, propose adding it as a dev dependency and wait for approval); run spec tests 1–8 against the running app **using API-level or unit-level checks** (no auto-browsing).

### Phase 28 — Six Role Dashboards + Workflow Screens  *(design checkpoint first)*

Batch design questions for: action detail + timeline, evidence uploader/viewer, inspection scheduling form, verify/reject dialog. Then build, per spec §15, using real endpoints only (no fabricated numbers):

- **Manager:** Risk Center (review → create action + assign contractor), Inspections, Corrective Actions board, verify/reject.
- **Contractor:** Assigned Work, action page (accept/start/upload/submit), rejection reason display, Performance.
- **Inspector (web, mobile-first):** assigned inspections, new observation entry point, pending sync, risk cards.
- **Corporate / Regulator:** read-only views over closed cases, KPIs, compliance, audit timeline; no verify buttons rendered.
- **Super Admin:** overview tiles from real system data (users, mines, sync status, AI service status, audit head hash).
Every button wrapped in `PermissionGuard`. Replace the persona switcher per D16.

### Phase 29 — Mobile: Inspections, Actions, Two-Way Delta Sync

1. Backend: `GET /sync/pull?since=<watermark>` returning assigned inspections and status changes of the caller's observations and their linked actions (watermark on `updated_at`; server wins on status).
2. Mobile: SQLite tables for cached inspections/actions and an outbox for inspection events (start/complete/submit) that syncs on reconnect; screens for Inspections (list/detail with start-complete-submit) and read-only Actions (status + rejection reason). Existing observation queue and offline toggle stay untouched. Batch design questions first for the new screens.
3. **Verify:** `verify_phase29_pull_sync.py` (watermark correctness, no duplicates, idempotent replays); manual checklist for offline start → observe → reconnect → sync (run by me).

### Phase 30 — Super Admin Console, Reports, Governance Config

- **Users:** create/edit/disable/activate/reset access/assign role (each audited: `USER_CREATED`, `ROLE_ASSIGNED`, `ROLE_CHANGED`).
- **Roles & Permissions page** (spec §24): shows role, users, permissions, scope, status; toggles write `PERMISSION_CHANGED` with previous/new values; respects `HARD_DENY` and the lock-out guard.
- **Mines & zones**, **Contractors** (`contractor_profiles`), **Compliance Rules**, **AI Configuration** (edit `system_settings`: risk-flag thresholds, SLA hours; the scheduler and cloud engine read them with a short cache), **Sync Monitor**, **System Health**.
- **Reports:** `POST /reports` (scope-limited snapshots: compliance summary, violations, closure performance), `GET /reports/{id}/export?format=csv` with `REPORT_EXPORTED` audit. PDF export is a stretch item — mark it `[~]` if not done.
- **Verify:** `verify_phase30_admin_reports.py`.

### Phase 31 — Demo Hardening & Final Acceptance

1. Idempotent demo accounts (D16) and a **story dataset**: one mine with an inspection ready to start, one contractor, so the jury flow works on a clean DB.
2. `scripts/demo_walkthrough.py` — drives the whole Section 2 flow via the API and prints each step's result and the final audit verification. `scripts/reset_demo.py` returns to the clean story state.
3. `scripts/verify_phase31_acceptance.py` — **RBAC spec §32 tests 1–15**, each as an automated assertion (UI-only tests 1–6 are checked as "correct dashboard route + permissions payload for that role").
4. Full regression: every verify script from Phases 8–31, plus `npm run build`.
5. Update `README.md` (roles, flow, demo accounts, `DEMO_MODE`), `docs/FLOW.md`, `ROADMAP.md`, `task.md`, `walkthrough.md`.

---

## 7. Out of Scope (do not start)

Kafka/IoT streaming, S3/MinIO, Celery, SSO/OIDC, HSM signing, YOLO/vision, digital twin, DGMS form generator, Merkle anchoring, retraining the ML models. Note them in `ROADMAP.md` if relevant; do not build them here.

---

## 8. Acceptance (the whole effort is done only when)

- The jury flow in RBAC spec §23 runs end to end **with real data** and `/audit/verify` still passes afterwards.
- RBAC spec §32 tests 1–15 pass as automated checks.
- No endpoint authorizes with a hand-rolled role/mine filter (grep proof in the Phase 24 report).
- Every workflow transition produced a `workflow_transitions` row and an audit event.
- All earlier verify scripts still pass (report the new total; do not reuse the old 138 figure).
- Every stubbed item is honestly marked in `task.md`.

---

## 9. Phase Report Format (end of every phase)

1. **Files changed** (grouped: backend / dashboard / mobile / scripts / docs).
2. **Migration** name and whether `upgrade` and `downgrade` both ran.
3. **Verification output**, pasted, for the new script and the regression run.
4. **Assertions changed** in old scripts (D9) — or "none".
5. **Stubbed / partial items** — or "none".
6. **Assumptions you made** and anything ambiguous that needs my decision.
7. **The next phase's design questions** (if it has a design checkpoint).

Then stop and wait for "go".

**Start now with Phase 24 step 1.** Do not touch Phase 25 until I confirm Phase 24.
