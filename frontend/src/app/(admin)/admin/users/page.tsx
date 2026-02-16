'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Search,
  UserCog,
  RefreshCw,
  Shield,
  MoreHorizontal,
  Power,
  Eye,
  Filter,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  useSearchUsers,
  useTriggerSync,
  useTriggerUserSync,
  useUpdateUserRole,
} from '@/features/system/hooks';
import { Skeleton } from '@/components/ui/skeleton';
import { formatThaiDateTime, formatThaiNumber } from '@/shared/utils/thai-locale';

// --- Constants ---
const roleOptions = [
  'USER',
  'HEAD_WARD',
  'HEAD_DEPT',
  'PTS_OFFICER',
  'HEAD_HR',
  'HEAD_FINANCE',
  'FINANCE_OFFICER',
  'DIRECTOR',
  'ADMIN',
];

type SystemUserRow = {
  id: number;
  citizen_id: string;
  role: string;
  is_active: number;
  last_login_at: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url?: string; // Optional: if available
};

// --- Helpers ---
const getRoleBadgeColor = (role: string) => {
  if (role === 'ADMIN') return 'bg-red-50 text-red-700 border-red-200';
  if (role === 'DIRECTOR') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (['HEAD_HR', 'HEAD_FINANCE'].includes(role))
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['PTS_OFFICER', 'FINANCE_OFFICER'].includes(role))
    return 'bg-blue-50 text-blue-700 border-blue-200';
  if (['HEAD_WARD', 'HEAD_DEPT'].includes(role))
    return 'bg-orange-50 text-orange-700 border-orange-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const fullName = (u: SystemUserRow) =>
  [u.first_name ?? '', u.last_name ?? ''].join(' ').trim() || u.citizen_id;

