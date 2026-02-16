import PDFDocument from "pdfkit";
import { PayrollRepository } from '@/modules/payroll/repositories/payroll.repository.js';
import { getPayoutDataForReport } from '@/modules/snapshot/services/snapshot.service.js';

export async function buildPeriodReport(periodId: number): Promise<Buffer> {
  const period = await PayrollRepository.findPeriodById(periodId);
  if (!period) {
    throw new Error("Period not found");
  }
  if (period.status !== "CLOSED" || !period.is_frozen) {
    throw new Error("Report is available only for closed and frozen periods");
  }

  const payoutData = await getPayoutDataForReport(periodId);
  const payouts = payoutData.data as any[];

  const summaryMap = new Map<string, { headcount: number; total_payable: number }>();
  for (const row of payouts) {
    const key = row.position_name || "Unknown";
    const bucket = summaryMap.get(key) || { headcount: 0, total_payable: 0 };
    bucket.headcount += 1;
    bucket.total_payable += Number(row.total_payable ?? 0);
    summaryMap.set(key, bucket);
  }
  const summary = Array.from(summaryMap.entries()).map(([position_name, totals]) => ({
    position_name,
    headcount: totals.headcount,
    total_payable: totals.total_payable,
  }));

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      doc.fontSize(16).text(
        `รายงานงวดเงินเพิ่ม พ.ต.ส. ${period.period_month}/${period.period_year}`,
      );
      doc.moveDown(0.5);
      doc
        .fontSize(10)
        .text(`สถานะ: ${period.status}  จำนวนคน: ${period.total_headcount ?? 0}`);
      doc
        .fontSize(10)
        .text(`ยอดรวม: ${Number(period.total_amount ?? 0).toLocaleString('th-TH')} บาท`);

      doc.moveDown();
      doc.fontSize(12).text("สรุปตามวิชาชีพ");
      doc.moveDown(0.3);

      summary.forEach((row: any) => {
        doc
          .fontSize(10)
          .text(
            `${row.position_name} | จำนวน ${row.headcount} | รวม ${Number(
              row.total_payable,
            ).toLocaleString('th-TH')} บาท`,
          );
      });

      doc.moveDown();
      doc.fontSize(12).text("รายการจ่ายเงิน");
      doc.moveDown(0.3);

      payouts.forEach((row: any) => {
        const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
        const line = [
          name || row.citizen_id,
          row.position_name ?? "-",
          `สิทธิ ${row.eligible_days ?? 0}`,
          `หัก ${row.deducted_days ?? 0}`,
          `อัตรา ${Number(row.rate ?? 0).toLocaleString('th-TH')}`,
          `รวม ${Number(row.total_payable ?? 0).toLocaleString('th-TH')}`,
        ].join(" | ");
        doc.fontSize(9).text(line);
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
