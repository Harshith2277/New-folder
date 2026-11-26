<<<<<<< HEAD
# Scheme
hello!!
=======
# SchemeSaathi: Indian Government Welfare Eligibility & Governance Platform

A full-stack hackathon prototype built with **React (Vite)** on the frontend and **Node.js (Express)** on the backend, connected via persistent REST APIs and SQLite database storage.

> **Hackathon Safety & Integrity Notice**: All citizen profiles and document vault syncs represent synthetic mock data. Welfare scheme feeds are strictly filtered to authorized `.gov.in` and `.nic.in` domains. No real external government endpoints or DigiLocker servers are queried.

---

## Architecture & Upgraded Capabilities

### 1. Database-Backed Authentication (`users` table)
- **Hashed Passwords**: Password hashing via `crypto.scryptSync` with cryptographic salt.
- **Roles**: Distinct role handling for `CITIZEN` and `OFFICER`.
- **Endpoints**:
  - `POST /api/auth/register`: Creates new user account in database.
  - `POST /api/auth/login`: Authenticates credentials against database password hash.
  - `GET /api/auth/me`: Retrieves current profile data.

### 2. Ingestion & Strict Indian Government Filter (`schemeSync.js`)
- Feeds configured via `GOV_SCHEME_FEEDS` in `.env`.
- **Domain Verification**: Strictly allows only `.gov.in`, `.nic.in`, or designated state/central portals (e.g. `pminternship.mca.gov.in`, `scholarships.gov.in`, `sevasindhu.karnataka.gov.in`, `mahaswayam.gov.in`).
- **State & New Badges**: Ingests `state` (e.g., Karnataka, Maharashtra, All-India) and `isNew` flags.
- **Automatic Background Sync**: Periodic background timer runs every 6 hours (`SYNC_INTERVAL_MS=21600000`).

### 3. Upgraded Deterministic Rule Engine (`ruleEngine.js`)
- **No `eval()`**: Pure declarative AST evaluation of `all`, `any`, and operators (`==`, `!=`, `<`, `>`, `<=`, `>=`).
- **Actionable "How to Qualify" Remediation**: Returns specific step-by-step guidance alongside failure reasons (e.g., income limits, employment exchanges, age thresholds).
- **Document Expiry & Renewal Guidance**: Compares document `expiryDate` against the target `evaluationDate`. Detects expired certificates and gives step-by-step renewal instructions (e.g., Tahsildar / Nadakacheri fiscal year renewal).
- **Eligible First Sorting**: Automatically sorts schemes so eligible matches appear at the top, followed by near-misses.

### 4. PDF Document Uploads (`pdfUploadHelper.js`)
- **Node-Native Multipart Parser**: Validates `%PDF` file signatures and `.pdf` extensions.
- Persists uploaded files in `backend/uploads/` and logs metadata in the `documents` table (`issueDate`, `expiryDate`, file size).

### 5. Application Management with Editing
- `POST /api/applications`: Submits application locked to the active rule version.
- `PUT /api/applications/:id`: Allows editing submitted/in-review applications with **automatic re-evaluation strictly against the historical locked rule version**.
- `PATCH /api/applications/:id/status`: Transitions status (`SUBMITTED` -> `UNDER_REVIEW` -> `APPROVED` / `REJECTED`) with officer remarks.

### 6. Temporal Rule Versioning Demo Scenario (`PM-YUVA-INTERN`)
- **Version 1** (eff. `2024-10-01`): Max Age `<= 24`.
- **Version 2** (eff. `2026-06-01`): Max Age amended to `<= 28`.
- Test citizen profile with Age `26`:
  - Quick button 1 (`2026-05-15`): **Not Eligible** under v1 (Age 26 > 24).
  - Quick button 2 (`2026-06-15`): **Eligible** under v2 (Age 26 <= 28).

---

## How to Install & Run

### Prerequisites
- Node.js (v18+)
- npm

### 1. Start the Backend API Server
```bash
cd backend
npm install
npm start
```
*Backend runs on `http://localhost:5000`.*

### 2. Start the Frontend Dev Server
In a separate terminal window:
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register citizen or officer account |
| `POST` | `/api/auth/login` | Login and authenticate against password hash |
| `GET` | `/api/schemes` | Fetch schemes (supports `?isNew=1` and `?state=Karnataka`) |
| `POST` | `/api/schemes/sync` | Manually trigger verified Indian government feed ingestion |
| `POST` | `/api/eligibility/check` | Evaluates eligibility, document readiness & expiry |
| `POST` | `/api/eligibility/alternatives` | Ranks alternative schemes when ineligible |
| `POST` | `/api/documents/upload` | Upload PDF certificate with issue and expiry dates |
| `GET` | `/api/documents` | Retrieve user documents from wallet |
| `POST` | `/api/applications` | Submit application locked to active rule version |
| `GET` | `/api/applications` | List applications (role-filtered) |
| `PUT` | `/api/applications/:id` | Edit application and re-verify against locked version |
| `PATCH` | `/api/applications/:id/status` | Update review status and officer remarks |
| `GET` | `/api/audit-logs` | Retrieve immutable officer audit trail |
>>>>>>> acfaec3 (okey)
