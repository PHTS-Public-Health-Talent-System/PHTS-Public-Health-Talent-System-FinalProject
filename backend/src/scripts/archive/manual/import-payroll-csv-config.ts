import path from "node:path";

export type ImportPayrollConfig = {
  sourceFile: string;
  periodMonth: number;
  periodYear: number;
  personnelScope: "NURSE" | "PHARMACIST";
};

const USAGE =
  "Usage: npx tsx src/scripts/archive/manual/import_payroll_csv.ts <source_csv_path> <period_month> <period_year> [personnel_scope]";

const parseNumberArg = (value: string, name: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
};

const ensureSafeSourceFile = (sourceFileArg: string): string => {
  const sourceFileName = path.basename(sourceFileArg.trim());
  const extension = path.extname(sourceFileName).toLowerCase();
  if (extension !== ".csv") {
    throw new Error("sourceFile must be a .csv file");
  }

  // Force source files to be loaded from import_data/ to prevent arbitrary path reads.
  return path.resolve("import_data", sourceFileName);
};

export const parseImportPayrollConfig = (
  args: string[],
): ImportPayrollConfig => {
  if (args.length < 3) {
    throw new Error(USAGE);
  }

  const [sourceFileArg, monthArg, yearArg, scopeArg] = args;
  const periodMonth = parseNumberArg(monthArg, "periodMonth");
  const periodYear = parseNumberArg(yearArg, "periodYear");
  const personnelScope = String(scopeArg ?? "NURSE").trim().toUpperCase();

  if (periodMonth < 1 || periodMonth > 12) {
    throw new Error("periodMonth must be between 1 and 12");
  }
  if (periodYear < 1900 || periodYear > 2600) {
    throw new Error("periodYear is out of supported range");
  }
  if (personnelScope !== "NURSE" && personnelScope !== "PHARMACIST") {
    throw new Error("Unsupported personnelScope");
  }

  return {
    sourceFile: ensureSafeSourceFile(sourceFileArg),
    periodMonth,
    periodYear,
    personnelScope,
  };
};
