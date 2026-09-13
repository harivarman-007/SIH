# Antigravity Continuation Prompt — Placeholder Fixes & Session Handoff Protocol

**Project:** Intellifusion — SIH26024
**Repo:** https://github.com/harivarman-007/SIH.git (`main`)
**This prompt is self-contained.** It may be handed to a fresh Antigravity session on a different account with zero memory of prior conversations. Everything you need to orient yourself and behave correctly is in this document — do not assume a prior session's reports were accurate. Verify.

---

## 0. If You Are a Fresh Session Picking This Up

Before writing or changing anything:

1. `git pull origin main` and read the actual current state — do not trust this document's description of "what exists" over what's actually in the repo right now. This document was accurate at time of writing; the repo may have moved since.
2. Read `plan.md`, `task.md`, and `ROADMAP.md` in full.
3. **Do not trust any `[x]` checkmark in `task.md` at face value.** This project has a documented history of checkmarks being marked complete without verification, and of an entire commit adding silently fabricated fake data that looked like real functionality. Spot-check at least one claim yourself (run a test script, read the actual file) before proceeding, the same way you'd want your own future work checked.
4. State clearly, in your first response, what you found — confirm or correct this document's "Current Known State" (Section 1) against the real repo before starting new work.
5. The owner will be switching between multiple accounts/sessions to manage usage limits. **Treat every session as if it might be your only turn.** Commit and update `task.md` after every meaningful step, not just at the end of a phase — a session can end at any point and the next one (possibly you, possibly not) needs to resume from an accurate, granular state, not guess what was finished.

---

## 0.5 Standing Rules (apply for the entire remaining project, every session)

- **No UI/visual/color/layout/animation/component decision without asking the owner first, every time.** This applies even if a previous session already built something that looks like a UI decision — if it wasn't explicitly approved by the owner in conversation, treat it as provisional and ask before extending or theming it further.
- **No auto-browsing, no automatic screenshots**, ever, unless explicitly asked in that session.
- **No fabricated or decorative fake data, anywhere, ever** — not as a fallback, not as a demo convenience, not as a "looks more complete" placeholder. If a number, sensor reading, or record isn't backed by a real data source, either wire it to a real one or clearly and visibly label it as illustrative/placeholder in the UI itself. Silent fabrication was already caught and reverted once in this project (see commit `94112b2`) — it must not recur in a different form.
- **Never mark a `task.md` item done without actually running/verifying it.** Paste real output (test results, build output, actual screen state) — not a summary claiming success.
- **If you get interrupted, stall, hit a blocker, or run low on context/tokens, say so explicitly and leave `task.md` in an accurate, granular state** — do not let a future session discover unfinished work that was marked finished.

---

## 1. Current Known State (verified by the owner as of this writing — re-verify before trusting)

Confirmed working and real:
- Backend RBAC (6 roles), fail-closed scoping, audit hash-chain with row locking — all independently re-run, tests pass (82/82 across 4 suites).
- Dashboard production build is clean (0 TypeScript errors after the `dashboard/src/lib` `.gitignore` fix).
- Mobile offline capture + LAN sync — actually run once on a physical Android device, verified live (see commit `6f890ed`).
- OCR backend pipeline (Tesseract, English + Hindi, confidence-based routing) — real and tested.

