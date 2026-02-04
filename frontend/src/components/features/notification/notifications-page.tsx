"use client"

import { Bell, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useMarkNotificationRead, useNotifications } from "@/features/notification/hooks"
import { toast } from "sonner"

export default function NotificationsPage() {
  const { data, isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()

  const notifications = data?.notifications ?? []
  const unreadCount = data?.unreadCount ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">การแจ้งเตือน</h2>
          <p className="text-muted-foreground">แจ้งเตือนทั้งหมดของคุณ</p>
        </div>
        <Badge variant={unreadCount > 0 ? "destructive" : "secondary"}>
          ยังไม่อ่าน {unreadCount}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>รายการแจ้งเตือน</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={`skeleton-${i}`} className="h-14 w-full" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Bell className="mx-auto h-10 w-10 mb-2 opacity-40" />
              <p>ยังไม่มีการแจ้งเตือน</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n, index) => {
                // Safety check for invalid notification objects
                if (!n || typeof n !== 'object') return null;

                const notificationId = n.notification_id ?? `${n.created_at ?? "unknown"}-${index}`;
                const isRead = n.is_read ?? false;
                const dateStr = n.created_at ? new Date(n.created_at).toLocaleString("th-TH") : "-";

                return (
                  <div
                    key={notificationId}
                    className={`flex items-start justify-between gap-4 rounded-lg border p-4 ${
                      isRead ? "bg-muted/30" : "bg-white"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{n.title || "ไม่มีหัวข้อ"}</p>
                        {!isRead && <Badge variant="secondary">ใหม่</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{n.message || "-"}</p>
                      <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                        {dateStr}
                      </p>
                    </div>
                    {!isRead && n.notification_id != null && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={markRead.isPending}
                        onClick={() => {
                          markRead.mutate(n.notification_id, {
                            onSuccess: () => toast.success("ทำเครื่องหมายว่าอ่านแล้ว"),
                            onError: () => toast.error("ไม่สามารถอัปเดตได้"),
                          })
                        }}
                      >
                        <Check className="mr-1 h-3 w-3" /> อ่านแล้ว
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}