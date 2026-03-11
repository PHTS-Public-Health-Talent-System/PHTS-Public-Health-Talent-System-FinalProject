import path from "node:path";

import { parseImportPayrollConfig } from "@/scripts/archive/manual/import-payroll-csv-config.js";

describe("parseImportPayrollConfig", () => {
  it("parses file, month and year from CLI args", () => {
    const config = parseImportPayrollConfig([
      "import_data/nurse_1_26.csv",
      "1",
      "2026",
    ]);

    expect(config.sourceFile).toBe(path.resolve("import_data/nurse_1_26.csv"));
    expect(config.periodMonth).toBe(1);
    expect(config.periodYear).toBe(2026);
    expect(config.personnelScope).toBe("NURSE");
  });

  it("throws for invalid month", () => {
    expect(() =>
      parseImportPayrollConfig(["import_data/nurse_1_26.csv", "13", "2026"]),
    ).toThrow("periodMonth must be between 1 and 12");
  });

  it("accepts optional PHARMACIST scope", () => {
    const config = parseImportPayrollConfig([
      "import_data/pharmacist/1_26.csv",
      "1",
      "2026",
      "PHARMACIST",
    ]);

    expect(config.personnelScope).toBe("PHARMACIST");
  });

  it("throws for unsupported scope", () => {
    expect(() =>
      parseImportPayrollConfig([
        "import_data/pharmacist/1_26.csv",
        "1",
        "2026",
        "DENTIST",
      ]),
    ).toThrow("Unsupported personnelScope");
  });

  it("throws when args are missing", () => {
    expect(() => parseImportPayrollConfig(["import_data/nurse_1_26.csv"])).toThrow(
      "Usage: npx tsx src/scripts/archive/manual/import_payroll_csv.ts <source_csv_path> <period_month> <period_year> [personnel_scope]",
    );
  });
});
