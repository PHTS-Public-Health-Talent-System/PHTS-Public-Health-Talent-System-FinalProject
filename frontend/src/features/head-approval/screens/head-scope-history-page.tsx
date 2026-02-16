'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { History, Search, Eye } from 'lucide-react';
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
import { useApprovalHistory } from '@/features/request/hooks';
import { mapRequestToFormData } from '@/features/request/components/hooks/request-form-mapper';
import type { RequestWithDetails, ApprovalAction } from '@/types/request.types';
import { STATUS_LABELS } from '@/types/request.types';
import { formatThaiDateTime } from '@/shared/utils/thai-locale';

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
  lastActionDate: string | null;
};

const ACTION_LABELS: Record<string, string> = {
  APPROVE: 'อนุมัติ',
  REJECT: 'ไม่อนุมัติ',
  RETURN: 'ส่งกลับแก้ไข',
  SUBMIT: 'ยื่นคำขอ',
  CANCEL: 'ยกเลิก',
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
    case 'PENDING_HEAD_WARD':
    case 'PENDING_HEAD_DEPT':
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
  const [historyView, setHistoryView] = useState<'team' | 'mine'>(() => {
    if (typeof window === 'undefined') return 'team';
    const storageKey = `${HISTORY_VIEW_STORAGE_KEY_PREFIX}${roleKey}`;
    const saved = window.localStorage.getItem(storageKey);
    return saved === 'mine' || saved === 'team' ? saved : 'team';
  });
  const [actionMode, setActionMode] = useState<'important' | 'all'>('important');
  const historyQuery = useApprovalHistory({ view: historyView, actions: actionMode });
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | 'APPROVE' | 'REJECT' | 'RETURN'>('all');

  useEffect(() => {
    const storageKey = `${HISTORY_VIEW_STORAGE_KEY_PREFIX}${roleKey}`;
    window.localStorage.setItem(storageKey, historyView);
  }, [historyView, roleKey]);

  const rows = useMemo<HistoryRow[]>(() => {
    const items = (historyQuery.data ?? []) as RequestWithDetails[];
    return items.map((request) => {
      const formData = mapRequestToFormData(request);
      const requesterName =
        [formData.title, formData.firstName, formData.lastName].filter(Boolean).join(' ').trim() ||
        request.citizen_id;
      const department =
        formData.subDepartment || formData.department || request.current_department || '-';
      const requestNo = request.request_no ?? String(request.request_id);
      const sortedActions = [...(request.actions ?? [])]
        .filter((action) => (actionMode === 'all' ? true : ['APPROVE', 'REJECT', 'RETURN'].includes(action.action)))
        .sort((a, b) =>
        new Date(b.action_date).getTime() - new Date(a.action_date).getTime(),
      );
      const lastAction = sortedActions[0];
      return {
        id: request.request_id,
        requestNo,
        requesterName,
        department,
        status: request.status,
        lastActionType: (lastAction?.action as ApprovalAction['action']) ?? '-',
        lastActionDate: lastAction?.action_date ?? null,
      };
    });
  }, [historyQuery.data, actionMode]);

  const filteredRows = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !keyword ||
        row.requestNo.toLowerCase().includes(keyword) ||
        row.requesterName.toLowerCase().includes(keyword) ||
        row.department.toLowerCase().includes(keyword);
      const matchesAction = actionFilter === 'all' || row.lastActionType === actionFilter;
      return matchesSearch && matchesAction;
    });
  }, [rows, searchTerm, actionFilter]);

  return (
    <div className="p-8 space-y-8 pb-20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">ประวัติการอนุมัติ</h1>
          <p className="text-muted-foreground mt-1">รายการคำขอที่{roleTitle}เคยดำเนินการ</p>
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
                ของทีม/ตาม scope
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
              {historyView === 'team' ? 'ประวัติของทีม/ตาม scope' : 'ประวัติของฉัน'}
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
                  <SelectItem value="important">เฉพาะสำคัญ</SelectItem>
                  <SelectItem value="all">ทุกการดำเนินการ</SelectItem>
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as typeof actionFilter)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกการดำเนินการ</SelectItem>
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
                  <TableHead>การดำเนินการล่าสุด</TableHead>
                  <TableHead>วันเวลา</TableHead>
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
                      <TableCell className="font-mono">{row.requestNo}</TableCell>
                      <TableCell className="font-medium">{row.requesterName}</TableCell>
                      <TableCell className="text-muted-foreground">{row.department}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {row.lastActionType === '-' ? '-' : ACTION_LABELS[row.lastActionType] ?? row.lastActionType}
                        </Badge>
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
                        <Link href={`${basePath}/requests/${row.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
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
