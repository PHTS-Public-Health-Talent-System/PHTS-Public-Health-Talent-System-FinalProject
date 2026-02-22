/**
 * PHTS System - Finance Dashboard Service (compatibility bridge)
 *
 * Deprecated: use summary.service instead.
 */

export {
  getFinanceDashboard,
  getFinanceSummary,
  getYearlySummary,
} from '@/modules/finance/services/summary.service.js';

export type {
  FinanceSummary,
  YearlySummary,
} from '@/modules/finance/services/summary.service.js';
