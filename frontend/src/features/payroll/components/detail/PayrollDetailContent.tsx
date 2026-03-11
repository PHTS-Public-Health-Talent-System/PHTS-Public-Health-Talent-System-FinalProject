'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, Calendar, Clock, Users, AlertCircle, FileText, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  useApproveByDirector,
  useApproveByHeadFinance,
  useApproveByHR,
  usePeriodDetail,
  usePeriodPayouts,
  usePayoutDetail,
  useRejectPeriod,
  useUpdatePayout,
} from '@/features/payroll/hooks';
import type { PayoutDetail, PeriodDetail, PeriodPayoutRow } from '@/features/payroll/api';
import { getSnapshotStatusUi, normalizeSnapshotStatus } from '@/features/payroll/domain/snapshot';
import { useRateHierarchy } from '@/features/master-data/hooks';
import type { ProfessionHierarchy } from '@/features/master-data/api';
import { formatThaiNumber } from '@/shared/utils/thai-locale';
import type { PayrollRow, PeriodStatus } from './model/detail.types';
import { statusConfig } from './model/detail.helpers';
import { PayrollSummaryCard } from '../common/PayrollSummaryCard';
import { usePayrollDetailActions, usePayrollDetailViewModel } from './hooks';
import {
  PayrollDetailHeader,
  PayrollPayoutTableSection,
  PayrollProfessionSelector,
} from './sections';
import { PayrollActionDialog } from './sections/PayrollActionDialog';
import { PayrollChecksDialog } from './sections/PayrollChecksDialog';
import { PayrollEditDialog } from './sections/PayrollEditDialog';

type PayrollDetailContentProps = {
  periodId: string;
  selectedProfession: string;
  basePath: string;
  compactView?: boolean;
  showTable?: boolean;
  showSummary?: boolean;
  showSelector?: boolean;
  backHref?: string;
  allowApprovalActions?: boolean;
  approvalRole?: 'HR' | 'HEAD_FINANCE' | 'DIRECTOR';
  reviewedProfessionCodes?: string[];
  onSetProfessionReviewed?: (professionCode: string, reviewed: boolean) => void;
  onSubmitForReview?: () => Promise<void>;
  isSubmittingForReview?: boolean;
  onAvailableProfessionsChange?: (professions: { code: string; label: string }[]) => void;
};

