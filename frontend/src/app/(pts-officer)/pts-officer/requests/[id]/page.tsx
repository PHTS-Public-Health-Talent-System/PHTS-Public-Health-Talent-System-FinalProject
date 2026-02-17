'use client';
export const dynamic = 'force-dynamic';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  FileText,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  Eye,
  ExternalLink,
  ChevronRight,
  Briefcase,
  Building2,
  RotateCcw,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  useCreateVerificationSnapshot,
  useProcessAction,
  useRequestDetail,
} from '@/features/request/hooks';
import { useRateHierarchy } from '@/features/master-data/hooks';
import { AttachmentPreviewDialog } from '@/components/common/attachment-preview-dialog';
import { toRequestDisplayId } from '@/shared/utils/public-id';
import type { RequestWithDetails } from '@/types/request.types';
import { formatThaiDate, formatThaiDateTime, toDateOnly } from '@/features/request/detail/requestDetail.format';
import { getStatusColor, getStatusLabel } from '@/features/request/detail/requestDetail.status';
import { getAttachmentLabel } from '@/features/request/detail/requestDetail.attachmentsLabel';
import { InfoItem, SectionHeader } from '@/features/request/detail/requestDetail.ui';
import { ApprovalTimelineCard } from '@/features/request/detail/components/ApprovalTimelineCard';
import {
  isEmptyRateMapping,
  normalizeRateMapping,
  resolveRateMappingDisplay,
} from '@/features/request/detail/requestDetail.rateMapping';
import {
  buildAttachmentUrl,
  isPreviewableFile,
} from '@/features/request/detail/requestDetail.attachments';
import { formatThaiNumber } from '@/shared/utils/thai-locale';

type AssessmentVerdict = 'correct' | 'incorrect';

type MinimumChecklistItem = {
  key: string;
  label: string;
  description: string;
};

const MinimumChecklist = ({
  title,
  items,
  verdictMap,
  onSelect,
  className,
}: {
  title: string;
  verdictMap: Record<string, AssessmentVerdict | undefined>;
  items: MinimumChecklistItem[];
  onSelect: (key: string, verdict: AssessmentVerdict) => void;
  className?: string;
}) => {
  const checkedCount = items.filter((i) => verdictMap[i.key]).length;
  const isAllChecked = checkedCount === items.length;
  const hasIncorrect = items.some((i) => verdictMap[i.key] === 'incorrect');

  return (
    <div
      className={`mt-6 rounded-lg border transition-colors ${
        isAllChecked && !hasIncorrect
          ? 'border-emerald-200 bg-emerald-50/30'
          : hasIncorrect
            ? 'border-rose-200 bg-rose-50/30'
            : 'border-border/60 bg-muted/20'
      } p-4 ${className ?? ''}`}
    >
      <div className="flex justify-between items-center mb-3">
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            isAllChecked && !hasIncorrect
              ? 'text-emerald-700'
              : hasIncorrect
                ? 'text-rose-700'
                : 'text-muted-foreground'
          }`}
        >
          {title}
        </p>
        <span className="text-[10px] bg-background px-2 py-0.5 rounded-full border text-muted-foreground">
          {checkedCount}/{items.length}
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const verdict = verdictMap[item.key];
          return (
            <div
              key={item.key}
              className={`rounded border p-3 transition-colors ${
                verdict === 'correct'
                  ? 'bg-emerald-50/50 border-emerald-100'
                  : verdict === 'incorrect'
                    ? 'bg-rose-50/50 border-rose-100'
                    : 'bg-background/80 border-border/50'
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                </div>
                {verdict === 'correct' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                )}
                {verdict === 'incorrect' && <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`h-7 px-3 text-xs ${
                    verdict === 'correct'
                      ? 'border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'hover:bg-emerald-50 hover:text-emerald-600'
                  }`}
                  onClick={() => onSelect(item.key, 'correct')}
                >
                  ถูกต้อง
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`h-7 px-3 text-xs ${
                    verdict === 'incorrect'
                      ? 'border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-200'
                      : 'hover:bg-rose-50 hover:text-rose-600'
                  }`}
                  onClick={() => onSelect(item.key, 'incorrect')}
                >
                  ไม่ถูกต้อง
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- CONSTANTS ---

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

const EMPLOYEE_MINIMUM_CHECKLIST: MinimumChecklistItem[] = [
  {
    key: 'basic_form_data',
    label: 'ข้อมูลในแบบคำขอครบและตรงกับข้อมูลบุคคล',
    description: 'ชื่อ-สกุล ตำแหน่ง สังกัด สถานที่ปฏิบัติงาน กรอกครบถ้วน และตรงกับข้อมูลในระบบ',
  },
];

