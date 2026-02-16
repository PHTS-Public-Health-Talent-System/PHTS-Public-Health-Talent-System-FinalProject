'use client';

export const dynamic = 'force-dynamic';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import {
  PenTool,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useMySignature, useRefreshSignature } from '@/features/signature/hooks';

export function SignaturePage() {
  const { data: signature, isLoading, error } = useMySignature();
  const refreshSignature = useRefreshSignature();
  const queryClient = useQueryClient();
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  const handleRefresh = () => {
    if (cooldownLeft > 0) return;
    refreshSignature.mutate(undefined, {
      onSuccess: (data) => {
        const delayMs = data?.delay_ms ?? 1500;
        const now = Date.now();
        const cooldownMs = 5000;
        setCooldownUntil(now + cooldownMs);
        toast.success('อัปเดตข้อมูลลายเซ็นแล้ว');
        window.setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['my-signature'] });
          queryClient.invalidateQueries({ queryKey: ['signature-check'] });
        }, delayMs + 300);
      },
      onError: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
        toast.error(message);
      },
    });
  };

  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, cooldownUntil - Date.now());
      setCooldownLeft(left);
      if (left === 0) {
        window.clearInterval(timer);
        setCooldownUntil(null);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  return (
    <div className="container max-w-5xl mx-auto p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">ลายเซ็นอิเล็กทรอนิกส์</h1>
        <p className="text-muted-foreground">
          ดูและตรวจสอบลายเซ็นดิจิทัลของคุณสำหรับการอนุมัติเอกสาร
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Main Signature Card */}
        <div className="md:col-span-8 lg:col-span-8">
          <Card className="h-full border-border shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <PenTool className="h-5 w-5 text-primary" />
                    ลายเซ็นปัจจุบัน
                  </CardTitle>
                  <CardDescription className="mt-1">
                    รูปภาพลายเซ็นที่ใช้ในระบบอนุมัติ
                  </CardDescription>
                </div>
                {!isLoading && signature?.data_url && (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-3 py-1"
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    พร้อมใช้งาน
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-[200px] w-full rounded-xl bg-secondary/50" />
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-[200px] rounded-xl border border-destructive/20 bg-destructive/5 text-center">
                  <AlertCircle className="h-10 w-10 text-destructive mb-2 opacity-80" />
                  <p className="font-medium text-destructive">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
                  <Button
                    variant="link"
                    onClick={() => window.location.reload()}
                    className="text-destructive underline mt-2"
                  >
                    ลองใหม่อีกครั้ง
                  </Button>
                </div>
              ) : signature?.data_url ? (
                <div className="space-y-4">
                  {/* Signature Preview Area with Grid Pattern */}
                  <div className="relative flex items-center justify-center h-[240px] rounded-xl border border-border bg-background overflow-hidden group">
                    <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:16px_16px]" />
                    <Image
                      src={signature.data_url}
                      alt="ลายเซ็น"
                      width={400}
                      height={200}
                      className="max-h-[180px] w-auto object-contain transition-transform group-hover:scale-105"
                      unoptimized
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm px-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ShieldCheck className="h-4 w-4" />
                      <span>ยืนยันตัวตนผ่านระบบ HRMS</span>
                    </div>
                    <span className="text-xs text-muted-foreground/60">
                      อัปเดตล่าสุด: อัตโนมัติ
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[240px] rounded-xl border border-dashed border-border bg-secondary/5 text-center">
                  <div className="p-4 rounded-full bg-secondary/50 mb-3">
                    <PenTool className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="font-medium text-foreground">ไม่พบข้อมูลลายเซ็น</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                    ระบบไม่พบไฟล์ลายเซ็นของคุณ กรุณาติดต่อฝ่ายบุคคลเพื่อดำเนินการบันทึกลายเซ็น
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Info & Actions */}
        <div className="md:col-span-4 lg:col-span-4 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                ข้อมูลและการใช้งาน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-3">
                <p>
                  <strong className="text-foreground font-medium">ที่มาของข้อมูล:</strong>
                  <br />
                  ลายเซ็นถูกดึงโดยตรงจากระบบฐานข้อมูลบุคลากร (HRMS) เพื่อความปลอดภัยและถูกต้อง
                </p>
                <p>
                  <strong className="text-foreground font-medium">การนำไปใช้:</strong>
                  <br />
                  จะปรากฏในเอกสารคำขออนุมัติและรายงานต่างๆ ที่คุณเป็นผู้ลงนามโดยอัตโนมัติ
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">เครื่องมือ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="default"
                className="w-full justify-start shadow-sm"
                onClick={handleRefresh}
                disabled={refreshSignature.isPending || cooldownLeft > 0}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${refreshSignature.isPending ? 'animate-spin' : ''}`}
                />
                {refreshSignature.isPending
                  ? 'กำลังซิงค์ข้อมูล...'
                  : cooldownLeft > 0
                    ? `รอสักครู่ (${Math.ceil(cooldownLeft / 1000)}s)`
                    : 'ซิงค์ข้อมูลใหม่จาก HRMS'}
              </Button>

              <Button variant="outline" className="w-full justify-start bg-background" asChild>
                <a href="#" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  เปิดระบบ HRMS
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
