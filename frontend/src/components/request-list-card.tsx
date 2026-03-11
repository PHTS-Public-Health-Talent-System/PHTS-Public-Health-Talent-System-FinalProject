'use client';

import Link from 'next/link';
import { DataTableCard } from '@/components/data-table-card';
import { StatusBadge, type StatusType } from '@/components/status-badge';

export type RequestListRow = {
  id: string | number;
  href: string;
  requestNo: string;
  status: {
    type: StatusType;
    label?: string;
  };
  primaryText: string;
  secondaryText?: string;
  stepText?: string;
  dateText?: string;
  amountText?: string;
};

type RequestListCardProps = {
  title: string;
  viewAllHref?: string;
  rows: RequestListRow[];
  emptyMessage: string;
  emptyAction?: React.ReactNode;
  minRows?: number;
};

export function RequestListCard({
  title,
  viewAllHref,
  rows,
  emptyMessage,
  emptyAction,
  minRows = 3,
}: RequestListCardProps) {
  const visibleRows = rows.slice(0, minRows);
  const fillerCount = Math.max(0, minRows - visibleRows.length);

  return (
    <DataTableCard title={title} viewAllHref={viewAllHref}>
      <div className="space-y-3">
        {visibleRows.length > 0 ? (
          <>
            {visibleRows.map((row) => (
            <Link
              key={row.id}
              href={row.href}
              className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-all hover:bg-secondary/50 hover:shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {row.requestNo}
                  </span>
                  <StatusBadge status={row.status.type} label={row.status.label} />
                </div>
                <p className="mt-2 font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {row.primaryText}
                </p>
                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5">
                  {[row.secondaryText, row.stepText, row.dateText]
                    .filter((item): item is string => Boolean(item))
                    .map((item, idx, arr) => (
                      <span key={`${row.id}-${item}`}>
                        {item}
                        {idx < arr.length - 1 ? ' •' : ''}
                      </span>
                    ))}
                </div>
              </div>
              {row.amountText ? (
                <div className="text-right pl-4">
                  <p className="text-lg font-bold text-foreground">{row.amountText}</p>
                </div>
              ) : null}
            </Link>
            ))}
            {Array.from({ length: fillerCount }).map((_, idx) => (
              <div
                key={`filler-${idx}`}
                className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-7"
              />
            ))}
          </>
        ) : (
          <div className="py-12 text-center flex flex-col items-center justify-center text-muted-foreground">
            <p>{emptyMessage}</p>
            {emptyAction}
          </div>
        )}
      </div>
    </DataTableCard>
  );
}
