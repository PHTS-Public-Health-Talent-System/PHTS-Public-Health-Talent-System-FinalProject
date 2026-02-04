# GEMINI.md

## Project Overview

This is a full-stack web application called PHTS (Public Health Talent System). It is designed to manage eligibility requests, approvals, and monthly payroll calculations for P.T.S. allowances at Uttaradit Hospital.

The project is a monorepo with a backend, frontend, and infrastructure components.

*   **Backend:** The backend is built with Node.js, Express, and TypeScript. It uses a MySQL database and Redis for caching. The backend handles the core business logic, including user authentication, request processing, and payroll calculations.

*   **Frontend:** The frontend is a Next.js application built with TypeScript and React. It provides the user interface for submitting requests, tracking their status, and managing payroll periods. It uses `axios` for making API requests to the backend, `zod` for validation and `zustand` for state management.

*   **Infrastructure:** The infrastructure component includes a Docker Compose setup for an optional OCR (Optical Character Recognition) service.

## Building and Running

### Installation

To install all dependencies for both the backend and frontend, run the following command from the project root:

```bash
npm run install:all
```

### Environment Configuration

Before running the application, you need to set up the environment variables for the backend and frontend.

*   **Backend:** Create a `.env` file in the `backend` directory. You can use the `backend/.env.example` file as a template.
*   **Frontend:** Create a `.env.local` file in the `frontend` directory.

### Development

To run both the backend and frontend development servers concurrently, use the following command from the project root:

```bash
npm run dev:all
```

This will start the backend server on `http://localhost:3000` and the frontend server on `http://localhost:3001`.

### Build

To build the backend and frontend for production, run the following command from the project root:

```bash
npm run build:all
```

## Development Conventions

*   **Domain Logic:** Keep domain logic inside the correct module.
*   **Naming Conventions:**
    *   `camelCase` for API/services.
    *   `PascalCase` for React components.
*   **Secrets:** Never commit secrets or real credentials to the repository.
*   **Environment Variables:** Keep `.env` files for local development only.

## Testing

### Backend

The backend uses Jest for testing. To run the tests, navigate to the `backend` directory and run:

```bash
npm test
```

### Frontend

The frontend uses `vitest` for testing. To run the tests, navigate to the `frontend` directory and run:

```bash
npm test
```

## Linting and Formatting

### Backend

The backend uses ESLint for linting and Prettier for formatting.

*   **Lint:** `npm run lint` in the `backend` directory.
*   **Format:** `npm run format` in the `backend` directory.

### Frontend

The frontend uses ESLint for linting.

*   **Lint:** `npm run lint` in the `frontend` directory.
