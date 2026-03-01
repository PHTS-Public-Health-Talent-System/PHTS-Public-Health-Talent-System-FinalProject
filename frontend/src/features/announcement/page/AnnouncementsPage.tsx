'use client';

export const dynamic = 'force-dynamic';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone, Calendar, AlertCircle, Info, Pin } from 'lucide-react';
import { useActiveAnnouncements } from '@/features/announcement/listing';
import { formatThaiDate } from '@/shared/utils/thai-locale';

function mapPriorityToDisplay(priority: string): string {
  switch (priority?.toUpperCase()) {
    case 'HIGH':
      return 'high';
    case 'NORMAL':
      return 'normal';
    case 'LOW':
      return 'low';
    default:
      return 'normal';
  }
}

const getPriorityStyles = (priority: string) => {
  switch (priority) {
    case 'high':
      return {
        badge: 'bg-destructive/10 text-destructive border-destructive/20',
        border: 'border-l-4 border-l-destructive',
        icon: <AlertCircle className="h-5 w-5 text-destructive" />,
      };
    case 'normal':
      return {
        badge: 'bg-primary/10 text-primary border-primary/20',
        border: 'border-l-4 border-l-primary',
        icon: <Info className="h-5 w-5 text-primary" />,
      };
    case 'low':
      return {
        badge: 'bg-secondary text-secondary-foreground',
        border: 'border-l-4 border-l-secondary',
        icon: <Megaphone className="h-5 w-5 text-muted-foreground" />,
      };
    default:
      return {
        badge: 'bg-secondary',
        border: 'border-l-4 border-l-muted',
        icon: <Megaphone className="h-5 w-5" />,
      };
  }
};

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'สำคัญ';
    case 'normal':
      return 'ทั่วไป';
    case 'low':
      return 'แจ้งทราบ';
    default:
      return 'ประกาศ';
  }
};

export function AnnouncementsPage() {
  const { data: announcements, isLoading, error } = useActiveAnnouncements();

  // Sort: High priority first, then by date (assuming API returns date sorted, but good to be safe)
  const sortedAnnouncements = useMemo(() => {
    if (!announcements) return [];
    return [...announcements].sort((a, b) => {
      const priorityOrder = { HIGH: 3, NORMAL: 2, LOW: 1 } as const;
      const pA = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
      const pB = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
      if (pA !== pB) return pB - pA;
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [announcements]);

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="bg-destructive/10 p-4 rounded-full w-fit mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">เกิดข้อผิดพลาด</h3>
            <p className="text-muted-foreground">ไม่สามารถโหลดข้อมูลประกาศได้ในขณะนี้</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Megaphone className="h-8 w-8 text-primary" />
          ข่าวสารและประกาศ
        </h1>
        <p className="text-muted-foreground text-lg">
          ติดตามข่าวสารสำคัญและการแจ้งเตือนจากระบบจัดการเงิน พ.ต.ส.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <div className="flex">
                <div className="w-1 bg-muted animate-pulse"></div>
                <div className="flex-1 p-6 space-y-4">
                  <div className="flex justify-between">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : sortedAnnouncements.length > 0 ? (
        <div className="grid gap-4">
          {sortedAnnouncements.map((announcement) => {
            const priority = mapPriorityToDisplay(announcement.priority);
            const styles = getPriorityStyles(priority);

            return (
              <Card
                key={announcement.id}
                className={`overflow-hidden transition-all hover:shadow-md group ${styles.border}`}
              >
                <CardHeader className="pb-3 pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 p-2 rounded-lg bg-background border shadow-sm shrink-0`}
                      >
                        {styles.icon}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg font-semibold leading-tight group-hover:text-primary transition-colors">
                            {announcement.title}
                          </CardTitle>
                          {priority === 'high' && (
                            <Badge
                              variant="secondary"
                              className="h-5 px-1.5 text-[10px] bg-red-50 text-red-700 border-red-100 gap-1"
                            >
                              <Pin className="w-3 h-3" /> ปักหมุด
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <Badge variant="outline" className={`font-normal ${styles.badge}`}>
                            {getPriorityLabel(priority)}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {announcement.created_at &&
                              formatThaiDate(announcement.created_at, { month: 'long' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-5 pl-[4.5rem]">
                  <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                    {announcement.body}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl bg-muted/10">
          <div className="bg-background p-4 rounded-full shadow-sm mb-4">
            <Megaphone className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">ไม่มีประกาศใหม่</h3>
          <p className="text-muted-foreground mt-1 max-w-sm">
            ขณะนี้ยังไม่มีข่าวสารหรือประกาศแจ้งเตือน หากมีข้อมูลใหม่จะปรากฏที่หน้านี้
          </p>
        </div>
      )}
    </div>
  );
}
