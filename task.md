# Intellifusion — Task Checklist

> Rule: Mark [/] when starting, [x] only after verified. Never mark done without running/testing.
> Re-read plan.md Section 10 (Assumptions) at every phase boundary.

---

## Phase 0 — Repo Structure, Docker, DB, Mock Data

- [x] Create monorepo folder structure (mobile/, backend/, dashboard/)
- [x] Write docker-compose.yml (PostgreSQL 15 + PostGIS, backend service)
- [x] Write backend/Dockerfile
- [x] Write backend requirements.txt (fastapi, uvicorn, sqlalchemy, alembic, psycopg2, python-jose, bcrypt, scikit-learn, pillow, pytesseract)
- [x] Write Alembic config and initial migration (all core tables)
- [x] Write scripts/generate_mock_data.py (5 sites, 3 zones each, 200 observations, varied risk/status, some overdue)
- [x] Run docker-compose up, verify PostgreSQL is healthy
- [x] Run Alembic migrations, verify all tables created
- [x] Run mock data seed script, verify data queryable via psql

**CHECKPOINT: Phase 0 complete — DB up, tables created, mock data queryable. Ready for Phase 1.**

---

## Phase 1 — Backend API (FastAPI)

- [x] Project skeleton: main.py, app/ structure, env config
- [x] Auth: POST /auth/login, POST /auth/register, JWT issue + verify, RBAC middleware
- [x] Observations: POST, GET list (role-filtered), GET detail, PATCH /close
- [x] Sync: POST /sync/batch (accepts array, creates observations, triggers enrichment async)
- [x] Sync: GET /sync/status (returns sync% KPI)
- [x] KPI: GET /kpi/ (time-to-closure avg, sync%, open-high-risk count)
- [x] Audit log: append_audit() called on every write, hash-chain verified
- [x] GET /audit/verify endpoint
- [x] GET /audit/log endpoint (regulator only)
- [x] Risk card: GET /observations/{id}/risk-card
- [x] Test all routes via Swagger UI (/docs)
- [x] Verify RBAC: inspector cannot access regulator routes, etc.

**CHECKPOINT: Phase 1 complete — all routes tested, RBAC verified. Confirm before Phase 2.**

---

## Phase 2 — Edge Model (Training + Export)

- [x] Write feature extractor (12 features as per plan.md Section 7) — `backend/app/edge/features.py`
- [x] Train Isolation Forest on mock data subset — `backend/app/edge/train_and_export.py` (1500 synthetic observations, 82/18 split)
- [x] Export model weights to JSON (lightweight, loadable in JS/TS) — `backend/app/edge/model_weights.json` (616KB, 50 trees)
- [x] Write rule layer (keyword-based instant flags) — `backend/app/edge/rules.py` (5 critical hazard patterns)
- [x] Write RiskScoringEngine wrapper — `backend/app/edge/engine.py` (Python) + `mobile/src/models/RiskScoringEngine.ts` (TypeScript)
- [x] Verify output on at least 10 mock observations — `backend/scripts/verify_edge_model.py` (15 scenarios: 4 rule-critical, 8 anomaly, 3 nominal)
- [x] Place exported model in mobile/assets/model/ — `mobile/assets/model/model.json` (616KB)

**CHECKPOINT: Phase 2 complete — model verified against mock data. Confirm before Phase 3.**

---

## Phase 3 — Mobile App (Offline + Sync)

- [x] Expo project init — `mobile/package.json`, `mobile/app.json`, `mobile/babel.config.js`, `mobile/tsconfig.json`
- [x] SQLite schema: observations table + sync_queue table — `mobile/src/db/schema.ts`, `ObservationRepository.ts`
- [x] Offline observation form (category, description, photo, geo-tag / beacon-id) — `NewObservationScreen.tsx`
- [x] On-save: persist to SQLite, run on-device scoring, show Risk Card to inspector — `NewObservationScreen.tsx` → `RiskCardScreen.tsx`
- [x] Sync worker: on connectivity event, batch-POST queued items to /sync/batch — `SyncWorker.ts`, `TaskManager.ts`
- [x] Sync worker: mark items synced in local queue, update sync% — `ObservationRepository.markSynced()`, `getSyncStats()`
- [x] Manual "Sync Now" trigger for demo — `QueueScreen.tsx` "Sync Now" button
- [x] Connectivity toggle UI element for demo (simulate offline/online) — `QueueScreen.tsx` DEMO toggle + `useConnectivity.ts` store
- [x] Auth: login screen, JWT stored in SecureStore — `LoginScreen.tsx`, `authStore.ts`, `src/api/auth.ts`
- [ ] Demo the full offline -> sync flow without network (verify no network calls during offline phase)

