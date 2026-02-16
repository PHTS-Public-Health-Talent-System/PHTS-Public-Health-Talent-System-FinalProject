import ExcelJS from "exceljs";
import { getPayoutDataForReport } from '@/modules/snapshot/services/snapshot.service.js';
import { ReportRepository } from '@/modules/report/repositories/report.repository.js';
import {
  ReportParams,
  PayoutRow,
  PROFESSION_NAME_MAP,
} from '@/modules/report/entities/report.entity.js';

// Re-export entities for backward compatibility
export * from '@/modules/report/entities/report.entity.js';

const BORDER_STYLE: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const FONT_HEADER: Partial<ExcelJS.Font> = {
  name: "TH SarabunPSK",
  size: 16,
  bold: true,
};
const FONT_BODY: Partial<ExcelJS.Font> = { name: "TH SarabunPSK", size: 16 };

const escapeCsvValue = (value: string | number | null | undefined): string => {
  const normalized = value === null || value === undefined ? "" : String(value);
  if (
    normalized.includes(",") ||
    normalized.includes('"') ||
    normalized.includes("\n")
  ) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

const buildCsv = (
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): Buffer => {
  const csv = [headers, ...rows]
    .map((line) => line.map((cell) => escapeCsvValue(cell)).join(","))
    .join("\n");
  return Buffer.from(`\uFEFF${csv}`, "utf-8");
};

export async function generateDetailReport(
  params: ReportParams,
): Promise<Buffer> {
  const { year, month, professionCode } = params;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Detail Report");

  const periodId = await ReportRepository.getPeriodId(year, month);
  const payoutData = await getPayoutDataForReport(periodId);
  const payouts = payoutData.data as PayoutRow[];

  const rateIds = payouts
    .map((row) => row.master_rate_id)
    .filter((id): id is number => typeof id === "number");
  const rateMap = await ReportRepository.getMasterRateMap(Array.from(new Set(rateIds)));

  const rows = payouts
    .map((row) => {
      const rate = row.master_rate_id
        ? rateMap.get(row.master_rate_id)
        : undefined;
      const profession =
        (row as any).profession_code ?? rate?.profession_code ?? null;
      return {
        citizen_id: row.citizen_id,
        first_name: row.first_name || "",
        last_name: row.last_name || "",
        position_name: row.position_name || "",
        base_rate:
          row.pts_rate_snapshot ?? (row as any).base_rate ?? rate?.amount ?? 0,
        current_receive: Number(row.calculated_amount) || 0,
        retro: Number(row.retroactive_amount) || 0,
        total: Number(row.total_payable) || 0,
        remark: row.remark || "",
        group_no: (row as any).group_no ?? rate?.group_no ?? null,
        item_no: (row as any).item_no ?? rate?.item_no ?? null,
        profession_code: profession,
      };
    })
    .filter((row) => !professionCode || row.profession_code === professionCode)
    .sort((a, b) => a.first_name.localeCompare(b.first_name, "th"));

  worksheet.pageSetup = { paperSize: 9, orientation: "landscape" };

  const titleRow = worksheet.getRow(1);
  titleRow.getCell(1).value =
    `บัญชีรายชื่อข้าราชการที่มีสิทธิ์ได้รับเงินเพิ่มสำหรับตำแหน่งที่มีเหตุพิเศษ (พ.ต.ส.) ตำแหน่ง ${professionCode || "รวม"} ประจำเดือน ${month}/${year}`;
  titleRow.font = { ...FONT_HEADER, size: 18 };
  titleRow.alignment = { horizontal: "center" };
  worksheet.mergeCells("A1:K1");

  worksheet.columns = [
    { key: "seq", width: 8 },
    { key: "name", width: 25 },
    { key: "pos", width: 20 },
    { key: "rate", width: 15 },
    { key: "curr", width: 15 },
    { key: "retro", width: 12 },
    { key: "total", width: 15 },
    { key: "ref_group", width: 10 },
    { key: "ref_item", width: 10 },
    { key: "ref_rate", width: 12 },
    { key: "remark", width: 20 },
  ];

  worksheet.mergeCells("A3:A5");
  worksheet.getCell("A3").value = "ลำดับ";
  worksheet.mergeCells("B3:B5");
  worksheet.getCell("B3").value = "ชื่อ-สกุล";
  worksheet.mergeCells("C3:C5");
  worksheet.getCell("C3").value = "ตำแหน่ง";
  worksheet.mergeCells("D3:D5");
  worksheet.getCell("D3").value = "อัตราเงินเพิ่ม\nที่ได้รับ/เดือน\n(บาท)";
  worksheet.mergeCells("E3:E5");
  worksheet.getCell("E3").value = "ได้รับจริง\n(บาท)";
  worksheet.mergeCells("F3:F5");
  worksheet.getCell("F3").value = "ตกเบิก\n(บาท)";
  worksheet.mergeCells("G3:G5");
  worksheet.getCell("G3").value = "รวมรับ\n(บาท)";

  worksheet.mergeCells("H3:J3");
  worksheet.getCell("H3").value = "ประกาศ ก.พ. (ฉบับที่ 3) พ.ศ. 2560";
  worksheet.mergeCells("H4:J4");
  worksheet.getCell("H4").value = "กลุ่มตำแหน่งตามลักษณะงาน";
  worksheet.getCell("H5").value = "กลุ่มที่";
  worksheet.getCell("I5").value = "ข้อ";
  worksheet.getCell("J5").value = "อัตรา(บาท)";

  worksheet.mergeCells("K3:K5");
  worksheet.getCell("K3").value = "หมายเหตุ";

  [3, 4, 5].forEach((r) => {
    const row = worksheet.getRow(r);
    row.font = FONT_HEADER;
    row.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    row.eachCell((cell: ExcelJS.Cell) => {
      cell.border = BORDER_STYLE;
    });
  });

  let currentRow = 6;
  let seq = 1;
  let sumTotal = 0;

  for (const row of rows as any[]) {
    const r = worksheet.getRow(currentRow);

    r.getCell(1).value = seq++;
    r.getCell(2).value =
      `${row.first_name || ""} ${row.last_name || ""}`.trim();
    r.getCell(3).value = row.position_name;
    r.getCell(4).value = Number(row.base_rate);
    r.getCell(5).value = Number(row.current_receive);
    r.getCell(6).value = Number(row.retro);
    r.getCell(7).value = Number(row.total);
    r.getCell(8).value = row.group_no;
    r.getCell(9).value = row.item_no || "-";
    r.getCell(10).value = Number(row.base_rate);
    r.getCell(11).value = row.remark;

    [4, 5, 6, 7, 10].forEach((c) => {
      r.getCell(c).numFmt = "#,##0.00";
      r.getCell(c).alignment = { horizontal: "right" };
    });

    r.font = FONT_BODY;
    r.eachCell(
      { includeEmpty: true },
      (cell: ExcelJS.Cell) => (cell.border = BORDER_STYLE),
    );

    sumTotal += Number(row.total);
    currentRow++;
  }

  const footerRow = worksheet.getRow(currentRow);
  footerRow.getCell(1).value = "รวมทั้งสิ้น";
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  footerRow.getCell(1).alignment = { horizontal: "center" };
  footerRow.getCell(1).font = FONT_HEADER;

  footerRow.getCell(7).value = sumTotal;
  footerRow.getCell(7).numFmt = "#,##0.00";
  footerRow.getCell(7).font = { ...FONT_HEADER, underline: true };

  footerRow.eachCell(
    { includeEmpty: true },
    (cell: ExcelJS.Cell) => (cell.border = BORDER_STYLE),
  );

  currentRow += 3;
  const signRow = worksheet.getRow(currentRow);
  signRow.getCell(2).value =
    "ลงชื่อ ........................................................... ผู้จัดทำ";
  signRow.getCell(7).value =
    "ลงชื่อ ........................................................... ผู้ตรวจสอบ";

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generateSummaryReport(
  year: number,
  month: number,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Summary Report");

  const periodId = await ReportRepository.getPeriodId(year, month);
  const payoutData = await getPayoutDataForReport(periodId);
  const payouts = payoutData.data as PayoutRow[];

  const rateIds = payouts
    .map((row) => row.master_rate_id)
    .filter((id): id is number => typeof id === "number");
  const rateMap = await ReportRepository.getMasterRateMap(Array.from(new Set(rateIds)));

  const summaryMap = new Map<
    string,
    { sum_current: number; sum_retro: number; sum_total: number }
  >();
  for (const row of payouts) {
    const rate = row.master_rate_id
      ? rateMap.get(row.master_rate_id)
      : undefined;
    const profession =
      (row as any).profession_code ?? rate?.profession_code ?? "UNKNOWN";
    const current = Number(row.calculated_amount) || 0;
    const retro = Number(row.retroactive_amount) || 0;
    const total = Number(row.total_payable) || 0;
    const bucket = summaryMap.get(profession) || {
      sum_current: 0,
      sum_retro: 0,
      sum_total: 0,
    };
    bucket.sum_current += current;
    bucket.sum_retro += retro;
    bucket.sum_total += total;
    summaryMap.set(profession, bucket);
  }

  const rows = Array.from(summaryMap.entries())
    .map(([profession_code, sums]) => ({
      profession_code,
      sum_current: sums.sum_current,
      sum_retro: sums.sum_retro,
      sum_total: sums.sum_total,
    }))
    .sort((a, b) => a.profession_code.localeCompare(b.profession_code, "th"));

  worksheet.pageSetup = { paperSize: 9, orientation: "portrait" };

  worksheet.mergeCells("A1:E1");
  const title = worksheet.getCell("A1");
  title.value = `สรุปค่าตอบแทนกำลังคนด้านสาธารณสุข (พ.ต.ส.) ข้าราชการ ประจำเดือน ${month}/${year}`;
  title.font = { ...FONT_HEADER, size: 20 };
  title.alignment = { horizontal: "center" };

  const headerRow = worksheet.getRow(3);
  headerRow.values = [
    "ที่",
    "กลุ่มวิชาชีพ",
    "ยอดเดือนปัจจุบัน",
    "ยอดตกเบิก",
    "รวมเป็นเงิน",
  ];
  headerRow.font = FONT_HEADER;
  headerRow.alignment = { horizontal: "center" };
  headerRow.eachCell((cell: ExcelJS.Cell) => (cell.border = BORDER_STYLE));

  worksheet.columns = [
    { width: 8 },
    { width: 40 },
    { width: 20 },
    { width: 15 },
    { width: 20 },
  ];

  let currentRow = 4;
  let i = 1;
  let grandTotal = 0;

  for (const row of rows as any[]) {
    const r = worksheet.getRow(currentRow);
    r.getCell(1).value = i++;
    r.getCell(2).value =
      PROFESSION_NAME_MAP[row.profession_code] || row.profession_code;
    r.getCell(3).value = Number(row.sum_current);
    r.getCell(4).value = Number(row.sum_retro);
    r.getCell(5).value = Number(row.sum_total);

    [3, 4, 5].forEach((c) => {
      r.getCell(c).numFmt = "#,##0.00";
      r.getCell(c).alignment = { horizontal: "right" };
    });

    r.font = FONT_BODY;
    r.eachCell(
      { includeEmpty: true },
      (cell: ExcelJS.Cell) => (cell.border = BORDER_STYLE),
    );

    grandTotal += Number(row.sum_total);
    currentRow++;
  }

  const totalRow = worksheet.getRow(currentRow);
  totalRow.getCell(1).value = "รวมทั้งสิ้น";
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
  totalRow.getCell(1).alignment = { horizontal: "center" };
  totalRow.getCell(1).font = FONT_HEADER;

  totalRow.getCell(5).value = grandTotal;
  totalRow.getCell(5).numFmt = "#,##0.00";
  totalRow.getCell(5).font = { ...FONT_HEADER, underline: true };

  totalRow.eachCell(
    { includeEmpty: true },
    (cell: ExcelJS.Cell) => (cell.border = BORDER_STYLE),
  );

  currentRow += 4;
  worksheet.mergeCells(`B${currentRow}:D${currentRow}`);
  const signCell = worksheet.getCell(`B${currentRow}`);
  signCell.value =
    "ลงชื่อ ........................................................... ผู้อำนวยการโรงพยาบาล";
  signCell.alignment = { horizontal: "center" };
  signCell.font = FONT_BODY;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generateDetailReportCsv(
  params: ReportParams,
): Promise<Buffer> {
  const { year, month, professionCode } = params;
  const periodId = await ReportRepository.getPeriodId(year, month);
  const payoutData = await getPayoutDataForReport(periodId);
  const payouts = payoutData.data as PayoutRow[];

  const rateIds = payouts
    .map((row) => row.master_rate_id)
    .filter((id): id is number => typeof id === "number");
  const rateMap = await ReportRepository.getMasterRateMap(Array.from(new Set(rateIds)));

  const rows = payouts
    .map((row) => {
      const rate = row.master_rate_id
        ? rateMap.get(row.master_rate_id)
        : undefined;
      const profession =
        (row as any).profession_code ?? rate?.profession_code ?? null;
      return {
        first_name: row.first_name || "",
        last_name: row.last_name || "",
        position_name: row.position_name || "",
        base_rate:
          row.pts_rate_snapshot ?? (row as any).base_rate ?? rate?.amount ?? 0,
        current_receive: Number(row.calculated_amount) || 0,
        retro: Number(row.retroactive_amount) || 0,
        total: Number(row.total_payable) || 0,
        group_no: (row as any).group_no ?? rate?.group_no ?? null,
        item_no: (row as any).item_no ?? rate?.item_no ?? null,
        profession_code: profession,
        remark: row.remark || "",
      };
    })
    .filter((row) => !professionCode || row.profession_code === professionCode)
    .sort((a, b) => a.first_name.localeCompare(b.first_name, "th"));

  return buildCsv(
    [
      "ลำดับ",
      "ชื่อ-สกุล",
      "ตำแหน่ง",
      "อัตราเงินเพิ่มที่ได้รับ/เดือน(บาท)",
      "ได้รับจริง(บาท)",
      "ตกเบิก(บาท)",
      "รวมรับ(บาท)",
      "กลุ่มที่",
      "ข้อ",
      "อัตรา(บาท)",
      "หมายเหตุ",
    ],
    rows.map((row, idx) => [
      idx + 1,
      `${row.first_name} ${row.last_name}`.trim(),
      row.position_name,
      Number(row.base_rate).toFixed(2),
      Number(row.current_receive).toFixed(2),
      Number(row.retro).toFixed(2),
      Number(row.total).toFixed(2),
      row.group_no ?? "",
      row.item_no ?? "-",
      Number(row.base_rate).toFixed(2),
      row.remark,
    ]),
  );
}

export async function generateSummaryReportCsv(
  year: number,
  month: number,
): Promise<Buffer> {
  const periodId = await ReportRepository.getPeriodId(year, month);
  const payoutData = await getPayoutDataForReport(periodId);
  const payouts = payoutData.data as PayoutRow[];

  const rateIds = payouts
    .map((row) => row.master_rate_id)
    .filter((id): id is number => typeof id === "number");
  const rateMap = await ReportRepository.getMasterRateMap(Array.from(new Set(rateIds)));

  const summaryMap = new Map<
    string,
    { sum_current: number; sum_retro: number; sum_total: number }
  >();
  for (const row of payouts) {
    const rate = row.master_rate_id
      ? rateMap.get(row.master_rate_id)
      : undefined;
    const profession =
      (row as any).profession_code ?? rate?.profession_code ?? "UNKNOWN";
    const current = Number(row.calculated_amount) || 0;
    const retro = Number(row.retroactive_amount) || 0;
    const total = Number(row.total_payable) || 0;
    const bucket = summaryMap.get(profession) || {
      sum_current: 0,
      sum_retro: 0,
      sum_total: 0,
    };
    bucket.sum_current += current;
    bucket.sum_retro += retro;
    bucket.sum_total += total;
    summaryMap.set(profession, bucket);
  }

  const rows = Array.from(summaryMap.entries())
    .map(([profession_code, sums]) => ({
      profession_code,
      sum_current: sums.sum_current,
      sum_retro: sums.sum_retro,
      sum_total: sums.sum_total,
    }))
    .sort((a, b) => a.profession_code.localeCompare(b.profession_code, "th"));

  return buildCsv(
    ["ที่", "กลุ่มวิชาชีพ", "ยอดเดือนปัจจุบัน", "ยอดตกเบิก", "รวมเป็นเงิน"],
    rows.map((row, idx) => [
      idx + 1,
      PROFESSION_NAME_MAP[row.profession_code] || row.profession_code,
      Number(row.sum_current).toFixed(2),
      Number(row.sum_retro).toFixed(2),
      Number(row.sum_total).toFixed(2),
    ]),
  );
}
