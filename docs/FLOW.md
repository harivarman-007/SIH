# Intellifusion — Canonical Regulatory Governance & Operational Flow

## 1. Architectural Life-Cycle Diagram

```
 +---------------------------------------------------------------------------------------------------------+
 |                                  INTELLIFUSION STATE MACHINE ARCHITECTURE                               |
 |                                          DGMS Statutory Workflow                                       |
 +---------------------------------------------------------------------------------------------------------+

  [ Mine Official ]           [ Field Inspector ]             [ Contractor ]            [ Regulator (DGMS) ]
         |                            |                              |                          |
 (1) POST /inspections                |                              |                          |
     (SCHEDULED)                      |                              |                          |
         |--------------------------->|                              |                          |
                                (2) POST /inspections/{id}/start     |                          |
                                    (IN_PROGRESS)                    |                          |
                                      |                              |                          |
                                (3) POST /observations/              |                          |
                                    (Edge AI: High Risk)             |                          |
                                    (Status: OPEN)                   |                          |
                                      |                              |                          |
                                (4) POST /inspections/{id}/submit    |                          |
                                    (SUBMITTED)                      |                          |
         |<---------------------------+                              |                          |
 (5) POST /observations/{id}/review                                  |                          |
     (UNDER_REVIEW)                                                  |                          |
         |                                                           |                          |
 (6) POST /actions                                                   |                          |
     (Parent Obs: ACTION_REQUIRED)                                   |                          |
     (Action: ASSIGNED)                                              |                          |
         |---------------------------------------------------------->|                          |
                                                               (7) POST /actions/{id}/accept    |
                                                                   (ACCEPTED)                   |
                                                                     |                          |
                                                               (8) POST /actions/{id}/start     |
                                                                   (IN_PROGRESS)                |
                                                                   (Obs: IN_PROGRESS)           |
                                                                     |                          |
                                                               (9) POST /actions/{id}/evidence  |
                                                                   (Before & After Proofs)      |
                                                                     |                          |
                                                              (10) POST /actions/{id}/submit    |
                                                                   (PENDING_VERIFICATION)       |
         |<----------------------------------------------------------+                          |
 (11) POST /actions/{id}/verify                                                                 |
      (HITL Verification - Decision D12)                                                        |
      (Action: VERIFIED -> CLOSED)                                                              |
      (Parent Obs: CLOSED - Decision D7)                                                        |
         |                                                                                      |
 [ Corporate Executive ]                                                                        |
 (12) GET /kpi/cross-mine-summary                                                               |
      (Fleet Risk & Multi-Mine KPIs)                                                            |
                                                                                          (13) GET /audit/verify
                                                                                               (SHA-256 Ledger
                                                                                                Intact & Valid)
 [ Super Admin ]
 (14) POST /reports & GET /reports/{id}/export?format=csv
      (Statutory Governance Snapshot & Cryptographic Export)
```

---

## 2. Canonical 14-Step Operational Matrix