const getInitials = (name: string) => {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export default function UsersPage() {
  // --- State ---
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit] = useState('20');
  const [selectedUser, setSelectedUser] = useState<SystemUserRow | null>(null);
  const [newRole, setNewRole] = useState('');
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // --- Hooks ---
  const usersQuery = useSearchUsers({
    q: searchQuery,
    page: String(page),
    limit,
    role: roleFilter === 'all' ? undefined : roleFilter,
    is_active: statusFilter === 'all' ? undefined : statusFilter === 'active' ? '1' : '0',
  });

  const updateRole = useUpdateUserRole();
  const triggerSync = useTriggerSync();
  const triggerUserSync = useTriggerUserSync();

  // --- Effects ---
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 400); // Increased debounce slightly
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // --- Data Processing ---
  const result = useMemo(
    () =>
      usersQuery.data ?? {
        rows: [],
        total: 0,
        active_total: 0,
        inactive_total: 0,
        page: 1,
        limit: Number(limit),
        total_pages: 1,
      },
    [usersQuery.data, limit],
  );

  const users = result.rows as SystemUserRow[];
  const totalRows = Number(result.total ?? 0);
  const totalPages = Math.max(1, Number(result.total_pages ?? 1));
  const currentPage = Math.min(page, totalPages);
  const startRow = totalRows === 0 ? 0 : (currentPage - 1) * Number(limit) + 1;
  const endRow = Math.min(currentPage * Number(limit), totalRows);

  // --- Handlers ---
  const handleChangeRole = (user: SystemUserRow) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setIsRoleDialogOpen(true);
  };

  const confirmChangeRole = async () => {
    if (!selectedUser || !newRole) return;
    setActionError(null);
    try {
      await updateRole.mutateAsync({
        userId: selectedUser.id,
        payload: { role: newRole },
      });
      await usersQuery.refetch();
      toast.success(`อัปเดตสิทธิ์ ${fullName(selectedUser)} เป็น ${newRole} สำเร็จ`);
      setIsRoleDialogOpen(false);
      setSelectedUser(null);
    } catch {
      setActionError('ไม่สามารถอัปเดตบทบาทได้');
      toast.error('ไม่สามารถอัปเดตบทบาทได้');
    }
  };

  const handleToggleActive = async (user: SystemUserRow) => {
    const isActive = Number(user.is_active) === 1;
    setActionError(null);
    try {
      await updateRole.mutateAsync({
        userId: user.id,
        payload: {
          role: user.role,
          is_active: !isActive,
        },
      });
      toast.success(isActive ? 'ระงับการใช้งานบัญชีแล้ว' : 'เปิดใช้งานบัญชีแล้ว');
      usersQuery.refetch();
    } catch {
      setActionError('ไม่สามารถเปลี่ยนสถานะผู้ใช้ได้');
      toast.error('ไม่สามารถเปลี่ยนสถานะผู้ใช้ได้');
    }
  };

  const handleSync = async () => {
    setActionError(null);
    const promise = triggerSync.mutateAsync();
    toast.promise(promise, {
      loading: 'กำลังซิงค์ข้อมูลจาก HRMS...',
      success: 'ซิงค์ข้อมูลสำเร็จ',
      error: 'การซิงค์ล้มเหลว',
    });
    try {
      await promise;
      usersQuery.refetch();
    } catch {
      setActionError('การซิงค์ข้อมูลล้มเหลว กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handleSyncUser = async (userId: number) => {
    setActionError(null);
    const promise = triggerUserSync.mutateAsync(userId);
    toast.promise(promise, {
      loading: 'กำลังซิงค์ข้อมูลผู้ใช้...',
      success: 'ซิงค์ข้อมูลผู้ใช้สำเร็จ',
      error: 'การซิงค์ล้มเหลว',
    });
    try {
      await promise;
      usersQuery.refetch();
    } catch {
      setActionError('การซิงค์ข้อมูลผู้ใช้ล้มเหลว กรุณาลองใหม่อีกครั้ง');
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            จัดการผู้ใช้
          </h1>
          <p className="text-muted-foreground mt-1">
            ค้นหา ตรวจสอบ และกำหนดสิทธิ์การเข้าถึงของผู้ใช้งานในระบบ
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleSync}
          disabled={triggerSync.isPending}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${triggerSync.isPending ? 'animate-spin' : ''}`} />
          ซิงค์ HRMS
        </Button>
      </div>

      {actionError && (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {/* Filters & Actions */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาด้วยชื่อ หรือเลขบัตรประชาชน..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 h-10 bg-background border-input"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select
                value={roleFilter}
                onValueChange={(v) => {
                  setRoleFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px] h-10 bg-background border-input">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="บทบาท" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกบทบาท</SelectItem>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[190px] h-10 bg-background border-input">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="สถานะ" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="active">ใช้งานอยู่</SelectItem>
                  <SelectItem value="inactive">ระงับ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="border-b bg-muted/10 py-4 px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">รายการผู้ใช้งาน</CardTitle>
            <Badge variant="secondary" className="font-normal">
              {formatThaiNumber(totalRows)} รายการ
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[300px]">ผู้ใช้งาน</TableHead>
                <TableHead>บทบาท</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>เข้าใช้งานล่าสุด</TableHead>
                <TableHead className="text-right w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    ไม่พบข้อมูลผู้ใช้งานที่ตรงกับเงื่อนไข
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const isActive = Number(user.is_active) === 1;
                  const userName = fullName(user);
                  return (
                    <TableRow key={user.id} className="group hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border">
                            <AvatarImage src={user.avatar_url} />
                            <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                              {getInitials(userName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm text-foreground">{userName}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {user.citizen_id}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`font-normal ${getRoleBadgeColor(user.role)}`}
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                          />
                          <span
                            className={`text-sm ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}
                          >
                            {isActive ? 'ใช้งานอยู่' : 'ระงับ'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.last_login_at
                          ? formatThaiDateTime(user.last_login_at, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : 'ไม่เคยเข้าใช้งาน'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>จัดการบัญชี</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/users/${user.id}`} className="cursor-pointer">
                                <Eye className="mr-2 h-4 w-4 text-muted-foreground" /> ดูรายละเอียด
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleChangeRole(user)}
                              className="cursor-pointer"
                            >
                              <UserCog className="mr-2 h-4 w-4 text-muted-foreground" /> เปลี่ยนบทบาท
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleSyncUser(user.id)}
                              disabled={triggerUserSync.isPending}
                              className="cursor-pointer"
                            >
                              <RefreshCw className="mr-2 h-4 w-4 text-muted-foreground" /> ซิงค์ข้อมูล
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleToggleActive(user)}
                              disabled={updateRole.isPending}
                              className={
                                isActive
                                  ? 'text-destructive focus:text-destructive cursor-pointer'
                                  : 'text-emerald-600 focus:text-emerald-600 cursor-pointer'
                              }
                            >
                              <Power className="mr-2 h-4 w-4" />
                              {isActive ? 'ระงับการใช้งาน' : 'เปิดใช้งานบัญชี'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination Footer */}
        <div className="border-t bg-muted/10 p-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            แสดง {startRow}-{endRow} จาก {totalRows}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || usersQuery.isLoading}
              className="h-8 text-xs bg-background"
            >
              ย้อนกลับ
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || usersQuery.isLoading}
              className="h-8 text-xs bg-background"
            >
              ถัดไป
            </Button>
          </div>
        </div>
      </Card>

      {/* Role Change Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>เปลี่ยนสิทธิ์การใช้งาน</DialogTitle>
            <DialogDescription>
              กำหนดระดับสิทธิ์ใหม่ให้กับ{' '}
              <span className="font-medium text-foreground">
                {selectedUser ? fullName(selectedUser) : ''}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="role-select">เลือกบทบาทใหม่</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger id="role-select">
                  <SelectValue placeholder="เลือกบทบาท" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={confirmChangeRole} disabled={updateRole.isPending} className="gap-2">
              {updateRole.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <UserCog className="h-4 w-4" />
              )}
              บันทึกการเปลี่ยนแปลง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