const ELIGIBILITY_MINIMUM_CHECKLIST: MinimumChecklistItem[] = [
  {
    key: 'healthcare_definition',
    label: 'เข้าเกณฑ์ผู้ปฏิบัติงานด้านการสาธารณสุขตามระเบียบ',
    description: 'สำเร็จการศึกษาตามเกณฑ์ มีใบอนุญาตฯ และใช้ใบอนุญาตในการให้บริการด้านสุขภาพ',
  },
  {
    key: 'assignment_order_match',
    label: 'มีคำสั่ง/หนังสือมอบหมายงาน',
    description: 'มีหลักฐานการมอบหมายงาน และงานที่ปฏิบัติสอดคล้องกับกลุ่ม/ข้อที่ขอรับ',
  },
  {
    key: 'rate_mapping_correct',
    label: 'กลุ่ม/ข้อ/อัตราที่ขอรับถูกต้อง',
    description: 'อัตราไม่เกินบัญชีท้ายระเบียบ และได้รับอัตราสูงสุดเพียงอัตราเดียว',
  },
  {
    key: 'effective_date_correct',
    label: 'วันที่เริ่มมีสิทธิถูกต้อง',
    description: 'วันที่เริ่มมีผลสอดคล้องกับวันที่เริ่มปฏิบัติงาน/คำสั่งมอบหมายงาน',
  },
];

const LICENSE_MINIMUM_CHECKLIST: MinimumChecklistItem[] = [
  {
    key: 'license_active',
    label: 'ใบอนุญาตยังมีผลใช้บังคับ',
    description: 'ตรวจวันหมดอายุ และประเภท/สาขาใบอนุญาตสอดคล้องกับงานที่ขอรับ',
  },
];

const ATTACHMENT_MINIMUM_CHECKLIST: MinimumChecklistItem[] = [
  {
    key: 'minimum_documents',
    label: 'เอกสารครบถ้วน',
    description: 'มีหลักฐานคุณวุฒิ ใบอนุญาต คำสั่งมอบหมายงาน และเอกสารเงื่อนไขเฉพาะ',
  },
];

const ALL_CHECKLIST_ITEMS = [
  ...EMPLOYEE_MINIMUM_CHECKLIST,
  ...ELIGIBILITY_MINIMUM_CHECKLIST,
  ...LICENSE_MINIMUM_CHECKLIST,
  ...ATTACHMENT_MINIMUM_CHECKLIST,
];

// --- HELPERS ---

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

const getLicenseStatusClass = (status?: string | null) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'EXPIRED':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'INACTIVE':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'UNKNOWN':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const getLicenseStatusLabel = (status?: string | null) => {
  switch (status) {
    case 'ACTIVE':
      return 'มีผลใช้บังคับ';
    case 'EXPIRED':
      return 'หมดอายุ';
    case 'INACTIVE':
      return 'ไม่อยู่ในสถานะใช้งาน';
    case 'UNKNOWN':
      return 'ไม่สามารถระบุสถานะ';
    default:
      return 'ไม่พบข้อมูล';
  }
};

// --- OCR LOGIC ---
const OCR_SERVICE_BASE = (process.env.NEXT_PUBLIC_OCR_API_URL || '').replace(/\/+$/, '');

type MockOcrResult = {
  fileName: string;
  documentType: string;
  checkedAt: string;
  markdown: string;
};

type OcrPrecheckPayload = {
  status?: 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
  error?: string;
  queued_at?: string;
  started_at?: string;
  finished_at?: string;
  service_url?: string;
  serviceUrl?: string;
  results?: Array<{
    name?: string;
    ok?: boolean;
    markdown?: string;
    error?: string;
  }>;
};

type MockOcrParams = {
  fileName: string;
  markdown: string;
};

const detectMockDocumentType = (fileName: string) => {
  const lower = fileName.toLowerCase();
  if (lower.includes('license') || lower.includes('ใบอนุญาต')) return 'ใบอนุญาตประกอบวิชาชีพ';
  if (lower.includes('id') || lower.includes('บัตรประชาชน')) return 'บัตรประจำตัวประชาชน';
  if (lower.includes('request') || lower.includes('คำขอ')) return 'แบบคำขอ';
  return 'เอกสารทั่วไป';
};

const buildMockOcrResult = (params: MockOcrParams): MockOcrResult => {
  const { fileName, markdown } = params;

  return {
    fileName,
    documentType: detectMockDocumentType(fileName),
    checkedAt: new Date().toISOString(),
    markdown: markdown.trim(),
  };
};

// --- MAIN PAGE ---

