/**
 * dashboard module - compatibility bridge
 *
 * Deprecated: use approver-dashboard.service instead.
 */

export {
  buildApproverDashboard,
  getApproverDashboard,
  buildHeadHrDashboard,
  getHeadHrDashboard,
} from "@/modules/dashboard/approver-dashboard.service.js";

export type {
  ApproverDashboardPayload,
  ApproverDashboardStats,
  ApproverPendingPayroll,
  ApproverPendingRequest,
} from "@/modules/dashboard/approver-dashboard.service.js";