export function PayrollDetailContent({
  periodId,
  selectedProfession,
  basePath,
  compactView = false,
  showTable = true,
  showSummary = true,
  showSelector = true,
  backHref = basePath,
  allowApprovalActions = true,
  approvalRole = 'HR',
  reviewedProfessionCodes = [],
  onSetProfessionReviewed,
  onSubmitForReview,
  isSubmittingForReview = false,
  onAvailableProfessionsChange,
}: PayrollDetailContentProps) {
  const router = useRouter();
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [selectedCheckRow, setSelectedCheckRow] = useState<PayrollRow | null>(null);
  const [editRow, setEditRow] = useState<PayrollRow | null>(null);
  const [editEligibleDays, setEditEligibleDays] = useState<string>('');
  const [editDeductedDays, setEditDeductedDays] = useState<string>('');
  const [editRetroactiveAmount, setEditRetroactiveAmount] = useState<string>('');
  const [editRemark, setEditRemark] = useState<string>('');

  const periodDetailQuery = usePeriodDetail(periodId);
  const payoutsQuery = usePeriodPayouts(periodId);
  const rateHierarchyQuery = useRateHierarchy();
  const payoutDetailQuery = usePayoutDetail(selectedCheckRow?.id ?? undefined);
  const approveByDirector = useApproveByDirector();
  const approveByHeadFinance = useApproveByHeadFinance();
  const approveByHR = useApproveByHR();
  const rejectPeriod = useRejectPeriod();
  const updatePayoutMutation = useUpdatePayout();

  const periodDetail = periodDetailQuery.data as PeriodDetail | undefined;
  const period = periodDetail?.period;
  const statusInfo = statusConfig[(period?.status as PeriodStatus) ?? 'OPEN'];
  const payoutsData = useMemo(
    () => (payoutsQuery.data ?? []) as PeriodPayoutRow[],
    [payoutsQuery.data],
  );

  const vm = usePayrollDetailViewModel({
    selectedProfession,
    periodDetail,
    payoutsData,
    rateHierarchyData: (rateHierarchyQuery.data ?? []) as ProfessionHierarchy[],
    reviewedProfessionCodes,
    onAvailableProfessionsChange,
    onSubmitForReview,
  });

  const canEditPayout = period?.status === 'OPEN' && !Boolean(period?.is_locked);
  const snapshotStatus = normalizeSnapshotStatus(period?.snapshot_status);
  const snapshotUi = getSnapshotStatusUi(snapshotStatus);
  const approvalStatus =
    approvalRole === 'DIRECTOR'
      ? 'WAITING_DIRECTOR'
      : approvalRole === 'HEAD_FINANCE'
        ? 'WAITING_HEAD_FINANCE'
        : 'WAITING_HR';
  const approvalLabel =
    approvalRole === 'DIRECTOR'
      ? 'ผู้อำนวยการ'
      : approvalRole === 'HEAD_FINANCE'
        ? 'หัวหน้าการเงิน'
        : 'หัวหน้าทรัพยากรบุคคล';
  const canRejectPeriod = approvalRole === 'DIRECTOR' || approvalRole === 'HR';

  const actions = usePayrollDetailActions({
    router,
    basePath,
    periodId,
    selectedProfession,
    approvalRole,
    canRejectPeriod,
    approveByDirector,
    approveByHeadFinance,
    approveByHR,
    rejectPeriod,
    updatePayoutMutation,
    canEditPayout,
    setSearchQuery: vm.setSearchQuery,
    setRateFilter: vm.setRateFilter,
  });

  // UX Fix: Structured Skeleton Loading
  if (periodDetailQuery.isLoading || payoutsQuery.isLoading) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
        <Skeleton className="h-28 w-full rounded-none md:rounded-b-2xl" />
        {!compactView && (
          <div className="grid grid-cols-2 gap-4 px-6 md:px-8 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        )}
        <div className="px-6 md:px-8 space-y-6">
           <Skeleton className="h-14 w-full rounded-xl" />
           <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // UX Fix: Friendly Error State
  if (periodDetailQuery.isError || payoutsQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center pb-12 animate-in fade-in max-w-[1600px] mx-auto">
        <div className="p-4 bg-destructive/10 rounded-full mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">ไม่สามารถโหลดข้อมูลรอบจ่ายเงินได้</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-5">
          เกิดข้อผิดพลาดในการเชื่อมต่อ หรือไม่พบข้อมูล กรุณาลองใหม่อีกครั้ง
        </p>
        <Button onClick={() => window.location.reload()} className="gap-2 shadow-sm">
          <RefreshCw className="h-4 w-4" /> ลองใหม่อีกครั้ง
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-[1600px] mx-auto">
      <PayrollDetailHeader
        backHref={backHref}
        period={period}
        activeProfessionLabel={vm.activeProfessionLabel}
        statusLabel={statusInfo.label}
        statusClassName={statusInfo.color}
        allowApprovalActions={allowApprovalActions}
        approvalStatus={approvalStatus}
        approvalLabel={approvalLabel}
        canRejectPeriod={canRejectPeriod}
        periodStatus={period?.status}
        currentProfessionReviewed={vm.currentProfessionReviewed}
        canSubmitReview={vm.canSubmitReview}
        isSubmittingForReview={isSubmittingForReview}
        onApproveClick={() => setActionType('approve')}
        onRejectClick={() => setActionType('reject')}
        onToggleReviewed={
          onSetProfessionReviewed && selectedProfession !== 'all'
            ? () => onSetProfessionReviewed(selectedProfession, !vm.currentProfessionReviewed)
            : undefined
        }
        onSubmitForReview={
          onSubmitForReview
            ? async () => {
                if (!vm.canSubmitReview) {
                  const names = vm.remainingProfessions
                    .map((profession) => profession.label)
                    .join(', ');
                  toast.error(
                    names ? `ยังตรวจไม่ครบทุกวิชาชีพ: ${names}` : 'ยังตรวจไม่ครบทุกวิชาชีพ',
                  );
                  return;
                }
                await onSubmitForReview();
              }
            : undefined
        }
        snapshotStatusLabel={snapshotUi.label}
        snapshotStatusClassName={snapshotUi.className}
      />

      {!compactView && (
        <div className="grid grid-cols-2 gap-4 px-4 md:px-6 lg:px-8 lg:grid-cols-4">
          <PayrollSummaryCard
            icon={Users}
            title="จำนวนรายชื่อ"
            value={
               <div className="flex items-baseline gap-1.5">
                 <span className="font-bold tracking-tight text-foreground">{formatThaiNumber(vm.displayStats.count)}</span>
                 <span className="text-sm font-normal text-muted-foreground">คน</span>
               </div>
            }
            iconClassName="text-primary"
            iconBgClassName="bg-primary/10"
          />
          <PayrollSummaryCard
            icon={Banknote}
            title="ยอดสุทธิรวม"
            value={
               <div className="flex items-baseline gap-1.5">
                 <span className="font-bold tracking-tight text-foreground">{formatThaiNumber(vm.displayStats.amount)}</span>
                 <span className="text-sm font-normal text-muted-foreground">บาท</span>
               </div>
            }
            iconClassName="text-emerald-600"
            iconBgClassName="bg-emerald-500/10"
          />
          <PayrollSummaryCard
            icon={Calendar}
            title="วันทำการ"
            value={
               <div className="flex items-baseline gap-1.5">
                 <span className="font-bold tracking-tight text-foreground">{formatThaiNumber(Number(periodDetail?.calendar?.working_days ?? 0))}</span>
                 <span className="text-sm font-normal text-muted-foreground">วัน</span>
               </div>
            }
            iconClassName="text-blue-600"
            iconBgClassName="bg-blue-500/10"
          />
          <PayrollSummaryCard
            icon={Clock}
            title="วันหยุดราชการ"
            value={
               <div className="flex items-baseline gap-1.5">
                 <span className="font-bold tracking-tight text-foreground">{formatThaiNumber(Number(periodDetail?.calendar?.holiday_days ?? 0))}</span>
                 <span className="text-sm font-normal text-muted-foreground">วัน</span>
               </div>
            }
            iconClassName="text-amber-600"
            iconBgClassName="bg-amber-500/10"
          />
        </div>
      )}

      {showSelector && (
        <div className="px-4 md:px-6 lg:px-8">
          <PayrollProfessionSelector
            selectedProfession={selectedProfession}
            professionCards={vm.professionCards}
            professionTotals={vm.professionTotals}
            reviewedCodeSet={vm.reviewedCodeSet}
            onSelectProfession={actions.handleSelectProfession}
          />
        </div>
      )}

      {showSummary && (
        <div className="px-4 md:px-6 lg:px-8">
           <Card className="border-border shadow-sm">
             <CardHeader className="pb-4 border-b bg-muted/5">
               <CardTitle className="text-base font-semibold flex items-center gap-2">
                 <FileText className="h-4 w-4 text-muted-foreground" />
                 สรุปตามอัตราเงิน พ.ต.ส.{vm.activeProfessionLabel ? <span className="font-normal text-muted-foreground"> ({vm.activeProfessionLabel})</span> : ''}
               </CardTitle>
             </CardHeader>
             <CardContent className="pt-6">
               <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                 {(selectedProfession === 'all'
                   ? Array.from(
                       new Map(
                         vm.filteredPersons
                           .filter((row) => row.baseRate > 0)
                           .map((row) => [row.baseRate, row.baseRate]),
                       ).values(),
                     ).sort((a, b) => a - b)
                   : (vm.professionGroups[selectedProfession] ?? []).map(({ rate }) => rate)
                 ).map((rate) => {
                   const count = vm.filteredPersons.filter(
                     (person) => person.baseRate === rate,
                   ).length;
                   const amount = vm.filteredPersons
                     .filter((person) => person.baseRate === rate)
                     .reduce((total, person) => total + person.totalAmount, 0);
                   if (count === 0) return null;

                   const groupLabel =
                     selectedProfession === 'all'
                       ? 'อัตราเงิน พ.ต.ส.'
                       : `กลุ่มที่ ${
                           vm.professionGroups[selectedProfession]?.find(
                             (group) => group.rate === rate,
                           )?.group ?? '-'
                         }`;

                   return (
                     <div
                       key={`${selectedProfession}-${rate}`}
                       className="flex flex-col p-4 rounded-xl bg-background border shadow-sm hover:shadow-md transition-shadow"
                     >
                       <div className="flex items-center justify-between mb-4">
                         <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                           {groupLabel}
                         </span>
                         <Badge
                           variant="secondary"
                           className="font-mono bg-muted text-foreground font-medium"
                         >
                           {formatThaiNumber(rate)} บ.
                         </Badge>
                       </div>
                       <div className="flex items-end justify-between mt-auto">
                         <div className="flex items-baseline gap-1.5">
                           <span className="text-2xl font-bold text-foreground leading-none">
                             {formatThaiNumber(count)}
                           </span>
                           <span className="text-sm font-normal text-muted-foreground">คน</span>
                         </div>
                         <div className="flex items-baseline gap-1">
                           <span className="text-base font-bold text-emerald-600">
                             {formatThaiNumber(amount)}
                           </span>
                           <span className="text-xs text-muted-foreground">บาท</span>
                         </div>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </CardContent>
           </Card>
        </div>
      )}

      {showTable && (
        <PayrollPayoutTableSection
          activeProfessionLabel={vm.activeProfessionLabel}
          filteredPersonsCount={vm.filteredPersons.length}
          sortedPersons={vm.sortedPersons}
          searchQuery={vm.searchQuery}
          onSearchChange={vm.setSearchQuery}
          rateFilter={vm.rateFilter}
          onRateFilterChange={vm.setRateFilter}
          availableGroups={vm.availableGroups}
          departmentFilter={vm.departmentFilter}
          onDepartmentFilterChange={vm.setDepartmentFilter}
          availableDepartments={vm.availableDepartments}
          issueFilter={vm.issueFilter}
          onIssueFilterChange={vm.setIssueFilter}
          sortBy={vm.sortBy}
          onSortByChange={vm.setSortBy}
          canEditPayout={canEditPayout}
          onOpenAllowanceDetail={setSelectedCheckRow}
          onOpenChecks={setSelectedCheckRow}
          onEditRow={(person) => {
            setEditRow(person);
            setEditEligibleDays(String(person.workDays ?? 0));
            setEditDeductedDays(String(person.leaveDays ?? 0));
            setEditRetroactiveAmount(String(person.retroactiveAmount ?? 0));
            setEditRemark(person.note ?? '');
          }}
        />
      )}

      {/* Dialogs */}
      <PayrollEditDialog
        open={!!editRow}
        onOpenChange={(open) => {
          if (!open) setEditRow(null);
        }}
        editRow={editRow}
        editEligibleDays={editEligibleDays}
        setEditEligibleDays={setEditEligibleDays}
        editDeductedDays={editDeductedDays}
        setEditDeductedDays={setEditDeductedDays}
        editRetroactiveAmount={editRetroactiveAmount}
        setEditRetroactiveAmount={setEditRetroactiveAmount}
        editRemark={editRemark}
        setEditRemark={setEditRemark}
        periodMonth={period?.period_month}
        periodYear={period?.period_year}
        onSave={async () => {
          const ok = await actions.handleSavePayoutEdit({
            editRow,
            editEligibleDays,
            editDeductedDays,
            editRetroactiveAmount,
            editRemark,
            periodMonth: period?.period_month,
            periodYear: period?.period_year,
          });
          if (ok) setEditRow(null);
        }}
        saving={updatePayoutMutation.isPending}
        canEditPayout={canEditPayout}
      />

      <PayrollActionDialog
        open={!!actionType}
        onClose={() => {
          setActionType(null);
          setComment('');
        }}
        actionType={actionType}
        setComment={setComment}
        comment={comment}
        approvalLabel={approvalLabel}
        periodMonth={period?.period_month}
        periodYear={period?.period_year}
        totalHeadcount={period?.total_headcount}
        totalAmount={period?.total_amount}
        onConfirm={async () => {
          if (!actionType) return;
          const ok = await actions.handleAction(actionType, comment);
          if (ok) {
            periodDetailQuery.refetch();
            setActionType(null);
            setComment('');
          }
        }}
        isPending={approveByHR.isPending || approveByDirector.isPending || rejectPeriod.isPending}
      />

      <PayrollChecksDialog
        open={!!selectedCheckRow}
        onOpenChange={(open) => {
          if (!open) setSelectedCheckRow(null);
        }}
        selectedCheckRow={selectedCheckRow}
        payoutDetailLoading={payoutDetailQuery.isLoading}
        payoutDetailError={payoutDetailQuery.isError}
        payoutDetail={payoutDetailQuery.data as PayoutDetail | undefined}
      />
    </div>
  );
}
