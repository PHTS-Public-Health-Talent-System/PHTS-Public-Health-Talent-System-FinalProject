import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type AdminPageShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidthClassName?: string;
};

export function AdminPageShell({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  contentClassName,
  maxWidthClassName = 'max-w-[1400px]',
}: AdminPageShellProps) {
  return (
    <div className={cn(className)}>
      <div
        className={cn(
          'mx-auto space-y-8 px-6 py-6 lg:px-8 lg:py-8',
          maxWidthClassName,
          contentClassName,
        )}
      >
        <section className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              {eyebrow ? (
                <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {eyebrow}
                </div>
              ) : null}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  {Icon ? (
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                      {title}
                    </h1>
                    {description ? (
                      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                        {description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {actions}
              </div>
            ) : null}
        </section>

        {children}
      </div>
    </div>
  );
}
