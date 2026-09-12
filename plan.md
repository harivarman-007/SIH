# Intellifusion — MVP Architecture Plan
**Project:** AI-Based Smart Governance & Compliance Monitoring System for Coal Mines
**Problem Statement:** SIH26024 | **Team:** Intellifusion | **Target:** SIH 2026

---

## 1. Guiding Principles

- **Offline-first, not online-with-fallback** — every field-facing feature must work with zero connectivity.
- **Modularity** — each service/module is independently swappable (edge model, cloud model, OCR engine, audit log).
- **Explainability is mandatory** — every risk flag must carry a human-readable reason, not just a number.
- **RBAC at the API layer** — not just hidden UI elements.
- **No hallucinated progress** — nothing is marked done without a verified run against real/mock data.

---

## 2. System Architecture Overview

```
+------------------------------------------------------------+
|                     FIELD (Mobile App)                     |
|  React Native  .  SQLite queue  .  TFLite edge model       |
|  GPS / beacon-ID geo-tag  .  Camera  .  BG sync worker     |
+----------------------+-------------------------------------+
                       |  REST (batch sync on reconnect)
                       v
+------------------------------------------------------------+
|                    BACKEND API (FastAPI)                    |
|  JWT RBAC  .  Observation CRUD  .  Sync endpoint           |
|  PostgreSQL + PostGIS  .  Hash-chained Audit Log           |
+------+--------------------+-------------------------------+
       | async task         | REST
       v                    v
+-------------+    +----------------------------------------+
|  Enrichment |    |          WEB DASHBOARD (React)         |
|  Service    |    |  Role-based views (ask owner for UI)   |
|  (Python)   |    |  Map/heatmap . KPI panel . Risk Cards  |
|  sklearn IF |    |  Closure flow . Escalation flags       |
|  SHAP-lite  |    +----------------------------------------+
|  Action map |
+-------------+
       |
       v
+------------------------------------------------------------+
|                     OCR SERVICE (Python)                   |
|  Tesseract  .  Confidence threshold  .  Review queue       |
+------------------------------------------------------------+
```

---

## 3. Technology Stack

### Mobile (Field App)
| Concern | Choice | Rationale |
|---|---|---|
| Framework | React Native (Expo managed) | Cross-platform, good offline libs |
| Local DB / Queue | expo-sqlite + custom queue table | Lightweight, no native link needed |
| On-device model | TensorFlow.js + @tensorflow/tfjs-react-native | Runs fully offline, swappable |
| Camera | expo-image-picker | Handles permissions cleanly |
| Geo | expo-location | Surface GPS; beacon ID is just a text field |
| Auth tokens | expo-secure-store | JWT storage |
| Background sync | expo-background-fetch + expo-task-manager | Fires on connectivity event |

### Backend API
| Concern | Choice | Rationale |
|---|---|---|
| Framework | FastAPI (Python 3.11) | Async, auto-docs, same language as ML |
| Database | PostgreSQL 15 + PostGIS | Relational + spatial; JSONB for flex data |
| ORM | SQLAlchemy 2.0 (async) | Clean model definitions |
| Migrations | Alembic | |
| Auth | JWT (python-jose) + bcrypt | Sufficient for MVP |
| Audit log | Append-only table, SHA-256 hash-chain | Every write hashes previous entry |
| Containerisation | Docker + docker-compose | Local dev parity |

### Cloud Enrichment Service
| Concern | Choice | Rationale |
|---|---|---|
| Language | Python 3.11 | Consistent with backend |
| Anomaly model | Isolation Forest (scikit-learn) | Lightweight, interpretable |
| Explainability | Per-feature contribution via path-length delta | Simple but shows reasoning |
| Action mapping | Rule table (category x severity -> action text) | Deterministic, easy to demo |
| Integration | Called as internal async task from FastAPI | Avoids extra HTTP hop for MVP |

### OCR Service
| Concern | Choice |
|---|---|
| Engine | pytesseract (Tesseract 5) |
| Confidence threshold | Per-word confidence < 70 -> manual review queue |
| Language | English (primary) + Hindi (PoC) |
| Queue | PostgreSQL table ocr_review_queue |

---

## 4. Module Boundaries

```
intellifusion/
+-- mobile/                  # React Native Expo app
|   +-- src/
|   |   +-- db/              # SQLite schema + queue helpers
|   |   +-- models/          # On-device TFLite inference wrapper
|   |   +-- sync/            # Background sync worker
|   |   +-- screens/         # (structure TBD - ask owner before building)
|   |   +-- api/             # HTTP client (sync calls only)
|   +-- assets/model/        # tflite model file + label map
|
+-- backend/                 # FastAPI service
|   +-- app/
|   |   +-- api/             # Route handlers (observations, sync, auth, audit)
|   |   +-- models/          # SQLAlchemy ORM models
|   |   +-- schemas/         # Pydantic request/response schemas
|   |   +-- services/        # Business logic (enrichment, audit, OCR routing)
|   |   +-- enrichment/      # Cloud-side risk model + explainability + action map
|   |   +-- ocr/             # OCR pipeline + confidence router
|   |   +-- audit/           # Hash-chain log writer + verifier
|   +-- alembic/             # DB migrations + seed data
|   +-- scripts/
|       +-- generate_mock_data.py
|
+-- dashboard/               # React web app (structure TBD - ask owner)
+-- docker-compose.yml
+-- plan.md
+-- task.md
+-- ROADMAP.md
```

---

## 5. Core Data Models

