# Intellifusion SafeMine — Comprehensive Project Status & Claude Handoff Document

**Project:** Intellifusion — Smart Mine Safety & Statutory Compliance Management System  
**Problem Statement ID:** SIH26024  
**GitHub Repository:** [https://github.com/harivarman-007/SIH.git](https://github.com/harivarman-007/SIH.git) (`main`)  
**Latest Git Commit:** `2d900a1`  
**Document Generated:** September 23, 2026  

---

## 1. Executive Summary & Purpose

This document is a complete, authoritative status report and technical orientation guide intended for **Claude** (or any subsequent AI engineering agent / developer) resuming work on the **Intellifusion SafeMine** project. 

It covers:
1. Current running state of all services (backend, web, mobile, database).
2. The newly implemented **Unified Executive Light Theme** across both Web and Mobile.
3. System architecture, role-based access control (RBAC), and compliance workflows.
4. Database schemas, offline synchronization, and edge ML scoring.
5. Step-by-step instructions to run, test, and verify every component.
6. Seed accounts, credentials, and known verified capabilities.

---

## 2. Current Known State & Verification Record

All recent changes have been verified with **zero TypeScript errors** and pushed directly to `main` at GitHub commit `2d900a1`.

### Verification Matrix

| Component | Status | Port / Target | Verification Command | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL 15** | Healthy | `localhost:5432` | Docker container `intellifusion_db` | Relational tables, foreign keys, Alembic migrations |
| **FastAPI Backend** | Healthy | `localhost:8000` | `curl -s http://localhost:8000/health` | Returns `{"status":"ok","environment":"development"}` |
| **Web Dashboard** | Running | `localhost:3000` | `npm run build` in `dashboard/` | 0 TypeScript errors, Vite dev server active |
| **Mobile App** | Running | Expo SDK 57 | `npx tsc --noEmit` in `mobile/` | 0 TypeScript errors, Metro bundler active (`npx expo start`) |
| **Git Working Tree**| Clean | `origin/main` | `git status` | Clean working tree; committed & pushed |

---

## 3. Technology Stack & Key Libraries

### 3.1 Backend API (`/backend`)
- **Framework:** FastAPI (Python 3.11+) with Uvicorn.
- **Database ORM:** SQLAlchemy 2.0 (asyncpg) + Alembic migrations.
- **Database:** PostgreSQL 15 with JSONB support and row-level locking.
- **Authentication:** OAuth2 with JWT tokens (`HS256`), bcrypt password hashing.
- **Audit Logging:** Tamper-evident SHA-256 cryptographic hash-chain (`SELECT ... FOR UPDATE` row locks).
- **OCR Engine:** PyTesseract (English & Hindi) with confidence-based bounding box routing.
- **Background Tasks:** Asynchronous sync delta endpoints and periodic escalation tasks.

### 3.2 Web Dashboard (`/dashboard`)
- **Framework:** React 19 + Vite 6 + TypeScript.
- **Styling:** Vanilla CSS + TailwindCSS 4 tokens (Executive Light Theme).
- **Icons:** `lucide-react` vector icons (strictly zero unicode emojis).
- **State Management:** Zustand with local storage persistence.
- **Routing:** React Router v7 with role-based route protection.

### 3.3 Mobile Application (`/mobile`)
- **Framework:** React Native 0.86.3 + Expo SDK 57.
- **Database:** `expo-sqlite` v14 with auto-migrating schema wrapper.
- **Styling:** Custom design tokens (`src/theme/index.ts`) matching the web dashboard.
- **Icons:** `@expo/vector-icons` (`Ionicons`, strictly zero unicode emojis).
- **Edge AI:** Pure TypeScript on-device Isolation Forest inference engine (`RiskScoringEngine.ts`, 50 decision trees, trained model in `assets/model/model.json`).
- **Sync & Outbox:** Local mutation queue with two-way delta sync worker (`SyncWorker.ts`, `TaskManager.ts`).

---

## 4. Design System: Unified Executive Light Theme

Both Web and Mobile applications have been completely migrated from dark slate (`#0F172A`/`#1E293B`) to the **Executive Light Theme**:

```
Canvas / Page Background:   #F8FAFC (Slate-50)
Card / Surface Fills:       #FFFFFF (Pure White)
Borders & Dividers:         #E2E8F0 (Slate-200) / Strong: #CBD5E1 (Slate-300)
Primary Header Text:        #0F172A (Slate-900)
Secondary / Subtitle Text:  #475569 (Slate-600) / #64748B (Slate-500)
Brand Primary Color:        #1E40AF (Royal Blue-800)
Brand Primary Light:        #EFF6FF (Blue-50 fill with #BFDBFE border)
Success / Safe:             #16A34A (Emerald-600) with #F0FDF4 fill
Warning / Medium:           #D97706 (Amber-600) with #FFFBEB fill
Danger / High Risk:         #DC2626 (Rose-600) with #FEF2F2 fill
Informational:              #0284C7 (Sky-600) with #F0F9FF fill
```

### Strict Styling Rules
1. **Zero Unicode Emojis:** All UI emojis (`⛏️`, `🏠`, `📋`, `➕`, `🛠️`, `🔄`, `🚨`, `⚠️`, `✅`, `❌`, `⏳`, `📷`) have been permanently replaced by vector icons (`lucide-react` on Web, `Ionicons` on Mobile).
2. **Surface Elevations:** Crisp, subtle shadows (`0 1px 2px rgba(0,0,0,0.05)`) on white cards.
3. **Typography:** Font sizes, weights, and line-heights are aligned between mobile headers and web dashboard headers.

---

## 5. Role-Based Access Control (RBAC) Architecture

Per the official DGMS problem statement requirements, the system enforces **6 distinct user roles** failing **closed** (users without explicit permissions see zero cross-site data):

| Role | Scope | Key Responsibilities & Capabilities |
| :--- | :--- | :--- |
| `super_admin` | Global Platform | Manage users, assign elevated roles, manage mine sites, platform settings. |
| `corporate_management`| Multi-Site | Read-only executive analytics across all subsidiaries, safety KPIs, cross-site hazard trends. |
| `mine_official` (Mine Manager) | Single Mine Site | Assign corrective actions, review field observations, approve/reject remediation submissions, manage mine personnel. |
| `inspector` (Field Inspector) | Assigned Mine | Execute statutory inspections, capture offline observations, photo evidence, gas telemetry, submit with sign-offs. |
| `contractor` | Assigned Actions Only | Remediation queue, upload resolution evidence, request verification closure. |
| `regulator` (DGMS Authority) | Global Read/Audit | Statutory oversight, violation records, tamper-evident audit hash-chain verification. |

### Demo Accounts (Seed Passwords: `password123`)
- **Super Admin:** `admin@intellifusion.com`
- **Corporate Manager:** `corporate@intellifusion.com`
- **Mine Manager (Jharia):** `manager.jharia@intellifusion.com`
- **Field Inspector:** `inspector.singh@intellifusion.com`
- **Contractor:** `contractor.apex@intellifusion.com`
- **DGMS Regulator:** `regulator.dgms@intellifusion.com`

---

## 6. Detailed Feature & Module Status

### 6.1 Statutory Inspections Lifecycle (Phase 29)
- **Lifecycle:** `SCHEDULED` -> `IN_PROGRESS` -> `SUBMITTED` -> `CLOSED`.
- **Field Execution:** Field Inspector can begin statutory inspections offline via SQLite outbox.
- **Rule #2 (Mandatory Sign-off Notes):** Submitting an inspection with 0 observations requires statutory certification notes certified by the inspector before submission is allowed.
- **Two-Way Delta Sync:** Both Web and Mobile synchronize inspection progress and observation counts via `/sync/delta`.

### 6.2 Corrective Actions Remediation Queue
- **Lifecycle:** `ASSIGNED` -> `ACCEPTED` -> `IN_PROGRESS` -> `PENDING_VERIFICATION` -> `CLOSED` (or `REJECTED`).
- **Multi-Round Tracking:** When an inspector or manager rejects submitted evidence, the action enters `REJECTED` status with an incremented `submission_round` and an explicit `rejection_reason`.
- **Amber Rejection Callout:** Displayed across both Web and Mobile detailing round number, reason quotation, and resubmission prompt.
- **Field Inspector Audit View:** Strictly read-only for field inspectors to inspect progress without bypassing contractor workflows.

### 6.3 Edge AI & On-Device Risk Scoring
- **Model:** Isolation Forest trained on mining risk features (12 features, 50 decision trees, `c_factor = 8.858431`).
- **Offline Inference:** Evaluated locally on the mobile phone in `RiskScoringEngine.ts` in under 15ms.
- **Critical DGMS Rules Override:** Automatically overrides the ML tree traversal to `0.95` (HIGH RISK) if critical hazard patterns are detected in the description:
  - Strata collapse, roof fall, bench collapse (`ROOF_STRATA_COLLAPSE`)
  - Explosion, fire, spontaneous combustion (`EXPLOSION_OR_FIRE`)
  - Methane, carbon monoxide, gas leak (`HAZARDOUS_GAS_LEAK`)
  - Inundation, water breakthrough (`WATER_INUNDATION`)
  - Mechanical / electrical fatal hazards (`FATAL_OR_HAUL_FAILURE`)

### 6.4 Offline Outbox & Database Auto-Migrations
- **SQLite Outbox:** Mutations recorded in `local_observations` and `inspection_outbox`.
- **Auto-Migration Architecture:** To avoid `no such column` errors when existing databases on mobile devices upgrade, `schema.ts` and `ObservationRepository.ts` implement non-destructive `ALTER TABLE ... ADD COLUMN` migration fallbacks with automatic retry wrappers.
- **Offline Simulation:** Queue screen includes a native switch (`🧪 DEMO: Simulate Offline`) that intercepts network calls to demonstrate offline outbox queuing without toggling device Wi-Fi.

### 6.5 Tamper-Evident Audit Hash-Chain
- Every state mutation (observation created, action status changed, inspection submitted) appends to an immutable audit ledger.
- SHA-256 hash chaining links `previous_hash` to `current_hash`.
- Concurrency protection utilizes PostgreSQL `SELECT ... FOR UPDATE` row locks to prevent chain forks.
- Regulators can verify ledger integrity via `/audit/verify`.

---

## 7. How to Run and Verify the Entire System

### Step 1: Start Infrastructure & Backend
```powershell
cd c:\projects\SIH
docker-compose up -d
```
Verify backend health:
```powershell
curl.exe -s http://localhost:8000/health
# Expected: {"status":"ok","environment":"development"}
```
Backend API docs: `http://localhost:8000/docs`

---

### Step 2: Start Web Dashboard
```powershell
cd c:\projects\SIH\dashboard
npm run dev
```
- Dashboard runs on `http://localhost:3000/`.
- Verify TypeScript:
  ```powershell
  npm run build
  ```

---

### Step 3: Start Mobile Application
```powershell
cd c:\projects\SIH\mobile
npx expo start
```
- **On Physical Device:** Scan the Metro terminal QR code with the **Expo Go** app (Android/iOS).
- **On Android Emulator:** Press `a` in the terminal.
- **Verify TypeScript:**
  ```powershell
  npx tsc --noEmit
  ```

---

## 8. Summary of Recent Commits

- **`0a4e167`:** `feat(mobile): apply executive light theme and vector icons across all mobile screens`  
  *Refactored BottomNavBar, Login, Dashboard, Inspections, NewObservation, RiskCard, Actions, and Queue screens to executive light theme. Removed all unicode emojis and replaced with Ionicons.*
- **`2d900a1`:** `fix(mobile): add auto-migration fallback and detailed error reporting for observation saves`  
  *Added automatic SQLite column migration checks to prevent `no such column` errors in existing databases, added auto-retry wrapper in `ObservationRepository`, and surfaced detailed error messages in `NewObservationScreen`.*

---

## 9. Guidance for Claude / Future AI Sessions

1. **Always Preserve Executive Light Theme:** Do not reintroduce dark slate backgrounds (`#0F172A`, `#1E293B`) or unicode emojis. Always use `#F8FAFC` canvas, `#FFFFFF` surfaces, `#E2E8F0` borders, `#1E40AF` royal blue accents, and vector icons.
2. **Never Fabricate Placeholder Data:** Keep sensor readings, audit records, and inspections wired to real database queries and outbox synchronization.
3. **Maintain Offline-First Architecture:** Any newly introduced mobile feature must write to SQLite first and synchronize via the outbox worker.
4. **Failing Closed on Scoping:** Ensure `apply_role_filter` and role guards continue to restrict access strictly by role and `mine_site_id`.
5. **Verify Before Declaring Done:** Always run `npm run build` in `dashboard/` and `npx tsc --noEmit` in `mobile/` to ensure zero compilation or type errors before completing turns.
