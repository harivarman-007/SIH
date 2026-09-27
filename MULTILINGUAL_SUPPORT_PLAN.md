# MINEGOV-AI — Multilingual Support Plan (English + Sanskrit + 6 Indian Regional Languages)

**Repo analyzed:** `harivarman-007/SIH` (MINEGOV-AI — AI-Based Smart Governance & Compliance Monitoring System for Coal Mines, SIH26024)

This document specifies how to add **8 languages** to the dashboard, mobile app, and OCR pipeline:
- **English** — the system's existing major/primary language (already the UI default; kept as the top-level fallback and the language every other translation is authored against).
- **Sanskrit** — added as a classical/official Indian language (8th Schedule), used for formal statutory/regulatory document headers and DGMS-style official terminology.
- **6 Indian regional languages** — chosen based on the states with the **highest coal mining activity**, since that is where the majority of field inspectors, mine officials, and contractors using this system are located.

---

## 1. The 8 languages — 2 major/system languages + 6 mapped to coal-producing states

India's coal output is concentrated in a handful of states (Coal India Ltd. subsidiaries + captive/commercial mines). Mapping the top coal-bearing regions to their dominant spoken language gives 6 regional languages, plus 2 languages that sit above the regional layer as system-wide majors:

| # | Language | Script | Role in this system | Primary Coal-Mining State(s) / Coalfield | Notes |
|---|----------|--------|----------------------|---------------------------------------------|-------|
| — | **English** | Latin | **Major/primary language** — existing UI default, top-level fallback, and the source language every other translation is authored from | All states (Corporate/Regulator roles, cross-state reporting) | Already fully implemented today; stays as `DEFAULT_LANGUAGE` |
| — | **Sanskrit** | Devanagari | **Major/official language** — used for formal statutory headers, certificate/report titles, and official terminology (e.g. DGMS-style formal phrasing), independent of any one mine's state | 8th Schedule official language; not tied to a specific coalfield | Optional "formal register" language, offered system-wide rather than derived from mine location |
| 1 | **Hindi** | Devanagari | Regional (state-derived) | Jharkhand, Madhya Pradesh, Chhattisgarh (Hindi belt) — Jharia, Bokaro, Dhanbad, Singrauli, Korba (SECL) | Largest single-language coverage across CCL, SECL, NCL command areas |
| 2 | **Bengali** | Bengali | Regional (state-derived) | West Bengal — Raniganj, Asansol (ECL) | Oldest coal-mining belt in India |
| 3 | **Odia** | Odia | Regional (state-derived) | Odisha — Talcher, IB Valley (MCL) | Odisha holds India's **largest coal reserves** of any state |
| 4 | **Telugu** | Telugu | Regional (state-derived) | Telangana — Singareni Collieries (SCCL) | Only state-run coal company outside Coal India |
| 5 | **Marathi** | Devanagari (Marathi) | Regional (state-derived) | Maharashtra — Chandrapur, Nagpur (WCL) | Major Western Coalfields Ltd. command area |
| 6 | **Santali** | Ol Chiki | Regional (state-derived) | Jharkhand / West Bengal / Odisha tribal belt — cuts across Jharia, Raniganj, Talcher tribal workforce | Largest tribal (Adivasi) language among mine-adjacent labour, an official 8th Schedule language |

This set deliberately goes **beyond just "Hindi across all mines"** and includes Santali because a large share of on-ground contract labour and field-level workers in Jharkhand/Odisha/WB coal belts are Santhal-speaking, and the existing `README.md` already flags **multilingual OCR (English + Hindi)** and a **roadmap item for Bengali/Odia voice ingestion** (see `SYSTEM_ARCHITECTURE_AND_ROADMAP.md`, Feature 4) — so this plan extends work already scoped, rather than introducing a new direction. English and Sanskrit are kept conceptually separate from the 6 regional languages because neither is *derived* from a mine's state — English is the cross-cutting default for Corporate/Regulator roles who work across multiple states, and Sanskrit is offered as an optional formal register for official documents rather than a spoken-at-site language.

