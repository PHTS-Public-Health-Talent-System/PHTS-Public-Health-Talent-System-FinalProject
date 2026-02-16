'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Eye,
  FileText,
  RefreshCw,
  User,
  XCircle,
} from 'lucide-react';
import type { RequestWithDetails } from '@/types/request.types';
import { toRequestDisplayId } from '@/shared/utils/public-id';
import { useRequestDetail, useProcessAction } from '@/features/request/hooks';
import { useRateHierarchy } from '@/features/master-data/hooks';
import { RequestDetailPageShell } from '@/features/request/detail/components/RequestDetailPageShell';
import { ApprovalTimelineCard } from '@/features/request/detail/components/ApprovalTimelineCard';
import { SectionHeader, InfoItem } from '@/features/request/detail/requestDetail.ui';
import { AttachmentPreviewDialog } from '@/components/common/attachment-preview-dialog';
import { getAttachmentLabel } from '@/features/request/detail/requestDetail.attachmentsLabel';
import { buildAttachmentUrl, isPreviewableFile } from '@/features/request/detail/requestDetail.attachments';
import {
  isEmptyRateMapping,
  normalizeRateMapping,
  resolveRateMappingDisplay,
} from '@/features/request/detail/requestDetail.rateMapping';
import { formatThaiDate, formatThaiNumber } from '@/shared/utils/thai-locale';

const parseSubmission = (value: RequestWithDetails['submission_data']) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
};

