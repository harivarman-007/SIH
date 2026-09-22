# Intellifusion — Canonical Governance & Compliance Flow

This document defines the statutory compliance lifecycle for industrial coal mine operations under the Intellifusion platform:

$$\text{OBSERVE} \longrightarrow \text{DETECT} \longrightarrow \text{EXPLAIN} \longrightarrow \text{ACT} \longrightarrow \text{VERIFY} \longrightarrow \text{CLOSE} \longrightarrow \text{AUDIT}$$

---

## 1. Governance Architecture Flow Diagram

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

---

## 2. Transition Table & Lifecycle Steps

| Step | Actor | Action / Target Endpoint | Observation State | Action State | Audit Event | Alert Recipient |
|:---:|:---|:---|:---:|:---:|:---|:---|
| **1** | Mine Manager | `POST /inspections` | — | — | `INSPECTION_ASSIGNED` | Assigned Inspector |
| **2** | Field Inspector | `POST /inspections/{id}/start` | — | — | `INSPECTION_STARTED` | Mine Manager |
| **3** | Field Inspector | `POST /observations` or `POST /sync/batch` | `open` (Synced) | — | `OBSERVATION_CREATED`, `RISK_GENERATED` | Mine Manager |
| **4** | Field Inspector | `POST /inspections/{id}/complete`, `/submit` | — | — | `INSPECTION_SUBMITTED` | Mine Manager |
| **5** | Mine Manager | `POST /observations/{id}/review` | `under_review` | — | `OBSERVATION_REVIEWED` | — |
| **6** | Mine Manager | `POST /actions` (creates & assigns) | `action_required` | `ASSIGNED` | `ACTION_CREATED`, `ACTION_ASSIGNED` | Assigned Contractor |
| **7** | Contractor | `POST /actions/{id}/accept` | `action_required` | `ACCEPTED` | `ACTION_ACCEPTED` | Mine Manager |
| **8** | Contractor | `POST /actions/{id}/start` | `in_progress` | `IN_PROGRESS` | `ACTION_STARTED` | Mine Manager |
| **9** | Contractor | `POST /actions/{id}/evidence` (multipart) | `in_progress` | `IN_PROGRESS` | `EVIDENCE_UPLOADED` | — |
| **10** | Contractor | `POST /actions/{id}/submit` | `in_progress` | `PENDING_VERIFICATION` | `ACTION_SUBMITTED` | Mine Manager |
| **11a** | Mine Manager | `POST /actions/{id}/verify` (approve) | `closed` (when all actions closed) | `VERIFIED` → `CLOSED` | `ACTION_APPROVED`, `CASE_CLOSED` | Contractor, Corporate |
| **11b** | Mine Manager | `POST /actions/{id}/reject` `{reason}` | `in_progress` | `REJECTED` → `IN_PROGRESS` | `ACTION_REJECTED` | Contractor |
| **12** | Corporate / Regulator | Read-only analytics, `POST /reports` | — | — | `REPORT_EXPORTED` | — |

---

## 3. SLA Escalation Engine Rules

The statutory escalation scheduler runs every 5 minutes in the background:
- **High Risk**: Breached after **24 hours** without resolution $\rightarrow$ transitions to `escalated`, logs `SLA_BREACH_ESCALATED`, raises priority alert to Mine Manager & Corporate.
- **Medium Risk**: Breached after **72 hours** without resolution $\rightarrow$ transitions to `escalated`.
- **Low Risk**: Breached after **168 hours** (7 days) without resolution $\rightarrow$ transitions to `escalated`.
- **Overdue Corrective Actions**: Actions exceeding statutory deadlines raise automated overdue alerts to Manager & Corporate without automatic state transition.
