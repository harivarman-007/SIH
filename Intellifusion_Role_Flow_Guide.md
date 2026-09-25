# Intellifusion SafeMine — 6-Role Operational Flow Guide

This explains **who does what, in what order**, and **how each role operates the site** — starting from setup, through daily field operations, to closure and audit.

---

## The Big Picture: How the 6 Roles Connect

The system runs as a **chain** — each role's output becomes the next role's input. Here's the full sequence, start to finish:

```
1. SUPER ADMIN        →  sets up the platform (accounts, mine sites)
        ↓
2. MINE OFFICIAL       →  schedules an inspection at their mine
        ↓
3. FIELD INSPECTOR     →  goes underground, logs hazards, submits inspection
        ↓
4. MINE OFFICIAL       →  reviews findings, assigns corrective action
        ↓
5. CONTRACTOR          →  fixes the hazard, uploads proof
        ↓
6. MINE OFFICIAL       →  verifies the fix, closes the case
        ↓
7. CORPORATE MANAGER   →  watches KPIs across all mines (any time, in parallel)
        ↓
8. REGULATOR (DGMS)    →  audits everything, verifies nothing was tampered with
```

Corporate Manager and Regulator don't wait for their "turn" — they can look in at any point. But Mine Official, Inspector, and Contractor genuinely hand off to each other in that order, every single case.

---

## ROLE 1 — Super Admin
**Login:** `admin@intellifusion.com`
**Starts everything. Runs this once during setup, not daily.**

### What they do:
1. Log in to the **Web Dashboard**.
2. Go to **User Management** → create accounts for every other role (mine officials, inspectors, contractors, regulators, corporate managers) and assign each one their role.
3. Go to **Mine Sites** → add the mine(s) the platform will manage (e.g., Jharia, Moonidih).
4. Set any platform-wide settings.

### Where they stop:
Once accounts and mine sites exist, Super Admin's job is done for that setup. They come back only to add new users or new mine sites later.

---

## ROLE 2 — Mine Official (Mine Manager)
**Login:** `official1@mine.in` (or `manager.jharia@intellifusion.com`)
**This is the hub role — appears at the start, middle, AND end of every case.**

### Step A — Start a case (Schedule)
1. Log in to the **Web Dashboard**.
2. Go to **Inspections**.
3. Click **Schedule Inspection** → pick a mine zone (e.g., "Gallery 4 East") → assign a Field Inspector.
4. This inspection now appears on that inspector's mobile app.

### Step B — Review the case (after Inspector submits)
5. Once the inspector finishes and submits their report, the Mine Official opens the **Risk Card** for any flagged hazard.
6. If it's serious, click **Create Corrective Action** → assign it to a Contractor with a deadline (e.g., 24 hours).

### Step C — Close the case (after Contractor fixes it)
7. Once the Contractor marks the work complete and uploads evidence photos, the Mine Official reviews it in the **Action Lifecycle Kanban**.
8. If the fix looks good, click **Sign Off / Close**. If not, reject it — it goes back to the contractor with a reason.

### Other things they manage:
- **Labour Register** (`/labour`) — register workers once, log daily attendance, review violations.
- **Worker Master Directory** — add/edit/deactivate workers.

---

## ROLE 3 — Field Inspector
**Login:** `inspector1@mine.in` (or `inspector.singh@intellifusion.com`)
**Works from the Mobile App, often underground with no signal.**

### What they do:
1. Log in to the **Mobile App**.
2. Open the inspection the Mine Official assigned to them (see it under **My Inspections**).
3. Tap **Start Inspection** → status changes to "In Progress."
4. Walk the site. For every hazard found, tap **New Observation**:
   - Pick a category (Safety / Environment / Labour / Production).
   - Type a description.
   - Attach a photo, capture GPS/beacon location.
   - Choose **Auto (AI)** scoring or **Manual Override** scoring.
   - Save — this works **fully offline**, even with zero signal.