### Language priority order (for phased rollout)
`en (existing, major/default) → hi (existing, OCR only today) → bn → or → te → mr → sat → sa (Sanskrit, formal-register, lowest priority)`

---

## 2. Current state of the repo (what already exists)

| Area | Current support | File(s) |
|---|---|---|
| OCR | English + Hindi only, via Tesseract `lang` param | `backend/app/ocr/engine.py` (`lang: str = "eng"`, docstring: `'eng', 'hin', 'eng+hin'`) |
| Dashboard UI | English-only, no i18n library in `package.json` | `dashboard/src/**` |
| Mobile UI | English-only, no i18n library in `package.json` | `mobile/src/**` |
| Settings screen | Exists on dashboard only | `dashboard/src/components/SystemSettingsView.tsx` |
| Mobile settings | **No dedicated settings/profile screen exists** — needs to be added | `mobile/src/screens/*` (only `ActionsScreen`, `DashboardScreen`, `InspectionsScreen`, `LabourAttendanceScreen`, `LoginScreen`, `NewObservationScreen`, `QueueScreen`, `RiskCardScreen`) |
| Mine site location data | `MineSite` model has `location_name`, `lat`, `lng` but **no `state` field** | `backend/app/models/__init__.py` (`class MineSite`) |
| User model | No `preferred_language` field yet | `backend/app/models/__init__.py` (`class User`) |

**Conclusion:** this is a greenfield feature — no i18n library is installed anywhere yet. The plan below adds it cleanly on top of the existing FastAPI + React + React Native (Expo 51) stack.

---

## 3. Language auto-selection logic (the "depends on where the mine is" part)

Add a `state` column to `mine_sites`, and derive/default a user's language from **their assigned mine site's state**, while still letting them override it manually.

```
state -> default_language mapping (backend constant)

Jharkhand       -> hi   (with sat as selectable secondary)
Madhya Pradesh  -> hi
Chhattisgarh    -> hi
West Bengal     -> bn
Odisha          -> or
Telangana       -> te
Maharashtra     -> mr
(any other)     -> en  (fallback)
```

