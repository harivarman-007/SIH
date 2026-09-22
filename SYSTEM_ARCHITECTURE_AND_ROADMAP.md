# Intellifusion — System Architecture, Gaps & Production Transformation Roadmap

> **Document Type:** Technical Architecture Specification & Production Roadmap  
> **Project:** Intellifusion — AI-Based Smart Governance & Compliance Monitoring System for Coal Mines  
> **Problem Statement:** SIH26024  
> **Target Deployment:** Multi-subsidiary Coal Mine Operations (DGMS Compliant)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Technology Stack](#2-current-technology-stack)
3. [End-to-End System Flow & Architecture](#3-end-to-end-system-flow--architecture)
4. [Critical Gaps & Areas for Improvement](#4-critical-gaps--areas-for-improvement)
5. [High-Value Features to Add](#5-high-value-features-to-add)
6. [Transition Plan: From Demo to Real Production System](#6-transition-plan-from-demo-to-real-production-system)
7. [Repository File Reference Map](#7-repository-file-reference-map)

---

## 1. Executive Summary

**Intellifusion** is an intelligent, offline-first compliance monitoring and risk management platform engineered specifically for harsh, underground, and remote industrial environments such as coal mines. 

The system operates across three tiers:
- **Field Tier (Edge Mobile App):** React Native / Expo app operating in zero-connectivity tunnels, providing instant on-device hazard scoring via a pure TypeScript tree-traversal engine, local SQLite persistence, and store-and-forward batch synchronization.
- **Core Tier (Cloud / Server Backend):** Asynchronous FastAPI service running on PostgreSQL 15 + PostGIS with deep Isolation Forest explainability, SHAP-lite feature attribution, DGMS statutory action mapping, multilingual Tesseract OCR, automated SLA escalation scheduling, and a SHA-256 tamper-evident cryptographic audit ledger.
- **Governance Tier (Web Command Center):** React 18 + Vite dashboard with 6-role access control, live KPI telemetry, GIS spatial maps, corporate fleet drilldowns, human-in-the-loop OCR review, and regulatory audit verification.

---

## 2. Current Technology Stack

| Layer | Component | Technologies Used | Description & Implementation Details |
|---|---|---|---|
| **Mobile App** | Core Framework | React Native, Expo 51/57, TypeScript | Cross-platform mobile client for underground mine inspectors. |
| | Local Storage & Queue | `expo-sqlite`, `ObservationRepository.ts` | Local SQLite outbox storing observations when underground with zero network. |
| | On-Device ML | TypeScript Tree Traversal (`RiskScoringEngine.ts`) | Evaluates 50 Isolation Forest trees + 5 critical DGMS regex rules offline. |
| | Hardware / Sensors | `expo-location`, `expo-image-picker`, `expo-secure-store` | GPS coordinates, BLE Beacon IDs, photo capture, and encrypted JWT storage. |
| | Background Sync | `SyncWorker.ts`, `expo-task-manager` | Store-and-forward batch synchronizer triggering upon network reconnect. |
| **Backend API** | Web Framework | Python 3.11, FastAPI, Pydantic v2, Uvicorn | High-throughput asynchronous REST API for data ingestion and role routing. |
| | Database Engine | PostgreSQL 15 + PostGIS 3.4 (`postgis/postgis:15-3.4`) | Relational schema with spatial point geometries and JSONB anomaly storage. |
| | ORM & Migrations | SQLAlchemy 2.0 (AsyncIO), Alembic | Fully typed async models with transaction rollbacks and database migrations. |
| | Authentication & RBAC | `python-jose` (JWT), `bcrypt`, Custom Middleware | 6 granular roles (`super_admin`, `corporate_management`, `mine_official`, `inspector`, `contractor`, `regulator`). |
| | Background Tasks | `APScheduler` (AsyncIOScheduler) | Runs background jobs every 5 minutes for statutory SLA escalation. |
| **Machine Learning** | Edge Model | Scikit-learn (training), Python weight exporter | Exports trained Isolation Forest tree structures into portable JSON (`model_weights.json`). |
| | Cloud Enrichment | Deep Isolation Forest (15 features), NumPy | Cross-zone and cross-site context scoring with calibrated anomaly values. |
| | Explainability | SHAP-lite Path-Length Delta Perturbations | Perturbs feature vectors to calculate top contributing root-cause factors. |
| | Statutory Engine | DGMS Rule Table (`action_map.py`) | Deterministic mapping of hazard category $\times$ severity to DGMS corrective actions. |
| **Vision & OCR** | Ingestion Engine | Tesseract 5 (`pytesseract`), Pillow | Multilingual OCR parsing of paper log sheets (English `eng` + Hindi `hin`). |
| | Review Queue | Human-in-the-Loop Pipeline (`ocr_review_queue`) | Automatically routes extractions with word confidence $< 70\%$ to an approval queue. |
| **Cryptographic Ledger**| Audit Trail | SHA-256 Hash Chaining | Append-only block ledger where every write hashes the previous entry's SHA-256 digest. |
| | Concurrency Control | Row-Level Serialization (`with_for_update`) | Serializes ledger writes to prevent chain forks or race conditions. |
| **Web Dashboard** | Frontend Framework | React 18, Vite, TypeScript | High-performance SPA with client-side routing and reactive UI. |
| | Styling & UI | Tailwind CSS, Radix UI, Lucide Icons, Framer Motion | Clean industrial dark/light command center design with micro-animations. |
| | Mapping & GIS | Leaflet, `react-leaflet`, GeoJSON | Interactive mine boundary maps, zone risk baselines, and coordinate hazard pins. |
| | State & Client | Zustand, Axios | Session management, role switching, and polling telemetry every 30 seconds. |
| **DevOps** | Containerization | Docker, Docker Compose | Multi-container local orchestration for PostgreSQL/PostGIS and FastAPI backend. |

---

## 3. End-to-End System Flow & Architecture

### System Architecture Diagram

```
+----------------------------------------------------------------------------------------------------+
|                                    1. FIELD TIER (Mobile App)                                      |
|  React Native (Expo) • expo-sqlite • Offline RiskScoringEngine.ts (Edge IF) • expo-location / BLE  |
+-------------------------------------------------+--------------------------------------------------+
                                                  |
                                                  | REST Batch Sync (POST /sync/batch on reconnect)
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                  2. INGESTION & CORE (FastAPI)                                     |
|     JWT Auth & 6-Role RBAC Middleware • In-Memory / Async Orchestration • PostgreSQL + PostGIS     |
+----------------------+--------------------------+----------------------------+---------------------+
                       |                          |                            |
                       v                          v                            v
+-----------------------------+  +-------------------------------+  +--------------------------------+
|      3. CLOUD ML & NLP      |  |    4. CRYPTOGRAPHIC LEDGER    |  |       5. VISION & OCR          |
|  15-Feature Isolation Forest|  |  SHA-256 Append-Only Chain    |  |  Tesseract OCR (Eng/Hindi)     |
|  SHAP-Lite Explainability   |  |  Row-Lock Serialized Commits  |  |  Word-Level Confidence (<70%)  |
|  DGMS Prescriptive Actions  |  |  Mathematical Proof API       |  |  Human-in-the-Loop Review Queue|
+-----------------------------+  +-------------------------------+  +--------------------------------+
                       |                          |                            |
                       +--------------------------+----------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                 6. COMMAND & GOVERNANCE (Web)                                      |
|  React 18 + Vite + TS • Tailwind CSS • Leaflet GIS • Live Telemetry Poll • Role-Based Dashboards   |
+----------------------------------------------------------------------------------------------------+
```

### End-to-End Data Lifecycle

1. **Underground Capture (Zero Connectivity)**:
   - Field inspector identifies a hazard in a mine gallery and opens `NewObservationScreen.tsx`.
   - The app records statutory category (`safety`, `environment`, `labour`, `production`), text description, photo capture, quantitative sensor readings (`gas_reading_value`, e.g., $1.8\% \text{ CH}_4$), and location (GPS coordinates if outdoors or BLE Beacon ID if underground).
2. **Instant Edge Scoring**:
   - `RiskScoringEngine.ts` executes on-device:
     - Checks 5 critical DGMS regex rules (`ROOF_STRATA_COLLAPSE`, `EXPLOSION_OR_FIRE`, `HAZARDOUS_GAS_LEAK`, `WATER_INUNDATION`, `FATAL_OR_HAUL_FAILURE`).
     - If no immediate rule triggers, evaluates 50 Isolation Forest decision trees loaded from `model_weights.json` to calculate an anomaly score and risk flag (`low`, `medium`, `high`).
   - The observation is saved locally to SQLite (`ObservationRepository.ts`) with status `pending`.
3. **Store-and-Forward Reconnect Sync**:
   - When the worker returns to the surface or enters Wi-Fi/LTE coverage, `SyncWorker.ts` detects network availability.
   - Pending observations are packaged into a batch payload and sent via `POST /sync/batch`.
4. **Backend Ingestion & Cloud Enrichment**:
   - The FastAPI backend (`app/api/sync.py`) inserts the records into PostgreSQL.
   - It triggers `enrich_observation` (`app/enrichment/service.py`), evaluating a 15-feature deep Isolation Forest model incorporating cross-zone data (site historical violation rate, active unresolved zone hazards).
   - Top contributing root-cause factors are calculated using SHAP-lite path-length delta perturbations, and statutory corrective actions are attached from `action_map.py`.
5. **Cryptographic Chaining**:
   - For every committed observation, `append_audit_entry` (`app/audit/chain.py`) acquires a row lock on the latest ledger entry, computes `SHA-256(prev_hash + actor + payload + timestamp)`, and writes an immutable audit record.
6. **Automated SLA Escalation**:
   - A background scheduler (`APScheduler` in `app/main.py`) runs every 5 minutes.
   - It checks statutory resolution deadlines:
     - **High Risk**: 24 hours
     - **Medium Risk**: 72 hours
     - **Low Risk**: 168 hours (7 days)
   - Breached items automatically transition to `escalated`, generate in-app `Alert` records for site managers and corporate directors, and append a statutory breach audit log.
7. **Governance & Verification**:
   - The React Web Dashboard displays real-time compliance KPIs, GIS spatial pins, and multi-mine fleet risk leaderboards.
   - Regulatory inspectors can invoke `/audit/verify` at any time to mathematically verify that zero database records have been modified or deleted.

---

## 4. Critical Gaps & Areas for Improvement

### 1. In-Memory Synthetic ML Training on Boot
- **Current Limitation:** `CloudEnrichmentEngine` (`backend/app/enrichment/engine.py`) synthesizes 1,000 synthetic observations in memory and trains on the fly using random numbers every time the server starts.
- **Improvement:** Decouple training from the API process. Train models offline on real historical mining violation datasets (DGMS, US MSHA), serialize models to ONNX or MLflow formats, and store weights in an object store.

### 2. Local File Storage for Images
- **Current Limitation:** Captured photos and uploaded OCR documents are saved directly to the container's local disk (`/app/photos` and `Path(settings.ocr_upload_path)`). Scaling out to multiple container instances will result in lost or orphaned files.
- **Improvement:** Migrate to cloud object storage (AWS S3, Google Cloud Storage, or MinIO) using pre-signed upload URLs and CDN asset distribution.

### 3. Audit Log Write Serialization Bottleneck
- **Current Limitation:** In `backend/app/audit/chain.py`, `append_audit_entry` uses `with_for_update()` to lock the latest row of `audit_log`. Under high write concurrency (hundreds of inspectors syncing simultaneously), this row lock creates a database serialization bottleneck.
- **Improvement:** Implement **Merkle Trees** or **batch-anchoring** (e.g., batching 1,000 transactions and committing a single Merkle root hash every minute, or publishing roots to an immutable external ledger/timestamp authority).

### 4. Background Job Concurrency (In-Process Scheduler)
- **Current Limitation:** `APScheduler` runs in-process inside FastAPI. If Uvicorn is scaled to multiple workers (`--workers 4`) or run across multiple Kubernetes pods, each process will run redundant escalation cycles.
- **Improvement:** Extract background jobs into an external distributed task queue using **Celery + Redis / RabbitMQ** or **Temporal.io**.

### 5. Frontend Polling vs. Real-Time Push Telemetry
- **Current Limitation:** The web dashboard polls the backend every 30 seconds (`setInterval(refreshKpis, 30_000)`).
- **Improvement:** Implement **WebSockets** or **Server-Sent Events (SSE)**. High-risk statutory escalations and underground emergency flags should be pushed immediately to dispatchers.

### 6. Single-Direction Mobile Sync
- **Current Limitation:** The mobile app pushes new observations to the backend via `POST /sync/batch`, but does not pull updates back down (e.g., when an observation is closed, commented on, or escalated).
- **Improvement:** Implement **two-way delta sync** with a vector clock / `last_updated_at` watermark so field inspectors can view corrective action statuses and comments on their mobile devices.

### 7. OCR Quality & Document Layout Handling
- **Current Limitation:** Raw Tesseract without pre-processing produces low accuracy on crumpled, carbon-copy, or low-contrast handwritten mine log sheets.
- **Improvement:** Add an OpenCV pre-processing pipeline (deskew, bilateral filter denoising, adaptive thresholding) and integrate specialized document models (e.g., PaddleOCR, TrOCR, or AWS Textract) tailored for bilingual tabular forms.

---

## 5. High-Value Features to Add

### Feature 1: Multi-Modal Computer Vision for Autonomous Hazard Detection
- **Description:** Integrate a YOLOv8 / RT-DETR model into the mobile and cloud pipeline.
- **Functionality:**
  - **PPE Compliance:** Automatically detects missing helmets, high-visibility vests, safety boots, and harnesses in uploaded photos.
  - **Structural Hazards:** Detects roof strata cracks, conveyor belt tears, water pooling, and missing machine safety guards.
  - **Auto-Population:** Automatically fills category, description, and severity fields in the mobile form upon photo capture.

### Feature 2: Underground 3D Digital Twin & Bluetooth / UWB Positioning
- **Description:** GPS is non-functional underground. Replace 2D surface maps with an interactive 3D mine gallery digital twin using Three.js or CesiumJS.
- **Functionality:**
  - Position inspectors and hazards using Bluetooth Low Energy (BLE) Beacons or Ultra-Wideband (UWB) anchors placed every 50 meters along underground roadways.
  - Visualize ventilation airflow vectors, escape routes, and active extraction zones in 3D.

### Feature 3: SCADA & IoT Real-Time Gas Stream Ingestion
- **Description:** Ingest live continuous environmental telemetry from fixed and wearable mine safety sensors.
- **Functionality:**
  - Stream data via MQTT / Apache Kafka for Methane ($CH_4$), Carbon Monoxide ($CO$), Oxygen ($O_2$), and coal dust concentration ($PM_{2.5}/PM_{10}$).
  - Compute the rate of gas rise (velocity analysis) to generate automated predictive hazard warnings before physical safety thresholds are breached.

### Feature 4: Multilingual Voice-to-Report Ingestion
- **Description:** Integrate on-device or cloud speech-to-text (Whisper / Indic-Wav2Vec).
- **Functionality:**
  - In dark, dusty underground tunnels, typing on a touchscreen while wearing heavy gloves is difficult.
  - Inspectors can record a 15-second audio note in Hindi, English, or regional languages (Bengali, Odia).
  - The system transcribes the speech, extracts key entities (location, hazard, category), and formats it into a structured observation.

### Feature 5: Automated DGMS Statutory Compliance Form Generator
- **Description:** One-click generation of official Directorate General of Mines Safety (DGMS) regulatory compliance documentation.
- **Functionality:**
  - Automatically compiles daily, weekly, and monthly observations into standardized regulatory templates (e.g., Form IV accident returns, ventilation measurement logs, statutory shift records).
  - Generates digitally signed, tamper-evident PDF reports for regulatory submission.

### Feature 6: Closed-Loop Contractor Work-Order & Verification Workflow
- **Description:** End-to-end task assignment and repair verification.
- **Functionality:**
  - Mine officials assign corrective actions to certified contractors with an enforced resolution SLA.
  - Contractors receive push notifications, perform repairs, and submit a geo-tagged "After" photo as proof of work.
  - The original inspector must review and sign off before the observation transitions to `closed`.

---

## 6. Transition Plan: From Demo to Real Production System

```
+----------------------------------------------------------------------------------------------------+
|                                    ENTERPRISE ARCHITECTURE                                        |
+--------------------+---------------------+----------------------+----------------------------------+
| 1. HARDWARE & EDGE | 2. CLOUD & DEVOPS   | 3. DATA & QUEUES     | 4. SECURITY & GOVERNANCE         |
| • ATEX / IECEx     | • Kubernetes (EKS)  | • AWS S3 / MinIO     | • OIDC / Active Directory SSO    |
|   Handheld Devices | • Multi-AZ PostGIS  | • Celery + Redis     | • Cloud KMS / HSM Ledger Keys    |
| • On-device ONNX   | • Traefik / Envoy   | • Kafka IoT Streams  | • MeitY & DGMS Regulatory Cert.  |
+--------------------+---------------------+----------------------+----------------------------------+
```

### Step 1: Hardware & Intrinsic Safety Certification
- **Context:** Standard commercial mobile phones cannot legally be taken into underground coal mines due to the risk of battery sparks triggering methane or coal dust explosions.
- **Action Items:**
  1. Port and certify the mobile application on **Intrinsically Safe (IS) Android devices** certified for **ATEX Zone 1 / IECEx / DGMS Group I** (e.g., i.safe MOBILE IS530.1, Zebra TC77-NI, or Ecom Smart-Ex 02).
  2. Optimize the SQLite engine and background worker to minimize battery drain during 12-hour shifts.

### Step 2: Infrastructure & Cloud Modernization
- **Context:** Transitioning from local Docker Compose to enterprise-grade high availability.
- **Action Items:**
  1. **Container Orchestration:** Deploy FastAPI and frontend services to Kubernetes (AWS EKS, Google GKE, or on-premise OpenShift) with horizontal pod autoscaling (HPA) and TLS 1.3 termination.
  2. **Managed Database:** Migrate to AWS Aurora PostgreSQL or Google Cloud SQL with Multi-AZ replication, read replicas for analytics queries, and automated automated backup retention.
  3. **Task Decoupling:** Move ML enrichment, OCR processing, and SLA escalation to distributed Celery workers powered by Redis or RabbitMQ.

### Step 3: Media & Storage Architecture
- **Context:** Replacing container-bound local disk photo storage with resilient object storage.
- **Action Items:**
  1. Integrate AWS S3 or on-premise MinIO with pre-signed upload URLs:
     - Client requests a secure upload token from FastAPI.
     - Mobile app uploads compressed image directly to the object store.
     - Client submits the object key in the sync batch payload.
  2. Implement automated client-side WebP compression in the mobile app to ensure rapid uploads over low-bandwidth field networks.

### Step 4: Enterprise Identity & Cryptographic Hardening
- **Context:** Moving from standalone email/password JWTs to corporate single sign-on and legally defensible audit logs.
- **Action Items:**
  1. **Enterprise SSO:** Integrate OAuth2 / OpenID Connect (OIDC) with Active Directory / Azure AD / Okta used by mining conglomerates (e.g., Coal India Ltd, SCCL).
  2. **Device Hardware Fingerprinting:** Bind mobile inspection tokens to device hardware identifiers (IMEI / Secure Enclave keys) to prevent unauthorized observation injection.
  3. **HSM-Backed Ledger Signing:** Sign audit ledger entry hashes using asymmetric private keys stored in a Hardware Security Module (HSM) or AWS CloudHSM / KMS, ensuring court-admissible non-repudiation under the Indian Information Technology Act.

### Step 5: Testing, CI/CD & Production Observability
- **Context:** Establishing zero-downtime deployment pipelines and operational visibility.
- **Action Items:**
  1. **CI/CD Pipeline:** Configure GitHub Actions / GitLab CI for:
     - Static analysis and type checking (`ruff`, `mypy`, `tsc --noEmit`).
     - Automated unit and integration test suites.
     - Automated Docker image builds and mobile release artifact generation (`.apk` / `.aab`).
  2. **Observability Stack:**
     - Instrument FastAPI and mobile sync clients with **OpenTelemetry**.
     - Export metrics to **Prometheus** and visualize system health, sync latency, and queue depths in **Grafana**.
     - Centralize application logs using **Vector / FluentBit** into **Loki / Elasticsearch**.

---

## 7. Repository File Reference Map

For navigation and maintenance of the existing codebase:

| Subsystem | Key Files | Function |
|---|---|---|
| **Core Entry & Scheduler** | [`backend/app/main.py`](file:///c:/projects/SIH/backend/app/main.py)<br>[`backend/app/scheduler.py`](file:///c:/projects/SIH/backend/app/scheduler.py) | Application startup, CORS allowlist, and 5-minute background SLA escalation scheduler. |
| **API Routers** | [`backend/app/api/observations.py`](file:///c:/projects/SIH/backend/app/api/observations.py)<br>[`backend/app/api/sync.py`](file:///c:/projects/SIH/backend/app/api/sync.py)<br>[`backend/app/api/kpi.py`](file:///c:/projects/SIH/backend/app/api/kpi.py)<br>[`backend/app/api/ocr.py`](file:///c:/projects/SIH/backend/app/api/ocr.py)<br>[`backend/app/api/audit.py`](file:///c:/projects/SIH/backend/app/api/audit.py) | Primary REST endpoints for observations, sync batches, KPIs, OCR processing, and audit verification. |
| **Database Schema** | [`backend/app/models/__init__.py`](file:///c:/projects/SIH/backend/app/models/__init__.py) | SQLAlchemy 2.0 models: `User`, `MineSite`, `Zone`, `Observation`, `AuditLog`, `OcrReviewQueue`, `Alert`. |
| **Edge Intelligence** | [`backend/app/edge/engine.py`](file:///c:/projects/SIH/backend/app/edge/engine.py)<br>[`backend/app/edge/rules.py`](file:///c:/projects/SIH/backend/app/edge/rules.py)<br>[`backend/app/edge/model_weights.json`](file:///c:/projects/SIH/backend/app/edge/model_weights.json) | Python edge model training, regex hazard rules, and exported 50-tree JSON weights. |
| **Cloud Enrichment** | [`backend/app/enrichment/engine.py`](file:///c:/projects/SIH/backend/app/enrichment/engine.py)<br>[`backend/app/enrichment/action_map.py`](file:///c:/projects/SIH/backend/app/enrichment/action_map.py)<br>[`backend/app/enrichment/service.py`](file:///c:/projects/SIH/backend/app/enrichment/service.py) | 15-feature deep Isolation Forest, SHAP-lite path length feature contributions, and DGMS action mapping. |
| **Cryptographic Ledger** | [`backend/app/audit/chain.py`](file:///c:/projects/SIH/backend/app/audit/chain.py) | SHA-256 block calculation, `with_for_update` row locks, and full audit chain verification. |
| **OCR Pipeline** | [`backend/app/ocr/engine.py`](file:///c:/projects/SIH/backend/app/ocr/engine.py) | Tesseract 5 wrapper with per-word confidence scoring and bilingual support. |
| **Mobile Application** | [`mobile/src/sync/SyncWorker.ts`](file:///c:/projects/SIH/mobile/src/sync/SyncWorker.ts)<br>[`mobile/src/models/RiskScoringEngine.ts`](file:///c:/projects/SIH/mobile/src/models/RiskScoringEngine.ts)<br>[`mobile/src/screens/NewObservationScreen.tsx`](file:///c:/projects/SIH/mobile/src/screens/NewObservationScreen.tsx)<br>[`mobile/src/db/ObservationRepository.ts`](file:///c:/projects/SIH/mobile/src/db/ObservationRepository.ts) | Mobile offline outbox repository, TypeScript edge inference, observation form, and sync worker. |
| **Web Dashboard** | [`dashboard/src/App.tsx`](file:///c:/projects/SIH/dashboard/src/App.tsx)<br>[`dashboard/src/components/MineMap.tsx`](file:///c:/projects/SIH/dashboard/src/components/MineMap.tsx)<br>[`dashboard/src/components/CorporateManagementView.tsx`](file:///c:/projects/SIH/dashboard/src/components/CorporateManagementView.tsx)<br>[`dashboard/src/components/ObservationTable.tsx`](file:///c:/projects/SIH/dashboard/src/components/ObservationTable.tsx)<br>[`dashboard/src/components/AuditTrailView.tsx`](file:///c:/projects/SIH/dashboard/src/components/AuditTrailView.tsx) | React main navigation, GIS Leaflet map, corporate multi-mine view, observation list, and audit verification UI. |
| **Verification Scripts** | [`backend/scripts/verify_edge_model.py`](file:///c:/projects/SIH/backend/scripts/verify_edge_model.py)<br>[`backend/scripts/verify_sync_enrichment_e2e.py`](file:///c:/projects/SIH/backend/scripts/verify_sync_enrichment_e2e.py)<br>[`backend/scripts/verify_ocr.py`](file:///c:/projects/SIH/backend/scripts/verify_ocr.py)<br>[`backend/scripts/verify_escalation.py`](file:///c:/projects/SIH/backend/scripts/verify_escalation.py) | Automated test and verification scripts across edge inference, cloud sync, OCR, and escalation. |
