import { memo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardAttentionItem } from '@/features/system/dashboard';

type SystemAttentionBannerProps = {
  items: DashboardAttentionItem[];
};

export const SystemAttentionBanner = memo(function SystemAttentionBanner({
  items,
}: SystemAttentionBannerProps) {
  return (
    <Card className="border-border bg-muted/10 shadow-sm">
      <CardContent className="grid gap-3 p-4 md:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.title}
            className={cn(
              'flex items-start gap-3 rounded-lg border bg-background p-3 shadow-sm',
              item.tone === 'danger' && 'border-destructive/40 bg-destructive/5',
              item.tone === 'warn' && 'border-amber-200 bg-amber-50/50',
              item.tone === 'ok' && 'border-emerald-200 bg-emerald-50/50',
            )}
          >
            {item.tone === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  item.tone === 'danger' ? 'text-destructive' : 'text-amber-600',
                )}
              />
            )}
            <div>
              <p
                className={cn(
                  'text-sm font-semibold',
                  item.tone === 'danger'
                    ? 'text-destructive'
                    : item.tone === 'warn'
                      ? 'text-amber-700'
                      : 'text-emerald-700',
                )}
              >
                {item.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
});