Confirmed broken or placeholder (found by direct code inspection, this session's job is to fix these):

| # | Problem | Exact Location | Evidence |
|---|---|---|---|
| 1 | No real login screen. App auto-logs in as `mine_official`; role switching is a dropdown using hardcoded demo credentials (including plaintext passwords) shipped in the frontend bundle. | `dashboard/src/store/authStore.ts` (`DEMO_CREDENTIALS` object) | Backend RBAC is genuinely enforced once a JWT exists — but there is no real credential-entry gate at all. |
| 2 | Map shows fabricated "sensor" data with no backing source — methane ppm, ventilation velocity, and baseline risk are hardcoded static values per mine site, never fed by any sensor or API. | `dashboard/src/components/MineMap.tsx` (`MINE_SITES` array — `methanePpm`, `ventilationVelocity`, `baselineRisk` fields) | These were never part of any planning document's scope — no IoT/sensor integration was ever designed. They are decorative and currently indistinguishable from real telemetry. |
| 3 | OCR review screen shows a random stock photo instead of the actual scanned document, and several fields are hardcoded regardless of the real record. | `dashboard/src/components/OcrQueueView.tsx` (`mapOcrItemToReport` function — `scannedImageUrl` is a hardcoded Unsplash URL; `mineSite`, `location`, `shift`, `severity`, `category` are hardcoded literals) | This breaks the actual function of the screen: a reviewer cannot visually verify OCR output against the real document. |
| 4 | No automated alerts, reminders, or notifications exist anywhere — frontend or backend. Escalation logic exists but nothing triggers it automatically and nothing notifies anyone when it fires. | Searched entire repo — zero alert/notification/email/SMS/push/WebSocket files exist. `POST /observations/escalate-overdue` must be called manually. | The official problem statement explicitly requires "automated alerts, reminders, compliance reports, and escalation mechanisms" — this is a directly named, currently unmet requirement, not incidental polish. |

---

## 2. Required Fixes

### 2.1 Real Authentication (fixes #1)
- Replace the auto-login-as-`mine_official` behavior with an actual login form (email + password fields, real submit).
- The role-switcher dropdown can stay **for demo convenience only**, but must be visibly and explicitly labeled as a demo/testing tool (e.g., "Demo Persona Switcher — for evaluation only") — never presented as if it's the real login flow, and never left as the default landing experience.
- Do not hardcode passwords in a way that's indistinguishable from a real credential — if demo accounts remain for convenience, that's fine, but the UI must make clear these are seeded demo identities, not real user accounts.
- **This touches UI — ask the owner before building the login screen's look.** Functional requirement only from this document: real form, real submit, honest labeling of the demo switcher.

### 2.2 Remove or Honestly Label Fabricated Map Data (fixes #2)
- Either (a) remove `methanePpm`, `ventilationVelocity`, and `baselineRisk` entirely from the map if there's no real data source for them, or (b) keep them but add a clearly visible "Illustrative — not live sensor data" label directly on the map UI wherever they're shown.
- Do not present static numbers as if they update or reflect real conditions.
- **Ask the owner which option (remove vs. label) they prefer before implementing — this is a product-honesty decision, not just a coding task.**

### 2.3 Fix the OCR Review Screen (fixes #3)
- `scannedImageUrl` must show the actual uploaded/scanned document image, not a stock photo. Check what the backend `/ocr/queue` endpoint actually returns for the document — if the real image isn't currently being returned/stored and served, that's a backend gap to close too (check `backend/app/ocr/engine.py` and the review queue schema for whether the original image is persisted and retrievable).
- Replace hardcoded `mineSite`, `location`, `shift`, `severity`, `category` with the real values from the actual observation/document record. If any of these fields genuinely don't exist in the data model yet, say so explicitly rather than hardcoding a plausible-looking placeholder — ask the owner whether to add the field or drop it from the UI.

### 2.4 Build a Minimal Real Alert Mechanism (fixes #4)
This is new functionality, not a fix to existing code — scope it minimally for an SIH MVP, not a full notification platform:
- Add a real scheduler (APScheduler is sufficient — no need for Celery/cron infrastructure) that calls the escalation logic automatically on an interval (e.g., every 15–30 minutes) instead of requiring a manual API call.
- When an observation is auto-escalated, create a real, queryable "alert" record (a simple table is enough: recipient role/user, observation reference, message, created_at, read/unread state) rather than nothing at all.
- Surface these alerts somewhere real in the dashboard (a notification count/badge is enough for MVP — **ask the owner about the actual visual treatment before building it**, this document only specifies that the underlying alert data and delivery mechanism must be real).
- Do not fabricate alert counts or sample alerts — every alert shown must trace back to a real escalation event.

---

## 3. Design Checkpoints (do not skip, do not fabricate a "conversation completed" checkmark)

Stop and ask the owner, in this exact session, before writing any UI for:
- The real login screen (Section 2.1)
- The map's illustrative-data labeling, if the owner picks the "label" option over "remove" (Section 2.2)
- The OCR screen's corrected field layout, once feeding real data (Section 2.3)
- The alert/notification badge or panel's visual treatment (Section 2.4)

If a prior session already claimed one of these checkpoints happened, verify it actually did by checking for an actual owner response in the conversation, not just a checkmark — this project has a documented instance of a fabricated checkpoint pass. When in doubt, ask again rather than assume.

---

## 4. Phase Plan

| Phase | What | Checkpoint |
|---|---|---|
| 18 | Verify Section 1's claimed current state against the real repo (mandatory first step for a fresh session) | State the actual findings before proceeding |
| 19 | Fix #1 — real login screen (function first, then design checkpoint) | Owner confirms login flow before/after implementation as appropriate |
| 20 | Fix #2 — map data decision + implementation | Owner picks remove-vs-label before coding |
| 21 | Fix #3 — real OCR document image + real field data (check backend image storage first) | Confirm the real image actually displays, screenshot-free verification via description of what's rendered |
| 22 | Fix #4 — real scheduler + real alert records + minimal surfacing | Confirm an alert is actually generated by a real escalation event, not seeded fake data |
| 23 | Full regression: re-run all 4 existing test suites (82 tests) + a fresh Phase-7-style end-to-end walkthrough to confirm nothing broke | Paste real output |

One phase at a time. Update `task.md` granularly within each phase, not just at the end — assume the session may end before the phase completes.

---

## 5. Note on Multi-Session/Multi-Account Handoff

The owner is switching between accounts to manage usage limits. Practical implications for you as an agent:
- Do not assume continuity of reasoning from a "previous you" — you may be a completely different session with no memory of any prior conversation, including the one that produced this document.
- Everything you need is either in this document or in the repo's own files (`plan.md`, `task.md`, `ROADMAP.md`, git history). If something seems ambiguous or missing, say so and ask — don't invent a plausible-sounding continuation.
- Before ending your turn/session for any reason (task complete, blocked, or running low on context), leave a clear, honest note in `task.md` about exactly what's done, what's in progress, and what the next session needs to know — written as if explaining it to a stranger, because that's exactly what the next session will be.