5. Once every hazard on the walk is logged, tap **Submit Inspection Report**.
   - If there were zero observations, the app requires a signed statutory note before it'll let them submit.
6. When they walk back into signal range, everything they logged automatically syncs to the server in the background.

### Where they stop:
Once submitted, it's out of their hands — it goes to the Mine Official for review.

---

## ROLE 4 — Contractor
**Login:** `contractor1@mine.in` (or `contractor.apex@intellifusion.com`)
**Only sees work specifically assigned to them — nothing else.**

### What they do:
1. Log in (Web or Mobile).
2. Go to their **Work Queue** — a list of corrective actions assigned to them by a Mine Official.
3. Open one, read what needs fixing and the deadline.
4. Do the physical repair work.
5. Come back to the app, upload **before/after evidence photos**, and mark **Work Complete**.
6. If the Mine Official rejects the submission, it reappears in their queue with a rejection reason — they fix it again and resubmit.

### Where they stop:
They have no visibility into anything beyond their own assigned actions — no labour data, no other contractors' work, no full inspection history.

---

## ROLE 5 — Corporate Manager
**Login:** `corporate1@mine.in` (or `corporate@intellifusion.com`)
**Read-only, big-picture view. Doesn't participate in the case chain — just watches it.**

### What they do:
1. Log in to the **Web Dashboard**.
2. Go to the **Corporate Overview** — see safety KPIs, hazard trends, and compliance status across **every mine site**, not just one.
3. Use **Trend Analytics** to see which zones or contractors have recurring problems across the whole company.
4. Use this to make company-wide decisions — but they don't schedule inspections, assign work, or close cases themselves.

---

## ROLE 6 — Regulator (DGMS)
**Login:** `regulator@dgms.gov.in` (or `regulator.dgms@intellifusion.com`)
**The external auditor. Comes in after the fact, checks everything is legitimate.**

### What they do:
1. Log in to the **Web Dashboard**.
2. Go to **Audit Ledger** → click **Verify Blockchain Integrity** — the system recalculates the SHA-256 hash chain and confirms nothing has been tampered with.
3. Review observations and see, at a glance, which ones were **AI-scored**, which were **Manual Overrides** (with the inspector's justification), and which hit the **DGMS Safety Floor**.
4. Go to **Reports** → download the official monthly DGMS statutory PDF return.
5. Check the **Labour Register** for any statutory violations across mines (overtime, rest-period breaches).

### Where they stop:
They never create or edit anything — purely read, verify, and export.

---

## Quick Reference: Where Does Each Role Log In and Start?

| Role | Platform | First Screen After Login |
|---|---|---|
| Super Admin | Web Dashboard | User Management |
| Mine Official | Web Dashboard | Inspections (to schedule) or Risk Cards (to review) |
| Field Inspector | Mobile App | My Inspections |
| Contractor | Web or Mobile | Work Queue |
| Corporate Manager | Web Dashboard | Corporate Overview |
| Regulator | Web Dashboard | Audit Ledger |

---

## One Case, Start to Finish (Example)

1. **Mine Official** schedules an inspection for Gallery 4 East, assigns Inspector Singh.
2. **Field Inspector** (Singh) walks Gallery 4, finds loose strata, logs it as an observation, AI scores it 0.85 HIGH, submits the inspection.
3. **Mine Official** sees the high-risk observation, creates a corrective action, assigns Contractor Apex with a 24-hour deadline.
4. **Contractor** (Apex) fixes the strata issue, uploads before/after photos, marks it complete.
5. **Mine Official** reviews the photos, signs off, case closed.
6. **Corporate Manager** later sees this incident reflected in the mine's safety trend chart.
7. **Regulator** later audits the month's records, sees this case's full trail — AI score, corrective action, contractor evidence, sign-off — all cryptographically verified as untampered.

That's the whole loop, repeated for every hazard found across every mine.