const getSubmissionString = (
  submission: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const value = submission[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const PERSONNEL_TYPE_LABELS: Record<string, string> = {
  CIVIL_SERVANT: 'ข้าราชการ',
  GOV_EMPLOYEE: 'พนักงานราชการ',
  PH_EMPLOYEE: 'พนักงานกระทรวงสาธารณสุข',
  TEMP_EMPLOYEE: 'ลูกจ้างชั่วคราว',
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  NEW_ENTRY: 'ขอรับสิทธิ พ.ต.ส. ครั้งแรก',
  EDIT_INFO_SAME_RATE: 'แก้ไขข้อมูล (อัตราเดิม)',
  EDIT_INFO_NEW_RATE: 'แก้ไขข้อมูล (อัตราใหม่)',
};

const WORK_ATTRIBUTE_LABELS: Record<string, string> = {
  operation: 'ปฏิบัติการ',
  planning: 'วางแผน',
  coordination: 'ประสานงาน',
  service: 'ให้บริการ',
};

export default function HeadHRRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: request, isLoading } = useRequestDetail(id);
  const { data: rateHierarchy } = useRateHierarchy();
  const processAction = useProcessAction();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [comment, setComment] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const submission = useMemo(
    () => parseSubmission(request?.submission_data) as Record<string, unknown>,
    [request?.submission_data],
  );
  const submissionTitle = getSubmissionString(submission, ['title']);
  const submissionFirstName = getSubmissionString(submission, ['first_name', 'firstName']);
  const submissionLastName = getSubmissionString(submission, ['last_name', 'lastName']);
  const submissionPositionName = getSubmissionString(submission, ['position_name', 'positionName']);
  const submissionDepartment = getSubmissionString(submission, ['department']);
  const submissionSubDepartment = getSubmissionString(submission, [
    'sub_department',
    'subDepartment',
  ]);
  const submissionPositionNumber = getSubmissionString(submission, [
    'position_number',
    'positionNumber',
  ]);

  const requesterName = useMemo(() => {
    const firstName = submissionFirstName ?? request?.requester?.first_name;
    const lastName = submissionLastName ?? request?.requester?.last_name;
    return [submissionTitle, firstName, lastName].filter(Boolean).join(' ').trim() || '-';
  }, [request?.requester, submissionTitle, submissionFirstName, submissionLastName]);

  const positionName = submissionPositionName ?? request?.requester?.position ?? '-';
  const department = submissionDepartment ?? request?.current_department ?? '-';
  const subDepartment = submissionSubDepartment ?? '-';
  const displayId = request
    ? (request.request_no ?? toRequestDisplayId(request.request_id, request.created_at))
    : id;

  const rateMapping = useMemo(
    () => normalizeRateMapping(request?.submission_data ?? null),
    [request?.submission_data],
  );
  const rateDisplay = useMemo(() => {
    if (!rateMapping) return null;
    return resolveRateMappingDisplay(rateMapping, rateHierarchy);
  }, [rateMapping, rateHierarchy]);
  const rateAmount = rateMapping?.amount ?? request?.requested_amount ?? null;
  const isRateMappingEmpty = useMemo(() => isEmptyRateMapping(rateMapping), [rateMapping]);
  const effectiveDateLabel = request?.effective_date
    ? formatThaiDate(request.effective_date, { month: 'long' })
    : null;

  const attachments = request?.attachments ?? [];
  const personnelTypeLabel = request?.personnel_type
    ? PERSONNEL_TYPE_LABELS[request.personnel_type] || request.personnel_type
    : '-';
  const requestTypeLabel = request?.request_type
    ? REQUEST_TYPE_LABELS[request.request_type] || request.request_type
    : '-';
  const mainDuty = request?.main_duty || '-';
  const workAttributes = request?.work_attributes
    ? Object.entries(request.work_attributes)
        .filter(([, enabled]) => Boolean(enabled))
        .map(([key]) => WORK_ATTRIBUTE_LABELS[key] || key)
    : [];

  const canAct = request?.status === 'PENDING' && request?.current_step === 4;

  const handlePreview = (url: string, name: string) => {
    setPreviewUrl(url);
    setPreviewName(name);
    setPreviewOpen(true);
  };

  const handleAction = async () => {
    if (!request || !actionType) return;
    const trimmed = comment.trim();
    if (actionType !== 'approve' && !trimmed) {
      setActionError('กรุณาระบุเหตุผลก่อนดำเนินการ');
      return;
    }
    setActionError(null);
    const actionMap = {
      approve: 'APPROVE',
      reject: 'REJECT',
      return: 'RETURN',
    } as const;

    try {
      await processAction.mutateAsync({
        id: request.request_id,
        payload: { action: actionMap[actionType], comment: trimmed || undefined },
      });
      toast.success('ดำเนินการคำขอเรียบร้อย');
      setActionType(null);
      setComment('');
      router.push('/head-hr/requests');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
      setActionError(message);
    }
  };

  return (
    <RequestDetailPageShell
      state={isLoading ? 'loading' : request ? 'ready' : 'notFound'}
      backHref="/head-hr/requests"
      backLabel="รายการคำขอ"
      displayId={displayId}
      status={request?.status}
      currentStep={request?.current_step ?? null}
      createdAt={request?.created_at ?? null}
      headerActions={
        request ? (
          <>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!canAct || processAction.isPending}
              onClick={() => setActionType('approve')}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              อนุมัติ
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canAct || processAction.isPending}
              onClick={() => setActionType('return')}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              ส่งกลับแก้ไข
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              disabled={!canAct || processAction.isPending}
              onClick={() => setActionType('reject')}
            >
              <XCircle className="mr-2 h-4 w-4" />
              ไม่อนุมัติ
            </Button>
          </>
        ) : null
      }
      left={
        request ? (
          <>
            <Card className="scroll-mt-20 shadow-sm transition-all duration-300 border-border/60">
              <CardContent className="p-6">
                <SectionHeader title="ข้อมูลผู้ยื่นคำขอ" icon={User} />
                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
                  <InfoItem label="ชื่อ-นามสกุล" value={requesterName} icon={User} className="sm:col-span-2" />
                  <InfoItem label="เลขประจำตัวประชาชน" value={request.citizen_id ?? '-'} />
                  <div className="col-span-full border-t border-border/50 my-2"></div>
                  <InfoItem label="ตำแหน่ง" value={positionName} icon={Briefcase} className="sm:col-span-2" />
                  <InfoItem
                    label="เลขที่ตำแหน่ง"
                    value={submissionPositionNumber || request.current_position_number || '-'}
                  />
                  <InfoItem label="กลุ่มงาน" value={department} icon={Building2} />
                  <InfoItem label="หน่วยงาน" value={subDepartment} />
                </dl>
              </CardContent>
            </Card>

            <Card className="scroll-mt-20 shadow-sm transition-all duration-300 border-border/60">
              <CardContent className="p-6">
                <SectionHeader title="รายละเอียดสิทธิ พ.ต.ส." icon={CreditCard} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4 mb-6">
                  <InfoItem label="ประเภทคำขอ" value={requestTypeLabel} className="sm:col-span-2" />
                  <InfoItem label="ประเภทบุคลากร" value={personnelTypeLabel} />
                  <InfoItem label="วันที่เริ่มมีผล" value={effectiveDateLabel || '-'} />
                  <InfoItem label="งานที่ได้รับมอบหมาย" value={mainDuty} className="sm:col-span-2" />
                  <InfoItem
                    label="ลักษณะงาน"
                    value={workAttributes.length > 0 ? workAttributes.join(', ') : '-'}
                    className="sm:col-span-2"
                  />
                </div>

                <div className="bg-muted/30 rounded-lg p-5 border border-border/50">
                  <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <span className="w-1 h-4 bg-primary rounded-full"></span>
                    ผลการประเมินสิทธิ พ.ต.ส.
                  </h4>

                  {isRateMappingEmpty ? (
                    <div className="text-sm text-muted-foreground text-center py-4 italic">
                      ยังไม่มีผลการประเมินสิทธิ
                    </div>
                  ) : (
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4">
                      <InfoItem label="วิชาชีพ" value={rateDisplay?.professionLabel || '-'} />
                      <InfoItem label="กลุ่ม" value={rateDisplay?.groupLabel || '-'} />
                      <InfoItem
                        label="เงื่อนไขหลัก"
                        value={rateDisplay?.criteriaLabel || '-'}
                        className="sm:col-span-2"
                      />
                      <InfoItem
                        label="เงื่อนไขย่อย"
                        value={rateDisplay?.subCriteriaLabel || '-'}
                        className="sm:col-span-2"
                      />

                      <div className="sm:col-span-2 mt-2 pt-4 border-t border-border/50 flex justify-between items-center">
                        <span className="text-sm font-medium">อัตราเงินตามสิทธิ</span>
                        <span className="text-lg font-bold text-primary">
                          {rateAmount !== null && rateAmount !== undefined
                            ? formatThaiNumber(Number(rateAmount))
                            : '-'}
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            บาท/เดือน
                          </span>
                        </span>
                      </div>
                    </dl>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="scroll-mt-20 shadow-sm transition-all duration-300 border-border/60">
              <CardContent className="p-6">
                <SectionHeader title={`ไฟล์แนบ (${attachments.length})`} icon={FileText} />
                {attachments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                    <FileText className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-sm">ไม่มีไฟล์เอกสารแนบ</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {attachments.map((file) => {
                      const fileUrl = buildAttachmentUrl(file.file_path);
                      const previewable = isPreviewableFile(file.file_name);
                      return (
                        <div
                          key={file.attachment_id}
                          className="group relative flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 hover:border-primary/30 transition-all duration-200"
                        >
                          <div className="h-10 w-10 shrink-0 rounded bg-primary/10 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate pr-6" title={file.file_name}>
                              {file.file_name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {getAttachmentLabel(file.file_name, file.file_type)}
                            </p>
                            <div className="flex items-center gap-2 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                              {previewable && (
                                <button
                                  onClick={() => handlePreview(fileUrl, file.file_name)}
                                  className="text-xs flex items-center hover:text-primary transition-colors hover:underline"
                                >
                                  <Eye className="w-3 h-3 mr-1" /> ดูตัวอย่าง
                                </button>
                              )}
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs flex items-center hover:text-primary transition-colors hover:underline"
                              >
                                <ExternalLink className="w-3 h-3 mr-1" /> เปิดไฟล์
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null
      }
      right={
        request ? (
          <>
            <Card className="shadow-sm border-primary/20 bg-primary/5 overflow-hidden">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-primary/80 mb-1">ยอดเงินเบิกจ่าย</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-primary">
                    {formatThaiNumber(request.requested_amount ?? 0)}
                  </span>
                  <span className="text-sm text-primary/80">บาท</span>
                </div>
              </CardContent>
            </Card>

            <ApprovalTimelineCard request={request} />
          </>
        ) : null
      }
      after={
        request ? (
          <>
            <AttachmentPreviewDialog
              open={previewOpen}
              onOpenChange={setPreviewOpen}
              previewUrl={previewUrl}
              previewName={previewName}
            />

            <Dialog
              open={!!actionType}
              onOpenChange={(open) => {
                if (!open) {
                  setActionType(null);
                  setComment('');
                  setActionError(null);
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {actionType === 'approve' && 'อนุมัติคำขอ'}
                    {actionType === 'reject' && 'ไม่อนุมัติคำขอ'}
                    {actionType === 'return' && 'ส่งกลับแก้ไข'}
                  </DialogTitle>
                  <DialogDescription>
                    คำขอ {displayId} - {requesterName}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">
                      {actionType === 'approve' ? 'หมายเหตุ (ไม่บังคับ)' : 'เหตุผล'}
                    </label>
                    <Textarea
                      placeholder={
                        actionType === 'approve'
                          ? 'ระบุหมายเหตุเพิ่มเติม (ถ้ามี)'
                          : actionType === 'reject'
                            ? 'ระบุเหตุผลที่ไม่อนุมัติ'
                            : 'ระบุสิ่งที่ต้องแก้ไข'
                      }
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      className="mt-2"
                    />
                    {actionError && <p className="mt-2 text-sm text-destructive">{actionError}</p>}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActionType(null);
                      setComment('');
                      setActionError(null);
                    }}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    onClick={handleAction}
                    disabled={processAction.isPending}
                    className={
                      actionType === 'approve'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : actionType === 'return'
                          ? 'bg-orange-500 hover:bg-orange-600 text-white'
                          : 'bg-destructive hover:bg-destructive/90'
                    }
                  >
                    {actionType === 'approve' && 'อนุมัติ'}
                    {actionType === 'reject' && 'ไม่อนุมัติ'}
                    {actionType === 'return' && 'ส่งกลับแก้ไข'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : null
      }
    />
  );
}
