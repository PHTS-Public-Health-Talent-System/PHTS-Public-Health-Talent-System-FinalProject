# PHTS Backend

Express + TypeScript API for the P.T.S. system.

This document is deliberately detailed to reflect the real system design and to help onboarding new engineers quickly.

---

## 1) Architecture Overview

The backend is organized into domain modules inside `src/modules/`:
- **request** – request workflow, approvals, attachments, verification snapshot
- **payroll** – period creation, calculation, retroactive logic, reporting
- **snapshot** – period snapshots, freeze/unfreeze, report data
- **alerts** – license expiry monitoring, retirements, SLA digests
- **master-data** – holidays, payment rates
- **notification** – in‑app notifications

Each module typically contains:
- `*.routes.ts`
- `*.controller.ts`
- `*.service.ts`
- `*.repository.ts`
- `*.schema.ts`
- `entities/*`

---

## 2) Directory Structure

```
backend/
├─ src/
│  ├─ modules/
│  │  ├─ request/
│  │  ├─ payroll/
│  │  ├─ snapshot/
│  │  ├─ alerts/
│  │  ├─ master-data/
│  │  └─ notification/
│  ├─ middlewares/       # auth, validation, error handling
│  ├─ shared/            # shared utils and helpers
│  ├─ config/            # db, jwt, redis, upload
│  └─ index.ts           # app entry
├─ scripts/              # jobs / utilities
├─ uploads/              # file uploads (gitkept)
├─ .env.example
├─ jest.config.cjs
└─ package.json
```

---

## 3) Environment Setup

Required files:
- `backend/.env`
- `backend/.env.example` is the template

Common keys:
- DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
- JWT_SECRET
- REDIS_HOST, REDIS_PORT (optional)

---

## 4) Commands

```
# dev (hot reload)
cd backend
npm run dev

# tests
npm test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:ci

# lint / format
npm run lint
npm run format
```

---

## 5) Testing Guidelines
- Jest is separated into 3 tiers:
  - `test:unit`
  - `test:integration`
  - `test:e2e`
- Full local/CI sequence: `npm run test:ci`
- Integration tests use test DB defined by `.env.test`
- Integration test files should use `*.integration.test.ts`

Run single test:
```
cd backend
npx jest src/modules/request/__tests__/workflow.test.ts
```

---

## 6) Key Data Models (Summary)
- `req_submissions`: all request data
- `req_approvals`: approval history
- `req_eligibility`: finalized eligibility records
- `pay_periods`: payroll period
- `pay_results`: calculation results per person
- `pay_snapshots`: frozen results for reporting

---

## 7) Conventions
- TypeScript only
- camelCase for APIs and services
- Domain separation is mandatory
- Never commit secrets
