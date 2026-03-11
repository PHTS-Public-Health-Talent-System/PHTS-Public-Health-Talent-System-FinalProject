'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { History, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCurrentUser } from '@/features/auth/hooks';
import { useApprovalHistory } from '@/features/request/core/hooks';
import { TableRowViewAction } from '@/components/common';
import { mapRequestToFormData } from '@/features/request/create/hooks/request-form-mapper';
import type { RequestWithDetails, ApprovalAction } from '@/types/request.types';
import { STATUS_LABELS } from '@/types/request.types';
import { formatThaiDateTime } from '@/shared/utils/thai-locale';
import {
  getDefaultHistoryActionMode,
  matchesHistoryActionFilter,
  pickLatestHistoryAction,
  type HistoryActionFilter,
} from '@/features/head-approval/history.utils';
import { getOnBehalfMetadata } from '@/features/request/core/utils';

type HeadScopeHistoryPageProps = {
  basePath: string;
  roleTitle: string;
  roleKey: string;
};

type HistoryRow = {
  id: number;
  requestNo: string;
  requesterName: string;
  department: string;
  status: string;
  lastActionType: ApprovalAction['action'] | '-';
  lastActionActor: string;
  lastActionDate: string | null;
  isOfficerCreated: boolean;
};

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'APPROVED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'REJECTED':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'RETURNED':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'PENDING':
    case 'PENDING_WARD_SCOPE':
    case 'PENDING_DEPT_SCOPE':
    case 'PENDING_PTS_OFFICER':
    case 'PENDING_HR':
    case 'PENDING_FINANCE':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const HISTORY_VIEW_STORAGE_KEY_PREFIX = 'approval-history-view:';

