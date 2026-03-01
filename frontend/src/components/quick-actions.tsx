'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

interface QuickAction {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string; // เพิ่ม optional description
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
}

interface QuickActionsProps {
  title?: string;
  actions: QuickAction[];
  columns?: 1 | 2 | 3 | 4;
}

export function QuickActions({
  title = 'การดำเนินการด่วน',
  actions,
  columns = 4,
}: QuickActionsProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3 border-b bg-muted/10 px-6 py-4">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className={cn('grid gap-4', gridCols[columns])}>
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link key={index} href={action.href} className="w-full">
                <Button
                  variant={action.variant || 'outline'}
                  className={cn(
                    'w-full h-auto py-4 px-4 justify-start items-center gap-4 whitespace-normal text-left group transition-all duration-200',
                    'hover:border-primary/50 hover:shadow-sm hover:-translate-y-0.5',
                    'bg-background',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                      action.variant === 'destructive'
                        ? 'bg-destructive/10 text-destructive group-hover:bg-destructive/20'
                        : 'bg-primary/10 text-primary group-hover:bg-primary/20',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground">{action.label}</div>
                    {action.description && (
                      <p className="text-xs text-muted-foreground font-normal mt-0.5 line-clamp-1">
                        {action.description}
                      </p>
                    )}
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
                </Button>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
