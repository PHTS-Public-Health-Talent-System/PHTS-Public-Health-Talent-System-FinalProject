"use client";

import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthProvider } from "@/components/providers/auth-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <AppSidebar />
        
        {/* พื้นที่เนื้อหาหลัก (SidebarInset) */}
        <SidebarInset className="bg-slate-50 min-h-screen">
          
          {/* Header Strip ด้านบน */}
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 shadow-sm sticky top-0 z-10">
            <div className="flex items-center gap-2 mr-auto">
              <SidebarTrigger className="-ml-1 h-10 w-10 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 rounded-lg" />
              <Separator orientation="vertical" className="mr-2 h-4 bg-slate-300" />
              
              {/* Breadcrumb บอกตำแหน่งหน้า */}
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-lg font-semibold text-slate-800">
                      ระบบ PHTS
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            {/* Action ขวาสุดของ Header */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-100 text-slate-500 relative">
                 <Bell className="h-5 w-5" />
                 <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-red-500 border border-white"></span>
              </Button>
            </div>
          </header>

          {/* Content Area จริงๆ */}
          <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  );
}