Resolution order at login / app start:
1. If `User.preferred_language` is explicitly set → use it (this is how a user opts into **Sanskrit**, since it is never auto-derived from a mine site).
2. Else derive from `User.mine_site.state` using the mapping above.
3. Else fall back to `en` (English — the system's major/default language).

---

## 4. Backend changes (FastAPI / PostgreSQL)

### 4.1 Schema changes (new Alembic migration)
- `mine_sites.state` — `String(64)`, nullable, backfilled from `location_name` where possible.
- `users.preferred_language` — `String(8)`, nullable, one of `en|sa|hi|bn|or|te|mr|sat`, default `NULL` (falls back to state-derived language, or `en` if no state mapping applies).

```python
# backend/alembic/versions/xxxx_add_language_support.py
def upgrade():
    op.add_column("mine_sites", sa.Column("state", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("preferred_language", sa.String(8), nullable=True))

def downgrade():
    op.drop_column("users", "preferred_language")
    op.drop_column("mine_sites", "state")
```

### 4.2 New constants module
`backend/app/config.py` (or a new `backend/app/i18n/constants.py`):

```python
# "en" and "sa" are system-wide majors (not derived from a mine site);
# the rest are regional languages resolved via STATE_LANGUAGE_MAP.
SUPPORTED_LANGUAGES = ["en", "sa", "hi", "bn", "or", "te", "mr", "sat"]

STATE_LANGUAGE_MAP = {
    "Jharkhand": "hi",
    "Madhya Pradesh": "hi",
    "Chhattisgarh": "hi",
    "West Bengal": "bn",
    "Odisha": "or",
    "Telangana": "te",
    "Maharashtra": "mr",
}
DEFAULT_LANGUAGE = "en"   # major/primary language, used whenever no state mapping or explicit preference exists
FORMAL_REGISTER_LANGUAGE = "sa"  # Sanskrit — opt-in only, used for formal/statutory document rendering
```

### 4.3 API surface
- `GET /users/me` → include `preferred_language` and `resolved_language` (computed via the rule in §3).
- `PATCH /users/me/language` → body `{ "language": "bn" }` (or `"sa"` / `"en"`), validated against `SUPPORTED_LANGUAGES`.
- `GET /mine-sites/{id}` → include `state`.
- `GET /reports/{id}?formal=true` (or similar report/PDF endpoints) → when the requester's language is `sa`, render statutory headers/titles in Sanskrit while keeping the observation body text in the user's actual working language, since Sanskrit is a formal-register overlay, not a full conversational UI language.

### 4.4 OCR engine extension (`backend/app/ocr/engine.py`)
Tesseract language-pack codes needed (these differ from the app's UI language codes):

| UI code | Language | Tesseract `traineddata` code |
|---|---|---|
| `en` | English | `eng` (already installed) |
| `sa` | Sanskrit | `san` |
| `hi` | Hindi | `hin` |
| `bn` | Bengali | `ben` |
| `or` | Odia | `ori` |
| `te` | Telugu | `tel` |
| `mr` | Marathi | `mar` |
| `sat` | Santali (Ol Chiki) | `sat` |

- Extend the `lang` parameter's allowed values and update the docstring.
- Install the corresponding `.traineddata` files in the Docker image: update `backend/Dockerfile` to `apt-get install -y tesseract-ocr-hin tesseract-ocr-ben tesseract-ocr-ori tesseract-ocr-tel tesseract-ocr-mar tesseract-ocr-sat tesseract-ocr-san` (`eng` ships by default).
- Default OCR language per request can be inferred from the uploading user's `resolved_language`, same as UI, so a Field Inspector at a Jharkhand mine gets Hindi OCR by default without extra taps.
- Sanskrit OCR (`san`) is a low-traffic path in practice — mainly useful if a scanned statutory document happens to carry Sanskrit shlokas/headers (e.g. government letterheads) — so it can be deprioritized to Phase E rather than shipped alongside the 6 regional packs in Phase B.

---

## 5. Dashboard changes (React 18 + Vite + TypeScript)

### 5.1 Library
```bash
cd dashboard
npm install i18next react-i18next i18next-browser-languagedetector
```
(All compatible with the existing `react@^18.3.1`.)

### 5.2 File structure to add
```
dashboard/src/i18n/
  index.ts                 # i18next.init(), language detector config
  locales/
    en/common.json         # major/default — source of truth for all keys
    sa/common.json         # Sanskrit — formal strings only (titles/headers), falls back to en for the rest
    hi/common.json
    bn/common.json
    or/common.json
    te/common.json
    mr/common.json
    sat/common.json
```

### 5.3 Integration points
- `dashboard/src/App.tsx` — wrap root with `I18nextProvider`.
- `dashboard/src/components/SystemSettingsView.tsx` — add a **"Language"** section with a dropdown listing all 8 languages (English and Sanskrit pinned at the top as "System languages", the 6 regional ones below as "Regional languages"), calling `PATCH /users/me/language` and `i18n.changeLanguage()`.
- `dashboard/src/components/Sidebar.tsx` / `LoginForm.tsx` — replace hardcoded English strings with `t("key")` calls incrementally, starting with the highest-traffic screens: `LoginForm`, `Sidebar`, `ObservationTable`, `ComplianceReportsView`.
- On login success, call `i18n.changeLanguage(resolved_language)` using the value returned from `GET /users/me`.

### 5.4 Font/script handling
Devanagari (Hindi, Marathi, **and Sanskrit**), Bengali, Odia, Telugu, and Ol Chiki (Santali) all need proper web font fallbacks. Add to `dashboard/tailwind.config.js` / global CSS:
```css
@font-face { font-family: 'NotoSansMultiIndic'; src: local('Noto Sans'), url(...); }
body { font-family: 'Inter', 'NotoSansMultiIndic', sans-serif; }
```
Use **Noto Sans Devanagari / Bengali / Oriya / Telugu / Ol Chiki** (Google Noto family covers all 6 non-Latin scripts here, including Santali's Ol Chiki, which most font stacks omit). Sanskrit reuses the same Noto Sans Devanagari font as Hindi/Marathi — no separate font is required.

---

## 6. Mobile app changes (React Native + Expo 51)

### 6.1 Library
```bash
cd mobile
npx expo install expo-localization
npm install i18next react-i18next
```

### 6.2 File structure to add
```
mobile/src/i18n/
  index.ts                 # i18next.init() using expo-localization for device default
  locales/
    en.json                # major/default
    sa.json                # Sanskrit — formal strings only, low priority on mobile (see §7)
    hi.json
    bn.json
    or.json
    te.json
    mr.json
    sat.json
```

### 6.3 Integration points
- **New screen required:** `mobile/src/screens/SettingsScreen.tsx` (does not currently exist) — add a language picker here, plus wire it into navigation and `BottomNavBar.tsx` (currently a 5-tab bar: Home | Inspections | + New | Actions | Sync — either add a 6th icon or nest Settings under a profile menu on `DashboardScreen.tsx`).
- `mobile/src/screens/LoginScreen.tsx` — after successful login, persist `resolved_language` from the API response into the Zustand store and call `i18n.changeLanguage(...)`.
- Since the app is **offline-first** (SQLite queue, per `README.md`), bundle all 7 language JSON files into the app binary at build time — do **not** fetch them from the network, so language switching works underground with zero connectivity.
- Field-facing screens to translate first (highest priority, used by Field Inspectors in mine galleries): `NewObservationScreen.tsx`, `InspectionsScreen.tsx`, `QueueScreen.tsx`, `ActionsScreen.tsx`.

---

## 7. Rollout phasing

| Phase | Scope | Depends on |
|---|---|---|
| **Phase A** | DB migration (`state`, `preferred_language`) + backend language-resolution API (incl. `en`/`sa` as majors) | none |
| **Phase B** | OCR engine: add `ben`, `ori`, `tel`, `mar`, `sat` Tesseract packs (the 6 regional priorities) | Phase A (Dockerfile) |
| **Phase C** | Dashboard i18n scaffolding + Settings language switcher (all 8 languages) + translate top 5 screens into `en`/`hi`/`bn`/`or`/`te`/`mr`/`sat` | Phase A |
| **Phase D** | Mobile i18n scaffolding + new Settings screen + translate 4 field-facing screens (same 7 languages as Phase C) | Phase A |
| **Phase E** | Full string coverage across remaining dashboard/mobile screens + QA pass with native speakers per script **+ Sanskrit (`sa`) formal-register strings and `san` OCR pack, added last since it's opt-in rather than state-derived** | Phase C, D |

---

## 8. Open decisions for the team

1. **Chhattisgarhi vs. Hindi** — Chhattisgarh is India's #1 coal-producing state by volume, but Chhattisgarhi is not a Tesseract-supported OCR language and is mutually intelligible with Hindi for most field use; recommend shipping Hindi there and revisiting Chhattisgarhi as a Phase F stretch goal.
2. Whether `preferred_language` should be a **per-user** setting only, or also configurable **per-mine-site** as an org-wide default (useful for Corporate Manager / Regulator roles who view multiple mines).
3. Voice-to-report ingestion (`SYSTEM_ARCHITECTURE_AND_ROADMAP.md`, Feature 4) already names Hindi/Bengali/Odia as targets — this plan's language list should stay the single source of truth so that feature and this one don't diverge.
4. **Scope of Sanskrit** — recommend keeping it strictly to formal/statutory document rendering (titles, certificate headers, DGMS-style official phrasing) rather than a full conversational UI translation, since it is not a day-to-day spoken language for any user role in this system. If the team instead wants full Sanskrit UI coverage, treat it as equivalent effort to one more regional language and fold it into Phase C/D rather than Phase E.
5. **English's role** — since English is already the fully-implemented default today, "adding" it here mainly means formalizing it in `SUPPORTED_LANGUAGES` as the canonical source-of-truth language that every `hi`/`bn`/`or`/`te`/`mr`/`sat`/`sa` translation file is diffed against, and making sure it remains explicitly selectable (not just an implicit fallback) in the language switcher UI.
