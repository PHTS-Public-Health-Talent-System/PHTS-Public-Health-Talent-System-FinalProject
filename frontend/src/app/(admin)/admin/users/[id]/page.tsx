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
  History,
  Activity,
  ShieldAlert,
  GitCompareArrows,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Briefcase,
} from 'lucide-react';
import Link from 'next/link';
import { useSystemUserById, useUserSyncAudits } from '@/features/system/hooks';
import { useEntityAuditTrail } from '@/features/audit/hooks';
import { useAccessReviewQueue } from '@/features/access-review/hooks';
import type { AccessReviewQueueRow, AccessReviewQueueStatus } from '@/features/access-review/api';
import type { UserSyncAuditRecord } from '@/features/system/types';
import { formatThaiDateTime } from '@/shared/utils/thai-locale';
import { getRoleLabel } from '@/shared/utils/role-label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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
  scopes?: Array<{
    scope_type: 'UNIT' | 'DEPT';
    scope_name: string;
    source: string;
  }>;
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

// UX FIX: ปรับการดึงตัวย่อภาษาไทยให้รองรับสระได้ดีขึ้น
const getInitials = (name: string) => {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  // ดึงตัวอักษรแรกของคำหน้า และคำหลัง
  return (parts[0].charAt(0) + (parts[1]?.charAt(0) || '')).toUpperCase();
};

const getRoleBadgeColor = (role: string) => {
  if (role === 'ADMIN') return 'bg-red-50 text-red-700 border-red-200';
  if (role === 'DIRECTOR') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (['HEAD_HR', 'HEAD_FINANCE'].includes(role))
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['PTS_OFFICER', 'FINANCE_OFFICER'].includes(role))
    return 'bg-blue-50 text-blue-700 border-blue-200';
  if (['HEAD_WARD', 'HEAD_DEPT'].includes(role))
    return 'bg-orange-50 text-orange-700 border-orange-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const getQueueReasonLabel = (reasonCode: string) => {
  switch (reasonCode) {
    case 'NEW_USER':
      return 'ผู้ใช้ใหม่จากรอบซิงก์';
    case 'ROLE_MISMATCH':
      return 'บทบาทไม่ตรงกติกา';
    case 'PROFILE_CHANGED':
      return 'ข้อมูลบุคลากรเปลี่ยน';
    case 'INACTIVE_BUT_ACTIVE':
      return 'บุคลากรไม่พร้อมใช้งาน แต่บัญชีเปิดอยู่';
    default:
      return reasonCode;
  }
};

const getQueueStatusMeta = (status: AccessReviewQueueStatus) => {
  switch (status) {
    case 'OPEN':
      return {
        label: 'ค้างตรวจ',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: AlertTriangle,
      };
    case 'IN_REVIEW':
      return {
        label: 'กำลังตรวจ',
        className: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: Clock,
      };
    case 'RESOLVED':
      return {
        label: 'ปิดแล้ว',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: CheckCircle2,
      };
    case 'DISMISSED':
      return {
        label: 'ยกเลิกเคส',
        className: 'bg-slate-50 text-slate-600 border-slate-200',
        icon: XCircle,
      };
    default:
      return {
        label: status,
        className: 'bg-slate-50 text-slate-600 border-slate-200',
        icon: ShieldAlert,
      };
  }
};

const getSyncActionLabel = (action: UserSyncAuditRecord['action']) => {
  switch (action) {
    case 'CREATE':
      return 'สร้างบัญชี';
    case 'ACTIVATE':
      return 'เปิดใช้งาน';
    case 'DEACTIVATE':
      return 'ปิดใช้งาน';
    case 'PASSWORD_FILLED':
      return 'เติมรหัสผ่าน';
    case 'DEACTIVATE_MISSING':
      return 'ปิด (ไม่พบในการซิงก์)';
    default:
      return action;
  }
};

