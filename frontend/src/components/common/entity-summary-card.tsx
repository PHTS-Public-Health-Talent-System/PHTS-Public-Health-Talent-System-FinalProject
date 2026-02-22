"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type EntitySummaryField = {
  label: string;
  value: ReactNode;
};

export function EntitySummaryCard({
  title,
  icon: Icon,
  fields,
}: {
  title: string;
  icon: LucideIcon;
  fields: EntitySummaryField[];
}) {
  return (
    <div className="p-4 rounded-lg bg-secondary/50 border border-border">
      <div className="flex items-center gap-3 mb-3">
        <Icon className="h-5 w-5 text-primary" />
        <span className="font-medium">{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        {fields.map((field) => (
          <div key={field.label}>
            <p className="text-muted-foreground">{field.label}</p>
            <p className="font-medium">{field.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
