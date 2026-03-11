# Archived Manual Scripts

This folder contains one-off operational scripts that are no longer part of
the default runtime/tooling flow.

Examples:

- Legacy movement diagnostic report
- Old payroll import/apply helpers
- OCR precheck backfill helper

Use only when explicitly needed for data recovery or historical investigation.

## Payroll CSV import helper

Import one payroll file into staging tables (`pay_import_batches`, `pay_import_rows`):

```bash
npx tsx src/scripts/archive/manual/import_payroll_csv.ts <source_csv_path> <period_month> <period_year> [personnel_scope]
```

Example:

```bash
npx tsx src/scripts/archive/manual/import_payroll_csv.ts ../import_data/nurse_1_26.csv 1 2026
npx tsx src/scripts/archive/manual/import_payroll_csv.ts ../import_data/pharmacist/1_26.csv 1 2026 PHARMACIST
```
