"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Building2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/components/providers/auth-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Validation Schema
const formSchema = z.object({
  citizen_id: z.string().min(13, "กรุณากรอกเลขบัตรประชาชน 13 หลัก").max(13, "เลขบัตรประชาชนต้องมี 13 หลัก"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
})

export default function LoginPage() {
  const { login } = useAuth()
  const [error, setError] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      citizen_id: "",
      password: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    setError("")
    try {
      await login(values)
      // Login success will trigger redirect in AuthProvider
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      setError(message || "เลขบัตรประชาชนหรือรหัสผ่านไม่ถูกต้อง")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-2 mb-8">
           <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-4">
            <Building2 className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            ยินดีต้อนรับเข้าสู่ระบบ
          </h1>
          <p className="text-sm text-muted-foreground">
            ระบบบริหารจัดการเงิน พ.ต.ส. (PHTS) <br/> โรงพยาบาลอุตรดิตถ์
          </p>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                {/* Alert Error */}
                {error && (
                  <Alert variant="destructive" className="py-2">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="citizen_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>เลขบัตรประชาชน</FormLabel>
                      <FormControl>
                        <Input placeholder="กรอกเลขบัตรประชาชน 13 หลัก" maxLength={13} {...field} className="h-11" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>รหัสผ่าน</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} className="h-11" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังเข้าสู่ระบบ...
                    </>
                  ) : (
                    "เข้าสู่ระบบ"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="px-8 text-center text-xs text-muted-foreground">
          หากลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ (Admin)
        </p>
      </div>
    </div>
  )
}
