import type { Metadata } from "next";
import { Sarabun, Inter } from "next/font/google";
import "./globals.css";
import { ReactQueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/sonner";

// ตั้งค่าฟอนต์ไทย (Sarabun)
const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sarabun",
  display: "swap",
});

// ตั้งค่าฟอนต์ตัวเลข (Inter)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PHTS - ระบบบริหารจัดการเงิน พ.ต.ส.",
  description: "Public Health Talent System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${sarabun.variable} ${inter.variable} font-sans antialiased bg-background text-slate-900`}>
        <ReactQueryProvider>
          <AuthProvider>
            {children}
            <Toaster position="top-center" richColors />
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
