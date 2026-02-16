'use client';

export const dynamic = 'force-dynamic';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Mail,
  Phone,
  FileText,
  CheckCircle2,
  ExternalLink,
  User,
  AlertCircle,
  Building2,
  CalendarDays,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useCurrentUser } from '@/features/auth/hooks';
import type { ApiResponse } from '@/shared/api/types';
import type { User as AuthUser } from '@/types/auth';
import { formatThaiDate as formatThaiDateValue } from '@/shared/utils/thai-locale';

type UserProfile = AuthUser & {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  license_no?: string;
  license_valid_until?: string | Date;
  license_name?: string;
  license_status?: 'ACTIVE' | 'EXPIRED' | 'INACTIVE' | 'UNKNOWN';
};

const formatThaiDate = (value?: string | Date | null) => {
  return formatThaiDateValue(value, { month: 'long' });
};

const resolveLicenseStatusLabel = (status?: UserProfile['license_status']) => {
  switch (status) {
    case 'ACTIVE':
      return 'ใช้งานได้';
    case 'EXPIRED':
      return 'หมดอายุ';
    case 'INACTIVE':
      return 'ไม่ใช้งาน';
    default:
      return 'ไม่พบข้อมูล';
  }
};

const resolveLicenseStatusClass = (status?: UserProfile['license_status']) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'EXPIRED':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'INACTIVE':
      return 'bg-secondary text-muted-foreground border-border';
    default:
      return 'bg-secondary text-muted-foreground border-border';
  }
};

const resolveLicenseStatusIcon = (status?: UserProfile['license_status']) => {
  switch (status) {
    case 'ACTIVE':
      return CheckCircle2;
    case 'EXPIRED':
      return AlertCircle;
    default:
      return ShieldCheck;
  }
};

export default function ProfilePage() {
  const { data: response, isLoading } = useCurrentUser();
  const user = (response as ApiResponse<UserProfile> | undefined)?.data ?? null;

  const initials = useMemo(() => {
    const first = (user?.firstName || user?.first_name || '').charAt(0).toUpperCase();
    const last = (user?.lastName || user?.last_name || '').charAt(0).toUpperCase();
    return first + last || 'U';
  }, [user]);

  return (
    <div className="container max-w-5xl mx-auto p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">โปรไฟล์ของฉัน</h1>
        <p className="text-muted-foreground">จัดการข้อมูลส่วนตัวและตรวจสอบสถานะใบอนุญาต</p>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Left Column: Avatar & Contact */}
        <div className="md:col-span-4 lg:col-span-3 space-y-6">
          <Card className="border-border shadow-sm overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-primary/10 to-primary/5" />
            <CardContent className="relative pt-0 pb-6 text-center">
              <div className="-mt-12 mb-4 flex justify-center">
                {isLoading ? (
                  <Skeleton className="h-24 w-24 rounded-full border-4 border-background" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground border-4 border-background text-3xl font-bold shadow-sm">
                    {initials}
                  </div>
                )}
              </div>

              {isLoading ? (
                <div className="space-y-2 flex flex-col items-center">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-semibold text-foreground">
                    {user?.firstName || user?.first_name} {user?.lastName || user?.last_name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {user?.position || 'ตำแหน่งไม่ระบุ'}
                  </p>
                </>
              )}

              <div className="mt-6 space-y-3 text-left">
                <Separator />
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{user?.email || '-'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{user?.phone || '-'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{user?.department || '-'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">การดำเนินการ</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button variant="outline" className="w-full justify-start gap-2" asChild>
                <Link href="#">
                  <ExternalLink className="h-4 w-4" />
                  ไปที่ระบบ HRMS
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Mail className="h-4 w-4" />
                ติดต่อฝ่ายบุคคล
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Details */}
        <div className="md:col-span-8 lg:col-span-9 space-y-6">
          {/* General Info */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" />
                ข้อมูลทั่วไป
              </CardTitle>
              <CardDescription>ข้อมูลพื้นฐานจากระบบบุคลากร</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="grid gap-6 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      ชื่อจริง
                    </p>
                    <p className="text-base font-medium">
                      {user?.firstName || user?.first_name || '-'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      นามสกุล
                    </p>
                    <p className="text-base font-medium">
                      {user?.lastName || user?.last_name || '-'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      ตำแหน่ง
                    </p>
                    <p className="text-base font-medium">{user?.position || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      หน่วยงาน/แผนก
                    </p>
                    <p className="text-base font-medium">{user?.department || '-'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* License Info */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                ใบอนุญาตประกอบวิชาชีพ
              </CardTitle>
              <CardDescription>ข้อมูลใบอนุญาตสำหรับใช้เบิกจ่าย พ.ต.ส.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* License Status Banner */}
                  <div
                    className={`flex items-center gap-3 p-4 rounded-lg border ${resolveLicenseStatusClass(user?.license_status)} bg-opacity-10 border-opacity-20`}
                  >
                    {(() => {
                      const StatusIcon = resolveLicenseStatusIcon(user?.license_status);
                      return <StatusIcon className="h-6 w-6" />;
                    })()}
                    <div>
                      <p className="font-semibold text-sm">
                        สถานะใบอนุญาต: {resolveLicenseStatusLabel(user?.license_status)}
                      </p>
                      {user?.license_status === 'EXPIRED' && (
                        <p className="text-xs opacity-90">
                          กรุณาต่ออายุใบอนุญาตและแจ้งเจ้าหน้าที่เพื่ออัปเดตข้อมูล
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        เลขที่ใบอนุญาต
                      </p>
                      <p className="text-base font-mono font-medium">{user?.license_no || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        ประเภทใบอนุญาต
                      </p>
                      <p className="text-base font-medium">{user?.license_name || '-'}</p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <CalendarDays className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">
                          วันหมดอายุ
                        </span>
                      </div>
                      <p className="text-lg font-medium">
                        {formatThaiDate(user?.license_valid_until)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