| Step | Role | Actor Email | Action / Description | API Endpoint & HTTP Method | Entity States | Audit Action Emitted | Governance & Decision Notes |
|:---:|:---|:---|:---|:---|:---|:---|:---|
| **1** | Mine Official | `official1@mine.in` | Schedules statutory underground inspection and assigns field inspector | `POST /inspections` | Inspection: `SCHEDULED` | `INSPECTION_CREATED` | **D5**: Only assigned inspector or manager can access inspection record. |
| **2** | Field Inspector | `inspector1@mine.in` | Inspector starts underground inspection on mobile device | `POST /inspections/{id}/start` | Inspection: `SCHEDULED -> IN_PROGRESS` | `INSPECTION_STARTED` | Dispatches alert to mine official. |
| **3** | Field Inspector | `inspector1@mine.in` | Inspector logs underground hazard observation with edge AI risk score | `POST /observations/` | Observation: `open` | `observation.created`, `risk.generated` | **D14**: Edge AI runs locally offline, classifies risk (High Risk). |
| **4** | Field Inspector | `inspector1@mine.in` | Inspector submits completed inspection report with notes | `POST /inspections/{id}/submit` | Inspection: `IN_PROGRESS -> SUBMITTED` | `INSPECTION_SUBMITTED` | Mandatory notes enforced if zero observations recorded. |
| **5** | Mine Official | `official1@mine.in` | Manager reviews observation in Safety Risk Center | `POST /observations/{id}/review` | Observation: `open -> under_review` | `OBSERVATION_REVIEWED` | Pre-condition for corrective action assignment. |
| **6** | Mine Official | `official1@mine.in` | Manager creates Corrective Action and assigns certified Contractor | `POST /actions` | Action: `ASSIGNED`<br>Observation: `under_review -> action_required` | `action.create` | Generates sequential code (`ACT-xxxx`). Dispatches alert to contractor. |
| **7** | Contractor | `contractor1@contractor.in` | Contractor receives statutory work order and accepts assignment | `POST /actions/{id}/accept` | Action: `ASSIGNED -> ACCEPTED` | `action.accept` | **D18**: Contractor scope strictly isolated to assigned tasks. |
| **8** | Contractor | `contractor1@contractor.in` | Contractor commences physical underground remediation work | `POST /actions/{id}/start` | Action: `ACCEPTED -> IN_PROGRESS`<br>Observation: `action_required -> in_progress` | `action.start` | Commences SLA clock. |
| **9** | Contractor | `contractor1@contractor.in` | Contractor uploads Before and After photographic evidence with geotags | `POST /actions/{id}/evidence` | Evidence: `ActionEvidence` created | `action.evidence_upload` | SHA-256 hash verified and stored. |
| **10** | Contractor | `contractor1@contractor.in` | Contractor submits completed work order for managerial verification | `POST /actions/{id}/submit` | Action: `IN_PROGRESS -> PENDING_VERIFICATION` | `action.submit` | Requires $\ge 1$ proof-of-work evidence item before submission. |
| **11** | Mine Official | `official1@mine.in` | Manager inspects evidence and signs off closure (HITL Verification) | `POST /actions/{id}/verify` | Action: `PENDING_VERIFICATION -> VERIFIED -> CLOSED`<br>Observation: `CLOSED` | `action.verify`, `action.close`, `observation.close` | **D12**: Human-in-the-loop mandatory (`actor_type='user'`).<br>**D7**: Parent observation atomically closed. |
| **12** | Corporate Management | `corporate@coalindia.in` | Corporate executive inspects fleet-wide safety KPIs and risk leaderboard | `GET /kpi/cross-mine-summary` | Read-only analytics | — | Multi-mine access scoped via `corporate_mine_access` grants. |
| **13** | Regulatory Authority | `regulator@dgms.gov.in` | Statutory regulator audits cryptographic tamper-evident SHA-256 ledger | `GET /audit/verify` | Read-only cryptographic verification | — | Validates hash chain: $H_i = \text{SHA256}(H_{i-1} \parallel P_i \parallel T_i)$. 0 broken links. |
| **14** | Super Admin | `superadmin@intellifusion.gov.in` | Super Admin generates compliance report snapshot and exports streaming CSV | `POST /reports`<br>`GET /reports/{id}/export?format=csv` | Report: Point-in-time immutable record | `REPORT_CREATED`, `REPORT_EXPORTED` | Statutory audit export streamed as RFC-4180 CSV with immutable audit log entry. |

---

## 3. Negative Authorization Boundaries & Security Invariants

1. **Contractor Isolation (Decision D18)**:
   - A contractor can never access inspections or observations of other contractors.
   - `GET /actions/{foreign_id}` returns 403/404 Forbidden.
   - `GET /observations/{foreign_id}` returns 403/404 Forbidden.
2. **Operational Separation (Decision D9)**:
   - Super Admin holds system governance (`USER_CREATE`, `SETTING_EDIT`, `ROLE_ASSIGN`) but is decoupled from direct operational action verification (`ACTION_VERIFY`).
   - Action verification requires operational role assignment (`mine_official`).
3. **Strict Human-In-The-Loop Enforcement (Decision D12)**:
   - Automated system actors (`actor_type='system'`) are strictly blocked by the state machine from executing `pending_verification -> verified`.
   - Only human users with verified active sessions can sign off on statutory closures.
4. **Tamper-Evident SHA-256 Audit Chain**:
   - Every state transition, login event, evidence upload, setting change, and statutory report export appends an immutable entry to `audit_logs` linked to the cryptographic predecessor hash.
