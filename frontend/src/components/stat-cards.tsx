'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type StatColor =
  | 'primary'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'blue'
  | 'purple'
  | 'indigo';

export interface StatItem {
  title: string;
  value: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  trend?: string;
  trendUp?: boolean;
  showTrendIcon?: boolean;
  color?: StatColor; // เพิ่ม prop สำหรับกำหนดสี
}

interface StatCardsProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4;
}

const colorStyles: Record<StatColor, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-100 text-emerald-600',
  warning: 'bg-amber-100 text-amber-600',
  destructive: 'bg-red-100 text-red-600',
  blue: 'bg-blue-100 text-blue-600',
  purple: 'bg-purple-100 text-purple-600',
  indigo: 'bg-indigo-100 text-indigo-600',
};

export function StatCards({ stats, columns = 4 }: StatCardsProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns])}>
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const colorClass = colorStyles[stat.color || 'primary'];

        return (
          <Link
            key={index}
            href={stat.href}
            className="block transition-transform duration-200 hover:-translate-y-1"
          >
            <Card className="h-full border-border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-xl',
                      colorClass,
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  {stat.trend && (
                    <div
                      className={cn(
                        'flex items-center text-xs font-medium px-2 py-1 rounded-full bg-background border',
                        stat.trendUp === true &&
                          'text-emerald-600 border-emerald-100 bg-emerald-50',
                        stat.trendUp === false && 'text-red-600 border-red-100 bg-red-50',
                        stat.trendUp === undefined && 'text-muted-foreground',
                      )}
                    >
                      {stat.showTrendIcon !== false &&
                        (stat.trendUp === true ? (
                          <TrendingUp className="mr-1 h-3 w-3" />
                        ) : stat.trendUp === false ? (
                          <TrendingDown className="mr-1 h-3 w-3" />
                        ) : (
                          <Minus className="mr-1 h-3 w-3" />
                        ))}
                      {stat.trend}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <p
                    className="text-sm font-medium text-muted-foreground truncate"
                    title={stat.title}
                  >
                    {stat.title}
                  </p>
                  <h3 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                    {stat.value}
                  </h3>
                  {stat.description && (
                    <p
                      className="mt-1 text-xs text-muted-foreground line-clamp-1"
                      title={stat.description}
                    >
                      {stat.description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
