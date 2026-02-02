"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import SignaturePad from "@/components/common/signature-pad";
import { usePrefill } from "@/features/request/hooks";
import {
  useCheckSignature,
  useDeleteSignature,
  useMySignature,
  useUploadSignatureBase64,
  useUploadSignatureFile,
} from "@/features/signature/hooks";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import Image from "next/image";
import { useNotificationSettings, useUpdateNotificationSettings } from "@/features/notification/hooks";
import { User, PenTool, Bell, Upload, Eraser, Save } from "lucide-react";

// Types ... (คงเดิม)
type NotificationSettings = {
  inApp: boolean;
  sms: boolean;
  email: boolean;
};

export default function UserProfilePage() {
  // Hooks ... (คงเดิม)
  const { data: prefill, isLoading: isPrefillLoading } = usePrefill();
  const { user } = useAuth();
  const { data: signature, isLoading: isSignatureLoading } = useMySignature();
  const { data: signatureCheck } = useCheckSignature();
  const uploadBase64 = useUploadSignatureBase64();
  const uploadFile = useUploadSignatureFile();
  const deleteSignature = useDeleteSignature();
  const { data: notifSettings, isLoading: isNotifLoading } = useNotificationSettings();
  const updateNotifSettings = useUpdateNotificationSettings();
  const [localNotif, setLocalNotif] = useState<NotificationSettings>({
    inApp: true,
    sms: false,
    email: false,
  });

  const [localSignature, setLocalSignature] = useState<string>("");
  const notificationSettings: NotificationSettings = notifSettings
    ? {
        inApp: !!notifSettings.in_app,
        sms: !!notifSettings.sms,
        email: !!notifSettings.email,
      }
    : localNotif;

  const isBusy = uploadBase64.isPending || uploadFile.isPending || deleteSignature.isPending;

  const profile = useMemo(() => {
    // Logic ... (คงเดิม)
    if (!prefill) return null;
    const fullName = `${prefill.first_name ?? ""} ${prefill.last_name ?? ""}`.trim();
    return {
      fullName: fullName || "-",
      position: prefill.position_name || "-",
      positionNumber: prefill.position_number || "-",
      citizenId: prefill.citizen_id || "-",
      department: prefill.department || "-",
      subDepartment: prefill.sub_department || "-",
      employeeType: prefill.employee_type || "-",
      missionGroup: prefill.mission_group || "-",
    };
  }, [prefill]);

  // Components Helper for ReadOnly Field
  const ReadOnlyField = ({ label, value }: { label: string, value: string }) => (
    <div className="space-y-2">
       <Label className="text-slate-600 font-normal">{label}</Label>
       <div className="h-12 w-full rounded-lg bg-slate-100 px-3 py-3 text-slate-900 font-medium border-none shadow-inner text-base">
          {value}
       </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
           <User className="h-7 w-7" />
        </div>
        <div>
           <h1 className="text-3xl font-bold text-slate-900">โปรไฟล์ผู้ใช้งาน</h1>
           <p className="text-slate-500 text-lg">จัดการข้อมูลส่วนตัวและลายเซ็นดิจิทัล</p>
        </div>
      </div>

      {/* 1. Personal Info Section */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100">
          <CardTitle className="text-xl text-slate-800">ข้อมูลส่วนตัว (จากระบบ HR)</CardTitle>
          <CardDescription>ข้อมูลนี้ถูกดึงมาจากระบบฐานข้อมูลบุคลากร หากไม่ถูกต้องกรุณาติดต่อ HR</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {isPrefillLoading ? (
            <div className="grid gap-6 md:grid-cols-2">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <ReadOnlyField label="ชื่อ-นามสกุล" value={profile?.fullName ?? "-"} />
              <ReadOnlyField label="เลขบัตรประชาชน" value={profile?.citizenId ?? "-"} />

              <div className="md:col-span-2 my-2 h-px bg-slate-100" />

              <ReadOnlyField label="ตำแหน่ง" value={profile?.position ?? "-"} />
              <ReadOnlyField label="เลขที่ตำแหน่ง" value={profile?.positionNumber ?? "-"} />
              <ReadOnlyField label="กลุ่มงาน" value={profile?.department ?? "-"} />
              <ReadOnlyField label="หน่วยงาน" value={profile?.subDepartment ?? "-"} />
              <ReadOnlyField label="ประเภทบุคลากร" value={profile?.employeeType ?? "-"} />
              <ReadOnlyField label="Mission Group" value={profile?.missionGroup ?? "-"} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Signature Section */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center gap-3">
          <PenTool className="h-5 w-5 text-primary" />
          <div>
             <CardTitle className="text-xl text-slate-800">ลายเซ็นดิจิทัล</CardTitle>
             <CardDescription>ใช้สำหรับลงนามในเอกสารคำขอเบิกเงิน</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Current Signature Display */}
          <div className="bg-slate-50 rounded-xl p-6 border-2 border-dashed border-slate-200 text-center">
             <div className="mb-2 text-sm text-slate-500">สถานะปัจจุบัน</div>
             {isSignatureLoading ? (
               <Skeleton className="h-32 w-64 mx-auto rounded-lg" />
             ) : signature?.data_url ? (
               <div className="relative group inline-block">
                 <Image
                   src={signature.data_url}
                   alt="signature"
                   width={300}
                   height={150}
                   className="max-h-32 w-auto object-contain mx-auto mix-blend-multiply"
                 />
                 <div className="mt-4 flex justify-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✅ มีลายเซ็นในระบบแล้ว
                    </span>
                 </div>
               </div>
             ) : (
               <div className="py-8 text-slate-400">
                 <PenTool className="h-10 w-10 mx-auto mb-2 opacity-20" />
                 <p>ยังไม่มีลายเซ็น</p>
               </div>
             )}
          </div>

          <div className="grid md:grid-cols-2 gap-8">
             {/* Draw Signature */}
             <div className="space-y-4">
                <Label className="text-base font-semibold">วาดลายเซ็นใหม่</Label>
                <div className="border border-slate-300 rounded-xl overflow-hidden shadow-inner bg-white">
                  <SignaturePad
                    onSave={(value) => setLocalSignature(value)}
                    placeholder="เซ็นชื่อที่นี่..."
                    // ปรับแต่ง SignaturePad props เพิ่มเติมถ้า component รองรับ
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    className="flex-1 h-12 text-base"
                    onClick={async () => {
                      if (!localSignature) {
                        toast.error("กรุณาวาดลายเซ็นก่อนบันทึก");
                        return;
                      }
                      await uploadBase64.mutateAsync(localSignature);
                      toast.success("บันทึกลายเซ็นแล้ว");
                    }}
                    disabled={isBusy}
                  >
                    <Save className="mr-2 h-4 w-4" /> บันทึก
                  </Button>
                  <Button
                    variant="destructive"
                    className="h-12 px-4 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
                    onClick={async () => {
                      if (!signatureCheck?.has_signature) return;
                      await deleteSignature.mutateAsync();
                      toast.success("ลบลายเซ็นแล้ว");
                    }}
                    disabled={isBusy || !signatureCheck?.has_signature}
                  >
                    <Eraser className="h-4 w-4" /> ลบ
                  </Button>
                </div>
             </div>

             {/* Upload File */}
             <div className="space-y-4">
                <Label className="text-base font-semibold">หรือ อัปโหลดไฟล์รูปภาพ</Label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                   <Upload className="h-8 w-8 text-slate-400 mb-2" />
                   <p className="text-sm text-slate-600 font-medium">คลิกเพื่อเลือกไฟล์</p>
                   <p className="text-xs text-slate-400 mt-1">รองรับไฟล์ .png, .jpg (พื้นหลังใสดีที่สุด)</p>
                   <Input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        await uploadFile.mutateAsync(file);
                        toast.success("อัปโหลดลายเซ็นแล้ว");
                      }}
                      disabled={isBusy}
                    />
                </div>
             </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Settings */}
      <Card className="border-slate-200 shadow-sm rounded-xl">
        <CardHeader className="flex flex-row items-center gap-3">
           <Bell className="h-5 w-5 text-primary" />
           <CardTitle className="text-xl text-slate-800">ตั้งค่าการแจ้งเตือน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-6">
          {isNotifLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="divide-y divide-slate-100">
               {[
                 { id: "in-app", label: "แจ้งเตือนในระบบ (In-App)", key: "inApp", desc: "แสดงรายการแจ้งเตือนที่มุมขวาบนของหน้าจอ" },
                 { id: "sms", label: "แจ้งเตือนทาง SMS", key: "sms", desc: "ส่งข้อความเมื่อมีความเคลื่อนไหวสำคัญ (อาจมีค่าบริการ)", disabled: true },
                 { id: "email", label: "แจ้งเตือนทางอีเมล", key: "email", desc: "ส่งรายละเอียดไปยังอีเมลที่ลงทะเบียนไว้", disabled: true }
               ].map((item) => (
                 <div key={item.id} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                    <Checkbox
                      id={item.id}
                      checked={notificationSettings[item.key as keyof NotificationSettings]}
                      disabled={item.disabled}
                      className="mt-1 h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      onCheckedChange={(val) => {
                        const next = { ...notificationSettings, [item.key]: !!val };
                        setLocalNotif(next);
                        updateNotifSettings.mutate({
                          in_app: next.inApp,
                          sms: next.sms,
                          email: next.email,
                        });
                      }}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor={item.id}
                        className={`text-base font-medium ${item.disabled ? 'text-slate-400' : 'text-slate-900 cursor-pointer'}`}
                      >
                        {item.label}
                      </Label>
                      <p className="text-sm text-slate-500">{item.desc}</p>
                    </div>
                 </div>
               ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
