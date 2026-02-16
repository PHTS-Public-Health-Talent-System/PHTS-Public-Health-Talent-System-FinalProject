'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CalendarDays,
  Calculator,
  Clock,
  ClipboardList,
  FileBarChart,
  FileCheck,
  FileText,
  LayoutDashboard,
  Megaphone,
  PenTool,
  Server,
  Settings,
  Shield,
  TrendingUp,
  User,
  UserMinus,
  Users,
  Wallet,
  HelpCircle,
  LogOutIcon,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';

export interface NavItem {
  name: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconKey?: string;
  badge?: number;
}

export interface SidebarConfig {
  role: string;
  roleLabel: string;
  roleBgColor: string;
  roleTextColor?: string;
  navigation: NavItem[];
  secondaryNavigation?: NavItem[];
  secondaryLabel?: string;
  user: {
    name: string;
    title: string;
    initials: string;
    image?: string;
  };
  notificationCount?: number;
}

export function UnifiedSidebar({ config }: { config: SidebarConfig }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const basePath = `/${config.role.toLowerCase().replace(/_/g, '-')}`;

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    LayoutDashboard,
    FileText,
    User,
    FileCheck,
    Calculator,
    ClipboardList,
    FileBarChart,
    Users,
    Shield,
    Megaphone,
    Server,
    Clock,
    Wallet,
    TrendingUp,
    AlertTriangle,
    Calendar,
    CalendarDays,
    UserMinus,
  };

  const resolveIcon = (item: NavItem) =>
    item.icon ?? (item.iconKey ? iconMap[item.iconKey] : undefined) ?? FileText;

  const roleAccentByBgColor: Record<
    string,
    {
      activeContainer: string;
      activeIcon: string;
      activeBadge: string;
      activeRail: string;
    }
  > = {
    'bg-rose-600': {
      activeContainer: 'bg-rose-50 text-rose-700',
      activeIcon: 'text-rose-600',
      activeBadge: 'bg-rose-600 text-white',
      activeRail: 'bg-rose-600',
    },
    'bg-amber-600': {
      activeContainer: 'bg-amber-50 text-amber-700',
      activeIcon: 'text-amber-600',
      activeBadge: 'bg-amber-600 text-white',
      activeRail: 'bg-amber-600',
    },
    'bg-orange-600': {
      activeContainer: 'bg-orange-50 text-orange-700',
      activeIcon: 'text-orange-600',
      activeBadge: 'bg-orange-600 text-white',
      activeRail: 'bg-orange-600',
    },
    'bg-purple-600': {
      activeContainer: 'bg-purple-50 text-purple-700',
      activeIcon: 'text-purple-600',
      activeBadge: 'bg-purple-600 text-white',
      activeRail: 'bg-purple-600',
    },
    'bg-emerald-600': {
      activeContainer: 'bg-emerald-50 text-emerald-700',
      activeIcon: 'text-emerald-600',
      activeBadge: 'bg-emerald-600 text-white',
      activeRail: 'bg-emerald-600',
    },
    'bg-sky-600': {
      activeContainer: 'bg-sky-50 text-sky-700',
      activeIcon: 'text-sky-600',
      activeBadge: 'bg-sky-600 text-white',
      activeRail: 'bg-sky-600',
    },
    'bg-cyan-600': {
      activeContainer: 'bg-cyan-50 text-cyan-700',
      activeIcon: 'text-cyan-600',
      activeBadge: 'bg-cyan-600 text-white',
      activeRail: 'bg-cyan-600',
    },
    'bg-indigo-600': {
      activeContainer: 'bg-indigo-50 text-indigo-700',
      activeIcon: 'text-indigo-600',
      activeBadge: 'bg-indigo-600 text-white',
      activeRail: 'bg-indigo-600',
    },
    'bg-primary': {
      activeContainer: 'bg-primary/10 text-primary',
      activeIcon: 'text-primary',
      activeBadge: 'bg-primary text-primary-foreground',
      activeRail: 'bg-primary',
    },
  };
  const roleAccent = roleAccentByBgColor[config.roleBgColor] ?? roleAccentByBgColor['bg-primary'];

  const commonItems: NavItem[] = [
    {
      name: 'แจ้งเตือน',
      href: `${basePath}/notifications`,
      icon: Bell,
      badge: config.notificationCount || 0,
    },
    { name: 'ลายเซ็น', href: `${basePath}/signature`, icon: PenTool },
    { name: 'ประกาศ', href: `${basePath}/announcements`, icon: Megaphone },
    { name: 'แจ้งปัญหา', href: `${basePath}/support`, icon: HelpCircle },
  ];

  const primaryHrefs = new Set(config.navigation.map((item) => item.href));
  const secondaryHrefs = new Set((config.secondaryNavigation ?? []).map((item) => item.href));
  const commonItemsToRender = commonItems.filter(
    (item) => !primaryHrefs.has(item.href) && !secondaryHrefs.has(item.href),
  );

  const NavItem = ({ item, isActive }: { item: NavItem; isActive: boolean }) => {
    const Icon = resolveIcon(item);
    return (
      <Link
        href={item.href}
        className={cn(
          'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
          isActive
            ? roleAccent.activeContainer
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Icon
          className={cn(
            'h-4 w-4 shrink-0',
            isActive ? roleAccent.activeIcon : 'text-muted-foreground group-hover:text-foreground',
          )}
        />
        <span className="truncate">{item.name}</span>
        {item.badge !== undefined && item.badge > 0 && (
          <span
            className={cn(
              'ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] font-bold shadow-sm',
              isActive
                ? roleAccent.activeBadge
                : 'bg-muted text-muted-foreground group-hover:bg-background',
            )}
          >
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
        {isActive && <div className={cn('absolute left-0 h-6 w-1 rounded-r-full', roleAccent.activeRail)} />}
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-background border-r shadow-sm">
      {/* Brand / Logo */}
      <div className="flex h-16 items-center px-6 border-b">
        <div className="flex items-center gap-2 font-semibold">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg shadow-sm text-white',
              config.roleBgColor,
            )}
          >
            {config.role.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tight">ระบบ พ.ต.ส.</span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
              {config.roleLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-thin scrollbar-thumb-muted">
        {/* Main Menu */}
        <div>
          <h4 className="mb-2 px-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
            เมนูหลัก
          </h4>
          <div className="space-y-1">
            {config.navigation.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                isActive={
                  pathname === item.href ||
                  (item.href !== basePath && pathname.startsWith(item.href))
                }
              />
            ))}
          </div>
        </div>

        {/* Secondary Menu */}
        {config.secondaryNavigation && config.secondaryNavigation.length > 0 && (
          <div>
            <h4 className="mb-2 px-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
              {config.secondaryLabel || 'จัดการข้อมูล'}
            </h4>
            <div className="space-y-1">
              {config.secondaryNavigation.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  isActive={pathname === item.href || pathname.startsWith(item.href)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Common / General Menu */}
        <div>
          <h4 className="mb-2 px-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
            ทั่วไป
          </h4>
          <div className="space-y-1">
            {commonItemsToRender.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                isActive={pathname === item.href || pathname.startsWith(item.href)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* User Profile & Footer Actions */}
      <div className="border-t p-4 bg-muted/10">
        <div className="flex items-center gap-3 mb-4 px-1">
          <Avatar className="h-9 w-9 border cursor-pointer hover:opacity-80 transition-opacity">
            <AvatarImage src={config.user.image} />
            <AvatarFallback className={cn('text-xs font-medium text-white', config.roleBgColor)}>
              {config.user.initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium truncate" title={config.user.name}>
              {config.user.name}
            </span>
            <span className="text-xs text-muted-foreground truncate" title={config.user.title}>
              {config.user.title}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 h-8 text-xs font-normal"
            asChild
          >
            <Link href={`${basePath}/settings`}>
              <Settings className="h-3.5 w-3.5" /> ตั้งค่า
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-8 text-xs font-normal text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <LogOutIcon className="h-3.5 w-3.5" /> ออก
          </Button>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการออกจากระบบ</AlertDialogTitle>
            <AlertDialogDescription>คุณต้องการออกจากระบบใช่หรือไม่?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={logout}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ออกจากระบบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
