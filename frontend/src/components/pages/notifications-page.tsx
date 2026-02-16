'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Bell,
  CheckCircle2,
  Clock,
  Trash2,
  CheckCheck,
  Info,
  CreditCard,
  FileWarning,
  CalendarClock,
  Filter,
  X,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useNotifications,
  useMarkNotificationRead,
  useDeleteReadNotifications,
} from '@/features/notification/hooks';
import { formatThaiDateTime, formatThaiTime } from '@/shared/utils/thai-locale';

type NotificationType = 'approval' | 'reminder' | 'system' | 'payment' | 'license' | 'leave';

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'approval':
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case 'reminder':
      return <Clock className="h-5 w-5 text-amber-500" />;
    case 'system':
      return <Info className="h-5 w-5 text-primary" />;
    case 'payment':
      return <CreditCard className="h-5 w-5 text-purple-500" />;
    case 'license':
      return <FileWarning className="h-5 w-5 text-destructive" />;
    case 'leave':
      return <CalendarClock className="h-5 w-5 text-blue-500" />;
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
};

const getTypeLabel = (type: NotificationType) => {
  switch (type) {
    case 'approval':
      return 'การอนุมัติ';
    case 'reminder':
      return 'เตือนความจำ';
    case 'system':
      return 'ระบบ';
    case 'payment':
      return 'การจ่ายเงิน';
    case 'license':
      return 'ใบอนุญาต';
    case 'leave':
      return 'การลา';
    default:
      return 'ทั่วไป';
  }
};

const getTimeLabel = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInDays === 0) return 'วันนี้';
  if (diffInDays === 1) return 'เมื่อวาน';
  if (diffInDays < 7) return 'สัปดาห์นี้';
  return 'เก่ากว่านั้น';
};

export function NotificationsPage() {
  const { data: notifData, isLoading, error } = useNotifications();
  const markRead = useMarkNotificationRead();
  const deleteRead = useDeleteReadNotifications();

  const [filterType, setFilterType] = useState<string>('all');
  const [filterReadStatus, setFilterReadStatus] = useState<string>('all');

  const notifications = useMemo(() => notifData?.notifications ?? [], [notifData?.notifications]);
  const unreadCount = notifData?.unreadCount || 0;

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const matchesType = filterType === 'all' || n.type === filterType;
      const matchesRead =
        filterReadStatus === 'all' || (filterReadStatus === 'unread' ? !n.is_read : n.is_read);
      return matchesType && matchesRead;
    });
  }, [notifications, filterType, filterReadStatus]);

  // Group notifications by time
  const groupedNotifications = useMemo(() => {
    const groups: Record<string, typeof filteredNotifications> = {
      วันนี้: [],
      เมื่อวาน: [],
      สัปดาห์นี้: [],
      เก่ากว่านั้น: [],
    };
    filteredNotifications.forEach((n) => {
      const label = getTimeLabel(n.created_at);
      if (groups[label]) groups[label].push(n);
    });
    return groups;
  }, [filteredNotifications]);

  const handleMarkAsRead = (id: number) => {
    markRead.mutate(id, {
      onSuccess: () => toast.success('อ่านแล้ว'),
      onError: () => toast.error('เกิดข้อผิดพลาด'),
    });
  };

  const handleMarkAllAsRead = () => {
    notifications.filter((n) => !n.is_read).forEach((n) => markRead.mutate(n.id));
    toast.success('อ่านทั้งหมดแล้ว');
  };

  const handleDeleteRead = () => {
    deleteRead.mutate(undefined, {
      onSuccess: () => toast.success('ลบรายการที่อ่านแล้ว'),
      onError: () => toast.error('เกิดข้อผิดพลาด'),
    });
  };

  const formatTime = (dateString: string) => {
    return formatThaiTime(dateString);
  };

  const formatDateFull = (dateString: string) => {
    return formatThaiDateTime(dateString);
  };

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="bg-destructive/10 p-4 rounded-full w-fit mx-auto">
            <Bell className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">เกิดข้อผิดพลาด</h3>
            <p className="text-muted-foreground">ไม่สามารถโหลดการแจ้งเตือนได้</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Bell className="h-6 w-6 text-primary" />
            การแจ้งเตือน
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2 h-6 min-w-[1.5rem] px-2 rounded-full">
                {unreadCount}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">ติดตามสถานะคำขอและข่าวสารสำคัญจากระบบ</p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
              <CheckCheck className="mr-2 h-4 w-4" /> อ่านทั้งหมด
            </Button>
          )}
          {notifications.some((n) => n.is_read) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteRead}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> ลบที่อ่านแล้ว
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">ตัวกรอง:</span>
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px] h-9 text-xs bg-background border-input">
              <SelectValue placeholder="ประเภท" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกประเภท</SelectItem>
              <SelectItem value="approval">การอนุมัติ</SelectItem>
              <SelectItem value="payment">การจ่ายเงิน</SelectItem>
              <SelectItem value="system">ระบบ</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterReadStatus} onValueChange={setFilterReadStatus}>
            <SelectTrigger className="w-[140px] h-9 text-xs bg-background border-input">
              <SelectValue placeholder="สถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="unread">ยังไม่อ่าน</SelectItem>
              <SelectItem value="read">อ่านแล้ว</SelectItem>
            </SelectContent>
          </Select>
          {(filterType !== 'all' || filterReadStatus !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-muted-foreground hover:text-foreground ml-auto"
              onClick={() => {
                setFilterType('all');
                setFilterReadStatus('all');
              }}
            >
              <X className="h-3 w-3 mr-1" /> ล้างตัวกรอง
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Notification List */}
      <div className="space-y-8">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4 flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl bg-muted/10">
            <div className="bg-background p-4 rounded-full shadow-sm mb-4">
              <Bell className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <p className="text-muted-foreground">ไม่มีการแจ้งเตือนที่ตรงกับเงื่อนไข</p>
          </div>
        ) : (
          Object.entries(groupedNotifications).map(
            ([label, items]) =>
              items.length > 0 && (
                <div key={label} className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                    {label}
                  </h3>
                  {items.map((notification) => (
                    <div
                      key={notification.id}
                      className={`relative flex gap-4 p-4 rounded-xl border transition-all hover:shadow-sm ${
                        !notification.is_read
                          ? 'bg-card border-primary/20 shadow-sm'
                          : 'bg-muted/10 border-transparent hover:bg-card hover:border-border'
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${!notification.is_read ? 'bg-primary/10' : 'bg-muted'}`}
                      >
                        {getNotificationIcon(notification.type as NotificationType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p
                            className={`text-sm font-medium ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'}`}
                          >
                            {notification.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {label === 'วันนี้' || label === 'เมื่อวาน'
                              ? formatTime(notification.created_at)
                              : formatDateFull(notification.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-5 px-1.5 font-normal bg-secondary/50 text-muted-foreground border-transparent"
                          >
                            {getTypeLabel(notification.type as NotificationType)}
                          </Badge>
                          {!notification.is_read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] px-2 text-primary hover:text-primary hover:bg-primary/10 ml-auto"
                              onClick={() => handleMarkAsRead(notification.id)}
                              disabled={markRead.isPending}
                            >
                              ทำเครื่องหมายว่าอ่านแล้ว
                            </Button>
                          )}
                        </div>
                      </div>
                      {!notification.is_read && (
                        <div className="absolute top-4 right-[-6px] w-2 h-2 rounded-full bg-primary ring-4 ring-background" />
                      )}
                    </div>
                  ))}
                </div>
              ),
          )
        )}
      </div>
    </div>
  );
}
