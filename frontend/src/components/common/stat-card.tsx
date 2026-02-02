"use client";

import { Card, CardContent } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  iconClassName?: string;
  description?: string;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, iconClassName, description, className }: StatCardProps) {
  return (
    <Card className={cn("shadow-soft border-slate-100", className)}>
      <CardContent className="flex items-center gap-5 p-6">
        <div className={cn("rounded-2xl p-4 transition-colors", iconClassName ?? "bg-primary/10 text-primary")}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <p className="text-3xl font-bold text-slate-900 font-numbers">{value}</p>
          <p className="text-base font-medium text-slate-800">{title}</p>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
