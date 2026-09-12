# Antigravity Continuation Prompt — RBAC Correction & Problem-Statement Alignment

**Project:** Intellifusion — SIH26024 | **This is a continuation, not a restart.**
The repo already exists (`plan.md`, `task.md`, `backend/`, `mobile/`, `dashboard/`). Do not scaffold from zero. Read the existing code before writing anything.

---

## 0. Before You Touch Anything: Acknowledge What Happened

Phase 6 of `task.md` is marked `[x] Design conversation completed with owner`. **That conversation did not happen.** Do not treat that checkmark as true. Do not build on top of it as if it were verified.

Also confirm, out loud, in your response before starting: the entire prior build landed in effectively one shot across two commits instead of phase-by-phase with real checkpoints. That will not happen again in this continuation — see Section 5.

---

## 0.5 Reliability Guardrails (restated — this failed once, it is non-negotiable now)

- **Never** mark a `task.md` item done without actually running/verifying it.
- **Never** check off a "STOP — ask the owner" checkpoint without an actual message in this conversation where the owner answered. If you reach a checkpoint, stop your turn and wait for a real reply — do not simulate one, do not assume a reasonable answer and proceed.
- **Never** claim a phase is "complete" while any of its own checklist items are unchecked.
- If something is ambiguous, blocked, or bigger than expected, say so plainly. Do not quietly narrow scope or fabricate a passing result.
- Still applies: no auto-browsing, no automatic screenshots, ever, unless explicitly asked.
- Still applies: **no UI/color/layout/animation/component decisions without asking first.** This document contains zero visual direction on purpose.

---

## 1. Mandatory Fixes (from code audit — fix these before adding anything new)

These were found by reading the actual code, not assumed. Fix all of them as Phase 8, in this order, with a verification step for each:

| # | Problem | Location | Required Fix |
|---|---|---|---|
| 1 | `POST /auth/register` accepts a caller-supplied `role` with no restriction — anyone can self-register as `regulator`. | `backend/app/api/auth.py`, `schemas/auth.py` | Public registration must never accept an elevated role. Only `super_admin` (new role — see Section 2) can create users with roles above `inspector`/`contractor`. Public self-registration, if kept at all, is `inspector` or `contractor` only, and even that should require an invite/approval step, not open signup. |
| 2 | `apply_role_filter` fails **open**: a `contractor` or `mine_official` with `mine_site_id = None` sees ALL observations across ALL sites. | `backend/app/api/observations.py` | Fail closed, not open. No `mine_site_id` = no data, not all data. Corporate-level visibility must come from an explicit role (Section 2), never from a null/missing field. |
| 3 | CORS allows `allow_origins=["*"]` together with `allow_credentials=True`. | `backend/app/main.py` | Restrict to an explicit allow-list read from an environment variable (e.g. `CORS_ALLOWED_ORIGINS`), no wildcard when credentials are enabled. |
| 4 | Audit hash-chain append has a race condition — concurrent writes can both read the same "latest" entry and fork the chain. | `backend/app/audit/chain.py` | Serialize entry creation: use `SELECT ... FOR UPDATE` on the latest row (or a dedicated single-row lock / advisory lock) inside the same transaction as the insert, so concurrent appends can't read the same "latest" hash. |
| 5 | `JWT_SECRET` differs between `.env.example` and `docker-compose.yml`. | both files | Single-source it — pick one value, make the other reference it or match it exactly, and note in a comment that both must always agree. |

**Verification for this phase:** write a test (or a runnable script, same pattern as the Phase 2/4/5 verify scripts already in the repo) for each of the 5 fixes above that fails against the old behavior and passes against the new one. Do not mark Phase 8 done without running these.

---

## 2. Corrected Role Model (per official Problem Statement — 6 roles, not 4)

The current `UserRole` enum only has `inspector`, `contractor`, `mine_official`, `regulator`. The official PS defines six distinct roles. Add the two missing ones as first-class roles — never simulate a role via a nullable field again.

