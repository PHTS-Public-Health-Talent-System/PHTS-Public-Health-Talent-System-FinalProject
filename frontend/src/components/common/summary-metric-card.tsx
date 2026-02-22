"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SummaryMetricCard({
  icon: Icon,
  title,
  value,
  iconClassName,
  iconBgClassName,
  layout = "horizontal",
  cardClassName,
  contentClassName,
}: {
  icon: LucideIcon;
  title: string;
  value: ReactNode;
  iconClassName: string;
  iconBgClassName: string;
  layout?: "horizontal" | "split";
  cardClassName?: string;
  contentClassName?: string;
}) {
  const isSplit = layout === "split";
  return (
    <Card className={cn("border-border shadow-sm", cardClassName)}>
      <CardContent
        className={cn(
          isSplit
            ? "p-6 flex items-center justify-between"
            : "flex items-center gap-4 p-4",
          contentClassName,
        )}
      >
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {isSplit ? (
            <div className="text-2xl font-bold mt-1">{value}</div>
          ) : (
            <p className="text-xl font-bold tracking-tight">{value}</p>
          )}
        </div>
        <div className={cn(isSplit ? "p-3 rounded-full" : "rounded-xl p-3", iconBgClassName)}>
          <Icon className={cn("h-5 w-5", iconClassName)} />
        </div>
      </CardContent>
    </Card>
  );
}
