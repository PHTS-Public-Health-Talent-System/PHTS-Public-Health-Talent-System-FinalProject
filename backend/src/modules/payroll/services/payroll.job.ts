import { PayrollService } from '@/modules/payroll/payroll.service.js';

export async function ensureMonthlyPeriod(): Promise<void> {
  await PayrollService.ensureCurrentPeriod();
}
