'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, XCircle, Info } from 'lucide-react';
import type { RequestWithDetails } from '@/types/request.types';
import { APPROVAL_STEPS } from '@/features/request/detail/utils';
import { formatThaiDateTime } from '@/features/request/detail/utils';
import { TimelineStepItem } from './TimelineStepItem';
import { Badge } from '@/components/ui/badge';

export function ApprovalTimelineCard({ request }: { request: RequestWithDetails }) {
  const approvalActions = request.actions ?? [];
  const toActionTs = (value?: string | null) => {
    if (!value) return 0;
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : 0;
  };
  const sortedActions = [...approvalActions].sort(
    (a, b) => toActionTs(a.action_date) - toActionTs(b.action_date),
  );
  const latestSubmitAction = sortedActions
    .filter((action) => action.action === 'SUBMIT')
    .pop();
  const cycleStartTs = latestSubmitAction ? toActionTs(latestSubmitAction.action_date) : null;
  const timelineActions =
    cycleStartTs === null
      ? sortedActions
      : sortedActions.filter((action) => toActionTs(action.action_date) >= cycleStartTs);

  const submitAction = latestSubmitAction;
  const cancelAction = timelineActions
    .filter((action) => action.action === 'CANCEL')
    .sort((a, b) => (a.action_date || '').localeCompare(b.action_date || ''))
    .pop();
  const submitterRole = submitAction?.actor?.role ?? null;
  const isCancelled = request.status === 'CANCELLED';
  const cancelledByRequester = !cancelAction || cancelAction.actor?.role === 'USER';

  const getVisibleApprovalSteps = () => {
    if (submitterRole === 'HEAD_SCOPE') {
      const progressedStepNumbers = timelineActions
        .filter(
          (action) =>
            action.step_no &&
            (action.action === 'APPROVE' ||
              action.action === 'REJECT' ||
              action.action === 'RETURN'),
        )
        .map((action) => action.step_no as number);

      const earliestWorkflowStep = [request.current_step, ...progressedStepNumbers]
        .filter((step): step is number => typeof step === 'number' && step >= 1 && step <= 6)
        .sort((a, b) => a - b)[0];

      if (earliestWorkflowStep && earliestWorkflowStep > 1) {
        return APPROVAL_STEPS.filter((step) => step.step >= earliestWorkflowStep);
      }
    }

    if (submitterRole === 'WARD_SCOPE') {
      return APPROVAL_STEPS.filter((step) => step.step >= 2);
    }
    if (submitterRole === 'DEPT_SCOPE') {
      return APPROVAL_STEPS.filter((step) => step.step >= 3);
    }
    return APPROVAL_STEPS;
  };

  const visibleSteps = getVisibleApprovalSteps();
  const cancelledStepNo = (() => {
    if (!isCancelled) return null;
    if (cancelledByRequester) return null;
    const stepNo =
      typeof cancelAction?.step_no === 'number' && cancelAction.step_no >= 1
        ? cancelAction.step_no
        : null;
    if (stepNo) return stepNo;
    const hasApprovalProgress = timelineActions.some(
      (action) =>
        action.action === 'APPROVE' || action.action === 'REJECT' || action.action === 'RETURN',
    );
    if (!hasApprovalProgress) return null;
    return request.current_step ?? null;
  })();

  const currentStepDisplayIndex = (() => {
    const stepForDisplay = isCancelled ? cancelledStepNo : request.current_step;
    const index = visibleSteps.findIndex((step) => step.step === stepForDisplay);
    if (index >= 0) return index + 1;
    if (
      stepForDisplay &&
      visibleSteps.length > 0 &&
      stepForDisplay > visibleSteps[visibleSteps.length - 1].step
    ) {
      return visibleSteps.length;
    }
    return null;
  })();
  const shouldRenderApprovalSteps = !(isCancelled && cancelledByRequester);

  // Helper สำหรับสร้างข้อความ Status Header
  const getStatusDescription = () => {
    if (isCancelled) {
      if (!currentStepDisplayIndex) return 'ผู้ยื่นขอยกเลิกก่อนเข้าสายอนุมัติ';
      return `ยกเลิกที่ขั้นตอน ${currentStepDisplayIndex} จาก ${visibleSteps.length}`;
    }
    if (!currentStepDisplayIndex) return 'รอการดำเนินการ';
    return `ขั้นตอนที่ ${currentStepDisplayIndex} จาก ${visibleSteps.length}`;
  };

  return (
    <Card className="shadow-sm border-slate-200 overflow-hidden bg-white">
      {/* Header แบบใหม่ที่ดูคลีนและจัดสัดส่วนชัดเจน */}
      <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50 px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2.5 tracking-tight">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
              <Clock className="w-4 h-4" />
            </div>
            ลำดับการอนุมัติ
          </CardTitle>
          <Badge
            variant="outline"
            className={`px-3 py-1 font-medium text-xs border bg-white shadow-sm ${
              isCancelled
                ? 'text-destructive border-destructive/20'
                : 'text-slate-600 border-slate-200'
            }`}
          >
            {getStatusDescription()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="relative p-5">
        {/* Cancelled Alert สไตล์ Left-Accent */}
        {isCancelled && cancelledByRequester && cancelAction && (
          <div className="relative overflow-hidden mb-6 rounded-xl border border-destructive/20 bg-destructive/5 p-4 shadow-sm">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" />
            <div className="flex gap-3 items-start pl-1">
              <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <p className="text-sm font-bold text-destructive">ผู้ยื่นขอยกเลิกคำขอ</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-destructive/80 font-medium">
                  <p>
                    โดย: {cancelAction.actor?.first_name} {cancelAction.actor?.last_name}
                  </p>
                  <p className="sm:text-right">
                    เวลา: {formatThaiDateTime(cancelAction.action_date)}
                  </p>
                </div>
                {cancelAction.comment && (
                  <div className="mt-2 p-2 bg-white/60 rounded-md border border-destructive/10 text-xs text-destructive/80 flex gap-2 items-start">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <p>เหตุผล: {cancelAction.comment}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {isCancelled && cancelledByRequester ? (
          <p className="mb-1 text-sm text-slate-500">คำขอนี้ยังไม่เข้าสู่ลำดับการอนุมัติ</p>
        ) : null}

        {shouldRenderApprovalSteps ? (
          <>
            {/* Timeline Track Line */}
            <div
              className="absolute left-[39px] sm:left-[43px] top-7 bottom-7 w-0.5 bg-slate-100" // ปรับค่า left ให้ตรงกับ TimelineStepItem ของคุณ (อาจต้องจูนค่านิดหน่อย)
              aria-hidden="true"
            />

            {/* Timeline Items */}
            <div className="space-y-0 relative z-10">
              {visibleSteps.map((step, index) => {
                const approvalAction = timelineActions
                  .filter(
                    (a) =>
                      a.step_no === step.step &&
                      (a.action === 'APPROVE' || a.action === 'REJECT' || a.action === 'RETURN'),
                  )
                  .sort((a, b) => (a.action_date || '').localeCompare(b.action_date || ''))
                  .pop();

                const status = approvalAction
                  ? approvalAction.action === 'APPROVE'
                    ? 'approved'
                    : approvalAction.action === 'REJECT'
                      ? 'rejected'
                      : 'returned'
                  : isCancelled
                    ? cancelledStepNo === step.step
                      ? 'cancelled'
                      : cancelledStepNo && step.step < cancelledStepNo
                        ? 'approved'
                        : 'waiting'
                    : request.current_step === step.step
                      ? 'pending'
                      : request.current_step && step.step < request.current_step
                        ? 'approved'
                        : 'waiting';

                const isLast = index === visibleSteps.length - 1;
                const displayStepNumber = index + 1;
                const action = approvalAction ?? (status === 'cancelled' ? cancelAction : null);
                const actorName = action?.actor
                  ? `${action.actor.first_name} ${action.actor.last_name}`
                  : null;

                return (
                  <TimelineStepItem
                    key={step.step}
                    number={displayStepNumber}
                    title={step.role}
                    status={status}
                    actorName={actorName}
                    actionDate={action?.action_date ? formatThaiDateTime(action.action_date) : null}
                    startedAt={
                      status === 'pending' && request.step_started_at
                        ? formatThaiDateTime(request.step_started_at)
                        : null
                    }
                    comment={action?.comment ?? null}
                    isLast={isLast}
                  />
                );
              })}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
