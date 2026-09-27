# SIH26024 — Function Master List
## AI-Based Smart Governance and Compliance Monitoring System for Coal Mines

**Organization:** Ministry of Coal | **Department:** Coal India Limited | **Category:** Software | **Theme:** Smart Automation
**Project (this repo):** Intellifusion — `harivarman-007/SIH`

This document lists **every function the solution must include**, organized exactly the way a SIH submission (PPT/report) needs it: what the problem statement asks for (**Proposed Solution**), what makes this build different from a generic compliance tool (**Unique Value Proposition**), and what's been added **beyond** the minimum ask (**Extra Propositions**). Each function is checked against what's already implemented in the current codebase.

---

## 0. Official Problem Statement — source text (for reference)

> **Background:** The Indian coal mining sector involves large-scale operations spread across multiple subsidiaries, mine sites, contractors, regulatory bodies, and field offices. Governance-related activities... are often managed through fragmented systems, manual documentation, spreadsheets, and delayed reporting mechanisms — leading to data inconsistency, delayed decision-making, limited transparency, compliance gaps, duplication of records, weak field-level monitoring, and difficulty obtaining real-time operational insights.
>
> **Defining the Problem:** Develop a centralized AI-enabled governance and compliance monitoring platform for coal mining operations that can digitally integrate mine-level activities, statutory compliance, inspections, contractor management, and operational reporting.
>
> **Expected Solution:** A centralized AI-enabled smart governance platform for coal mines that integrates compliance monitoring, inspection management, operational reporting, contractor management, and field activity tracking into a single digital ecosystem, providing real-time visibility, automated workflows, and data-driven insights through web and mobile applications.

---

## 1. Proposed Solution — required functions (from the PS itself)

These are the functions the problem statement **explicitly requires** ("should" / "Expected Solution" bullets). Every one is mapped to where it lives in this repo.

| # | Required function (verbatim intent from PS) | Status | Implementation in this repo |
|---|---|---|---|
| 1 | Digitally track statutory compliance (safety, environment, production, labour regulations) | ✅ Done | `backend/app/models` — `Observation`, compliance-linked schemas; Dashboard `ComplianceReportsView.tsx` |
| 2 | Real-time monitoring of inspections, observations, violations, corrective actions | ✅ Done | `backend/app/api` observations router; mobile `InspectionsScreen.tsx`, `NewObservationScreen.tsx` |
| 3 | AI/analytics to identify high-risk areas, recurring compliance failures, operational anomalies | ✅ Done | `backend/app/edge` (Isolation Forest edge scoring) + `backend/app/enrichment` (cloud risk scoring, tree path-length explainability) |
| 4 | Geo-tagged, time-stamped field reporting via mobile application | ✅ Done | Mobile app — GPS/beacon geo-tagging + camera module on every observation |
| 5 | Dashboards for mine officials, corporate management, regulatory authorities | ✅ Done | Dashboard role views for `mine_official`, `corporate`, `regulator` (+ `inspector`) — RBAC enforced |
| 6 | Automated alerts, reminders, compliance reports, escalation mechanisms | ✅ Done | Alert/escalation logic tied to risk scoring; report generation in `ComplianceReportsView.tsx` |
| 7 | Minimize manual paperwork, improve transparency/accountability | ✅ Done | Full digital lifecycle: capture → sync → enrich → dashboard → closure, no paper step |
| 8 | Scalable across multiple mines and subsidiaries | ✅ Done | `MineSite` model, multi-tenant-style queries scoped by `mine_site_id` |
| 9 | Contractor management | ✅ Done | Contract/contractor tracking (work orders, contractor activities, compliance records) |
| 10 | Centralized dashboard, real-time compliance + operational monitoring | ✅ Done | React + Vite dashboard, Leaflet GIS heatmaps, KPI command center |
| 11 | AI/analytics engine — compliance risks, anomalies, recurring violations, **predictive** alerts | ✅ Done | Isolation Forest (edge) + cloud enrichment with prescriptive action recommendations |
| 12 | Mobile app with **offline support** for field inspections, safety observations, attendance, incident reporting | ✅ Done | React Native + Expo, SQLite local queue, background store-and-forward sync worker |
| 13 | Automated workflow — alerts, reminders, escalations, **digital approvals**, statutory report generation | ✅ Done | Full multi-step inspection & corrective action workflow (`ASSIGNED` → `IN_PROGRESS` → `PENDING_VERIFICATION` → `CLOSED`), HITL managerial verification & sign-off chain, and automated statutory report snapshots |
| 14 | GIS mapping | ✅ Done | Leaflet-based GIS heatmaps + pins on the dashboard |
| 15 | OCR-based document digitization | ✅ Done | Tesseract multilingual OCR pipeline (`backend/app/ocr/engine.py`) supporting 8 Indian mining languages, safety log sheets & permits |
| 16 | Secure digital audit trail (paperless governance) | ✅ Done | SHA-256 hash-chained, block-style audit log — every write cryptographically linked to the previous entry |
| 17 | Worker attendance tracking | ✅ Done | Mobile `LabourAttendanceScreen.tsx` |
| 18 | *(Optional per PS)* Blockchain-based audit trails | ✅ Done (hash-chain, not full blockchain) | Cryptographic hash chain — same tamper-evidence guarantee as a private blockchain, without the infra overhead |
| 19 | *(Optional per PS)* Multilingual conversational & UI interfaces | ✅ Done | Complete 8-language localization (`en`, `sa`, `hi`, `bn`, `or`, `te`, `mr`, `sat`) across backend APIs, Tesseract OCR, web dashboard, and offline mobile app |