export default function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: request, isLoading } = useRequestDetail(id);
  const { data: rateHierarchy } = useRateHierarchy();
  const processAction = useProcessAction();
  const createVerificationSnapshot = useCreateVerificationSnapshot();

  const [actionDialog, setActionDialog] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [comment, setComment] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [ocrDialogOpen, setOcrDialogOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<MockOcrResult | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [requestChecklistState, setRequestChecklistState] = useState<
    Record<string, AssessmentVerdict | undefined>
  >({});
  const [hasChecklistInteraction, setHasChecklistInteraction] = useState(false);
  const [lastSavedFingerprint, setLastSavedFingerprint] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );

  // --- Derived State for UX ---
  const checklistStats = useMemo(() => {
    const values = Object.values(requestChecklistState);
    const checkedCount = values.length;
    const totalCount = ALL_CHECKLIST_ITEMS.length;
    const incorrectItems = ALL_CHECKLIST_ITEMS.filter(
      (item) => requestChecklistState[item.key] === 'incorrect',
    );
    const incorrectCount = incorrectItems.length;

    return {
      checkedCount,
      totalCount,
      incorrectCount,
      incorrectItems,
      progress: Math.round((checkedCount / totalCount) * 100),
      isComplete: checkedCount === totalCount,
      hasIncorrect: incorrectCount > 0,
      canApprove: checkedCount === totalCount && incorrectCount === 0,
    };
  }, [requestChecklistState]);
  const checklistFingerprint = useMemo(
    () =>
      JSON.stringify(
        ALL_CHECKLIST_ITEMS.map((item) => ({
          key: item.key,
          verdict: requestChecklistState[item.key] ?? null,
        })),
      ),
    [requestChecklistState],
  );

  // Submission Parsing
  const submission = useMemo(
    () => parseSubmission(request?.submission_data) as Record<string, unknown>,
    [request?.submission_data],
  );
  const ocrPrecheck = useMemo(() => {
    const raw = (submission as { ocr_precheck?: unknown }).ocr_precheck;
    if (!raw || typeof raw !== 'object') return null;
    return raw as OcrPrecheckPayload;
  }, [submission]);
  const ocrServiceBase = useMemo(() => {
    if (OCR_SERVICE_BASE) return OCR_SERVICE_BASE;
    const fromPrecheck = (ocrPrecheck?.service_url || ocrPrecheck?.serviceUrl || '').trim();
    return fromPrecheck.replace(/\/+$/, '');
  }, [ocrPrecheck]);
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
  const attachments = request?.attachments ?? [];
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
  const licenseNo = request?.requester?.license_no?.trim() || '-';
  const licenseName = request?.requester?.license_name?.trim() || '-';
  const licenseValidFrom = request?.requester?.license_valid_from ?? null;
  const licenseValidUntil = request?.requester?.license_valid_until ?? null;
  const licenseStatus = request?.requester?.license_status ?? null;

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
  const effectiveDateLabel = request?.effective_date
    ? formatThaiDate(request.effective_date)
    : null;

  const submitAction = (request?.actions ?? []).find((a) => a.action === 'SUBMIT');
  const canAct = request?.status === 'PENDING';
  const hasVerificationSnapshot = Boolean(request?.has_verification_snapshot);

  const isSubmitting = processAction.isPending;
  const isSnapshotSaving = createVerificationSnapshot.isPending || autosaveStatus === 'saving';
  const isActionBusy = isSubmitting || isSnapshotSaving;

  const persistVerificationSnapshot = useCallback(
    async ({
      silent = false,
      source = 'PTS_OFFICER_DETAIL_PAGE',
    }: {
      silent?: boolean;
      source?: string;
    } = {}) => {
      if (!request) return false;
      if (!rateMapping?.rateId) {
        if (!silent) toast.error('ยังไม่พบข้อมูลอัตราที่ใช้ตรวจสอบ (rate_id)');
        return false;
      }
      const effectiveDateOnly = toDateOnly(request.effective_date);
      if (!effectiveDateOnly) {
        if (!silent) toast.error('ยังไม่พบวันที่เริ่มมีผลสำหรับบันทึกการตรวจสอบ');
        return false;
      }

      const checkedAt = new Date().toISOString();
      const checklistItems = ALL_CHECKLIST_ITEMS.map((item) => ({
        key: item.key,
        label: item.label,
        verdict: requestChecklistState[item.key] ?? null,
        checked_at: checkedAt,
      }));
      const checkedCount = checklistItems.filter((item) => item.verdict !== null).length;
      const correctCount = checklistItems.filter((item) => item.verdict === 'correct').length;
      const incorrectCount = checklistItems.filter((item) => item.verdict === 'incorrect').length;

      const snapshotData: Record<string, unknown> = {
        request_no: request.request_no,
        request_type: request.request_type,
        personnel_type: request.personnel_type,
        requested_amount: request.requested_amount,
        verification_source: source,
        rate_mapping: rateMapping,
        ocr_result: ocrResult ?? null,
        checklist: {
          items: checklistItems,
          summary: {
            total: checklistItems.length,
            checked: checkedCount,
            correct: correctCount,
            incorrect: incorrectCount,
            unchecked: checklistItems.length - checkedCount,
          },
        },
        checked_at: checkedAt,
      };

      try {
        setAutosaveStatus('saving');
        await createVerificationSnapshot.mutateAsync({
          id,
          payload: {
            master_rate_id: rateMapping.rateId,
            effective_date: effectiveDateOnly,
            snapshot_data: snapshotData,
          },
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['request', String(id)] }),
          queryClient.invalidateQueries({ queryKey: ['pending-approvals'] }),
        ]);
        setLastSavedFingerprint(checklistFingerprint);
        setLastSavedAt(checkedAt);
        setAutosaveStatus('saved');
        if (!silent) toast.success('บันทึกการตรวจสอบเรียบร้อย');
        return true;
      } catch {
        setAutosaveStatus('error');
        if (!silent) toast.error('ไม่สามารถบันทึกการตรวจสอบได้');
        return false;
      }
    },
    [
      checklistFingerprint,
      createVerificationSnapshot,
      id,
      ocrResult,
      queryClient,
      rateMapping,
      request,
      requestChecklistState,
    ],
  );

  useEffect(() => {
    if (!hasChecklistInteraction) return;
    if (checklistFingerprint === lastSavedFingerprint) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      void persistVerificationSnapshot({ silent: true, source: 'PTS_OFFICER_AUTOSAVE' });
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [checklistFingerprint, hasChecklistInteraction, lastSavedFingerprint, persistVerificationSnapshot]);

  const openActionDialog = (dialog: 'approve' | 'reject' | 'return' | null) => {
    if (isActionBusy) return;
    setActionDialog(dialog);
    if ((dialog === 'return' || dialog === 'reject') && checklistStats.hasIncorrect) {
      const issues = checklistStats.incorrectItems
        .map((item) => `- ${item.label}: ${item.description}`)
        .join('\n');
      setComment((prev) => (prev ? prev : `พบข้อมูลไม่ถูกต้องตามรายการดังนี้:\n${issues}`));
    }
  };

  const handlePreview = (url: string, name: string) => {
    setPreviewUrl(url);
    setPreviewName(name);
    setPreviewOpen(true);
  };

  const setRequestChecklistVerdict = (key: string, verdict: AssessmentVerdict) => {
    setHasChecklistInteraction(true);
    setAutosaveStatus('idle');
    setRequestChecklistState((prev) => ({
      ...prev,
      [key]: prev[key] === verdict ? undefined : verdict,
    }));
  };

  const handleAction = async (action: 'approve' | 'reject' | 'return') => {
    const trimmed = comment.trim();
    if ((action === 'reject' || action === 'return') && !trimmed) {
      toast.error('กรุณาระบุเหตุผล');
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const saved = await persistVerificationSnapshot({
      silent: true,
      source: 'PTS_OFFICER_ACTION_SUBMIT',
    });
    if (!saved) {
      toast.error('ไม่สามารถบันทึกการตรวจสอบก่อนดำเนินการคำขอได้');
      return;
    }

    try {
      await processAction.mutateAsync({
        id,
        payload: {
          action: action === 'approve' ? 'APPROVE' : action === 'reject' ? 'REJECT' : 'RETURN',
          comment: trimmed || undefined,
        },
      });
      toast.success('ดำเนินการคำขอเรียบร้อย');
      setActionDialog(null);
      setComment('');
      router.push('/pts-officer/requests');
    } catch {
      toast.error('ไม่สามารถดำเนินการคำขอได้');
    }
  };

  const runMockOcr = async (fileName: string, fileUrl: string) => {
    if (!ocrServiceBase) {
      const message = 'ยังไม่ได้ตั้งค่า OCR URL (NEXT_PUBLIC_OCR_API_URL) และไม่พบ service_url จาก OCR precheck';
      setOcrError(message);
      setOcrDialogOpen(true);
      toast.error(message);
      return;
    }

    setOcrDialogOpen(true);
    setOcrLoading(true);
    setOcrResult(null);
    setOcrError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('phts_token') : null;
      const attachmentResponse = await fetch(fileUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!attachmentResponse.ok) {
        throw new Error('ไม่สามารถดึงไฟล์แนบเพื่อส่ง OCR ได้');
      }

      const blob = await attachmentResponse.blob();
      const formData = new FormData();
      formData.append('files', new File([blob], fileName, { type: blob.type || 'application/octet-stream' }));

      const ocrResponse = await fetch(`${ocrServiceBase}/ocr-batch`, {
        method: 'POST',
        body: formData,
      });

      if (!ocrResponse.ok) {
        const errorText = await ocrResponse.text();
        throw new Error(errorText || 'OCR service error');
      }

      const payload = (await ocrResponse.json()) as {
        count?: number;
        results?: Array<{ name?: string; ok?: boolean; markdown?: string; error?: string }>;
      };
      const firstResult = payload.results?.[0];
      if (!firstResult?.ok) {
        throw new Error(firstResult?.error || 'OCR ไม่สามารถประมวลผลเอกสารนี้ได้');
      }

      const markdown = String(firstResult.markdown ?? '').trim();
      const result = buildMockOcrResult({
        fileName,
        markdown,
      });
      setOcrResult(result);
      setOcrError(null);
      toast.success('อ่านเอกสารด้วย OCR สำเร็จ');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถเรียก OCR service ได้';
      setOcrError(message);
      toast.error(message);
    } finally {
      setOcrLoading(false);
    }
  };

  const isSectionComplete = (items: MinimumChecklistItem[]) => {
    return items.every((item) => requestChecklistState[item.key] === 'correct');
  };

  useEffect(() => {
    if (!ocrPrecheck || ocrResult) return;
    if (ocrPrecheck.status !== 'completed') return;

    const firstSuccess = ocrPrecheck.results?.find(
      (result) => result.ok && typeof result.markdown === 'string' && result.markdown.trim(),
    );
    if (!firstSuccess?.markdown) return;

    const loaded = buildMockOcrResult({
      fileName: firstSuccess.name || 'ไฟล์แนบ',
      markdown: firstSuccess.markdown,
    });
    setOcrResult(loaded);
  }, [ocrPrecheck, ocrResult, request?.citizen_id, requesterName, department, subDepartment]);

  const ocrPrecheckMessage = useMemo(() => {
    if (!ocrPrecheck) return null;
    if (ocrPrecheck.status === 'queued') return 'ระบบกำลังรอคิวประมวลผล OCR อัตโนมัติ';
    if (ocrPrecheck.status === 'processing') return 'ระบบกำลังประมวลผล OCR อัตโนมัติ';
    if (ocrPrecheck.status === 'failed')
      return `OCR อัตโนมัติไม่สำเร็จ: ${ocrPrecheck.error || 'ไม่ทราบสาเหตุ'}`;
    if (ocrPrecheck.status === 'skipped')
      return `OCR อัตโนมัติถูกข้าม: ${ocrPrecheck.error || 'ไม่ได้ตั้งค่าบริการ OCR'}`;
    return null;
  }, [ocrPrecheck]);

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8 space-y-4">
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          <div className="flex justify-between items-center">
            <div className="h-8 w-64 bg-muted animate-pulse rounded" />
            <div className="h-10 w-32 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center min-h-[50vh]">
        <AlertCircle className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold text-foreground">ไม่พบข้อมูลคำขอ</h2>
        <p className="text-muted-foreground mb-6">คำขอที่ต้องการตรวจสอบอาจไม่มีอยู่ในระบบ</p>
        <Link href="/pts-officer/requests">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            กลับไปรายการคำขอ
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-24">
      <div className="mb-8">
        <nav className="flex items-center text-sm text-muted-foreground mb-4">
          <Link
            href="/pts-officer/requests"
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            รายการคำขอ
          </Link>
          <ChevronRight className="h-4 w-4 mx-1 opacity-50" />
          <span className="text-foreground font-medium">รายละเอียด</span>
        </nav>

        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{displayId}</h1>
              <Badge
                variant="outline"
                className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${getStatusColor(request.status)}`}
              >
                {getStatusLabel(request.status, request.current_step)}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              สร้างเมื่อ {formatThaiDateTime(request.created_at)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        <div className="space-y-8 lg:col-span-8">
          <Card
            className={`scroll-mt-20 shadow-sm transition-all duration-300 ${isSectionComplete(EMPLOYEE_MINIMUM_CHECKLIST) ? 'border-emerald-200/60 ring-1 ring-emerald-500/20' : 'border-border/60'}`}
          >
            <CardContent className="p-6">
              <SectionHeader
                title="ข้อมูลผู้ยื่นคำขอ"
                icon={User}
                isComplete={isSectionComplete(EMPLOYEE_MINIMUM_CHECKLIST)}
              />
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
                <InfoItem
                  label="ชื่อ-นามสกุล"
                  value={requesterName}
                  icon={User}
                  className="sm:col-span-2"
                />
                <InfoItem label="เลขประจำตัวประชาชน" value={request.citizen_id ?? '-'} />

                <div className="col-span-full border-t border-border/50 my-2"></div>

                <InfoItem
                  label="ตำแหน่ง"
                  value={positionName}
                  icon={Briefcase}
                  className="sm:col-span-2"
                />
                <InfoItem
                  label="เลขที่ตำแหน่ง"
                  value={submissionPositionNumber || request.current_position_number || '-'}
                />

                <InfoItem label="กลุ่มงาน" value={department} icon={Building2} />
                <InfoItem label="หน่วยงาน" value={subDepartment} />
              </dl>
              <MinimumChecklist
                title="รายการตรวจสอบข้อมูลผู้ยื่นคำขอ"
                items={EMPLOYEE_MINIMUM_CHECKLIST}
                verdictMap={requestChecklistState}
                onSelect={setRequestChecklistVerdict}
              />
            </CardContent>
          </Card>

          <Card
            className={`scroll-mt-20 shadow-sm transition-all duration-300 ${isSectionComplete(ELIGIBILITY_MINIMUM_CHECKLIST) ? 'border-emerald-200/60 ring-1 ring-emerald-500/20' : 'border-border/60'}`}
          >
            <CardContent className="p-6">
              <SectionHeader
                title="รายละเอียดสิทธิ พ.ต.ส."
                icon={CreditCard}
                isComplete={isSectionComplete(ELIGIBILITY_MINIMUM_CHECKLIST)}
              />

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
              <MinimumChecklist
                title="รายการตรวจสอบการประเมินสิทธิ"
                items={ELIGIBILITY_MINIMUM_CHECKLIST}
                verdictMap={requestChecklistState}
                onSelect={setRequestChecklistVerdict}
              />
            </CardContent>
          </Card>

          <Card
            className={`scroll-mt-20 shadow-sm transition-all duration-300 ${isSectionComplete(LICENSE_MINIMUM_CHECKLIST) ? 'border-emerald-200/60 ring-1 ring-emerald-500/20' : 'border-border/60'}`}
          >
            <CardContent className="p-6">
              <SectionHeader
                title="ข้อมูลใบอนุญาตประกอบวิชาชีพ"
                icon={FileText}
                isComplete={isSectionComplete(LICENSE_MINIMUM_CHECKLIST)}
              />
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4">
                <InfoItem label="เลขที่ใบอนุญาต" value={licenseNo} />
                <InfoItem label="ประเภท/สาขาวิชาชีพ" value={licenseName} />
                <InfoItem label="วันที่เริ่มมีผล" value={formatThaiDate(licenseValidFrom)} />
                <InfoItem label="วันที่หมดอายุ" value={formatThaiDate(licenseValidUntil)} />
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-muted-foreground mb-1">สถานะใบอนุญาต</dt>
                  <dd>
                    <Badge variant="outline" className={getLicenseStatusClass(licenseStatus)}>
                      {getLicenseStatusLabel(licenseStatus)}
                    </Badge>
                  </dd>
                </div>
              </dl>
              <MinimumChecklist
                title="รายการตรวจสอบใบอนุญาตประกอบวิชาชีพ"
                items={LICENSE_MINIMUM_CHECKLIST}
                verdictMap={requestChecklistState}
                onSelect={setRequestChecklistVerdict}
              />
            </CardContent>
          </Card>

          <Card
            className={`scroll-mt-20 shadow-sm transition-all duration-300 ${isSectionComplete(ATTACHMENT_MINIMUM_CHECKLIST) ? 'border-emerald-200/60 ring-1 ring-emerald-500/20' : 'border-border/60'}`}
          >
            <CardContent className="p-6">
              <SectionHeader
                title={`ไฟล์แนบ (${attachments.length})`}
                icon={FileText}
                isComplete={isSectionComplete(ATTACHMENT_MINIMUM_CHECKLIST)}
              />

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
                          <p
                            className="text-sm font-medium text-foreground truncate pr-6"
                            title={file.file_name}
                          >
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
                            <button
                              onClick={() => void runMockOcr(file.file_name, fileUrl)}
                              className="text-xs flex items-center hover:text-primary transition-colors hover:underline"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" /> ตรวจด้วย OCR
                            </button>
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
              <MinimumChecklist
                title="รายการตรวจไฟล์แนบ"
                items={ATTACHMENT_MINIMUM_CHECKLIST}
                verdictMap={requestChecklistState}
                onSelect={setRequestChecklistVerdict}
              />
            </CardContent>
          </Card>
        </div>

        <div className="hidden lg:block space-y-6 lg:col-span-4 sticky top-6">
          {canAct && (
            <Card className="shadow-lg border-primary/20 ring-1 ring-primary/5">
              <CardHeader className="pb-3 bg-muted/20 rounded-t-lg">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>ดำเนินการคำขอ</span>
                  {checklistStats.isComplete && !checklistStats.hasIncorrect && (
                    <CheckCircle2 className="text-emerald-500 w-5 h-5" />
                  )}
                  {checklistStats.hasIncorrect && (
                    <AlertTriangle className="text-rose-500 w-5 h-5" />
                  )}
                </CardTitle>
                <CardDescription>
                  {checklistStats.hasIncorrect
                    ? 'พบรายการไม่ถูกต้อง กรุณาส่งกลับ'
                    : checklistStats.isComplete
                      ? 'ตรวจสอบครบถ้วน พร้อมอนุมัติ'
                      : 'กรุณาตรวจสอบให้ครบถ้วน'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-muted-foreground">ความคืบหน้า</span>
                    <span
                      className={checklistStats.isComplete ? 'text-emerald-600' : 'text-foreground'}
                    >
                      {checklistStats.checkedCount} / {checklistStats.totalCount} รายการ
                    </span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${checklistStats.hasIncorrect ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${checklistStats.progress}%` }}
                    />
                  </div>
                </div>

                {checklistStats.hasIncorrect && (
                  <div className="rounded-md bg-rose-50 border border-rose-200 p-3 flex gap-2 items-start mt-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-rose-700">พบรายการไม่ถูกต้อง</p>
                      <ul className="text-[10px] text-rose-600 list-disc list-inside">
                        {checklistStats.incorrectItems.slice(0, 2).map((i) => (
                          <li key={i.key} className="truncate max-w-[200px]">
                            {i.label}
                          </li>
                        ))}
                        {checklistStats.incorrectItems.length > 2 && (
                          <li>และอีก {checklistStats.incorrectItems.length - 2} รายการ</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="mb-3 rounded-md border border-border/60 bg-muted/20 p-3 mt-4">
                  <p className="text-xs text-muted-foreground mb-1">สถานะบันทึกการตรวจสอบ</p>
                  <p className="text-sm font-medium">
                    {hasVerificationSnapshot
                      ? 'มีบันทึกการตรวจสอบแล้ว'
                      : 'ยังไม่มีบันทึกการตรวจสอบ'}
                  </p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    {autosaveStatus === 'saving'
                      ? 'กำลังบันทึกอัตโนมัติ...'
                      : autosaveStatus === 'saved' && lastSavedAt
                        ? `บันทึกล่าสุด ${formatThaiDateTime(lastSavedAt)}`
                        : autosaveStatus === 'error'
                          ? 'บันทึกอัตโนมัติไม่สำเร็จ'
                          : 'ระบบจะบันทึกให้อัตโนมัติเมื่อมีการเปลี่ยนแปลง'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Dialog
                    open={actionDialog === 'approve'}
                    onOpenChange={(open) => openActionDialog(open ? 'approve' : null)}
                  >
                    <DialogTrigger asChild>
                        <Button
                          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                          disabled={!checklistStats.canApprove || isActionBusy}
                        >
                          <Check className="w-4 h-4 mr-2" /> อนุมัติ (Approve)
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>ยืนยันการอนุมัติ</DialogTitle>
                        <DialogDescription>
                          คำขอ {displayId} จะถูกส่งต่อไปยังขั้นตอนถัดไป
                        </DialogDescription>
                      </DialogHeader>
                      <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="หมายเหตุ (ถ้ามี)"
                      />
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setActionDialog(null)}
                          disabled={isActionBusy}
                        >
                          ยกเลิก
                        </Button>
                        <Button
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleAction('approve')}
                          disabled={isActionBusy}
                        >
                          {isActionBusy ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังบันทึก...
                            </>
                          ) : (
                            'ยืนยัน'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog
                    open={actionDialog === 'return'}
                    onOpenChange={(open) => openActionDialog(open ? 'return' : null)}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant={checklistStats.hasIncorrect ? 'default' : 'outline'}
                        className={`w-full ${checklistStats.hasIncorrect ? 'bg-orange-500 hover:bg-orange-600 text-white border-transparent' : ''}`}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        ส่งกลับแก้ไข (Return)
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-orange-600 flex items-center gap-2">
                          <RotateCcw className="w-5 h-5" /> ส่งกลับแก้ไข
                        </DialogTitle>
                        <DialogDescription>กรุณาระบุเหตุผล</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2">
                        <Textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="เหตุผลที่ส่งกลับแก้ไข"
                          className="min-h-[120px]"
                        />
                        {checklistStats.hasIncorrect && (
                          <p className="text-xs text-muted-foreground italic">
                            * ระบบดึงเหตุผลจากรายการที่ติ๊ก &quot;ไม่ถูกต้อง&quot; มาให้แล้ว
                          </p>
                        )}
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setActionDialog(null)}
                          disabled={isActionBusy}
                        >
                          ยกเลิก
                        </Button>
                        <Button
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                          onClick={() => handleAction('return')}
                          disabled={isActionBusy}
                        >
                          {isActionBusy ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังส่ง...
                            </>
                          ) : (
                            'ส่งกลับ'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog
                    open={actionDialog === 'reject'}
                    onOpenChange={(open) => openActionDialog(open ? 'reject' : null)}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        ไม่อนุมัติ (Reject)
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-rose-600">ยืนยันการไม่อนุมัติ</DialogTitle>
                        <DialogDescription>กรุณาระบุเหตุผล</DialogDescription>
                      </DialogHeader>
                      <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="เหตุผลที่ไม่อนุมัติ"
                      />
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setActionDialog(null)}
                          disabled={isActionBusy}
                        >
                          ยกเลิก
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleAction('reject')}
                          disabled={isActionBusy}
                        >
                          {isActionBusy ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังส่ง...
                            </>
                          ) : (
                            'ยืนยัน'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm border-primary/20 bg-primary/5 overflow-hidden">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-primary/80 mb-1">ยอดเงินเบิกจ่าย</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-primary">
                  {formatThaiNumber(request.requested_amount ?? 0)}
                </span>
                <span className="text-sm text-primary/80">บาท</span>
              </div>
              <Separator className="my-4 bg-primary/10" />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">เลขที่คำขอ</span>
                  <span className="font-mono text-foreground">{displayId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">วันที่ยื่นเรื่อง</span>
                  <span className="text-foreground">
                    {submitAction?.action_date ? formatThaiDate(submitAction.action_date) : '-'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ผู้ช่วยตรวจเอกสาร (OCR)</CardTitle>
              <CardDescription>
                แสดงข้อความที่อ่านได้จากเอกสารด้วย OCR
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ocrResult ? (
                <>
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                    <p className="font-medium">{ocrResult.fileName}</p>
                    <p className="text-muted-foreground">{ocrResult.documentType}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ตรวจเมื่อ {formatThaiDateTime(ocrResult.checkedAt)}
                    </p>
                    <p className="mt-2 text-foreground line-clamp-3 whitespace-pre-wrap">
                      {ocrResult.markdown || '-'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setOcrDialogOpen(true)}
                  >
                    ดูผลตรวจ OCR
                  </Button>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  {ocrError || ocrPrecheckMessage || 'เลือกไฟล์แนบ แล้วกด “ตรวจด้วย OCR” เพื่อดูผลวิเคราะห์'}
                </div>
              )}
            </CardContent>
          </Card>

          <ApprovalTimelineCard request={request} />
        </div>
      </div>

      {canAct && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t z-50 lg:hidden flex gap-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          {checklistStats.canApprove ? (
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => openActionDialog('approve')}
              disabled={isActionBusy}
            >
              <Check className="w-4 h-4 mr-2" /> อนุมัติ
            </Button>
          ) : (
            <div className="flex-1 flex gap-2">
              <Button
                variant={checklistStats.hasIncorrect ? 'default' : 'outline'}
                className={`flex-1 ${checklistStats.hasIncorrect ? 'bg-orange-500 text-white' : ''}`}
                onClick={() => openActionDialog('return')}
                disabled={isActionBusy}
              >
                <RotateCcw className="w-4 h-4 mr-2" /> ส่งกลับ
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-rose-600"
                onClick={() => openActionDialog('reject')}
                disabled={isActionBusy}
              >
                <XCircle className="w-6 h-6" />
              </Button>
            </div>
          )}

          <div className="flex items-center justify-center px-3 rounded-md bg-muted text-xs font-medium min-w-[60px]">
            {checklistStats.checkedCount}/{checklistStats.totalCount}
          </div>
        </div>
      )}

      <AttachmentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        previewUrl={previewUrl}
        previewName={previewName}
      />

      <Dialog open={ocrDialogOpen} onOpenChange={setOcrDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ผลวิเคราะห์เอกสาร (OCR)</DialogTitle>
            <DialogDescription>ใช้ประกอบการพิจารณาคำขอโดยเจ้าหน้าที่ พ.ต.ส.</DialogDescription>
          </DialogHeader>

          {ocrLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              กำลังประมวลผล OCR...
            </div>
          ) : ocrResult ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                <p className="font-medium">{ocrResult.fileName}</p>
                <p className="text-muted-foreground">{ocrResult.documentType}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ตรวจเมื่อ {formatThaiDateTime(ocrResult.checkedAt)}
                </p>
              </div>

              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-sm font-medium mb-2">ข้อความจาก OCR</p>
                <pre className="text-xs whitespace-pre-wrap break-words text-foreground leading-relaxed">
                  {ocrResult.markdown || '-'}
                </pre>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {ocrError || ocrPrecheckMessage || 'ยังไม่มีผล OCR'}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