export function HeadScopeHistoryPage({ basePath, roleTitle, roleKey }: HeadScopeHistoryPageProps) {
  const { data: currentUserResponse } = useCurrentUser();
  const [historyView, setHistoryView] = useState<'team' | 'mine'>(() => {
    if (typeof window === 'undefined') return 'team';
    const storageKey = `${HISTORY_VIEW_STORAGE_KEY_PREFIX}${roleKey}`;
    const saved = window.localStorage.getItem(storageKey);
    return saved === 'mine' || saved === 'team' ? saved : 'team';
  });
  const [actionMode, setActionMode] = useState<'important' | 'all'>(() =>
    getDefaultHistoryActionMode(roleKey),
  );
  const historyQuery = useApprovalHistory({ view: historyView, actions: actionMode });
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<HistoryActionFilter>('all');

  const allowedSteps = useMemo<number[] | null>(() => {
    const normalizedRoleKey = roleKey.trim().toUpperCase();
    if (normalizedRoleKey === 'HEAD_SCOPE') {
      const data = currentUserResponse?.data as
        | {
            head_scope_roles?: Array<'WARD_SCOPE' | 'DEPT_SCOPE'>;
          }
        | undefined;
      const scopes = data?.head_scope_roles ?? [];
      const steps: number[] = [];
      if (scopes.includes('WARD_SCOPE')) steps.push(1);
      if (scopes.includes('DEPT_SCOPE')) steps.push(2);
      return steps.length > 0 ? steps : null;
    }
    if (normalizedRoleKey === 'PTS_OFFICER') return [3];
    if (normalizedRoleKey === 'HEAD_HR') return [4];
    if (normalizedRoleKey === 'HEAD_FINANCE') return [5];
    if (normalizedRoleKey === 'DIRECTOR') return [6];
    return null;
  }, [currentUserResponse?.data, roleKey]);

  useEffect(() => {
    const storageKey = `${HISTORY_VIEW_STORAGE_KEY_PREFIX}${roleKey}`;
    window.localStorage.setItem(storageKey, historyView);
  }, [historyView, roleKey]);

  const rows = useMemo<HistoryRow[]>(() => {
    const items = (historyQuery.data ?? []) as RequestWithDetails[];
    const normalizedRoleKey = roleKey.trim().toUpperCase();
    return items.map((request) => {
      const formData = mapRequestToFormData(request);
      const onBehalfMeta = getOnBehalfMetadata(
        request.submission_data && typeof request.submission_data === 'object'
          ? (request.submission_data as Record<string, unknown>)
          : null,
      );
      const requesterTitle =
        (formData.title ?? '').trim() ||
        ((request.requester as { title?: string } | undefined)?.title ?? '').trim();
      const requesterFromProfile = [
        requesterTitle,
        request.requester?.first_name,
        request.requester?.last_name,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();
      const requesterFromSubmission = [formData.title, formData.firstName, formData.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const requesterName =
        requesterFromProfile ||
        requesterFromSubmission ||
        request.citizen_id;
      const department =
        formData.subDepartment || formData.department || request.current_department || '-';
      const requestNo = request.request_no ?? '-';
      const lastAction = pickLatestHistoryAction(request.actions, {
        actionMode,
        roleKey: normalizedRoleKey,
        allowedSteps,
      });
      const lastActionActorName = [lastAction?.actor?.first_name, lastAction?.actor?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
      const lastActionActor = lastActionActorName || '-';
      return {
        id: request.request_id,
        requestNo,
        requesterName,
        department,
        status: request.status,
        lastActionType: (lastAction?.action as ApprovalAction['action']) ?? '-',
        lastActionActor,
        lastActionDate: lastAction?.action_date ?? null,
        isOfficerCreated: onBehalfMeta.isOfficerCreated,
      };
    });
  }, [historyQuery.data, actionMode, roleKey, allowedSteps]);

  const filteredRows = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !keyword ||
        row.requestNo.toLowerCase().includes(keyword) ||
        row.requesterName.toLowerCase().includes(keyword) ||
        row.department.toLowerCase().includes(keyword);
      const matchesAction = matchesHistoryActionFilter(row, actionFilter);
      return matchesSearch && matchesAction;
    });
  }, [rows, searchTerm, actionFilter]);

  return (
    <div className="p-8 space-y-8 pb-20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">ประวัติการอนุมัติ</h1>
          <p className="text-muted-foreground mt-1">รายการคำขอที่{roleTitle}เคยดำเนินการไว้</p>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="border-b bg-muted/10">
          <div className="flex flex-col gap-3">
            <div className="inline-flex rounded-md border bg-background p-1 w-fit">
              <Button
                type="button"
                size="sm"
                variant={historyView === 'team' ? 'default' : 'ghost'}
                onClick={() => setHistoryView('team')}
                className="h-8"
              >
                ตามขอบเขตการดูแล
              </Button>
              <Button
                type="button"
                size="sm"
                variant={historyView === 'mine' ? 'default' : 'ghost'}
                onClick={() => setHistoryView('mine')}
                className="h-8"
              >
                ของฉัน
              </Button>
            </div>
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              {historyView === 'team' ? 'ประวัติตามขอบเขตการดูแล' : 'ประวัติของฉัน'}
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหาเลขคำขอ, ชื่อผู้ยื่น, หน่วยงาน"
                  className="pl-9"
                />
              </div>
              <Select value={actionMode} onValueChange={(v) => setActionMode(v as typeof actionMode)}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="important">เฉพาะการพิจารณา</SelectItem>
                  <SelectItem value="all">ทุกเหตุการณ์</SelectItem>
                </SelectContent>
              </Select>
                <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as typeof actionFilter)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกผลการดำเนินการ</SelectItem>
                  {roleKey === 'PTS_OFFICER' ? (
                    <SelectItem value="ON_BEHALF">คำขอที่สร้างแทน</SelectItem>
                  ) : null}
                  <SelectItem value="APPROVE">อนุมัติ</SelectItem>
                  <SelectItem value="RETURN">ส่งกลับแก้ไข</SelectItem>
                  <SelectItem value="REJECT">ไม่อนุมัติ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>เลขที่คำขอ</TableHead>
                  <TableHead>ผู้ยื่นคำขอ</TableHead>
                  <TableHead>หน่วยงาน</TableHead>
                  <TableHead>ดำเนินการโดย</TableHead>
                  <TableHead>วันที่ดำเนินการล่าสุด</TableHead>
                  <TableHead>สถานะปัจจุบัน</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                      กำลังโหลดประวัติ...
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                      ไม่พบรายการประวัติ
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono">
                        <Link
                          href={`${basePath}/requests/${row.id}?from=history`}
                          className="text-primary hover:underline"
                        >
                          {row.requestNo}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{row.requesterName}</TableCell>
                      <TableCell className="text-muted-foreground">{row.department}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{row.lastActionActor}</span>
                          {row.isOfficerCreated ? (
                            <Badge
                              variant="outline"
                              className="border-primary/20 bg-primary/5 text-primary"
                            >
                              เจ้าหน้าที่สร้างแทน
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.lastActionDate ? formatThaiDateTime(row.lastActionDate) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadgeClass(row.status)}>
                          {STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] ?? row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <TableRowViewAction href={`${basePath}/requests/${row.id}?from=history`} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end border-t bg-muted/5 px-4 py-3 text-xs text-muted-foreground">
            แสดง {filteredRows.length} รายการ
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