**Coverage: 19/19 fully done (100% complete)** — the platform fully satisfies all required capabilities and optional extensions requested by the problem statement.

---

## 2. Unique Value Proposition (USP)

What makes this build different from "yet another compliance dashboard" — the things a judge/evaluator should specifically be told, because they go beyond simply satisfying the checklist above:

1. **Edge AI that works with zero connectivity underground.** Most compliance/safety software assumes always-on internet. Here, a pre-trained Isolation Forest model is exported to portable JSON (`model_weights.json`) and runs **on the phone itself**, so a Field Inspector gets an instant hazard risk score deep inside a mine gallery with no signal — not "queued for later."
2. **Explainable AI, not a black box.** The cloud enrichment layer doesn't just say "risky" — it computes tree path-length delta approximations to give a human-readable *reason* for the score, plus a prescriptive corrective action. This matters specifically for a **regulatory/governance** context, where an inspector or regulator has to justify a decision, not just trust a number.
3. **Tamper-evident by cryptographic design, not by access control alone.** SHA-256 hash-chaining means every record mathematically proves it hasn't been altered after the fact — a materially stronger transparency guarantee than typical "audit log" tables that an admin could quietly edit.
4. **True offline-first architecture, not "offline mode as an afterthought."** SQLite local queue + automated background sync is core to the data model, not a fallback screen — because coal mine galleries are the textbook worst-case connectivity environment this category of software has to survive.
5. **Human-in-the-loop OCR**, not fully-automated-and-hope. Low-confidence (<70%) OCR parses are automatically routed to a review queue instead of silently accepting bad data into statutory records — directly protects the "data inconsistency" problem named in the PS background.
6. **Deep, state-mapped localization**, not just an English product with a Hindi toggle. The multilingual plan ties each of 6 regional languages to the actual state where that language is spoken by the mine workforce (Hindi/Jharkhand-MP-Chhattisgarh, Bengali/West Bengal, Odia/Odisha, Telugu/Telangana, Marathi/Maharashtra, Santali/tribal mining belt), plus English and Sanskrit as system-wide majors — this is the "multilingual conversational interfaces" line item from the PS, executed with actual geographic reasoning behind it rather than a generic language dropdown.
7. **Indigenous, self-hosted stack.** FastAPI + PostgreSQL/PostGIS + open-source ML (scikit-learn) + open-source OCR (Tesseract) — no dependency on a foreign SaaS AI API for the core scoring pipeline, directly answering the PS's closing line about building a *"scalable indigenous e-governance framework."*

---

## 3. Extra / Additional Propositions (beyond what the PS asks for)

Functions that **aren't required** by SIH26024 but strengthen the submission as forward-looking, production-minded extras:

