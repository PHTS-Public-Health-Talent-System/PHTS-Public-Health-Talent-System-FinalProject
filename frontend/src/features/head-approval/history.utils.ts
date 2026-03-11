import type { ApprovalAction } from "@/types/request.types";

export type HistoryActionMode = "important" | "all";
export type HistoryActionFilter = "all" | "APPROVE" | "REJECT" | "RETURN" | "ON_BEHALF";

export const getDefaultHistoryActionMode = (roleKey: string): HistoryActionMode =>
  roleKey === "PTS_OFFICER" ? "all" : "important";

export const matchesHistoryActionFilter = (
  row: {
    lastActionType: ApprovalAction["action"] | "-";
    isOfficerCreated: boolean;
  },
  filter: HistoryActionFilter,
) => {
  if (filter === "all") return true;
  if (filter === "ON_BEHALF") return row.isOfficerCreated;
  return row.lastActionType === filter;
};

const IMPORTANT_ACTIONS = new Set<ApprovalAction["action"]>(["APPROVE", "REJECT", "RETURN"]);
const HEAD_SCOPE_ROLES = new Set(["HEAD_SCOPE", "WARD_SCOPE", "DEPT_SCOPE"]);
const ACTION_PRIORITY: Record<ApprovalAction["action"], number> = {
  SUBMIT: 0,
  APPROVE: 3,
  REJECT: 2,
  RETURN: 1,
  CANCEL: 0,
};

const normalizeRole = (role?: string | null): string => String(role ?? "").trim().toUpperCase();

export const isActionRoleMatched = (actionRole: string | undefined, roleKey: string): boolean => {
  const normalizedRoleKey = normalizeRole(roleKey);
  const normalizedActionRole = normalizeRole(actionRole);
  if (normalizedRoleKey === "HEAD_SCOPE") {
    return HEAD_SCOPE_ROLES.has(normalizedActionRole);
  }
  return normalizedActionRole === normalizedRoleKey;
};

export const compareHistoryActions = (a: ApprovalAction, b: ApprovalAction): number => {
  const dateDiff = new Date(b.action_date).getTime() - new Date(a.action_date).getTime();
  if (dateDiff !== 0) return dateDiff;

  const stepDiff = Number(b.step_no ?? -1) - Number(a.step_no ?? -1);
  if (stepDiff !== 0) return stepDiff;

  const priorityDiff = (ACTION_PRIORITY[b.action] ?? 0) - (ACTION_PRIORITY[a.action] ?? 0);
  if (priorityDiff !== 0) return priorityDiff;

  return 0;
};

export const pickLatestHistoryAction = (
  actions: ApprovalAction[] | undefined,
  options: {
    actionMode: HistoryActionMode;
    roleKey: string;
    allowedSteps?: number[] | null;
  },
): ApprovalAction | undefined => {
  const filtered = [...(actions ?? [])]
    .filter((action) => (options.actionMode === "all" ? true : IMPORTANT_ACTIONS.has(action.action)))
    .filter((action) => isActionRoleMatched(action.actor?.role, options.roleKey))
    .filter((action) => {
      const steps = options.allowedSteps ?? null;
      if (!steps || steps.length === 0) return true;
      return action.step_no !== null && steps.includes(Number(action.step_no));
    })
    .sort(compareHistoryActions);

  return filtered[0];
};
