"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import { isAxiosError } from "axios";
import { Eye, EyeOff, Loader2, LogIn, User, Lock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
type ValidationDetail = { field?: string; message?: string };

const toThaiLoginError = (message: string) => {
  if (message === "Invalid citizen ID or password" || message === "Login failed") {
    return "เลขบัตรประชาชนหรือรหัสผ่านไม่ถูกต้อง";
  }
  return message;
};

const getValidationSummary = (errors: Record<string, unknown>): string[] => {
  return Object.values(errors)
    .map((error) => {
      if (!error || typeof error !== "object") return null;
      const message = (error as { message?: unknown }).message;
      return typeof message === "string" ? message : null;
    })
    .filter((message): message is string => Boolean(message));
};

export default function LoginPage() {
  const { login } = useAuth(); // Added useAuth hook
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number>(0);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      citizenId: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginFormValues) {
    if (isLoading || retryAfterSeconds > 0) return;
    setIsLoading(true);
    setRetryAfterSeconds(0);
    setServerError(null);
    try {
      await login({
        citizen_id: data.citizenId,
        password: data.password
      });

      toast.success("เข้าสู่ระบบสำเร็จ");
    } catch (error: unknown) {
      let message = error instanceof Error ? error.message : "เลขบัตรประชาชนหรือรหัสผ่านไม่ถูกต้อง";
      const details: ValidationDetail[] =
        (isAxiosError(error) && Array.isArray((error.response?.data as { details?: unknown })?.details)
          ? ((error.response?.data as { details?: ValidationDetail[] }).details ?? [])
          : Array.isArray((error as { details?: unknown })?.details)
            ? ((error as { details?: ValidationDetail[] }).details ?? [])
            : []);

      if (isAxiosError(error) && error.response?.status === 429) {
        const retryAfter = Number(error.response.headers?.["retry-after"]);
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          setRetryAfterSeconds(Math.floor(retryAfter));
          message = `พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองอีกครั้งใน ${Math.floor(retryAfter)} วินาที`;
        } else {
          message = "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
        }
      } else {
        if (details.length > 0) {
          for (const detail of details) {
            const field = detail.field ?? "";
            if (field.endsWith("citizen_id")) {
              form.setError("citizenId", { type: "server", message: detail.message || "ข้อมูลไม่ถูกต้อง" });
            } else if (field.endsWith("password")) {
              form.setError("password", { type: "server", message: detail.message || "ข้อมูลไม่ถูกต้อง" });
            }
          }
          message = details[0]?.message || message;
        }

        const isExpectedAuthError =
          message === "Invalid citizen ID or password" ||
          message === "Login failed";
        if (!isExpectedAuthError && process.env.NODE_ENV !== "test") {
          console.error(error);
        }
      }

      setServerError(toThaiLoginError(message));

      toast.error("เข้าสู่ระบบไม่สำเร็จ", {
        description: toThaiLoginError(message),
      });
    } finally {
      setIsLoading(false);
    }
  }

  const onInvalid = () => {
    const messages = getValidationSummary(form.formState.errors as Record<string, unknown>);
    if (messages.length > 0) {
      setServerError(messages[0] ?? "กรุณาตรวจสอบข้อมูลอีกครั้ง");
      toast.error("กรุณากรอกข้อมูลให้ถูกต้อง");
    }
  };

  useEffect(() => {
    if (retryAfterSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRetryAfterSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAfterSeconds]);

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
              alt="โลโก้โรงพยาบาลอุตรดิตถ์"
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
            ระบบ พ.ต.ส.
          </p>
        </div>

        {/* Form Section */}
        <div className="p-8 pt-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">

              {(serverError || Object.keys(form.formState.errors).length > 0) && (
                <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>ตรวจสอบข้อมูลการเข้าสู่ระบบ</AlertTitle>
                  <AlertDescription className="space-y-1">
                    {serverError && <p>{serverError}</p>}
                    {!serverError &&
                      getValidationSummary(form.formState.errors as Record<string, unknown>).map(
                        (message, index) => <p key={`${message}-${index}`}>{message}</p>,
                      )}
                  </AlertDescription>
                </Alert>
              )}

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
                          disabled={isLoading || retryAfterSeconds > 0}
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
                          disabled={isLoading || retryAfterSeconds > 0}
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
                disabled={isLoading || retryAfterSeconds > 0}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    กำลังตรวจสอบ...
                  </>
                ) : retryAfterSeconds > 0 ? (
                  <>ลองใหม่ใน {retryAfterSeconds} วินาที</>
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
