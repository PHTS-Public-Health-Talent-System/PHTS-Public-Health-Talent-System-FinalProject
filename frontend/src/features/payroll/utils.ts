type PeriodStatus =
  | "OPEN"
  | "WAITING_HR"
  | "WAITING_HEAD_FINANCE"
  | "WAITING_DIRECTOR"
  | "CLOSED"
  | string;

export function getPeriodStatusLabel(status: PeriodStatus) {
  switch (status) {
    case "OPEN":
      return "เปิดงวด";
    case "WAITING_HR":
      return "รอหัวหน้า HR";
    case "WAITING_HEAD_FINANCE":
      return "รอหัวหน้าการเงิน";
    case "WAITING_DIRECTOR":
      return "รอผอ.";
    case "CLOSED":
      return "ปิดงวด";
    default:
      return status;
  }
}

export function canEditPeriod(status: PeriodStatus) {
  return status === "OPEN";
}

export function toPeriodLabel(period: {
  period_month: number;
  period_year: number;
}) {
  const month = String(period.period_month).padStart(2, "0");
  return `${month}/${period.period_year}`;
}
