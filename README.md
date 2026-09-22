# Intellifusion — AI-Based Smart Governance & Compliance Monitoring System for Coal Mines

[![Smart India Hackathon 2026](https://img.shields.io/badge/SIH-2026-orange.svg)](https://www.sih.gov.in/)
[![Problem Statement](https://img.shields.io/badge/Problem%20Statement-SIH26024-blue.svg)](https://www.sih.gov.in/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo%2051-000020.svg?logo=expo&logoColor=white)](https://expo.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%20PostGIS-336791.svg?logo=postgresql&logoColor=white)](https://postgis.net/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Intellifusion** is an intelligent, offline-first compliance monitoring and risk management platform engineered specifically for harsh, underground, and remote industrial environments such as coal mines. Combining edge AI, store-and-forward synchronization, cloud anomaly explainability, multilingual OCR, and a cryptographic audit trail, Intellifusion ensures zero data loss and uncompromised safety compliance.

---

## Table of Contents

- [Key Highlights & Features](#key-highlights--features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Quick Start Guide](#quick-start-guide)
  - [Prerequisites](#prerequisites)
  - [1. Backend & Database (Docker Compose)](#1-backend--database-docker-compose)
  - [2. Database Migrations & Mock Data](#2-database-migrations--mock-data)
  - [3. Web Dashboard](#3-web-dashboard)
  - [4. Mobile Application](#4-mobile-application)
- [Core Capabilities](#core-capabilities)
  - [Offline-First Mobile App & Edge AI](#offline-first-mobile-app--edge-ai)
  - [Cloud Risk Enrichment & Explainability](#cloud-risk-enrichment--explainability)
  - [Cryptographic Audit Trail (Tamper-Evident)](#cryptographic-audit-trail-tamper-evident)
  - [Multilingual OCR & Human-in-the-Loop](#multilingual-ocr--human-in-the-loop)
  - [Role-Based Web Dashboard](#role-based-web-dashboard)
- [API Reference](#api-reference)
- [Verification & Test Scripts](#verification--test-scripts)
- [Roadmap](#roadmap)
- [License & Acknowledgments](#license--acknowledgments)

---

## Key Highlights & Features

- **Offline-First Resilience**: Full operational functionality in zero-connectivity underground mine galleries using local SQLite queues and an automated background store-and-forward sync mechanism.
- **On-Device Edge AI Scoring**: Pre-trained Isolation Forest tree ensemble exported into portable JSON (`model_weights.json` / `model.json`), enabling instantaneous hazard classification directly on mobile devices without network latency.
- **Explainable Cloud Enrichment**: Multi-factor risk scoring with tree path-length delta approximations delivering transparent, human-readable explanations alongside automated corrective action recommendations.
- **Cryptographic Hash-Chained Audit Trail**: SHA-256 block-style chain where every write operation cryptographically hashes the previous entry, offering mathematical proof against regulatory data tampering.
- **Multilingual OCR & Review Queue**: Ingestion of safety log sheets and permits in English and Hindi via Tesseract OCR, automatically routing low-confidence parses (< 70% confidence) to a dedicated human review queue.
- **Granular RBAC**: Strict role-based permissions enforced across four distinct stakeholder personas: `inspector`, `mine_official`, `corporate`, and `regulator`.

---

## System Architecture

```
+--------------------------------------------------------------------------+
|                        FIELD (Mobile Application)                        |
|   React Native (Expo)  |  SQLite Local Queue  |  Edge AI Scoring Engine  |
|   GPS & Beacon ID Geo-Tagging  |  Camera Module  |  Background Sync Worker   |
+-------------------------------------+------------------------------------+
                                      |
                                      | REST Batch Sync (On Reconnect)
                                      v
+--------------------------------------------------------------------------+
|                           BACKEND API (FastAPI)                          |
|   JWT + RBAC Middleware  |  Observation Lifecycle  |  Store & Forward Sync|
|   PostgreSQL 15 + PostGIS Spatial Engine  |  SHA-256 Hash-Chained Ledger  |
+-------------------+------------------------------------+-----------------+
                    |                                    |
                    v (Async Pipeline)                   v (REST / GeoJSON)
+------------------------------------+   +---------------------------------+
|       CLOUD ENRICHMENT ENGINE      |   |       WEB DASHBOARD (React)     |
|   Isolation Forest Anomaly Scoring |   |   Leaflet GIS Heatmaps & Pins   |
|   Feature Path-Length Explainability|  |   Executive KPI Command Center  |
|   Prescriptive Action Recommendations| |   Observation Closure & Audit   |
+-------------------+----------------+   +---------------------------------+
                    |
                    v
+--------------------------------------------------------------------------+
|                     MULTILINGUAL OCR INGESTION SERVICE                   |
|   Tesseract OCR (Eng/Hin)  |  Confidence Threshold  |  Human Review Queue|
+--------------------------------------------------------------------------+
```

---

## Tech Stack

| Layer | Technologies | Description |
|---|---|---|
| **Backend API** | Python 3.11, FastAPI, Pydantic v2, Uvicorn | High-throughput asynchronous REST API |
| **Database** | PostgreSQL 15, PostGIS 3.4, SQLAlchemy 2.0 (Async), Alembic | Relational, spatial, and JSONB storage |
| **Machine Learning** | Scikit-learn, NumPy, Custom Tree Path Extractor | Edge Isolation Forest & explainability engine |
| **Computer Vision** | PyTesseract, Pillow | Multilingual permit & safety log sheet OCR |
| **Web Dashboard** | React 18, Vite, TypeScript, Tailwind CSS, Radix UI, Leaflet | Responsive compliance and analytics dashboard |
| **Mobile App** | React Native, Expo 51, expo-sqlite, Zustand, Axios | Offline-first field inspector mobile app |
| **Security** | Python-Jose, Bcrypt, SHA-256 Hash Chaining | Role-Based Access Control & tamper-evident logs |
| **DevOps** | Docker, Docker Compose | Containerized reproducible environment |

---

## Repository Structure

```
SIH/
|-- backend/                       # FastAPI Backend Service
|   |-- alembic/                   # Database migrations
|   |   +-- versions/              # Migration scripts
|   |-- app/
|   |   |-- api/                   # API Routers (auth, observations, sync, kpi, audit, ocr)
|   |   |-- audit/                 # Cryptographic SHA-256 hash-chain engine
|   |   |-- edge/                  # Edge model training, rule engine & exported weights
|   |   |-- enrichment/            # Cloud enrichment, explainability & action mapper
|   |   |-- models/                # SQLAlchemy database models
|   |   |-- ocr/                   # Multilingual Tesseract OCR pipeline
|   |   |-- schemas/               # Pydantic request/response schemas
|   |   |-- services/              # Authentication & business logic
|   |   |-- config.py              # Environment configuration
|   |   |-- database.py            # Async engine & session handling
|   |   +-- main.py                # FastAPI entrypoint
|   |-- photos/                    # Local storage for observation media
|   |-- scripts/                   # Verification and mock data generation scripts
|   |-- Dockerfile                 # Backend container definition
|   |-- requirements.txt           # Python dependencies
|   +-- .env.example               # Backend environment template
|
|-- dashboard/                     # React + Vite Web Dashboard
|   |-- src/
|   |   |-- components/            # UI components (AuditTrailView, RiskCards, Map, KPI)
|   |   |-- lib/                   # Utility helpers
|   |   |-- App.tsx                # Main dashboard app layout
|   |   +-- main.tsx               # React DOM root
|   |-- package.json               # Frontend dependencies & scripts
|   +-- tailwind.config.js         # Tailwind styling configuration
|
|-- mobile/                        # React Native / Expo Mobile App
|   |-- assets/
|   |   +-- model/model.json       # Exported edge model for on-device scoring
|   |-- src/
|   |   |-- api/                   # Client HTTP API connectors
|   |   |-- db/                    # Local SQLite schema & queue
|   |   |-- models/                # On-device RiskScoringEngine (TypeScript)
|   |   |-- navigation/            # Mobile navigation routes
|   |   |-- screens/               # Field inspector UI screens
|   |   |-- store/                 # Zustand state management
|   |   +-- sync/                  # Background store-and-forward sync manager
|   |-- app.json                   # Expo application config
|   +-- package.json               # Mobile dependencies
|
|-- docker-compose.yml             # Orchestration for PostGIS DB and Backend API
|-- plan.md                        # MVP Technical Specification & Architectural Blueprint
|-- task.md                        # Phase-by-phase development task checklist
|-- ROADMAP.md                     # Product expansion roadmap & scale-up vision
+-- .gitignore                     # Git exclusion rules
```

---

## Quick Start Guide

### Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose (v2.0+)
- [Node.js](https://nodejs.org/) (v18.0+) & npm
- [Python](https://www.python.org/) 3.11+ (if running backend natively without Docker)

---

### 1. Backend & Database (Docker Compose)

Start the PostGIS 15 database and FastAPI backend services:

```bash
docker-compose up -d --build
```

- **Backend API**: `http://localhost:8000`
- **Interactive OpenAPI Documentation (Swagger)**: `http://localhost:8000/docs`
- **PostgreSQL / PostGIS**: `localhost:5432` (`user: intellifusion`, `pass: intellifusion_dev`, `db: intellifusion`)

---

### 2. Database Migrations & Mock Data

Apply the initial database schema using Alembic and seed realistic test data (5 mine sites, 15 zones, 200 observations):

```bash
# Inside backend container:
docker-compose exec backend alembic upgrade head
docker-compose exec backend python scripts/generate_mock_data.py

# Or if running locally:
cd backend
alembic upgrade head
python scripts/generate_mock_data.py
```

---

### 3. Web Dashboard

Navigate to the dashboard directory, install dependencies, and launch the development server:

```bash
cd dashboard
npm install
npm run dev
```

Open `http://localhost:5173` in your browser to interact with the executive safety portal.

---

### 4. Mobile Application

Launch the Expo field application for Android, iOS, or Web preview:

```bash
cd mobile
npm install
npx expo start
```

- Press `a` for Android Emulator
- Press `w` for Web Preview
- Scan the QR code with the **Expo Go** app on an Android/iOS device connected to the same network.

---

## Core Capabilities

### Offline-First Mobile App & Edge AI
Inspectors working underground face complete cellular blackouts. Intellifusion stores observations, photos, and hazard metadata in a local SQLite database (`expo-sqlite`). A portable Isolation Forest model (`mobile/assets/model/model.json`) scores safety risk directly on the device using 12 extracted features (historical violation density, shift duration, zone risk index, hazard keywords) with zero cloud dependency.

### Cloud Risk Enrichment & Explainability
When network connectivity is restored, the mobile app transmits stored observations in batches. The backend's cloud enrichment engine:
1. Re-scores observations using an expanded Isolation Forest model.
2. Computes **feature path-length deltas** to identify which specific factors triggered the anomaly flag.
3. Automatically attaches actionable, prescriptive recommendations based on DGMS (Directorate General of Mines Safety) guidelines.

### Cryptographic Audit Trail (Tamper-Evident)
To prevent retrospective falsification of safety logs:
- Every observation write generates an immutable audit record.
- The record contains `SHA-256(previous_hash + timestamp + record_data)`.
- The `/audit/verify` endpoint dynamically re-computes the chain, proving cryptographic integrity or identifying the exact point of unauthorized alteration.

### Multilingual OCR & Human-in-the-Loop
Field offices often receive physical safety clearance sheets and statutory registers in both English and Hindi. The OCR pipeline extracts tabular content and notes, computing word-level confidence scores. Items scoring below the 70% threshold are systematically sequestered into an `ocr_review_queue` for human sign-off before being committed to the permanent database.

### Role-Based Web Dashboard
The web dashboard provides specialized views based on user roles:
- **Inspectors / Field Officers**: Observation queue, field entry, and sync monitoring.
- **Mine Managers & Officials**: Hazard resolution workflow, corrective action sign-offs, and escalation tracking.
- **Corporate HSE Executives**: Multi-site comparative analytics, time-to-closure metrics, and risk heatmaps.
- **Regulators (DGMS / Ministry)**: Read-only access to tamper-proof audit trails and statutory violation reports.

---

## Canonical Governance Flow & Live Demonstration

Intellifusion enforces a strict 14-step statutory compliance life cycle (DGMS CMR 2017 compliant) connecting all 6 platform roles with human-in-the-loop sign-offs and cryptographic verification.

For complete architectural diagrams, state machine specifications, and negative boundary documentation, see [docs/FLOW.md](docs/FLOW.md).

### Canonical Demo Accounts

All demo accounts share the password: `password123`

| Role | Email | Scope / Purpose | Primary Route |
|:---|:---|:---|:---|
| **Super Admin** | `superadmin@intellifusion.gov.in` | Platform-wide governance, SLA thresholds, reports | `/admin/system` |
| **Corporate Management** | `corporate@coalindia.in` | Multi-mine executive risk KPI command center | `/corporate` |
| **Mine Official** | `official1@mine.in` | Dhanbad Colliery Manager (HITL verification, actions) | `/manager` |
| **Field Inspector** | `inspector1@mine.in` | Underground statutory inspector (offline sync) | `/inspections` |
| **Contractor** | `contractor1@contractor.in` | Remediation specialist (Apex Mining Corp) | `/contractor` |
| **Regulatory Authority** | `regulator@dgms.gov.in` | DGMS statutory auditor (SHA-256 chain verification) | `/regulator` |

### Running the Live Demonstration

To reset the database to the pristine story starting point and execute the canonical 14-step end-to-end lifecycle walkthrough:

```bash
# 1. Reset demo story dataset (idempotent, safe)
cd backend
DEMO_MODE=true python scripts/reset_demo.py
# (or with force flag: python scripts/reset_demo.py --force)

# 2. Execute automated 14-step jury demonstration
python scripts/demo_walkthrough.py
```

## API Reference

The FastAPI backend exposes comprehensive RESTful endpoints:

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/auth/login` | POST | Public | Authenticate user & obtain JWT token |
| `/auth/register` | POST | Admin / Official | Register new stakeholder |
| `/observations/` | GET | All | List observations (filtered by role & site) |
| `/observations/` | POST | Inspector | Submit a new field observation |
| `/observations/{id}` | GET | All | Get detailed observation data with risk card |
| `/observations/{id}/close` | PATCH | Mine Official | Formally close out a hazard observation |
| `/sync/batch` | POST | Inspector | Upload offline queued observations in bulk |
| `/sync/status` | GET | All | Retrieve store-and-forward sync success KPIs |
| `/kpi/` | GET | Official / Corp | Retrieve system-wide safety KPIs |
| `/audit/log` | GET | Regulator / Admin | View the append-only audit trail |
| `/audit/verify` | GET | Regulator / Admin | Cryptographically verify hash-chain integrity |
| `/ocr/upload` | POST | Inspector / Official| Upload scanned permit/log for OCR processing |
| `/ocr/queue` | GET | Official | Fetch low-confidence items awaiting manual review |

---

## Verification & Test Scripts

The repository includes end-to-end automated verification scripts in `backend/scripts/`:

```bash
# Verify Edge AI Model scoring logic across test scenarios
python backend/scripts/verify_edge_model.py

# Verify Cloud Enrichment & Explainability pipeline
python backend/scripts/verify_enrichment.py

# Verify Multilingual OCR ingestion & queue fallback
python backend/scripts/verify_ocr.py

# Verify complete offline batch sync + asynchronous enrichment end-to-end
python backend/scripts/verify_sync_enrichment_e2e.py
```

---

## Roadmap

- [x] **Phase 0**: Monorepo layout, Docker Compose PostGIS environment, Alembic migrations, mock data seeder.
- [x] **Phase 1**: FastAPI core REST API, JWT auth, RBAC middleware, and cryptographic audit hash-chain.
- [x] **Phase 2**: Edge AI feature extractor, Isolation Forest training, JSON weight export, and TS runtime.
- [x] **Phase 3**: Offline SQLite queue and background sync manager for Expo React Native.
- [x] **Phase 4**: Cloud anomaly enrichment service, feature explainability, and action recommendation mapper.
- [x] **Phase 5**: Multilingual Tesseract OCR pipeline with confidence-based human review queue.
- [x] **Phase 6**: React + Vite + Leaflet command dashboard with real-time KPI metrics and audit trail explorer.
- [ ] **Phase 7 (Scale-Up)**: Kafka event streaming for real-time telemetry, TimescaleDB sensor time-series integration, and native IoT gas sensor hardware integration.

---

## Team & Acknowledgments

- **Team**: Intellifusion
- **Target Event**: Smart India Hackathon (SIH) 2026
- **Problem Statement**: SIH26024 — AI-Based Smart Governance & Compliance Monitoring System for Coal Mines
- Built with focus on industrial safety, statutory compliance, and zero-compromise offline resilience.
