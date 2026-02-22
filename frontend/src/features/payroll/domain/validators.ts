import type { PayPeriodStatus } from "./model"

export const isPayPeriodStatus = (value: string): value is PayPeriodStatus => {
  return [
    "OPEN",
    "WAITING_HR",
    "WAITING_HEAD_FINANCE",
    "WAITING_DIRECTOR",
    "CLOSED",
  ].includes(value)
}
