# Antigravity Build Prompt — Intellifusion (SIH26024)

**Project:** AI-Based Smart Governance & Compliance Monitoring System for Coal Mines
**Team:** Intellifusion | **Problem Statement:** SIH26024 | **Theme:** Smart Automation
**Target:** Smart India Hackathon 2026 — shortlisting + Grand Finale demoable MVP

---

## 0. How You Must Work

- Use a **`plan.md` / `task.md`** phase-by-phase workflow. Write `plan.md` first (architecture, phases, module boundaries) before touching code. Break each phase into `task.md` checklist items and update it as you complete work.
- **Do not make any UI, layout, color, or visual-design decisions on your own.** This prompt intentionally contains zero UI direction. Before building any screen, component, or visual element, **stop and ask me** what components to use, how it should look, how it should behave (scrolling, transitions, animations, layout structure), and what effects (if any) I want. Treat design as a separate conversation from functionality — do not default to generic dashboard templates, stock component libraries' default styling, or "safe" AI-generated layouts without checking with me first.
- **No auto-browsing and no automatic screenshots.** Do not open a browser preview or capture screenshots on your own initiative at any point in the workflow. Only do so if I explicitly ask you to. Always pause and ask before proceeding to the next phase, module, or screen — do not chain multiple build steps together without checkpoints.
- Work module by module. Finish and confirm one vertical slice (e.g., one flow end-to-end) before starting the next, rather than scaffolding everything shallowly at once.
- Flag any assumption you're making about scope, data, or functionality explicitly — don't silently fill gaps.

---

## 0.5 Reliability Guardrails (Hallucination & Stall Prevention)

**Anti-hallucination rules:**
- Never mark a `task.md` item as complete without actually running or testing it. "Should work" is not "works" — verify before checking it off.
- Never invent library APIs, package names, function signatures, or model behavior you're not certain about. If you're not sure a package/method exists or behaves a certain way, say so and verify (check docs, check the installed version) rather than generating plausible-looking code that may be wrong.
- Never fabricate demo output — sync-success percentages, KPI numbers, model scores, or "it worked" claims must come from an actual run against the mock data, not an invented plausible-sounding figure.
- Never claim a phase or module is done "in principle" — if something is stubbed, mocked, or incomplete, say so explicitly in `task.md` rather than letting it read as finished.
- When uncertain about a design or technical decision within your allowed scope (i.e., not a UI decision — those always go to me), state the uncertainty and the tradeoff rather than picking silently and presenting it as the obvious choice.

**Anti-stall / anti-hibernation rules:**
- Never go quiet mid-task or silently abandon a phase. If you hit a blocker, a missing dependency, an ambiguous requirement, or you're not sure how to proceed, say so plainly and ask rather than stalling or fabricating progress to appear unstuck.
- Checkpoint your actual state in `task.md` after every meaningful step, not just at phase boundaries — so if a session ends or resets mid-phase, the next session can resume from a known, accurate point instead of guessing.
- If you're resuming after any interruption or gap, re-verify the real state of the code (re-open the files, re-run whatever you can) before trusting your own prior notes in `task.md` — don't assume past-you was right about what got finished.
- If a task is taking far longer or proving far more complex than expected, flag that explicitly rather than quietly narrowing scope or silently producing a partial/simplified version without telling me.

---

## 1. Project Context

Intellifusion is a compliance and governance platform for coal mines. It unifies compliance monitoring, inspection tracking, contractor management, operational reporting, and field-level governance into one system, for three user roles: mine officials, corporate management, and regulatory authorities.

**Why this exists:** Existing Coal India Limited systems (ICCC / AI video analytics, DigiCOAL, Safety AI Analytics Dashboard, NRSC satellite MoU, NCMSR portal, ERP layers) are strong on real-time surveillance and operational visibility, but weak on turning fragmented compliance, contractor, and inspection data into **predictive, auditable, closed-loop statutory intelligence** that works **offline** and scales paperlessly. That gap is what this system closes — position and build accordingly.

**Ground-truth constraint that shapes every technical decision:** real coal mines do not have reliable connectivity or GPS everywhere. Underground galleries block satellite signal entirely; cellular/Wi-Fi coverage is patchy at best. Every module below must be designed offline-first, not "online with an offline fallback."

---

## 2. Scope for This Build: MVP, Not Full Vision

Build **one clean, end-to-end demoable story**, not a broad shallow platform. Everything outside the MVP scope below goes into a `ROADMAP.md` file as "Phase 2 / Scale-up" — do not build it now, but document it so it's visible.

### 2.1 The MVP Demo Flow (build exactly this loop first)

