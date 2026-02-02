import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { AuthProvider } from "@/components/providers/auth-provider"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
        <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-muted/10">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 bg-background/80 backdrop-blur-md sticky top-0 z-10 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-border shadow-sm">
            <SidebarTrigger className="-ml-1 h-8 w-8 hover:bg-muted" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex flex-col">
              <h1 className="text-sm font-semibold text-foreground leading-tight">
                  ระบบบริหารจัดการเงิน พ.ต.ส.
              </h1>
              <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
                โรงพยาบาลอุตรดิตถ์
              </span>
            </div>
            </header>
            <div className="flex flex-1 flex-col p-4 md:p-6 lg:p-8 pt-4 min-h-[calc(100vh-3.5rem)] overflow-x-hidden">
                <main className="flex-1 w-full max-w-7xl mx-auto space-y-6">
                    {children}
                </main>
            </div>
        </SidebarInset>
        </SidebarProvider>
    </AuthProvider>
  )
}
