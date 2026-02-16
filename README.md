# PHTS-Public-Health-Talent-System (Currently under development.)

PHTS (Position Allowance for Special Duties) is a full‑stack system for managing eligibility requests, approvals, and monthly payroll calculation for P.T.S. allowances at Uttaradit Hospital.

This README is intentionally detailed so anyone joining the project can understand how the repo is structured, how to run the system locally, and how the workflows are organized.

---

## 1) What This System Does

### Core workflows

1. **Request Workflow (Eligibility Requests)**
   - Users submit P.T.S. requests with attachments
   - Approvals happen in multiple steps (HEAD_WARD → HEAD_DEPT → PTS_OFFICER → HEAD_HR → HEAD_FINANCE → DIRECTOR)
   - Approved requests become official eligibility records

2. **Monthly Workflow (Payroll Cycle)**
   - PTS_OFFICER creates a payroll period
   - System calculates results (leave rules, licenses, retroactive adjustments)
   - HR / Finance / Director approvals complete the cycle
   - Period is locked (snapshot) for reporting

---

## 2) Roles & Permissions (High-Level)

- **USER**: Submit requests, track status
- **HEAD_WARD**: Approve in unit scope
- **HEAD_DEPT**: Approve in department scope
- **PTS_OFFICER**: Verify documents, run calculations, manage periods
- **HEAD_HR**: HR review of periods
- **HEAD_FINANCE**: Budget review of periods
- **DIRECTOR**: Final approval
- **FINANCE_OFFICER**: Export/reporting (read‑only)
- **ADMIN**: System admin tasks

---

## 3) Repository Structure

```
phts-project/
├─ backend/                  # Express + TypeScript API
│  ├─ src/
│  │  ├─ modules/            # Domain modules (request, payroll, data-quality, ...)
│  │  ├─ middlewares/        # Auth, validation, error handling
│  │  ├─ shared/             # Utilities, shared helpers
│  │  └─ index.ts            # App entry
│  ├─ scripts/               # Backend scripts and jobs
│  ├─ uploads/               # File uploads (gitkept)
│  ├─ .env.example
│  └─ package.json
│
├─ frontend/                 # Next.js (App Router)
│  ├─ src/
│  │  ├─ app/                # Routes/pages
│  │  ├─ components/         # Shared UI components
│  │  ├─ features/           # API wrappers + hooks per domain
│  │  ├─ theme/              # Theme and styles
│  │  └─ types/              # Global UI types
│  ├─ public/
│  ├─ next.config.ts
│  └─ package.json
│
├─ scripts/                  # Workspace scripts
└─ package.json              # Root scripts
```

---

## 4) Quick Start

### Step 1 — Install all dependencies

```
cd phts-project
npm run install:all
```

### Step 2 — Environment configuration

- Backend: `backend/.env`
- Frontend: `frontend/.env.local`
- Example file: `backend/.env.example`

Typical env keys:

- DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
- JWT_SECRET
- REDIS_HOST, REDIS_PORT (if enabled)
- NEXT_PUBLIC_API_URL (frontend)

### Step 3 — Run dev (backend + frontend)

```
cd phts-project
npm run dev:all
```

### Step 4 — Build all

```
cd phts-project
npm run build:all
```

---

## 5) Root Scripts (package.json)

- `npm run install:all` — install backend + frontend deps
- `npm run dev:all` — run backend + frontend together
- `npm run build:all` — build backend + frontend

---

## 6) Documentation

- System design + workflows: `../docs/` (workspace root)

---

## 7) Team Conventions

- Keep domain logic inside the correct module
- camelCase for API/services
- PascalCase for React components
- Never commit secrets or real credentials
- Keep `.env` local only

---

More details:

- Backend: `backend/README.md`
- Frontend: `frontend/README.md`
