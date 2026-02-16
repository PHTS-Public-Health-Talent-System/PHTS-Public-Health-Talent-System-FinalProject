'use client';

import { use } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  User,
  Shield,
  Clock,
  Building2,
  Calendar,
  History,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import { useSystemUserById } from '@/features/system/hooks';
import { useEntityAuditTrail } from '@/features/audit/hooks';
import { formatThaiDateTime } from '@/shared/utils/thai-locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

// --- Types ---
type SystemUserDetail = {
  id: number;
  citizen_id: string;
  role: string;
  is_active: number;
  last_login_at: string | null;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  position_name: string | null;
  updated_at: string | null;
  created_at: string | null;
  avatar_url?: string;
};

type AuditTrailEvent = {
  audit_id: number;
  event_type: string;
  action_detail?: Record<string, unknown> | null;
  created_at: string;
  ip_address?: string | null;
  actor_name?: string;
};

// --- Helpers ---
const getInitials = (name: string) => {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const getRoleBadgeColor = (role: string) => {
  if (role === 'ADMIN') return 'bg-red-50 text-red-700 border-red-200';
  if (role === 'DIRECTOR') return 'bg-purple-50 text-purple-700 border-purple-200';
  return 'bg-secondary text-secondary-foreground';
};

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const userId = Number(id);
  const userQuery = useSystemUserById(Number.isNaN(userId) ? undefined : userId);
  const auditQuery = useEntityAuditTrail('USER', Number.isNaN(userId) ? undefined : userId);

  const user = (userQuery.data ?? null) as SystemUserDetail | null;
  const events = (auditQuery.data ?? []) as AuditTrailEvent[];

  const name = [user?.first_name ?? '', user?.last_name ?? ''].join(' ').trim() || 'ไม่ระบุชื่อ';
  const isActive = Number(user?.is_active) === 1;

  if (userQuery.isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-10 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[50vh] text-center">
        <User className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold text-foreground">ไม่พบข้อมูลผู้ใช้งาน</h2>
        <p className="text-muted-foreground mt-2">ผู้ใช้งาน ID: {id} อาจถูกลบหรือไม่มีอยู่ในระบบ</p>
        <Button variant="outline" className="mt-6" asChild>
          <Link href="/admin/users">กลับหน้ารายชื่อ</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header Navigation */}
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> กลับไปหน้ารายชื่อ
        </Link>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-background shadow-sm">
              <AvatarImage src={user.avatar_url} />
              <AvatarFallback className="text-lg bg-primary/10 text-primary font-medium">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                {name}
                <Badge
                  variant={isActive ? 'default' : 'destructive'}
                  className="text-xs font-normal"
                >
                  {isActive ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                </Badge>
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                  {user.citizen_id}
                </span>
                <span>•</span>
                <span>{user.position_name || 'ไม่ระบุตำแหน่ง'}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Profile & Status */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Info */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-4 border-b bg-muted/10">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                ข้อมูลส่วนตัว
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    ชื่อ-นามสกุล
                  </span>
                  <p className="font-medium">{name}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    รหัสประชาชน
                  </span>
                  <p className="font-mono">{user.citizen_id}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    หน่วยงาน
                  </span>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{user.department || '-'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    ตำแหน่ง
                  </span>
                  <p>{user.position_name || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Status */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-4 border-b bg-muted/10">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                สถานะบัญชี
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    สิทธิ์การใช้งาน
                  </span>
                  <div>
                    <Badge
                      variant="outline"
                      className={`font-normal mt-1 ${getRoleBadgeColor(user.role)}`}
                    >
                      {user.role}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    เข้าสู่ระบบล่าสุด
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {user.last_login_at
                        ? formatThaiDateTime(user.last_login_at)
                        : 'ยังไม่เคยเข้าใช้งาน'}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    วันที่สร้างบัญชี
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {user.created_at ? formatThaiDateTime(user.created_at) : '-'}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    อัปเดตล่าสุด
                  </span>
                  <p className="text-sm mt-1">
                    {user.updated_at ? formatThaiDateTime(user.updated_at) : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Audit Trail */}
        <div className="lg:col-span-1">
          <Card className="border-border shadow-sm h-full flex flex-col">
            <CardHeader className="pb-4 border-b bg-muted/10">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                ประวัติการเปลี่ยนแปลง
              </CardTitle>
              <CardDescription className="text-xs">
                กิจกรรมล่าสุดที่เกี่ยวข้องกับผู้ใช้นี้
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <div className="overflow-y-auto max-h-[600px] p-4 space-y-6">
                {auditQuery.isLoading ? (
                  <p className="text-sm text-center text-muted-foreground py-8">
                    กำลังโหลดข้อมูล...
                  </p>
                ) : events.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">ไม่มีประวัติการเปลี่ยนแปลง</p>
                  </div>
                ) : (
                  <div className="relative border-l border-muted ml-2 space-y-6 pl-6 py-2">
                    {events.map((event) => (
                      <div key={event.audit_id} className="relative group">
                        <div className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground group-hover:bg-primary transition-colors" />
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                            {event.event_type}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatThaiDateTime(event.created_at)}
                          </span>
                          <div className="text-xs text-muted-foreground mt-1 bg-muted/30 p-2 rounded border border-border/50">
                            <p>
                              <span className="font-medium">โดย:</span>{' '}
                              {event.actor_name || 'ระบบ'}
                            </p>
                            {event.ip_address && (
                              <p>
                                <span className="font-medium">ไอพี:</span> {event.ip_address}
                              </p>
                            )}
                            {event.action_detail && (
                              <pre className="mt-1 text-[9px] overflow-x-auto opacity-70">
                                {JSON.stringify(event.action_detail, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
