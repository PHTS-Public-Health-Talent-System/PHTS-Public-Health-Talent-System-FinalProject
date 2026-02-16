'use client';

import { useMemo, useState } from 'react';
import { Layers, Users, Search, Filter, User as UserIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyScopeMembers } from '@/features/request/hooks';
import type { ScopeWithMembers } from '@/features/request/api';
import { formatThaiNumber } from '@/shared/utils/thai-locale';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type HeadScopeScopeMembersPageProps = {
  roleTitle: string;
};

// --- Helpers ---
const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
};

const getRoleBadgeColor = (role: string) => {
    const r = role.toUpperCase();
    if (r.includes('HEAD') || r.includes('DIRECTOR')) return "bg-indigo-100 text-indigo-700 border-indigo-200";
    if (r.includes('OFFICER')) return "bg-blue-100 text-blue-700 border-blue-200";
    if (r === 'ADMIN') return "bg-red-100 text-red-700 border-red-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
};

export function HeadScopeScopeMembersPage({ roleTitle }: HeadScopeScopeMembersPageProps) {
  const scopeMembersQuery = useMyScopeMembers();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<'role-desc' | 'name-asc' | 'name-desc'>('role-desc');

  const scopes = useMemo(() => (scopeMembersQuery.data ?? []) as ScopeWithMembers[], [scopeMembersQuery.data]);

  const rolePriority = useMemo(
    () => ({
      ADMIN: 100,
      DIRECTOR: 90,
      HEAD_FINANCE: 80,
      HEAD_HR: 75,
      HEAD_DEPT: 70,
      HEAD_WARD: 65,
      FINANCE_OFFICER: 60,
      PTS_OFFICER: 50,
      USER: 10,
      UNKNOWN: 0,
    }),
    [],
  );

  const normalizedKeyword = searchTerm.trim().toLowerCase();

  const processedScopes = useMemo(() => {
    return scopes.map((scope) => {
      const filteredMembers = scope.members.filter((member) => {
        if (!normalizedKeyword) return true;
        const haystack = [
          member.fullName,
          member.citizenId,
          member.position,
          member.userRoleLabel,
          member.department,
          member.subDepartment,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedKeyword);
      });

      const sortedMembers = [...filteredMembers].sort((a, b) => {
        if (sortMode === 'name-asc') return a.fullName.localeCompare(b.fullName, 'th');
        if (sortMode === 'name-desc') return b.fullName.localeCompare(a.fullName, 'th');
        const aPriority = rolePriority[(a.userRole ?? 'UNKNOWN') as keyof typeof rolePriority] ?? 0;
        const bPriority = rolePriority[(b.userRole ?? 'UNKNOWN') as keyof typeof rolePriority] ?? 0;
        if (aPriority !== bPriority) return bPriority - aPriority;
        return a.fullName.localeCompare(b.fullName, 'th');
      });

      return {
        ...scope,
        filteredMemberCount: sortedMembers.length,
        members: sortedMembers,
      };
    });
  }, [scopes, normalizedKeyword, sortMode, rolePriority]);

  const stats = useMemo(() => {
    const totalScopes = scopes.length;
    const totalMembers = scopes.reduce((sum, scope) => sum + Number(scope.memberCount ?? 0), 0);
    const filteredMembers = processedScopes.reduce((sum, scope) => sum + Number(scope.filteredMemberCount ?? 0), 0);
    const matchedScopes = processedScopes.filter((scope) => scope.filteredMemberCount > 0).length;
    return { totalScopes, totalMembers, filteredMembers, matchedScopes };
  }, [scopes, processedScopes]);

  if (scopeMembersQuery.isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  if (scopeMembersQuery.isError) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Card className="border-destructive/30 max-w-md w-full">
          <CardContent className="py-10 text-center flex flex-col items-center gap-4">
            <div className="p-3 bg-destructive/10 rounded-full">
                <Users className="h-8 w-8 text-destructive" />
            </div>
            <div>
                <h3 className="text-lg font-semibold text-foreground">โหลดข้อมูลไม่สำเร็จ</h3>
                <p className="text-sm text-muted-foreground mt-1">ไม่สามารถดึงข้อมูลขอบเขตที่ดูแลได้ในขณะนี้</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 pb-20 max-w-7xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Layers className="h-8 w-8 text-primary" />
            ขอบเขตที่ดูแล (Scopes)
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          รายการบุคลากรภายใต้การกำกับดูแลของ <span className="font-semibold text-foreground">{roleTitle}</span>
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">จำนวนขอบเขต (Scopes)</p>
              <p className="text-4xl font-bold tracking-tight text-foreground">{formatThaiNumber(stats.totalScopes)}</p>
              <p className="text-xs text-muted-foreground">หน่วยงาน/กลุ่มงาน ที่ดูแล</p>
            </div>
            <div className="h-12 w-12 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center">
                <Layers className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">บุคลากรทั้งหมด (Members)</p>
              <p className="text-4xl font-bold tracking-tight text-foreground">{formatThaiNumber(stats.totalMembers)}</p>
              <p className="text-xs text-muted-foreground">คน ในทุกขอบเขต</p>
            </div>
            <div className="h-12 w-12 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาชื่อ, เลขบัตร, ตำแหน่ง หรือระดับสิทธิ์..."
            className="pl-9"
            />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground hidden md:block" />
            <Select value={sortMode} onValueChange={(value) => setSortMode(value as typeof sortMode)}>
                <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="เรียงลำดับ" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="role-desc">เรียงตามตำแหน่ง (สูง-ต่ำ)</SelectItem>
                    <SelectItem value="name-asc">ชื่อ (ก-ฮ)</SelectItem>
                    <SelectItem value="name-desc">ชื่อ (ฮ-ก)</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      {/* Scope Lists */}
      {processedScopes.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center">
            <Layers className="h-12 w-12 opacity-20 mb-4" />
            <p className="text-lg font-medium">ไม่พบขอบเขตที่กำกับดูแล</p>
            <p className="text-sm">บัญชีของคุณยังไม่ได้ถูกกำหนดให้เป็นหัวหน้าหน่วยงานหรือกลุ่มงานใดๆ</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {processedScopes.map((scope) => {
             // Skip rendering scope if search is active but no members match (optional: keeps UI clean)
             if (searchTerm && scope.filteredMemberCount === 0) return null;

             return (
                <Card key={`${scope.type}_${scope.value}`} className="border-border shadow-sm overflow-hidden">
                <CardHeader className="border-b bg-muted/5 py-4 px-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm">
                                {scope.label.charAt(0)}
                            </div>
                            <div>
                                <CardTitle className="text-lg">{scope.label}</CardTitle>
                                <CardDescription className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-[10px] font-normal px-1.5 h-5">
                                        {scope.type === 'DEPT' ? 'ระดับกลุ่มงาน' : 'ระดับหน่วยงาน'}
                                    </Badge>
                                    <span>ID: {scope.value}</span>
                                </CardDescription>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-bold tabular-nums">
                                {formatThaiNumber(scope.filteredMemberCount)}
                            </span>
                            <span className="text-sm text-muted-foreground ml-2">
                                / {formatThaiNumber(scope.memberCount)} คน
                            </span>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {scope.members.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground bg-muted/5">
                        <UserIcon className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        <p>ไม่พบบุคลากรในรายการค้นหา</p>
                    </div>
                    ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                        <thead className="bg-muted/30 border-b">
                            <tr>
                            <th className="px-6 py-3 text-left font-semibold text-muted-foreground w-[35%]">ชื่อ-สกุล / รหัส</th>
                            <th className="px-6 py-3 text-left font-semibold text-muted-foreground w-[20%]">ระดับสิทธิ์</th>
                            <th className="px-6 py-3 text-left font-semibold text-muted-foreground w-[20%]">ตำแหน่ง</th>
                            <th className="px-6 py-3 text-left font-semibold text-muted-foreground w-[25%]">สังกัด</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {scope.members.map((member) => (
                            <tr key={`${scope.type}_${scope.value}_${member.citizenId}`} className="group hover:bg-muted/10 transition-colors">
                                <td className="px-6 py-3">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9 border border-border">
                                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${member.citizenId}`} />
                                            <AvatarFallback className="bg-muted text-muted-foreground text-xs">{getInitials(member.fullName)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-medium text-foreground group-hover:text-primary transition-colors">{member.fullName}</p>
                                            <p className="text-xs text-muted-foreground font-mono">{member.citizenId}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-3">
                                    <Badge variant="outline" className={`font-normal ${getRoleBadgeColor(member.userRoleLabel || "")}`}>
                                        {member.userRoleLabel}
                                    </Badge>
                                </td>
                                <td className="px-6 py-3 text-foreground/80">
                                    {member.position || "-"}
                                </td>
                                <td className="px-6 py-3 text-muted-foreground text-xs">
                                    <div className="flex flex-col">
                                        <span>{member.department}</span>
                                        {member.subDepartment && (
                                            <span className="opacity-70 text-[10px]">{member.subDepartment}</span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                    )}
                </CardContent>
                </Card>
             );
          })}

          {searchTerm && stats.matchedScopes === 0 && (
              <div className="py-12 text-center">
                  <p className="text-muted-foreground">ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา &quot;{searchTerm}&quot;</p>
                  <Button variant="link" onClick={() => setSearchTerm('')} className="mt-2">ล้างคำค้นหา</Button>
              </div>
          )}
        </div>
      )}
    </div>
  );
}
