# Backend Test Structure

This folder is a shared home for reusable test assets.

## Test Levels

- `unit`
  - Fast tests.
  - No real DB connection.
  - Use mocks/stubs.
- `integration`
  - Repository/service tests that validate SQL/DB behavior.
  - May use `src/test/test-db.ts`.
- `e2e`
  - End-to-end workflow tests across modules.

## Commands

- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run test:ci`

## Shared Subfolders

- `src/test/helpers`
  - Cross-suite helper functions.

## Naming Guidance

- Use:
  - `*.unit.test.ts`
  - `*.integration.test.ts`
  - `*.e2e.test.ts`
- Placement:
  - Integration tests should live under `__tests__/integration/`.
  - Unit tests can stay in `__tests__/`.
