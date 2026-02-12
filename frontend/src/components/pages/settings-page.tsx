"use client"

export const dynamic = 'force-dynamic'

import React, { useState } from "react"
import { User, Bell, Mail, Save, Smartphone, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { useCurrentUser, useUpdateCurrentUserProfile } from "@/features/auth/hooks"
import { useNotificationSettings, useUpdateNotificationSettings } from "@/features/notification/hooks"
import type { ApiResponse } from "@/shared/api/types"
import type { User as AuthUser } from "@/types/auth"
import type { NotificationSettings } from "@/features/notification/api"

type UserProfile = AuthUser & {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
}

type ProfileForm = {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export function SettingsPage() {
  const { data: response, isLoading: userLoading } = useCurrentUser()
  const user = (response as ApiResponse<UserProfile> | undefined)?.data ?? null
  const { data: notifSettings, isLoading: settingsLoading } = useNotificationSettings()
  const updateSettings = useUpdateNotificationSettings()
  const updateProfile = useUpdateCurrentUserProfile()
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [successMessage, setSuccessMessage] = useState("ข้อมูลของคุณถูกบันทึกเรียบร้อยแล้ว")
  const [notifications, setNotifications] = useState<NotificationSettings>({
    in_app: true,
    sms: false,
    email: false,
  })
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  })

  // Update local state when settings load
  React.useEffect(() => {
    if (notifSettings) {
      setNotifications(notifSettings)
    }
  }, [notifSettings])

  React.useEffect(() => {
    if (!user) return
    setProfileForm({
      firstName: user.firstName || user.first_name || "",
      lastName: user.lastName || user.last_name || "",
      email: user.email || "",
      phone: user.phone || "",
    })
  }, [user])

  const handleSaveNotifications = () => {
    updateSettings.mutate(notifications, {
      onSuccess: () => {
        toast.success("บันทึกการตั้งค่าสำเร็จ")
        setSuccessMessage("บันทึกการตั้งค่าการแจ้งเตือนเรียบร้อยแล้ว")
        setShowSuccessDialog(true)
      },
      onError: (error: unknown) => {
        const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด"
        toast.error(message)
      },
    })
  }

  const handleProfileChange = (key: keyof ProfileForm, value: string) => {
    setProfileForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveProfile = () => {
    updateProfile.mutate(
      {
        first_name: profileForm.firstName.trim(),
        last_name: profileForm.lastName.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim(),
      },
      {
        onSuccess: () => {
          toast.success("บันทึกข้อมูลส่วนตัวสำเร็จ")
          setSuccessMessage("บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว")
          setShowSuccessDialog(true)
        },
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้"
          toast.error(message)
        },
      },
    )
  }

  const isProfileChanged = React.useMemo(() => {
    if (!user) return false
    const base: ProfileForm = {
      firstName: user.firstName || user.first_name || "",
      lastName: user.lastName || user.last_name || "",
      email: user.email || "",
      phone: user.phone || "",
    }
    return (
      profileForm.firstName !== base.firstName ||
      profileForm.lastName !== base.lastName ||
      profileForm.email !== base.email ||
      profileForm.phone !== base.phone
    )
  }, [profileForm, user])

  const handleResetProfile = () => {
    if (!user) return
    setProfileForm({
      firstName: user.firstName || user.first_name || "",
      lastName: user.lastName || user.last_name || "",
      email: user.email || "",
      phone: user.phone || "",
    })
    toast.success("รีเซ็ตข้อมูลกลับค่าเริ่มต้นแล้ว")
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">ตั้งค่า</h1>
        <p className="mt-1 text-muted-foreground">จัดการข้อมูลส่วนตัวและการแจ้งเตือน</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            ข้อมูลส่วนตัว
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            การแจ้งเตือน
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลส่วนตัว</CardTitle>
              <CardDescription>ข้อมูลของคุณจากระบบ HRMS</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {userLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-20 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-6">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                      {(user?.firstName || user?.first_name)?.charAt(0)}
                      {(user?.lastName || user?.last_name)?.charAt(0)}
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">รูปโปรไฟล์</p>
                      <p className="text-xs text-muted-foreground">ดึงจากระบบ HRMS</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">ชื่อ</Label>
                      <Input
                        id="firstName"
                        value={profileForm.firstName}
                        onChange={(e) => handleProfileChange("firstName", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">นามสกุล</Label>
                      <Input
                        id="lastName"
                        value={profileForm.lastName}
                        onChange={(e) => handleProfileChange("lastName", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">อีเมล</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => handleProfileChange("email", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                      <Input
                        id="phone"
                        value={profileForm.phone}
                        onChange={(e) => handleProfileChange("phone", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                    <p className="flex items-start gap-2 text-sm text-amber-700">
                      <Info className="h-4 w-4" />
                      การบันทึกจะอัปเดตข้อมูลในฐานข้อมูลระบบทันที
                    </p>
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResetProfile}
                      disabled={userLoading}
                    >
                      รีเซ็ต
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={!isProfileChanged || userLoading || updateProfile.isPending}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {updateProfile.isPending ? "กำลังบันทึก..." : "บันทึกข้อมูลส่วนตัว"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>การแจ้งเตือนในระบบ</CardTitle>
                  <CardDescription>เลือกวิธีการรับการแจ้งเตือน</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-primary" />
                      <div className="space-y-0.5">
                        <Label>แจ้งเตือนในระบบ</Label>
                        <p className="text-sm text-muted-foreground">แสดงการแจ้งเตือนในระบบ</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.in_app}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, in_app: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-primary" />
                      <div className="space-y-0.5">
                        <Label>อีเมล</Label>
                        <p className="text-sm text-muted-foreground">ส่งการแจ้งเตือนทางอีเมล</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.email}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-primary" />
                      <div className="space-y-0.5">
                        <Label>SMS</Label>
                        <p className="text-sm text-muted-foreground">ส่งการแจ้งเตือนทาง SMS</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.sms}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, sms: checked })}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveNotifications} disabled={updateSettings.isPending}>
              <Save className="mr-2 h-4 w-4" />
              บันทึกการตั้งค่า
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <DialogTitle className="text-center">บันทึกสำเร็จ</DialogTitle>
            <DialogDescription className="text-center">
              {successMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowSuccessDialog(false)} className="w-full">
              ตกลง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
