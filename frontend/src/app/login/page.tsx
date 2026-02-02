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
  const router = useRouter(); // Kept for safety, though login() handles redirect
  const { login } = useAuth();
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
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Decoration - Updated for new Palette */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
         <div className="absolute -top-[30%] -right-[10%] w-[700px] h-[700px] rounded-full bg-accent/40 blur-3xl opacity-60" />
         <div className="absolute -bottom-[20%] -left-[10%] w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl opacity-50" />
      </div>

      <div className="w-full max-w-[480px] bg-card rounded-2xl shadow-soft border border-border/60 overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Header Section */}
        <div className="pt-10 pb-6 px-8 text-center bg-card">
          <div className="w-24 h-24 mx-auto mb-6 relative">
             <Image
              src="/logo-uttaradit-hospital.png"
              alt="Logo"
              width={96}
              height={96}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold font-heading text-foreground mb-2">
            ระบบบริหารจัดการเงิน พ.ต.ส.
          </h1>
          <p className="text-muted-foreground text-base">
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
                    <FormLabel className="text-foreground text-base font-medium">
                      เลขบัตรประจำตัวประชาชน
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground" />
                        <Input
                          {...field}
                          placeholder="ระบุเลข 13 หลัก"
                          className="pl-11 h-12 text-lg font-numbers tracking-wide border-input focus:border-primary focus:ring-primary/20 bg-muted/30"
                          maxLength={13}
                          inputMode="numeric"
                          disabled={isLoading}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-destructive font-medium" />
                  </FormItem>
                )}
              />

              {/* Password Field */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground text-base font-medium">
                      รหัสผ่าน
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground" />
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="ระบุรหัสผ่าน"
                          className="pl-11 pr-11 h-12 text-lg border-input focus:border-primary focus:ring-primary/20 bg-muted/30"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-2 p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50 transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-destructive font-medium" />
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 text-lg font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all mt-2"
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
                <div className="text-xs text-muted-foreground px-4">
                  หากพบปัญหาในการใช้งาน กรุณาติดต่อกลุ่มงานทรัพยากรบุคคล <br/>
                  โทร. 055-xxx-xxx ต่อ 1234
                </div>
              </div>

            </form>
          </Form>
        </div>
      </div>

      {/* Version Tag */}
      <div className="fixed bottom-4 right-4 text-xs text-muted-foreground/60">
        v1.0.0 (Beta)
      </div>
    </div>
  );
}