| Role | Scope | Main Responsibility (per PS) |
|---|---|---|
| **Super Admin** | Platform-wide | Manage users, roles, mines, system settings, and the overall platform. Only role that can create/promote users into elevated roles. |
| **Corporate Management** | Multiple mines (explicit list or "all", never inferred from a null field) | Monitor multiple mines, KPIs, compliance, risk trends, and contractor performance. Read/monitor only — cannot approve closures or manage users. |
| **Mine Manager / Mine Official** | Single mine site (`mine_site_id` required, not optional) | Handle mine-level risks, assign corrective actions, approve closures, monitor inspections — scoped strictly to their own site. |
| **Field Inspector** | Own submissions | Conduct inspections, create safety/environment observations, capture photos/location, work offline. |
| **Contractor** | Only work explicitly assigned to them | Handle assigned work, corrective actions, submit completion evidence, maintain compliance. Must never see unrelated sites' or other contractors' data, with or without a `mine_site_id` set. |
| **Regulatory Authority** | Platform-wide, read/audit-oriented | Monitor compliance, violations, evidence, audit history, and governance records. Distinct from Super Admin — no user or system management. |

**Implementation requirements:**
- Extend the `UserRole` enum to all 6 values.
- Add an explicit join table or array field for Corporate Management's mine-site scope (`corporate_mine_access` or similar) — do not reuse `mine_site_id = None` for this ever again.
- Add an explicit assignment mechanism for Contractor scope (which observations/work orders/sites a given contractor is actually assigned to) rather than a blanket site filter — a contractor should see the work assigned to them, not "everything at their site."
- Update `apply_role_filter` (and the `close_observation` role check, and any other role-gated endpoint) to branch on all 6 roles explicitly. No implicit fallthrough behavior for any role.
- Seed script: create exactly one `super_admin` account on first setup; every other account is created by a `super_admin` (or through whatever registration flow you build in fix #1 above) — never self-assigned into an elevated role.

---

## 3. Problem-Statement Coverage Check

Go through the official expected-solution bullets below and, for each, state in your response whether it is (a) already built and verified, (b) partially built, or (c) not started — do not assume, check the actual code:

- Digitally track statutory compliance (safety, environment, production, labour)
- Real-time monitoring of inspections, observations, violations, corrective actions
- AI/analytics for high-risk areas, recurring compliance failures, operational anomalies
- Geo-tagged, time-stamped field reporting via mobile, with offline support
- Dashboards for mine officials, corporate management, AND regulatory authorities (three distinct views — corporate management's view does not exist yet since the role didn't exist)
- Automated alerts, reminders, escalation mechanisms
- Minimize manual paperwork (OCR/document digitization)
- Scalable across multiple mines/subsidiaries
- Secure digital audit trail (hash-chain already exists — confirm it's actually tamper-evident after fixing #4 above)

Anything marked "not started" or "partial" goes into an updated `ROADMAP.md` entry or a new Phase — do not silently skip it.

---

## 4. New Work After Fixes: Corporate Management Dashboard View

Once Section 1 and 2 are done and verified, add the missing Corporate Management dashboard view (multi-mine KPIs, compliance trends, contractor performance across sites). **This is a UI-affecting task — before writing any of it, stop and ask the owner:**

- What should the Corporate Management view show that the existing Mine Official/Regulator views don't already cover?
- How should "compliance trends across mines" be visualized — comparison table, trend chart, ranked list?
- Same open questions as the original Phase 6 checklist (component library, layout, colors, animations, etc.) — ask again, don't assume the answers from the existing (unapproved) dashboard theme carry over.

Do not write a line of dashboard code for this until those questions are actually answered in this conversation.

---

## 5. Phase Plan for This Continuation

| Phase | What | Checkpoint |
|---|---|---|
| 8 | Fix all 5 audit findings (Section 1) with verification scripts | All 5 verified; show the failing-then-passing test output |
| 9 | Extend role model to 6 roles, fix scoping logic, update seed script (Section 2) | Confirm each role's access boundaries with a test per role — including negative tests (a contractor without an assignment gets nothing) |
| 10 | Problem-statement coverage check (Section 3) | Present the coverage table to the owner before proceeding |
| 11 | Corporate Management dashboard view — **design checkpoint first** (Section 4) | STOP. Ask. Wait for a real answer in this thread before writing UI code. |

One phase at a time. Confirm each with me before moving to the next — do not chain phases together in a single pass like last time.
