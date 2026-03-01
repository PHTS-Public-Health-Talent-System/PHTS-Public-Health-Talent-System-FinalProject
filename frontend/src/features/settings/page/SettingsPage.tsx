'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { User, Bell, Mail, Save, Smartphone, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useCurrentUser, useUpdateCurrentUserProfile } from '@/features/auth/hooks';
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '@/features/notification/preferences';
import type { ApiResponse } from '@/shared/api/types';
import type { User as AuthUser } from '@/types/auth';
import type { NotificationSettings } from '@/features/notification/shared';

type UserProfile = AuthUser & {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
};

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type ProfileFieldErrors = Partial<Record<keyof ProfileForm, string>>;
type ValidationDetail = { field?: string; message?: string };

const isValidEmail = (value: string) =>
  value.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function SettingsPage() {
  const { data: response, isLoading: userLoading } = useCurrentUser();
  const user = (response as ApiResponse<UserProfile> | undefined)?.data ?? null;
  const { data: notifSettings, isLoading: settingsLoading } = useNotificationSettings();
  const updateSettings = useUpdateNotificationSettings();
  const updateProfile = useUpdateCurrentUserProfile();

  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState<ProfileFieldErrors>({});

  const [notifications, setNotifications] = useState<NotificationSettings>({
    in_app: true,
    sms: false,
    email: false,
  });

  const [profileForm, setProfileForm] = useState<ProfileForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  // Update local state when settings load
  React.useEffect(() => {
    if (notifSettings) {
      setNotifications(notifSettings);
    }
  }, [notifSettings]);

  React.useEffect(() => {
    if (!user) return;
    setProfileForm({
      firstName: user.firstName || user.first_name || '',
      lastName: user.lastName || user.last_name || '',
      email: user.email || '',
      phone: user.phone || '',
    });
  }, [user]);

  const handleSaveNotifications = () => {
    updateSettings.mutate(notifications, {
      onSuccess: () => {
        setSuccessMessage('บันทึกการตั้งค่าการแจ้งเตือนเรียบร้อยแล้ว');
        setShowSuccessDialog(true);
      },
      onError: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
        toast.error(message);
      },
    });
  };

  const handleProfileChange = (key: keyof ProfileForm, value: string) => {
    setProfileForm((prev) => ({ ...prev, [key]: value }));
    setProfileError(null);
    setProfileFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSaveProfile = () => {
    setProfileError(null);
    const nextErrors: ProfileFieldErrors = {};
    if (!profileForm.firstName.trim()) nextErrors.firstName = 'กรุณาระบุชื่อจริง';
    if (!profileForm.lastName.trim()) nextErrors.lastName = 'กรุณาระบุนามสกุล';
    if (!isValidEmail(profileForm.email)) nextErrors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    if (profileForm.phone.trim() && !/^[0-9+\-\s]{8,15}$/.test(profileForm.phone.trim())) {
      nextErrors.phone = 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง';
    }
    if (Object.keys(nextErrors).length > 0) {
      setProfileFieldErrors(nextErrors);
      setProfileError('กรุณาตรวจสอบข้อมูลก่อนบันทึก');
      return;
    }

    updateProfile.mutate(
      {
        first_name: profileForm.firstName.trim(),
        last_name: profileForm.lastName.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim(),
      },
      {
        onSuccess: () => {
          setSuccessMessage('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
          setShowSuccessDialog(true);
          setProfileFieldErrors({});
          setProfileError(null);
        },
        onError: (error: unknown) => {
          const details = Array.isArray((error as { details?: unknown })?.details)
            ? (((error as { details?: ValidationDetail[] }).details ?? []) as ValidationDetail[])
            : [];
          const nextErrors: ProfileFieldErrors = {};
          for (const detail of details) {
            const field = detail.field ?? '';
            if (field.endsWith('first_name')) nextErrors.firstName = detail.message || 'ข้อมูลไม่ถูกต้อง';
            if (field.endsWith('last_name')) nextErrors.lastName = detail.message || 'ข้อมูลไม่ถูกต้อง';
            if (field.endsWith('email')) nextErrors.email = detail.message || 'ข้อมูลไม่ถูกต้อง';
            if (field.endsWith('phone')) nextErrors.phone = detail.message || 'ข้อมูลไม่ถูกต้อง';
          }
          if (Object.keys(nextErrors).length > 0) {
            setProfileFieldErrors(nextErrors);
          }
          const message = details[0]?.message || (error instanceof Error ? error.message : 'ไม่สามารถบันทึกข้อมูลได้');
          setProfileError(message);
          toast.error(message);
        },
      },
    );
  };

  const isProfileChanged = React.useMemo(() => {
    if (!user) return false;
    const base: ProfileForm = {
      firstName: user.firstName || user.first_name || '',
      lastName: user.lastName || user.last_name || '',
      email: user.email || '',
      phone: user.phone || '',
    };
    return (
      profileForm.firstName !== base.firstName ||
      profileForm.lastName !== base.lastName ||
      profileForm.email !== base.email ||
      profileForm.phone !== base.phone
    );
  }, [profileForm, user]);

  const handleResetProfile = () => {
    if (!user) return;
    setProfileForm({
      firstName: user.firstName || user.first_name || '',
      lastName: user.lastName || user.last_name || '',
      email: user.email || '',
      phone: user.phone || '',
    });
    setProfileFieldErrors({});
    setProfileError(null);
    toast.info('คืนค่าข้อมูลเดิมแล้ว');
  };

  return (
    <div className="container max-w-4xl mx-auto p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">การตั้งค่า</h1>
        <p className="text-muted-foreground">จัดการข้อมูลส่วนตัวและการตั้งค่าการใช้งานระบบ</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-secondary/50 w-full justify-start h-auto p-1">
          <TabsTrigger value="profile" className="gap-2 px-4 py-2">
            <User className="h-4 w-4" /> ข้อมูลส่วนตัว
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 px-4 py-2">
            <Bell className="h-4 w-4" /> การแจ้งเตือน
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" /> ข้อมูลบัญชีผู้ใช้
              </CardTitle>
              <CardDescription>ข้อมูลนี้จะถูกนำไปใช้ในเอกสารและรายงานต่างๆ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {userLoading ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-20 w-20 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ) : (
                <>
                  {profileError && (
                    <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>ไม่สามารถบันทึกข้อมูลได้</AlertTitle>
                      <AlertDescription>{profileError}</AlertDescription>
                    </Alert>
                  )}

                  {/* Avatar Section */}
                  <div className="flex items-center gap-6 p-4 rounded-lg bg-secondary/20 border border-border/50">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground shadow-sm">
                      {(user?.firstName || user?.first_name || 'U')?.charAt(0).toUpperCase()}
                      {(user?.lastName || user?.last_name || '')?.charAt(0).toUpperCase()}
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-medium text-lg">รูปโปรไฟล์</h3>
                      <p className="text-sm text-muted-foreground">
                        แสดงตัวอักษรย่อจากชื่อของคุณ (ดึงข้อมูลจาก HRMS)
                      </p>
                    </div>
                  </div>

                  {/* Form Section */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">ชื่อจริง</Label>
                      <Input
                        id="firstName"
                        value={profileForm.firstName}
                        onChange={(e) => handleProfileChange('firstName', e.target.value)}
                        className="bg-background"
                      />
                      {profileFieldErrors.firstName && (
                        <p className="text-xs text-destructive">{profileFieldErrors.firstName}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">นามสกุล</Label>
                      <Input
                        id="lastName"
                        value={profileForm.lastName}
                        onChange={(e) => handleProfileChange('lastName', e.target.value)}
                        className="bg-background"
                      />
                      {profileFieldErrors.lastName && (
                        <p className="text-xs text-destructive">{profileFieldErrors.lastName}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">อีเมลติดต่อ</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => handleProfileChange('email', e.target.value)}
                        className="bg-background"
                      />
                      {profileFieldErrors.email && (
                        <p className="text-xs text-destructive">{profileFieldErrors.email}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                      <Input
                        id="phone"
                        value={profileForm.phone}
                        onChange={(e) => handleProfileChange('phone', e.target.value)}
                        className="bg-background"
                      />
                      {profileFieldErrors.phone && (
                        <p className="text-xs text-destructive">{profileFieldErrors.phone}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleResetProfile}
                      disabled={!isProfileChanged}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      คืนค่าเดิม
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={!isProfileChanged || updateProfile.isPending}
                      className="min-w-[120px]"
                    >
                      {updateProfile.isPending ? (
                        'กำลังบันทึก...'
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" /> บันทึกการเปลี่ยนแปลง
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" /> การแจ้งเตือน
              </CardTitle>
              <CardDescription>เลือกช่องทางที่คุณต้องการรับข่าวสารและสถานะคำขอ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settingsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-secondary/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                        <Bell className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">แจ้งเตือนในระบบ (In-App)</Label>
                        <p className="text-sm text-muted-foreground">
                          แสดงรายการแจ้งเตือนเมื่อคุณเข้าใช้งานเว็บไซต์
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.in_app}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, in_app: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-secondary/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-full bg-amber-100 text-amber-600">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">อีเมล (Email)</Label>
                        <p className="text-sm text-muted-foreground">
                          ส่งสรุปสถานะคำขอไปยังอีเมลของคุณ
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.email}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, email: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-secondary/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-full bg-emerald-100 text-emerald-600">
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">ข้อความ SMS</Label>
                        <p className="text-sm text-muted-foreground">
                          แจ้งเตือนด่วนทางเบอร์โทรศัพท์ (เฉพาะเรื่องสำคัญ)
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.sms}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, sms: checked })
                      }
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-border">
                <Button
                  onClick={handleSaveNotifications}
                  disabled={updateSettings.isPending}
                  className="min-w-[120px]"
                >
                  {updateSettings.isPending ? (
                    'กำลังบันทึก...'
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" /> บันทึกการตั้งค่า
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="p-3 rounded-full bg-emerald-500/10 mb-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <DialogTitle className="text-xl mb-2">บันทึกสำเร็จ</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              {successMessage}
            </DialogDescription>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowSuccessDialog(false)} className="w-full sm:w-32">
              ตกลง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
