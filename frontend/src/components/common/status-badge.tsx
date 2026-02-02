"use client";

import { Badge } from "@/components/ui/badge";
import { RequestStatus, STATUS_LABELS, STEP_LABELS } from "@/types/request.types";

const STATUS_STYLES: Record<RequestStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700 hover:bg-gray-200",
  PENDING: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  PENDING_HEAD_WARD: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  PENDING_HEAD_DEPT: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  PENDING_PTS_OFFICER: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  PENDING_HR: "bg-purple-100 text-purple-700 hover:bg-purple-200",
  PENDING_FINANCE: "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
  APPROVED: "bg-green-100 text-green-700 hover:bg-green-200",
  REJECTED: "bg-red-100 text-red-700 hover:bg-red-200",
  CANCELLED: "bg-gray-100 text-gray-500 hover:bg-gray-200",
  RETURNED: "bg-amber-100 text-amber-700 hover:bg-amber-200",
};

const PENDING_STEP_STYLES: Record<number, string> = {
  1: STATUS_STYLES.PENDING_HEAD_WARD,
  2: STATUS_STYLES.PENDING_HEAD_DEPT,
  3: STATUS_STYLES.PENDING_PTS_OFFICER,
  4: STATUS_STYLES.PENDING_HR,
  5: STATUS_STYLES.PENDING_FINANCE,
  6: STATUS_STYLES.PENDING,
};

const getStatusLabel = (status: RequestStatus, currentStep?: number) => {
  if (status === "PENDING" && currentStep && STEP_LABELS[currentStep]) {
    return `รอ${STEP_LABELS[currentStep]}`;
  }
  return STATUS_LABELS[status] ?? status;
};

const getStatusStyle = (status: RequestStatus, currentStep?: number) => {
  if (status === "PENDING" && currentStep && PENDING_STEP_STYLES[currentStep]) {
    return PENDING_STEP_STYLES[currentStep];
  }
  return STATUS_STYLES[status] ?? "";
};

export function StatusBadge({
  status,
  currentStep,
}: {
  status: RequestStatus;
  currentStep?: number | null;
}) {
  return (
    <Badge variant="outline" className={getStatusStyle(status, currentStep ?? undefined)}>
      {getStatusLabel(status, currentStep ?? undefined)}
    </Badge>
  );
}
