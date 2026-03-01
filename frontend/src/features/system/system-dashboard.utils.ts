export type DashboardJobStatus = 'RUNNING' | 'IDLE' | 'FAILED' | 'DEGRADED' | 'UNKNOWN';

export type DashboardServiceRow = {
  name: string;
  status: DashboardJobStatus;
  key: string;
  detail: Record<string, unknown>;
};

export type DashboardAttentionItem = {
  title: string;
  detail: string;
  tone: 'danger' | 'warn' | 'ok';
};

export type DashboardSyncRow = {
  id: string;
  type: string;
  status: 'failed' | 'running' | 'success';
  records: number;
  details: string;
  progress: number;
  highlight: string | null;
};

export const toStatusClass = (status: DashboardJobStatus) => {
  if (status === 'IDLE') return 'bg-emerald-500';
  if (status === 'RUNNING') return 'bg-blue-500';
  if (status === 'DEGRADED') return 'bg-amber-500';
  if (status === 'FAILED') return 'bg-red-500';
  return 'bg-muted-foreground';
};

export const toThaiServiceName = (key: string, fallbackName: string) => {
  if (key === 'hrms-sync') return 'ซิงก์ข้อมูล HRMS';
  if (key === 'notification-outbox') return 'คิวแจ้งเตือน';
  if (key === 'snapshot-outbox') return 'คิวสร้างสแนปช็อตงวดจ่าย';
  if (key === 'ocr-precheck') return 'คิว OCR ตรวจเอกสาร';
  if (key === 'workforce-compliance') return 'งานกำกับบุคลากร';
  if (key === 'payroll-periods') return 'งวดการจ่ายเงิน';
  if (key === 'mysql') return 'ฐานข้อมูลหลัก (MySQL)';
  if (key === 'redis') return 'แคช/ล็อก (Redis)';
  if (key === 'hrms-source') return 'แหล่งข้อมูล HRMS';
  return fallbackName;
};

export const toServiceStatusBadge = (
  key: string,
  status: DashboardJobStatus,
  detail: Record<string, unknown>,
) => {
  if (key === 'notification-outbox' || key === 'snapshot-outbox') {
    if (status === 'IDLE') return 'ไม่มีคิวค้าง';
    if (status === 'RUNNING') return 'มีคิวรอประมวลผล';
    if (status === 'DEGRADED') return 'มีรายการล้มเหลว';
    if (status === 'FAILED') return 'ระบบคิวผิดพลาด';
  }
  if (key === 'ocr-precheck') {
    if (status === 'IDLE') return 'พร้อมใช้งาน';
    if (status === 'RUNNING') return 'มีคิวรอตรวจ';
    if (status === 'FAILED') return 'ตั้งค่าไม่พร้อม';
  }
  if (key === 'workforce-compliance') {
    if (status === 'DEGRADED') return 'พบงานล้มเหลว';
    if (status === 'IDLE') return 'ปกติ';
  }
  if (key === 'payroll-periods') {
    if (status === 'RUNNING') return 'มีงวดเปิดอยู่';
    if (status === 'IDLE') return 'ไม่มีงวดเปิด';
  }
  if (key === 'hrms-sync') {
    if (status === 'RUNNING') return 'กำลังซิงก์';
    if (status === 'DEGRADED') return 'ซิงก์สำเร็จแต่มีคำเตือน';
    if (status === 'IDLE') return 'ปกติ';
    if (status === 'FAILED') return 'ซิงก์ล้มเหลว';
  }
  if (status === 'IDLE') return 'พร้อมใช้งาน';
  if (status === 'RUNNING') return 'กำลังทำงาน';
  if (status === 'DEGRADED') return 'มีความเสี่ยง';
  if (status === 'FAILED') return 'ขัดข้อง';
  if (detail.error) return 'มีข้อผิดพลาด';
  return 'ไม่ทราบสถานะ';
};

export const extractSyncWarnings = (detail: Record<string, unknown>): string[] => {
  const lastResult =
    detail.lastResult && typeof detail.lastResult === 'object'
      ? (detail.lastResult as Record<string, unknown>)
      : null;
  const warnings = lastResult?.warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings
    .map((warning) => String(warning ?? '').trim())
    .filter((warning) => warning.length > 0)
    .slice(0, 3);
};

export const toQueueProgress = (
  status: 'failed' | 'running' | 'success',
  activeCount: number,
) => {
  if (status === 'failed') return activeCount > 0 ? 100 : 0;
  if (status === 'running') return 100;
  return 0;
};