1. Field inspector (mobile) logs a safety/environment observation **offline** — with photo attachment and a geo-tag (real GPS on surface; a simulated underground beacon/checkpoint ID as a stand-in for BLE/UWB hardware we don't have for the hackathon).
2. An **on-device model** immediately produces a local "Risk Card" (score + flag) with zero network dependency.
3. When connectivity returns (simulate this — e.g., a manual "sync now" trigger or a connectivity toggle for demo purposes), the observation and its local Risk Card sync to the backend.
4. The **cloud layer** enriches the observation: deeper anomaly-detection scoring + an explainability layer (which features drove the flag) + a suggested corrective action.
5. A role-based dashboard (mine official / corporate / regulator views) shows the observation on a map/heatmap, the full Risk Card (score, top contributing factors, suggested action, status), and a simple KPI panel (average time-to-closure, % of offline observations successfully recovered/synced).
6. A manager closes the observation with a geo-tagged proof photo; KPIs update.

This is the "Edge-First Closed-Loop Compliance Engine with Explainable Risk Cards" — treat it as the hero feature. It is what makes this different from a generic dashboard: the loop from field → edge inference → sync → deeper cloud analysis → explainable card → closure → measurable KPI, working start to finish even when offline for part of it.

### 2.2 Explicitly Out of Scope for the MVP (put in `ROADMAP.md`)

- Full Kafka event streaming — a simple queue/direct API call is enough for the demo.
- Full TimescaleDB sensor time-series pipeline.
- Real Hyperledger Fabric blockchain — for the MVP, a **signed hash-chain / append-only log simulation** is enough to demonstrate tamper-evidence; note Hyperledger as an optional Phase 2 upgrade, not a build target now.
- Full multi-language OCR coverage — get one working pipeline (English + one regional language as proof of concept) rather than broad language support.
- Real UWB/BLE hardware mesh — simulate underground positioning with mock beacon IDs rather than integrating real hardware.
- The full Multi-Agent RAG Statutory Auditor (classifier → extractor → violation matcher → risk predictor over DGMS/Mines Act circulars) — this is a strong optional differentiator but is heavier scope. Build it only as a stretch goal after the core loop above is solid, using a small set of mock/sample statutory circulars, not a production knowledge base.
- Contractor Trust & Performance Graph (predictive contractor risk scoring) — stretch goal, after the core loop, not a Week 1 priority.
- Full multilingual conversational query interface — stretch goal.

---

## 3. Functional Requirements by Module

Build these as independent, modular services/components — not one monolith — so any one module can be swapped or extended later.

### 3.1 Field Inspection Capture (Mobile)
- Inspector logs a new observation: category (safety / environment / labour), description, photo, geo-tag or simulated beacon ID, timestamp.
- Must work fully offline: local storage queue, background sync when connectivity is available.
- On save (even offline), immediately runs the on-device risk model and shows the resulting local Risk Card to the inspector before syncing.

### 3.2 On-Device (Edge) Risk Scoring
- Lightweight model runs locally on the mobile device — a simple threshold rule set plus a small anomaly-detection model (e.g., Isolation Forest trained on mock inspection data) is sufficient for the MVP; keep this swappable so it can be upgraded later.
- Must run with zero network calls.
- Output: a score + flag (e.g., low/medium/high risk) attached to the observation before sync.

### 3.3 Sync & Offline Recovery
- Store-and-forward queue on the mobile client.
- On reconnect, batch-syncs queued observations to the backend.
- Track and expose a "% of offline observations successfully synced" metric for the KPI panel — this is a demo talking point, make sure it's real and measurable, not decorative.
- Basic conflict handling: if the same record is edited in two places, keep both versions with timestamps rather than silently overwriting (append, don't destroy).

### 3.4 Cloud-Side Enrichment
- On sync, run a deeper anomaly/risk model over the observation (and, if time allows, cross-reference recent related observations for that contractor/zone).
- Generate an explainability output — which factors contributed most to the risk score (a simple feature-importance breakdown is enough; doesn't need to be full SHAP if that's too heavy for the timeline, but the *card must show the reasoning*, not just a number).
- Generate one suggested corrective action per flagged observation (can be templated/rule-based for MVP — e.g., mapped from category + severity — not necessarily generative).

### 3.5 Backend & Data
- REST (or GraphQL, your call functionally) API backing the mobile app and dashboard.
- Relational store for compliance/observation records; spatial support for geo-tagged data.
- Append-only audit log for every observation, status change, and closure — every write should be logged with who/when/what changed, immutable after the fact (hash-chain the log entries for tamper-evidence).
- Role-based access control: inspector, contractor, mine official, regulator each see/do different things — enforce this at the API layer, not just by hiding UI elements.

### 3.6 Dashboard (Role-Based)
Functional requirements only — no visual/design decisions here, ask me before building any of this:
- Mine official / corporate / regulator each get a role-appropriate view.
- Must show: observations on a map/heatmap by risk level, the full Risk Card per observation (score, contributing factors, suggested action, status), a KPI panel (time-to-closure, % offline-synced, count of open high-risk observations), and a way to close out an observation with proof (photo + note).
- Escalation logic: high-risk observations that stay open past a threshold should visibly escalate (flagged differently, surfaced higher) — functional behavior, not styling.

### 3.7 OCR Pipeline (Proof of Concept)
- Take a scanned/photographed paper compliance record, extract text via OCR.
- Route low-confidence extractions to a manual-review queue instead of auto-accepting them — this human-in-the-loop step is a core requirement, not optional, since real mine paperwork is often handwritten/damaged.
- One working language pipeline (English) plus a proof-of-concept pass at one regional language if time allows — don't try to cover many languages for the MVP.

### 3.8 Tamper-Evident Audit Trail (Simulated)
- Every observation → action → closure event gets appended to a hash-chained log (each entry's hash includes the previous entry's hash) so any retroactive tampering is detectable.
- Expose a simple verification function/endpoint that can confirm the chain hasn't been altered — this is the demo proof point for "governance-grade trust," you don't need real Hyperledger Fabric for this to be convincing at MVP stage.

---

## 4. Stretch Goals (Only After Section 3 Is Fully Working)

Pick at most one or two, and only after the core loop is solid and demoable:

- **Statutory Knowledge Graph + Multi-Agent Auditor**: small pipeline (document classifier → extractor → violation matcher against a handful of mock DGMS/Mines Act circulars → risk predictor) that returns citation-backed findings. Use a small hand-picked sample of statutory text, not a production-scale ingestion system.
- **Contractor Risk Graph**: model contractors as nodes with historical violation density, open observations, and geo-tagged activity; score "deployment risk" before assigning a crew to a high-risk zone.
- **Multilingual conversational query layer**: natural-language queries over the observation data ("show open high-risk observations in Area X this week").

---

## 5. Data Requirements

- Generate **synthetic but realistic** mock data: inspection logs, contractor records, and observation histories across multiple mock mine sites/zones.
- If pursuing the statutory-auditor stretch goal, use a small number of real or realistic sample DGMS/CIL circular excerpts (publicly available) — don't fabricate legal text and present it as authoritative.
- Design the mock dataset so the KPI panel has something meaningful to show (a mix of open/closed observations across a plausible timeline, varied risk levels, some intentionally overdue items to demonstrate escalation).

---

## 6. Non-Functional Requirements

- **Offline-first, not online-with-fallback** — every field-facing feature must be usable with zero connectivity, syncing later.
- **Security**: encryption in transit (TLS) and at rest, RBAC enforced server-side, JWT-based auth is sufficient for MVP (don't over-build auth infrastructure).
- **Explainability is a hard requirement, not a nice-to-have** — every risk flag shown anywhere in the system must be accompanied by a reason, not a bare score.
- **Modularity** — structure code so any module (edge model, cloud model, OCR engine, audit log) could be swapped out without rewriting the rest of the system.
- Keep a running **`ROADMAP.md`** distinguishing "what's demoable now" from "what's Phase 2 / full vision" — update it as scope decisions get made, don't let it go stale.

---

## 7. Deliverables Checklist (track in `task.md`)

- [ ] `plan.md` covering architecture, module boundaries, and phase breakdown
- [ ] Working offline-capable mobile capture + on-device risk scoring
- [ ] Sync + offline-recovery mechanism with measurable sync-success metric
- [ ] Backend API with RBAC and append-only hash-chained audit log
- [ ] Cloud-side risk enrichment + explainability output + suggested action
- [ ] Role-based dashboard showing the full closed loop (ask me about design/components before building this)
- [ ] OCR proof-of-concept with human-review queue for low-confidence extractions
- [ ] `ROADMAP.md` listing everything explicitly deferred to Phase 2
- [ ] End-to-end demo path confirmed working: offline log → edge risk card → sync → cloud enrichment → dashboard → closure → KPI update

---

## 8. Reminders

- Ask me before any UI/component/visual/animation/effect decision — every time, not just once at the start.
- No auto-browsing, no automatic screenshots — ever, unless I explicitly ask.
- Pause at the end of each phase in `task.md` for my confirmation before moving to the next.
- If something in this prompt conflicts with a decision I make live during the build, my live instruction wins — update `plan.md`/`task.md` accordingly rather than silently reverting to this document.
- Re-read Section 0.5 before every phase checkpoint: no marking things done without verifying them, and no going silent if you're stuck — flag it instead.