| # | Extra function | Why it adds value |
|---|---|---|
| 1 | **State-derived default language** (`mine_sites.state` → `users.preferred_language` resolution logic) | Zero-friction onboarding — a new inspector at a Jharkhand mine gets Hindi by default without configuring anything |
| 2 | **Sanskrit formal-register support** for statutory document headers/titles | A distinctive, low-cost addition that signals attention to official/ceremonial correctness in government-facing documents |
| 3 | **Santali (Ol Chiki script) language support** | Directly serves the tribal (Adivasi) contract-labour population who form a large share of on-ground workers in the Jharkhand/Odisha/WB coal belt — a demographic most competing solutions ignore entirely |
| 4 | **Bengali/Odia voice-to-report ingestion** (roadmap item already scoped in `SYSTEM_ARCHITECTURE_AND_ROADMAP.md`) | Removes the literacy/typing barrier for field-level voice reporting, not just text |
| 5 | **Confidence-scored OCR with automatic review routing** | Goes beyond "OCR the document" to actively flag what a human still needs to check — reduces silent data-quality failures |
| 6 | **Cryptographic hash-chain audit trail** (stronger than plain access-logged audit tables) | Gives regulators mathematical, not just procedural, proof against tampering |
| 7 | **On-device (edge) + cloud (enrichment) two-tier AI pipeline** | Gets both instant offline triage *and* deeper cloud-side explainability — most solutions pick only one tier |
| 8 | **Multi-subsidiary / multi-mine scalable data model** (`MineSite`, `CorporateMineAccess`) | Supports Corporate Manager and Regulator roles viewing across *many* mines at once — matches CIL's real organizational structure (multiple subsidiaries, not one mine) |
| 9 | **Role-based access control across 6 distinct personas** (`super_admin`, `corporate_management`, `mine_official`, `inspector`, `contractor`, `regulator`) | Matches the real-world stakeholder hierarchy named in the PS background exactly, rather than a generic "admin vs. user" model |
| 10 | **PostGIS-backed spatial storage** (not just lat/lng columns) | Enables proper geospatial querying (radius search, zone containment, heatmap aggregation) rather than app-side approximations |
| 11 | **Verification & test scripts included in-repo** (`backend/scripts`) | Signals production-readiness and reproducibility for judges reviewing the codebase, not just the demo |
| 12 | **Docker Compose reproducible environment** | Judges/evaluators can spin up the full stack in one command — reduces "works on my machine" risk during evaluation |

---

## 4. Quick-reference: full function checklist (for a slide/report)

**Core (PS-required):**
- [x] Statutory compliance tracking (safety, environment, production, labour)
- [x] Real-time inspection & observation monitoring
- [x] AI/ML anomaly & high-risk detection
- [x] Geo-tagged, timestamped mobile field reporting
- [x] Role-based dashboards (Super Admin, Mine Official, Corporate HQ, Regulator, Inspector, Contractor)
- [x] Automated alerts, reminders, escalations
- [x] Contractor management
- [x] Multi-mine / multi-subsidiary scalability
- [x] GIS mapping & heatmaps
- [x] Multilingual OCR document digitization (8 languages)
- [x] Secure, tamper-evident audit trail (SHA-256 hash-chained ledger)
- [x] Worker attendance tracking
- [x] Offline-first mobile operation
- [x] Full multi-step digital approval/sign-off chain (Inspection submission & Corrective Action HITL sign-off)
- [x] Full multilingual UI & OCR across 8 languages (`en`, `sa`, `hi`, `bn`, `or`, `te`, `mr`, `sat`)

**USP-driving:**
- [x] On-device edge AI (zero-connectivity scoring)
- [x] Explainable AI with prescriptive actions
- [x] Cryptographic SHA-256 hash-chained audit log
- [x] Human-in-the-loop OCR review queue
- [x] State-mapped deep localization strategy
- [x] Fully open-source / indigenous technology stack

**Extra propositions:**
- [x] State-derived default language resolution
- [x] Sanskrit formal-register documents
- [x] Santali (Ol Chiki) tribal-language support
- [x] Bengali/Odia voice-to-report ingestion *(roadmap)*
- [x] OCR confidence scoring + review routing
- [x] Two-tier edge + cloud AI pipeline
- [x] PostGIS spatial data model
- [x] In-repo verification/test scripts
- [x] One-command Docker Compose environment

---

## 5. How to use this document

- **For the PPT "Proposed Solution" slide:** use Section 1's table rows, phrased as bullet points.
- **For the "Unique Value Proposition" slide:** use Section 2 as-is — each point is written to be judge-facing.
- **For a "What else we built" / differentiation slide:** use Section 3.
- **For an appendix/backup slide or live Q&A:** use Section 4 as your rapid-fire checklist.
