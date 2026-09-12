# Intellifusion — Product Roadmap & Problem-Statement Alignment

*Last updated: Phase 10 — Post-RBAC and Security Hardening Audit*

## Problem-Statement Capability Audit & Status

| PS Capability | Status | Implementation Details |
|---|---|---|
| **1. Digitally track statutory compliance** (safety, env, production, labour) | **Partially Built** | Category enum currently covers `safety`, `environment`, `labour`. `production` statutory compliance tracking and specialized regulatory registers are pending. |
| **2. Real-time monitoring of inspections, observations, violations, corrective actions** | **Partially Built** | REST APIs, status workflow (`open` -> `in_progress` -> `closed` / `escalated`), and 30s dashboard polling are active. True real-time WebSocket / SSE streaming is deferred to scale-up. |
| **3. AI/analytics for high-risk areas, recurring compliance failures, operational anomalies** | **Already Built & Verified** | On-device Isolation Forest edge model + cloud 15-feature deep Isolation Forest with SHAP-lite feature contributions and DGMS statutory rule engine. |
| **4. Geo-tagged, time-stamped field reporting via mobile with offline support** | **Already Built & Verified** | React Native/Expo app with `expo-location` GPS coordinates, BLE beacon fallback, camera capture, SQLite outbox, and batch sync engine. |
| **5. Dashboards for mine officials, corporate management, AND regulatory authorities** | **Partially Built** | Mine Official view (site KPIs, interactive zone map, observation table) and Regulatory Authority view (audit hash chain verification, statutory read access) exist. **Corporate Management multi-mine view is not yet built** (Phase 11). |
| **6. Automated alerts, reminders, escalation mechanisms** | **Partially Built** | Observation escalation lifecycle (`escalated`, `escalated_at`) and KPI counters exist in backend & frontend. Background cron triggers, automated SLA breach auto-escalation, and SMS/email alerts are not yet built. |
| **7. Minimize manual paperwork (OCR/document digitization)** | **Already Built & Verified** | Tesseract OCR engine (English + Hindi) with word-level confidence scoring, human review queue API (`/ocr/queue`), and dashboard `OcrQueueView`. |
| **8. Scalable across multiple mines/subsidiaries** | **Partially Built** | Multi-mine database schema (`MineSite`, `Zone`, `CorporateMineAccess`) with explicit role-based boundary filters. Multi-tier organizational hierarchy (Holding Co -> Subsidiary -> Area -> Mine) is deferred. |
| **9. Secure digital audit trail (hash-chain)** | **Already Built & Verified** | SHA-256 append-only hash-chain with tamper detection verified in Phase 8 (`verify_audit_chain` + `/audit/verify`). |

---

## Phase Roadmap

### Current Focus: Phase 11 — Corporate Management Dashboard View
- Multi-mine aggregated KPI cards (Total open risks across granted mines, cross-mine compliance score, contractor incident counts)
- Cross-mine comparison / risk ranking view
- Compliance trend visualization across mine sites

### Subsequent Enhancements (Phase 12+)
1. **Production Statutory Compliance**: Add `production` to `ObservationCategory`, DGMS production safety norms, and statutory shift registers.
2. **Automated Escalation Daemon**: Background worker / Celery task to auto-escalate observations past SLA (e.g. high-risk unacknowledged after 24h) and trigger dispatch alerts.
3. **WebSockets / SSE**: Push notifications from backend to dashboard on high-risk sync.
4. **Multi-tier Corporate Hierarchy**: Holding Company -> Subsidiary (e.g. SECL, BCCL, ECL) -> Area -> Mine site data structures.
