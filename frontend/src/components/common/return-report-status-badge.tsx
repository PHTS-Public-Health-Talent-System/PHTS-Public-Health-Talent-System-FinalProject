"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ReturnReportBadgeStatus = "pending" | "reported";

export function ReturnReportStatusBadge({
  status,
  tone = "soft",
}: {
  status?: ReturnReportBadgeStatus;
  tone?: "soft" | "strong";
}) {
  if (!status) return null;

  const isReported = status === "reported";
  const className =
    tone === "strong"
      ? isReported
        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
        : "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : isReported
        ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
        : "bg-amber-500/10 text-amber-600 border-amber-200";

  return (
    <Badge variant="outline" className={cn(className)}>
      {isReported ? "รายงานตัวแล้ว" : "รอรายงานตัว"}
    </Badge>
  );
}
