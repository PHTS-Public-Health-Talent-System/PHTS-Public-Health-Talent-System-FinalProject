'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, LayoutList } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface DataTableCardProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  viewAllHref?: string;
  viewAllLabel?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function DataTableCard({
  title,
  description,
  icon: Icon = LayoutList, // Default icon
  viewAllHref,
  viewAllLabel = 'ดูทั้งหมด',
  children,
  action,
  className,
  contentClassName,
}: DataTableCardProps) {
  return (
    <Card className={cn('border-border shadow-sm flex flex-col h-full overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-start justify-between border-b bg-muted/10 px-6 py-4 space-y-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
          </div>
          {description && (
            <CardDescription className="text-xs ml-8 line-clamp-1">{description}</CardDescription>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-2">
          {action}
          {viewAllHref && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 text-xs font-medium text-muted-foreground hover:text-primary px-2"
            >
              <Link href={viewAllHref}>
                {viewAllLabel}
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className={cn('flex-1 p-6', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
