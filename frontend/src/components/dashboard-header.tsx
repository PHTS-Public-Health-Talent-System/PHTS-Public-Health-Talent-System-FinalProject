'use client';

import type { LucideIcon } from 'lucide-react';

type DashboardHeaderProps = {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
};

export function DashboardHeader({ title, subtitle, icon: Icon }: DashboardHeaderProps) {
  return (
    <div className="flex items-start gap-4">
      {Icon ? (
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="text-muted-foreground mt-1">{subtitle}</p>
      </div>
    </div>
  );
}