### observations
| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| created_at | timestamptz | Set by client |
| synced_at | timestamptz | When received by backend |
| inspector_id | UUID FK | |
| category | enum | safety / environment / labour |
| description | text | |
| photo_url | text | |
| lat | float | null if underground |
| lng | float | null if underground |
| beacon_id | text | underground stand-in |
| mine_site_id | UUID FK | |
| zone_id | UUID FK | |
| edge_score | float | 0-1, on-device |
| edge_flag | enum | low / medium / high |
| edge_reasons | JSONB | Feature contributions |
| cloud_score | float | After enrichment |
| cloud_flag | enum | low / medium / high |
| cloud_reasons | JSONB | Feature importances |
| suggested_action | text | From action map |
| status | enum | open / in_progress / closed / escalated |
| closed_at | timestamptz | |
| closure_photo_url | text | |
| closure_note | text | |
| version | int | Conflict tracking |
| versions_json | JSONB | All prior versions appended |

### audit_log
| Field | Type | Notes |
|---|---|---|
| id | bigserial PK | |
| entry_hash | char(64) | SHA-256 of (prev_hash + payload) |
| prev_hash | char(64) | Hash of previous entry |
| actor_id | UUID | |
| action | text | observation.created / status.changed / etc. |
| payload | JSONB | Full snapshot |
| ts | timestamptz | |

### users
| Field | Type |
|---|---|
| id | UUID PK |
| email | text unique |
| password_hash | text |
| role | enum: inspector / contractor / mine_official / regulator |
| mine_site_id | UUID FK (nullable) |

### ocr_review_queue
| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| document_id | UUID | |
| raw_text | text | Full OCR output |
| confidence_map | JSONB | Per-word confidence |
| status | enum | pending / approved / rejected |
| reviewer_id | UUID FK | |
| reviewed_at | timestamptz | |

---

## 6. API Routes

```
POST   /auth/login
POST   /auth/register

POST   /observations/
GET    /observations/
GET    /observations/{id}
PATCH  /observations/{id}/close

GET    /observations/{id}/risk-card

GET    /kpi/

POST   /sync/batch
GET    /sync/status

GET    /audit/verify
GET    /audit/log

POST   /ocr/submit
GET    /ocr/queue
PATCH  /ocr/queue/{id}
```

---

## 7. On-Device Risk Model

Two-layer architecture:
1. Rule layer: instant flags for known-critical keywords (explosion, collapse, fire -> high immediately)
2. Anomaly layer: Isolation Forest trained on mock data, exported to JSON weights

12 features:
- Category (one-hot, 3 features)
- Hour of day (normalized)
- Day of week (normalized)
- Zone risk baseline (normalized)
- Keyword flags: safety_keyword, env_keyword, labour_keyword (3 binary)
- Inspector historical high-risk rate
- Days since last zone inspection
- Photo attached (binary)

Output: { score: 0.0-1.0, flag: "low|medium|high", reasons: { feature: contribution } }

The inference call is behind a RiskScoringEngine interface — swapping the model means
replacing one file and the feature extractor only.

---

## 8. Hash-Chain Audit Trail

Every write triggers an audit log entry:
  - Compute SHA-256 of (prev_entry_hash + actor_id + action + payload + timestamp)
  - Store as new row with prev_hash reference
  - Verification endpoint replays chain and confirms every hash

---

## 9. Build Phases

| Phase | What gets built | Checkpoint |
|---|---|---|
| Phase 0 | Repo structure, Docker, DB schema, migrations, mock data seed | Confirm DB up + seed data queryable |
| Phase 1 | FastAPI backend - auth, RBAC, observations CRUD, audit log, hash-chain | All API routes tested via Swagger |
| Phase 2 | Edge model training + export + feature extractor | Model runs locally, output verified |
| Phase 3 | Mobile app - offline logging, SQLite queue, on-device scoring, sync worker | Full offline->sync flow demoed |
| Phase 4 | Cloud enrichment + explainability + action mapping wired into backend | POST /sync/batch triggers enrichment |
| Phase 5 | OCR service + review queue | Scanned doc extracted, low-conf routed |
| Phase 6 | DESIGN CHECKPOINT - Dashboard: ask owner for UI/component/layout decisions | PAUSE - discuss with owner |
| Phase 7 | End-to-end demo path verification + ROADMAP.md + polish | Full loop confirmed working |

Every phase ends with a checkpoint. No phase starts until the previous is confirmed.

---

## 10. Assumptions (Flagged)

1. Expo managed workflow for mobile - simplifies hackathon setup.
2. Enrichment service runs in-process with FastAPI for MVP (not a separate microservice).
3. Photos stored on server filesystem (not real S3) for MVP.
4. No real-time push - dashboard polls. WebSocket is Phase 2.
5. Sync% KPI = count(synced_at IS NOT NULL) / total submitted observations.
6. JWT secret managed via env-var; no key rotation for MVP.
7. Underground beacon ID is a free-text field only; no BLE/UWB hardware.

---

## 11. Out of Scope -> ROADMAP.md

- Full Kafka event streaming
- TimescaleDB sensor time-series pipeline
- Real Hyperledger Fabric blockchain
- Full multi-language OCR coverage
- Real UWB/BLE hardware mesh
- Multi-Agent RAG Statutory Auditor (stretch goal only)
- Contractor Trust & Performance Graph (stretch goal only)
- Multilingual conversational query interface (stretch goal only)
- Real object store (S3/GCS) for photos
- WebSocket real-time dashboard updates
- JWT key rotation / refresh token rotation
- Native push notifications for escalations

---

*Last updated: Phase 0 - pre-code*
