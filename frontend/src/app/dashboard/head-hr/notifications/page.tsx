"use client";

import { useMemo, useState } from "react";
import { Bell, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarkNotificationRead, useNotifications } from "@/features/notification/hooks";
import type { Notification } from "@/features/notification/api";
import { toast } from "sonner";

const payrollKeywords = ["งวด", "เงินเดือน", "HR", "หัวหน้า HR", "คำขอ"];
const slaKeywords = ["SLA", "เกิน SLA", "ใกล้ถึง SLA", "วันทำการ"];
const payrollLinks = ["/dashboard/head-hr", "/dashboard/approver/requests"];

function matchAny(text: string, keywords: string[]) {
  return keywords.some((k) => text.includes(k));
}

function classifyNotification(n: Notification) {
  const text = `${n.title} ${n.message}`;
  const type = (n.type ?? "").toUpperCase();
  const link = n.link ?? "";
  if (type.includes("SLA") || matchAny(text, slaKeywords)) return "SLA";
  if (payrollLinks.some((p) => link.includes(p)) || matchAny(text, payrollKeywords)) return "PAYROLL";
  return "OTHER";
}

export default function HeadHrNotificationsPage() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const [query, setQuery] = useState("");
  const [showPayroll, setShowPayroll] = useState(true);
  const [showSla, setShowSla] = useState(true);
  const [showOther, setShowOther] = useState(false);

  const notifications = useMemo(() => data?.notifications ?? [], [data]);
  const unreadCount = data?.unreadCount ?? 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notifications.filter((n) => {
      const bucket = classifyNotification(n);
      if (bucket === "PAYROLL" && !showPayroll) return false;
      if (bucket === "SLA" && !showSla) return false;
      if (bucket === "OTHER" && !showOther) return false;
      if (!q) return true;
      return `${n.title} ${n.message}`.toLowerCase().includes(q);
    });
  }, [notifications, query, showPayroll, showSla, showOther]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">การแจ้งเตือน (HR)</h2>
          <p className="text-muted-foreground">เฉพาะงานที่เกี่ยวข้องกับ HR</p>
        </div>
        <Badge variant={unreadCount > 0 ? "destructive" : "secondary"}>ยังไม่อ่าน {unreadCount}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ตัวกรอง</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาในหัวข้อ/ข้อความ"
            className="w-72"
          />
          <Button variant={showPayroll ? "default" : "outline"} onClick={() => setShowPayroll((v) => !v)}>
            งานงวดเงินเดือน
          </Button>
          <Button variant={showSla ? "default" : "outline"} onClick={() => setShowSla((v) => !v)}>
            SLA/เตือนกำหนด
          </Button>
          <Button variant={showOther ? "default" : "outline"} onClick={() => setShowOther((v) => !v)}>
            อื่น ๆ
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setQuery("");
              setShowPayroll(true);
              setShowSla(true);
              setShowOther(false);
            }}
          >
            รีเซ็ต
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายการแจ้งเตือน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Bell className="mx-auto h-10 w-10 mb-2 opacity-40" />
              <p>ยังไม่มีการแจ้งเตือน</p>
            </div>
          ) : (
            filtered.map((n) => (
              <div
                key={n.notification_id}
                className={`flex items-start justify-between gap-4 rounded-lg border p-4 ${
                  n.is_read ? "bg-muted/30" : "bg-white"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{n.title}</p>
                    {!n.is_read && <Badge variant="secondary">ใหม่</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("th-TH")}
                  </p>
                </div>
                {!n.is_read && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={markRead.isPending}
                    onClick={() => {
                      markRead.mutate(n.notification_id, {
                        onSuccess: () => toast.success("ทำเครื่องหมายว่าอ่านแล้ว"),
                        onError: () => toast.error("ไม่สามารถอัปเดตได้"),
                      });
                    }}
                  >
                    <Check className="mr-1 h-3 w-3" /> อ่านแล้ว
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
