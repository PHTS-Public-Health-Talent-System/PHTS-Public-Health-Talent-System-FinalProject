/**
 * PHTS System - Finance Dashboard Service
 *
 * Handles finance dashboard data aggregation and summaries.
 */

import { FinanceRepository } from '@/modules/finance/repositories/finance.repository.js';
import type {
  FinanceSummary,
  YearlySummary,
  FinanceDashboard,
} from '@/modules/finance/entities/finance.entity.js';

// Re-export for backward compatibility
export type { FinanceSummary, YearlySummary } from '@/modules/finance/entities/finance.entity.js';

/**
 * Get finance summary by period (from view)
 */
export async function getFinanceSummary(
  year?: number,
  month?: number,
): Promise<FinanceSummary[]> {
  return FinanceRepository.findFinanceSummary(year, month, true);
}

/**
 * Get yearly summary
 */
export async function getYearlySummary(
  year?: number,
): Promise<YearlySummary[]> {
  return FinanceRepository.findYearlySummary(year, true);
}

/**
 * Get dashboard stats for finance overview
 */
export async function getFinanceDashboard(): Promise<FinanceDashboard> {
  // Get recent periods
  const recentPeriods = await FinanceRepository.findFinanceSummary(undefined, undefined, true);

  // Current Month (latest period)
  const currentMonth = recentPeriods.length > 0 ? recentPeriods[0] : null;

  // Year to Date (Current Year)
  const currentYear = new Date().getFullYear();
  const yearly = await FinanceRepository.findYearlySummary(currentYear, true);
  const yearToDate = yearly.length > 0 ? yearly[0] : null;

  return {
    currentMonth,
    yearToDate,
    recentPeriods: recentPeriods.slice(0, 6),
  };
}
