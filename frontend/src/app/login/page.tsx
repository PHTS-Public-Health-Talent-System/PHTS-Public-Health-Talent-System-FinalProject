"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, Loader2, Lock, User, LogIn } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const { login } = useAuth();

  // State เหมือนต้นฉบับ frontend_old
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Logic เหมือนต้นฉบับ แต่ใช้ AuthProvider (redirect จัดการใน AuthProvider)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({ citizen_id: username, password });
      // Redirect จัดการโดย AuthProvider
    } catch (err: unknown) {
      console.error("Login failed:", err);
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as { response?: { status?: number } };
        if (axiosError.response?.status === 401) {
          setError("ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง");
        } else if (axiosError.response?.status === 403) {
          setError("บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
        } else {
          setError("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ กรุณาลองใหม่อีกครั้ง");
        }
      } else {
        setError("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="h-screen overflow-hidden grid grid-cols-1 md:grid-cols-[7fr_5fr]">
      {/* LEFT SIDE: Image & Overlay (7fr) - เหมือนต้นฉบับ */}
      <div
        className="hidden md:block bg-cover bg-center bg-no-repeat relative"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=2000&auto=format&fit=crop)",
        }}
      >
        {/* Overlay สีฟ้า rgba(25, 118, 210, 0.85) ตามต้นฉบับ */}
        <div className="absolute inset-0 bg-[rgba(25,118,210,0.85)] flex flex-col justify-center items-center text-white p-4 text-center">
          {/* Logo Container */}
          <div className="w-[110px] h-[110px] mb-2 rounded-2xl overflow-hidden flex items-center justify-center">
            <Image
              src="/logo-uttaradit-hospital.png"
              alt="Uttaradit Hospital"
              width={110}
              height={110}
              priority
              style={{ objectFit: "contain" }}
            />
          </div>
          {/* Typography h3 = 2.25rem (36px) = text-4xl, fontWeight 700 */}
          <h1 className="text-3xl font-bold mb-2 font-heading">PHTS System</h1>
          {/* Typography h5 = 1.125rem (18px) = text-lg, fontWeight 300 */}
          <h2 className="text-lg font-light opacity-90 font-thai">
            ระบบสารสนเทศเพื่อการบริหารจัดการ
          </h2>
          {/* Typography h6 = 1.125rem (18px) = text-lg, fontWeight 300 */}
          <h3 className="text-lg font-light opacity-90 font-thai">
            ค่าตอบแทนกำลังคนด้านสาธารณสุข
          </h3>
        </div>
      </div>

      {/* RIGHT SIDE: Login Form (5fr) - Paper elevation={6} square */}
      <div className="bg-white shadow-xl flex flex-col items-center justify-center px-4 py-8 md:my-8 md:mx-4 h-full">
        {/* Mobile Header */}
        <div className="md:hidden flex flex-col items-center mb-4">
          <div className="w-24 h-24 mb-1 rounded-[14px] overflow-hidden flex items-center justify-center">
            <Image
              src="/logo-uttaradit-hospital.png"
              alt="Uttaradit Hospital"
              width={96}
              height={96}
              priority
              style={{ objectFit: "contain" }}
            />
          </div>
          {/* Typography h5 = 1.5rem = text-2xl, fontWeight 700, color primary */}
          <h1 className="text-2xl font-bold text-blue-600">PHTS Login</h1>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block text-center mb-4">
          {/* Typography h5 = 1.5rem = text-2xl, fontWeight 600 */}
          <h1 className="text-2xl font-semibold mb-1">เข้าสู่ระบบ</h1>
          {/* Typography body2 = 0.875rem = text-sm, color text.secondary */}
          <p className="text-sm text-gray-500">
            กรุณากรอกเลขบัตรประชาชนและรหัสผ่าน
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="mt-1 w-full max-w-[400px]">
          {/* Error Alert */}
          {error && (
            <Alert
              variant="destructive"
              className="mb-3 rounded-lg bg-red-50 border-red-200 text-red-800"
            >
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Username Field - TextField เหมือนต้นฉบับ */}
          <div className="mb-4">
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <User className="h-5 w-5" />
              </div>
              <Input
                id="username"
                name="username"
                placeholder="เลขบัตรประชาชน / Username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="pl-10 h-14 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="mb-2">
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <Lock className="h-5 w-5" />
              </div>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="รหัสผ่าน"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="pl-10 pr-10 h-14 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button - fontSize 1.1rem ≈ text-lg */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-4 mb-2 py-6 text-lg font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 shadow-md"
          >
            {loading ? (
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

          {/* Footer Links - Typography body2 = text-sm */}
          <div className="flex justify-center mt-2">
            <p className="text-sm text-gray-500">
              ติดปัญหาการใช้งาน?{" "}
              <span className="text-blue-600 cursor-pointer font-semibold">
                ติดต่อฝ่าย IT
              </span>
            </p>
          </div>

          {/* Copyright - Typography caption = 0.75rem = text-xs */}
          <p className="text-xs text-center text-gray-400 mt-8">
            PHTS System v2.0 © 2025 Uttaradit Hospital
          </p>
        </form>
      </div>
    </main>
  );
}
