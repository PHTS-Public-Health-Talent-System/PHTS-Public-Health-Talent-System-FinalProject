import { SummaryMetricCard } from '@/components/common';
import type { LucideIcon } from 'lucide-react';

export function StatCard({
  title,
  value,
  icon: Icon,
  colorClass,
  bgClass,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <SummaryMetricCard
      icon={Icon}
      title={title}
      value={
        <>
          {value} <span className="text-xs font-normal text-muted-foreground">รายการ</span>
        </>
      }
      iconClassName={colorClass}
      iconBgClassName={bgClass}
      layout="split"
    />
  );
}