const getSyncActionBadgeClass = (action: UserSyncAuditRecord['action']) => {
  if (action === 'CREATE') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (action === 'ACTIVATE') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (action === 'DEACTIVATE' || action === 'DEACTIVATE_MISSING')
    return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const getRolePolicyHint = (roleCode: string) => {
  if (roleCode === 'HEAD_DEPT' || roleCode === 'HEAD_WARD') {
    return 'สิทธิ์นี้อิงข้อมูล HRMS จาก special_position และอาจถูกซิงก์ปรับอัตโนมัติ';
  }
  if (roleCode === 'ADMIN' || roleCode === 'PTS_OFFICER') {
    return 'สิทธิ์นี้เป็นสิทธิ์ที่แอดมินกำหนดและไม่ควรถูกซิงก์ทับ';
  }
  return 'สิทธิ์นี้ใช้ค่าปัจจุบันของบัญชีผู้ใช้ และจะเปลี่ยนเมื่อมีการจัดการโดยผู้ดูแลหรือกติกาเฉพาะ';
};

const ACTION_DETAIL_LABELS: Record<string, string> = {
  role: 'สิทธิ์',
  isActive: 'สถานะบัญชี',
  reason: 'เหตุผล',
  cycle_id: 'รอบตรวจสอบ',
  queue_id: 'คิวตรวจสอบ',
  sync_batch_id: 'รอบซิงก์',
  before_is_active: 'สถานะเดิม',
  after_is_active: 'สถานะใหม่',
};

const formatActionDetailValue = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'ใช่' : 'ไม่ใช่';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const formatActionDetailLabel = (key: string): string =>
  ACTION_DETAIL_LABELS[key] ?? key.replaceAll('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());

const toActionDetailEntries = (detail?: Record<string, unknown> | null) => {
  if (!detail || typeof detail !== 'object') return [];
  return Object.entries(detail).map(([key, value]) => ({
    key,
    label: formatActionDetailLabel(key),
    value: formatActionDetailValue(value),
  }));
};

// --- Sub Component: Label Value Pair ---
const DetailItem = ({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) => (
  <div className="space-y-1">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    <div className={cn('text-sm text-foreground', mono && 'font-mono')}>{value || '-'}</div>
  </div>
);

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const userId = Number(id);

  const userQuery = useSystemUserById(Number.isNaN(userId) ? undefined : userId);
  const auditQuery = useEntityAuditTrail('USER', Number.isNaN(userId) ? undefined : userId);
  const userData = (userQuery.data ?? null) as SystemUserDetail | null;
  const citizenId = userData?.citizen_id;

  const queueQuery = useAccessReviewQueue(
    { page: 1, limit: 10, search: citizenId },
    { enabled: Boolean(citizenId) },
  );

  const syncAuditQuery = useUserSyncAudits(
    { limit: 10, citizen_id: citizenId },
    { enabled: Boolean(citizenId) },
  );

  const user = userData;
  const events = (auditQuery.data ?? []) as AuditTrailEvent[];
  const queueRows = ((queueQuery.data?.rows ?? []) as AccessReviewQueueRow[]).filter(
    (r) => r.citizen_id === user?.citizen_id,
  );
  const latestQueue = queueRows[0] ?? null;
  const syncAudits = (syncAuditQuery.data ?? []) as UserSyncAuditRecord[];
  const latestSyncAudit = syncAudits[0] ?? null;

  const name = [user?.first_name ?? '', user?.last_name ?? ''].join(' ').trim() || 'ไม่ระบุชื่อ';
  const isActive = Number(user?.is_active) === 1;

  if (userQuery.isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
          <Skeleton className="h-[600px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="bg-muted/50 p-6 rounded-full mb-4">
          <User className="h-12 w-12 text-muted-foreground/50" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">ไม่พบข้อมูลผู้ใช้งาน</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          ผู้ใช้งาน ID: {id} อาจถูกลบ หรือคุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้
        </p>
        <Button variant="outline" className="mt-6" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="mr-2 h-4 w-4" /> กลับหน้ารายชื่อ
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1400px] mx-auto">
      {/* Header Navigation */}
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-5 bg-muted/30 px-3 py-1.5 rounded-full hover:bg-muted/60"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> กลับไปหน้ารายชื่อ
        </Link>
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 border-2 border-background shadow-sm shrink-0">
            <AvatarImage src={user.avatar_url} />
            <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1.5 pt-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              {name}
              <div
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  isActive
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                    : 'bg-slate-300',
                )}
                title={isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
              />
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono bg-muted/50 px-2 py-0.5 rounded border">
                {user.citizen_id}
              </span>
              <span className="text-border px-1">•</span>
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> {user.position_name || 'ไม่ระบุตำแหน่ง'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">สถานะบัญชี</p>
            <p className="mt-1 text-lg font-semibold">{isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</p>
            <p
              className="text-xs text-muted-foreground truncate"
              title={user.last_login_at ? formatThaiDateTime(user.last_login_at) : ''}
            >
              {user.last_login_at
                ? `เข้าใช้ล่าสุด ${formatThaiDateTime(user.last_login_at, { dateStyle: 'short', timeStyle: 'short' })}`
                : 'ยังไม่เคยเข้าใช้'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">สิทธิ์ปัจจุบัน</p>
            <p className="mt-1 text-lg font-semibold">{getRoleLabel(user.role)}</p>
            <p className="text-xs text-muted-foreground font-mono uppercase">{user.role}</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">ขอบเขตข้อมูล</p>
            <p className="mt-1 text-lg font-semibold">{user.scopes?.length ?? 0} รายการ</p>
            <p className="text-xs text-muted-foreground">
              {user.scopes?.length ? 'มี scope พิเศษ' : 'ใช้สิทธิ์พื้นฐานของ role'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">สถานะตรวจสิทธิ์ล่าสุด</p>
            <p className="mt-1 text-lg font-semibold">
              {latestQueue ? getQueueStatusMeta(latestQueue.status).label : 'ปกติ'}
            </p>
            <p
              className="text-xs text-muted-foreground truncate"
              title={latestQueue ? getQueueReasonLabel(latestQueue.reason_code) : ''}
            >
              {latestQueue
                ? `${getQueueReasonLabel(latestQueue.reason_code)}`
                : 'ไม่มีคิวตรวจสิทธิ์ค้าง'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Left Column: Profile & Status */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Info */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-4 border-b bg-muted/5">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> ข้อมูลส่วนตัว
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              <div className="grid gap-y-6 sm:grid-cols-2">
                <DetailItem label="ชื่อ-นามสกุล" value={name} />
                <DetailItem label="รหัสประชาชน" value={user.citizen_id} mono />
                <DetailItem
                  label="หน่วยงานสังกัด"
                  value={
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{user.department || '-'}</span>
                    </div>
                  }
                />
                <DetailItem label="ตำแหน่ง" value={user.position_name || '-'} />
              </div>
            </CardContent>
          </Card>

          {/* Account Status */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-4 border-b bg-muted/5">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> สถานะและการเข้าถึง
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              <div className="grid gap-y-6 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    สิทธิ์การใช้งาน (Role)
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn('font-normal', getRoleBadgeColor(user.role))}
                    >
                      {getRoleLabel(user.role)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">
                      {user.role}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getRolePolicyHint(user.role)}
                  </p>
                </div>
                <DetailItem
                  label="การเข้าสู่ระบบล่าสุด"
                  value={
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>
                        {user.last_login_at
                          ? formatThaiDateTime(user.last_login_at, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : 'ยังไม่เคยเข้าใช้งาน'}
                      </span>
                    </div>
                  }
                />
                <DetailItem
                  label="วันที่สร้างบัญชี"
                  value={
                    user.created_at
                      ? formatThaiDateTime(user.created_at, { dateStyle: 'medium' })
                      : '-'
                  }
                />
                <DetailItem
                  label="อัปเดตข้อมูลล่าสุด"
                  value={
                    user.updated_at
                      ? formatThaiDateTime(user.updated_at, { dateStyle: 'medium' })
                      : '-'
                  }
                />
                <div className="space-y-2 sm:col-span-2 pt-2 border-t border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">
                    ขอบเขตสิทธิ์ (Data Scopes)
                  </span>
                  {!user.scopes || user.scopes.length === 0 ? (
                    <p className="text-sm text-muted-foreground/80 italic">
                      เข้าถึงข้อมูลตามสิทธิ์ Role พื้นฐานเท่านั้น (ไม่มี Scope พิเศษ)
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {user.scopes.map((scope) => (
                        <Badge
                          key={`${scope.scope_type}:${scope.scope_name}`}
                          variant="secondary"
                          className="font-normal bg-muted"
                        >
                          <span className="text-muted-foreground mr-1">
                            {scope.scope_type === 'DEPT' ? 'กลุ่มงาน:' : 'หน่วยงาน:'}
                          </span>
                          {scope.scope_name}{' '}
                          <span className="text-[10px] opacity-50 ml-1">({scope.source})</span>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Access Review & Sync Snapshot Grid */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Queue Snapshot */}
            <Card className="border-border shadow-sm flex flex-col">
              <CardHeader className="pb-3 border-b bg-muted/5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-600" /> คิวตรวจสิทธิ์ (Access Review)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col">
                {queueQuery.isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : !latestQueue ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground py-6">
                    <CheckCircle2 className="h-8 w-8 opacity-20 mb-2 text-emerald-500" />
                    <p className="text-sm">ปกติ</p>
                    <p className="text-xs mt-0.5">ไม่มีคิวตรวจสิทธิ์ที่ต้องจัดการ</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'gap-1 px-1.5',
                          getQueueStatusMeta(latestQueue.status).className,
                        )}
                      >
                        {(() => {
                          const MetaIcon = getQueueStatusMeta(latestQueue.status).icon;
                          return <MetaIcon className="h-3 w-3" />;
                        })()}
                        {getQueueStatusMeta(latestQueue.status).label}
                      </Badge>
                      <Badge variant="secondary" className="font-normal text-xs">
                        {getQueueReasonLabel(latestQueue.reason_code)}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs">
                      <p className="text-muted-foreground flex justify-between">
                        <span>ตรวจพบ:</span>{' '}
                        <span className="text-foreground font-medium">
                          {formatThaiDateTime(latestQueue.last_detected_at, { dateStyle: 'short' })}
                        </span>
                      </p>
                      <p className="text-muted-foreground flex justify-between">
                        <span>รอบซิงก์:</span>{' '}
                        <span className="text-foreground font-mono">
                          {latestQueue.last_seen_batch_id
                            ? `#${latestQueue.last_seen_batch_id}`
                            : '-'}
                        </span>
                      </p>
                      <p className="text-muted-foreground flex justify-between">
                        <span>พบครั้งแรก:</span>{' '}
                        <span className="text-foreground font-medium">
                          {formatThaiDateTime(latestQueue.first_detected_at, {
                            dateStyle: 'short',
                          })}
                        </span>
                      </p>
                    </div>

                    {/* UX FIX: Deep Link ไปยัง Access Review พร้อมส่งค่า citizen_id ไปค้นหาอัตโนมัติ */}
                    <Button variant="outline" size="sm" className="w-full h-8 text-xs" asChild>
                      <Link href={`/admin/access-review?search=${user.citizen_id}`}>
                        จัดการในหน้าตรวจสอบสิทธิ์
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sync Timeline */}
            <Card className="border-border shadow-sm flex flex-col">
              <CardHeader className="pb-3 border-b bg-muted/5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <GitCompareArrows className="h-4 w-4 text-blue-600" /> ประวัติซิงก์ล่าสุด
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <div className="p-2 space-y-1 max-h-[180px] overflow-y-auto">
                  {syncAuditQuery.isLoading ? (
                    <div className="p-3">
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : syncAudits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-8">
                      <GitCompareArrows className="h-8 w-8 opacity-20 mb-2" />
                      <p className="text-sm">ไม่มีประวัติการซิงก์ข้อมูล</p>
                    </div>
                  ) : (
                    syncAudits.map((item) => (
                      <div
                        key={item.audit_id}
                        className="p-3 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] h-5 px-1.5 font-normal',
                              getSyncActionBadgeClass(item.action),
                            )}
                          >
                            {getSyncActionLabel(item.action)}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatThaiDateTime(item.created_at, { dateStyle: 'short' })}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                          <span className="font-mono">Batch #{item.sync_batch_id || '-'}</span>
                          <span>
                            {item.before_is_active ?? '-'} {'->'}{' '}
                            <span className="font-medium text-foreground">
                              {item.after_is_active ?? '-'}
                            </span>
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column: Audit Trail (Robust Timeline) */}
        <div className="lg:col-span-1">
          <Card className="border-border shadow-sm h-full flex flex-col">
            <CardHeader className="pb-4 border-b bg-muted/5 sticky top-0 z-10">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> ประวัติกิจกรรม (Audit Trail)
              </CardTitle>
              <CardDescription className="text-xs">
                กิจกรรมล่าสุดที่เกี่ยวข้องกับผู้ใช้นี้ในระบบ
              </CardDescription>
              {latestSyncAudit && (
                <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
                  การซิงก์ล่าสุด:{' '}
                  <span className="font-medium text-foreground">
                    {getSyncActionLabel(latestSyncAudit.action)}
                  </span>{' '}
                  • Batch #{latestSyncAudit.sync_batch_id ?? '-'}
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <div className="h-[600px] overflow-y-auto p-5">
                {auditQuery.isLoading ? (
                  <div className="space-y-6">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-4">
                        <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-16 w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground flex flex-col items-center">
                    <Activity className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm">ไม่มีประวัติกิจกรรม</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-6">
                    {events.map((event, idx) => (
                      <div key={event.audit_id} className="contents group">
                        {/* Timeline Line & Dot Column */}
                        <div className="relative flex flex-col items-center">
                          <div className="h-3 w-3 rounded-full border-2 border-background bg-muted-foreground group-hover:bg-primary transition-colors z-10 mt-1" />
                          {idx !== events.length - 1 && (
                            <div className="absolute top-4 bottom-[-24px] w-px bg-border group-hover:bg-border/80 transition-colors" />
                          )}
                        </div>

                        {/* Content Column */}
                        <div className="flex flex-col gap-1 pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                              {event.event_type}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatThaiDateTime(event.created_at, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>

                          <div className="mt-2 text-xs bg-muted/20 rounded-md border border-border/50 p-3 space-y-1.5 transition-colors group-hover:bg-muted/30">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">ดำเนินการโดย:</span>
                              <span className="font-medium text-foreground">
                                {event.actor_name || 'ระบบ'}
                              </span>
                            </div>
                            {event.ip_address && (
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-muted-foreground">ไอพีแอดเดรส:</span>
                                <span className="font-mono text-[10px] bg-background px-1.5 py-0.5 rounded text-muted-foreground border">
                                  {event.ip_address}
                                </span>
                              </div>
                            )}

                            {/* Action Details (Metadata) */}
                            {(() => {
                              const detailEntries = toActionDetailEntries(event.action_detail);
                              if (detailEntries.length === 0) return null;
                              return (
                                <div className="mt-2 pt-2 border-t border-border/60 space-y-1">
                                  {detailEntries.map((entry) => (
                                    <div
                                      key={`${event.audit_id}-${entry.key}`}
                                      className="flex flex-col sm:flex-row sm:justify-between sm:gap-4 py-0.5"
                                    >
                                      <span className="text-muted-foreground">{entry.label}:</span>
                                      <span className="font-medium text-foreground text-right break-words max-w-full sm:max-w-[150px]">
                                        {entry.value}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
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