> NOTE: Screen layouts approved and implemented with full dark theme design.

**CHECKPOINT: Phase 3 complete — offline->sync flow demoed. Confirm before Phase 4.**

---

## Phase 4 — Cloud Enrichment

- [x] Write enrichment module: deeper Isolation Forest, cross-zone context — `backend/app/enrichment/engine.py`, `service.py`
- [x] Write explainability output: feature importance breakdown (top 3-5 contributing factors) — `engine.py` (`_contributions` / SHAP-lite)
- [x] Write action map: category x severity -> suggested corrective action text (rule table) — `backend/app/enrichment/action_map.py`
- [x] Wire into /sync/batch: after observation saved, run enrichment, update cloud_score/cloud_flag/cloud_reasons/suggested_action — `backend/app/api/sync.py`
- [x] Verify: POST a sync batch, confirm risk card populated with cloud fields — `backend/scripts/verify_sync_enrichment_e2e.py`
- [x] Verify: suggested action text appears for each category/severity combo — `backend/scripts/verify_enrichment.py`

**CHECKPOINT: Phase 4 complete — enrichment verified end-to-end. Confirm before Phase 5.**

---

## Phase 5 — OCR Service

- [x] pytesseract integration in backend/app/ocr/ — `backend/app/ocr/engine.py`
- [x] POST /ocr/submit: accepts image, runs OCR, checks per-word confidence — `backend/app/api/ocr.py`
- [x] If all words confidence >= 70: return extracted text directly — `submit_ocr` in `ocr.py`
- [x] If any word confidence < 70: insert into ocr_review_queue, return queue item ID — `ocr_review_queue` table
- [x] GET /ocr/queue: list pending items (mine_official+ role) — `list_ocr_queue` in `ocr.py`
- [x] PATCH /ocr/queue/{id}: approve or reject — `review_ocr_queue_item` in `ocr.py`
- [x] Test with a clear English scanned doc — `backend/scripts/verify_ocr.py` (95.69% conf -> direct approval)
- [x] Test with a degraded/blurry doc to verify low-confidence routing — `backend/scripts/verify_ocr.py` (34.67% conf -> review queue)
- [x] Hindi PoC: verify Tesseract can extract at least partial Hindi text — `backend/scripts/verify_ocr.py` (95.86% conf Devanagari text)

**CHECKPOINT: Phase 5 complete — OCR pipeline verified. Confirm before Phase 6.**

---

## Phase 6 — Dashboard (DESIGN CHECKPOINT)

> *** STOP HERE ***
> Before writing any dashboard code, ask the project owner:
> - What components/UI library (if any) to use?
> - Layout structure for each role view (inspector, mine official, corporate, regulator)?
> - Map component preference (Leaflet, Mapbox, Google Maps)?
> - Color palette, dark/light mode, typography?
> - Animations / transitions / hover effects?
> - How should the Risk Card look visually?
> - How should escalated observations be surfaced differently?
> - KPI panel layout — cards, charts, numbers only?
> - Closure flow — modal, side panel, new screen?
> Do NOT proceed until owner has answered all of these.

- [x] Design conversation completed with owner
- [x] Dashboard scaffolded per agreed design
- [x] Role-based route protection (inspector sees own observations, official sees site, regulator sees all)
- [x] Map/heatmap component showing observations by risk level
- [x] Risk Card component (score + top factors + suggested action + status)
- [x] KPI panel (time-to-closure, sync%, open-high-risk count)
- [x] Observation closure flow (proof photo + note)
- [x] Escalation logic (overdue high-risk items visually surfaced)

**CHECKPOINT: Phase 6 complete — dashboard demoed per agreed design. Confirm before Phase 7.**

---

## Phase 7 — Integration, Demo Path, Polish

- [ ] End-to-end demo path walkthrough:
  - [ ] Inspector logs observation offline (no network)
  - [ ] Edge Risk Card shown immediately on device
  - [ ] "Sync Now" triggered — observations batch-synced
  - [ ] Dashboard updates: new observation visible on map, full Risk Card populated
  - [ ] KPI panel shows updated sync%
  - [ ] Manager closes observation with proof photo
  - [ ] KPI updates: time-to-closure changes
  - [ ] Audit log entry verified for every step
  - [ ] Hash-chain verify endpoint confirms integrity
- [x] Write ROADMAP.md (all deferred scope clearly listed)
- [x] Final review of plan.md / task.md for accuracy
- [x] Confirm no task.md item is marked done without verification

**CHECKPOINT: Phase 7 complete — full demo loop verified. Build done.**

---

*Current phase: Phase 7*
