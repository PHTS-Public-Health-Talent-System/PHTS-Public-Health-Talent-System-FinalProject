"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn, User, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// Schema สำหรับ Validation
const loginSchema = z.object({
  citizenId: z
    .string()
    .length(13, "เลขบัตรประชาชนต้องมี 13 หลัก")
    .regex(/^\d+$/, "ต้องเป็นตัวเลขเท่านั้น"),
  password: z.string().min(1, "กรุณาระบุรหัสผ่าน"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth(); // Added useAuth hook
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      citizenId: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    try {
      await login({
        citizen_id: data.citizenId,
        password: data.password
      });

      toast.success("เข้าสู่ระบบสำเร็จ");
      // Redirect is handled by login() in auth-provider
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : "เลขบัตรประชาชนหรือรหัสผ่านไม่ถูกต้อง";
      toast.error("เข้าสู่ระบบไม่สำเร็จ", {
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4">
      {/* Background Decoration (Optional) */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
         <div className="absolute -top-[30%] -right-[10%] w-[700px] h-[700px] rounded-full bg-sky-100/50 blur-3xl" />
         <div className="absolute -bottom-[20%] -left-[10%] w-[600px] h-[600px] rounded-full bg-blue-50/50 blur-3xl" />
      </div>

      <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
        {/* Header Section */}
        <div className="pt-10 pb-6 px-8 text-center bg-white">
          <div className="w-24 h-24 mx-auto mb-6 relative">
             {/* ใส่ Logo โรงพยาบาลตรงนี้ */}
             <Image
              src="/logo-uttaradit-hospital.png"
              alt="Logo"
              width={96}
              height={96}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            ระบบบริหารจัดการเงิน พ.ต.ส.
          </h1>
          <p className="text-slate-500 text-base">
            Public Health Talent System
          </p>
        </div>

        {/* Form Section */}
        <div className="p-8 pt-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Citizen ID Field */}
              <FormField
                control={form.control}
                name="citizenId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 text-base font-medium">
                      เลขบัตรประจำตัวประชาชน
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                        <Input
                          {...field}
                          placeholder="ระบุเลข 13 หลัก"
                          className="pl-11 h-12 text-lg font-numbers tracking-wide border-slate-200 focus:border-primary focus:ring-primary/20 bg-slate-50/50"
                          maxLength={13}
                          inputMode="numeric"
                          disabled={isLoading}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-500 font-medium" />
                  </FormItem>
                )}
              />

              {/* Password Field */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 text-base font-medium">
                      รหัสผ่าน
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="ระบุรหัสผ่าน"
                          className="pl-11 pr-11 h-12 text-lg border-slate-200 focus:border-primary focus:ring-primary/20 bg-slate-50/50"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-500 font-medium" />
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 text-lg font-medium shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all mt-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    กำลังตรวจสอบ...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-5 w-5" />
                    เข้าสู่ระบบ
                  </>
                )}
              </Button>

              {/* Footer / Help */}
              <div className="text-center space-y-4 pt-2">
                <a href="#" className="text-primary hover:text-primary/80 text-sm font-medium hover:underline">
                  ลืมรหัสผ่าน?
                </a>
                <div className="text-xs text-slate-400 px-4">
                  หากพบปัญหาในการใช้งาน กรุณาติดต่อกลุ่มงานทรัพยากรบุคคล <br/>
                  โทร. 055-xxx-xxx ต่อ 1234
                </div>
              </div>

            </form>
          </Form>
        </div>
      </div>

      {/* Version Tag */}
      <div className="fixed bottom-4 right-4 text-xs text-slate-300">
        v1.0.0 (Beta)
      </div>
    </div>
  );
}
