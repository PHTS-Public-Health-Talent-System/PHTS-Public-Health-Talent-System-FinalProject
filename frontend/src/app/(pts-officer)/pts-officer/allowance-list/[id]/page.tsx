'use client';
export const dynamic = 'force-dynamic';

import { use, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  X,
  ArrowLeft,
  User,
  Award,
  Phone,
  Mail,
  AlertTriangle,
  Calendar,
  FileText,
  Eye,
  ExternalLink,
  ChevronRight,
  Briefcase,
  Building2,
  Clock,
  CreditCard,
  Hash,
  Loader2,
  ScanText,
  Trash2,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import {
  useDeleteEligibilityAttachment,
  useEligibilityDetail,
  useEligibilityPaged,
  useRequestDetail,
  useClearEligibilityAttachmentOcr,
  useRunEligibilityAttachmentsOcr,
  useUploadEligibilityAttachments,
} from '@/features/request';
import { AttachmentPreviewDialog } from '@/components/common/attachment-preview-dialog';
import { ConfirmActionDialog } from '@/components/common/confirm-action-dialog';
import { AttachmentListCard, AttachmentListItemCard } from '@/components/common';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatRateItemLabel, resolveProfessionLabel } from '../utils';
import { buildAttachmentUrl, isPreviewableFile } from '@/features/request/detail/utils';
import { AssignmentOrderSummaryCard } from '@/features/request/detail/cards';
import { findAssignmentOrderSummary } from '@/features/request/detail/utils';
import { findMemoSummary } from '@/features/request/detail/utils';
import { getStatusLabel } from '@/features/request/detail/utils';
import { MemoSummaryCard } from '@/features/request/detail/cards';
import { ELIGIBILITY_EXPIRING_DAYS } from '@/features/request';
import {
  buildAllowanceAttachmentOcrResultMap,
  buildAllowanceAttachmentOcrPolicy,
  buildAllowanceClearableOcrFileNameSet,
  buildAllowanceOcrDocuments,
  getAllowanceAttachmentNotice,
  mergeAllowanceAttachments,
  type AllowanceAttachmentListItem as AttachmentListItem,
} from '../attachments';
import {
  formatThaiDateTime as formatThaiDateTimeValue,
  formatThaiDate as formatThaiDateValue,
  formatThaiNumber,
} from '@/shared/utils/thai-locale';
import { isPermanentLicenseDate } from '@/shared/utils/license';
import { toast } from 'sonner';
import type { RequestWithDetails } from '@/types/request.types';

// --- Components ---

const InfoItem = ({
  label,
  value,
  icon: Icon,
  className,
  isMono = false,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  className?: string;
  isMono?: boolean;
}) => (
  <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
    <dt className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
      {Icon && <Icon className="w-3.5 h-3.5 opacity-70" />}
      {label}
    </dt>
    <dd
      className={`text-sm font-medium text-foreground break-words ${isMono ? 'font-mono tracking-tight' : ''}`}
    >
      {value}
    </dd>
  </div>
);

const SectionHeader = ({ title, icon: Icon }: { title: string; icon: LucideIcon }) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/40">
    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
      <Icon className="w-4 h-4" />
    </div>
    <h3 className="font-semibold text-base text-foreground">{title}</h3>
  </div>
);

// --- Constants & Helpers ---
const PERSONNEL_TYPE_LABELS: Record<string, string> = {
  CIVIL_SERVANT: 'ข้าราชการ',
  GOV_EMPLOYEE: 'พนักงานราชการ',
  PH_EMPLOYEE: 'พนักงานกระทรวงสาธารณสุข',
  TEMP_EMPLOYEE: 'ลูกจ้างชั่วคราว',
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  NEW_ENTRY: 'ขอรับ พ.ต.ส. ครั้งแรก',
  EDIT_INFO_SAME_RATE: 'แก้ไขข้อมูล (อัตราเดิม)',
  EDIT_INFO_NEW_RATE: 'แก้ไขข้อมูล (อัตราใหม่)',
};

const getAttachmentLabel = (fileName: string, fileType?: string | null) => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'ไฟล์ PDF';
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg'))
    return 'ไฟล์รูปภาพ';
  return fileType || 'ไฟล์';
};

function parseSubmission(value: RequestWithDetails['submission_data']) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
}

function getSubmissionString(
  submission: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = submission[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function formatThaiDate(value?: string | null): string {
  return formatThaiDateValue(value);
}

function formatThaiDateTime(value?: string | null): string {
  return formatThaiDateTimeValue(value);
}

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
      return status ? status : 'ไม่พบข้อมูล';
  }
};

const getLicenseStatusClass = (status?: string | null) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50';
    case 'EXPIRED':
      return 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50';
    case 'INACTIVE':
      return 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100';
    case 'UNKNOWN':
      return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

function resolveLicenseStatus(expiryDate?: string | null): 'active' | 'expiring' | 'expired' {
  if (!expiryDate) return 'active';
  if (isPermanentLicenseDate(expiryDate)) return 'active';
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return 'active';
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'expired';
  if (diffDays <= ELIGIBILITY_EXPIRING_DAYS) return 'expiring';
  return 'active';
}

function resolveLicenseBadgeStatus(
  license?: {
    status?: string | null;
    valid_until?: string | null;
  } | null,
): 'active' | 'expiring' | 'expired' {
  if (!license) return 'expired';

  const status = String(license.status ?? '')
    .trim()
    .toUpperCase();
  if (status && status !== 'ACTIVE') return 'expired';

  return resolveLicenseStatus(license.valid_until ?? null);
}

const licenseStatusConfig = {
  active: {
    label: 'ใบอนุญาตยังใช้งานได้',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50',
  },
  expiring: {
    label: 'ใบอนุญาตใกล้หมดอายุ',
    color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50',
  },
  expired: {
    label: 'ใบอนุญาตหมดอายุแล้ว',
    color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-50',
  },
};

type LicenseStatusFilter = 'all' | 'active' | 'expiring' | 'expired';

// --- Main Page Component ---

export default function AllowanceEligibilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const profession = searchParams.get('profession');
  const normalizedProfession = profession ? profession.toUpperCase() : null;
  const sp = new URLSearchParams(searchParams.toString());
  sp.delete('profession');
  const backHref = normalizedProfession
    ? `/pts-officer/allowance-list/profession/${normalizedProfession}${sp.toString() ? `?${sp.toString()}` : ''}`
    : '/pts-officer/allowance-list';

  const { data, isLoading, refetch: refetchEligibilityDetail } = useEligibilityDetail(id);
  const { data: sourceRequest } = useRequestDetail(data?.request_id ?? undefined);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [ocrRunningAttachmentId, setOcrRunningAttachmentId] = useState<number | null>(null);
  const [ocrClearingFileName, setOcrClearingFileName] = useState<string | null>(null);
  const [latestOcrResults, setLatestOcrResults] = useState<
    Array<{
      name?: string;
      ok?: boolean;
      markdown?: string;
      error?: string;
      document_kind?: string;
    }>
  >([]);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const uploadEligibilityAttachments = useUploadEligibilityAttachments();
  const deleteEligibilityAttachment = useDeleteEligibilityAttachment();
  const runEligibilityAttachmentsOcr = useRunEligibilityAttachmentsOcr();
  const clearEligibilityAttachmentOcr = useClearEligibilityAttachmentOcr();

  const attachments = useMemo(() => data?.attachments ?? [], [data?.attachments]);
  const eligibilityAttachments = useMemo(
    () => data?.eligibility_attachments ?? [],
    [data?.eligibility_attachments],
  );
  const license = data?.license ?? null;
  const allAttachments = useMemo(() => {
    return mergeAllowanceAttachments({
      requestAttachments: attachments,
      eligibilityAttachments,
    });
  }, [attachments, eligibilityAttachments]);
  const visibleAttachmentFileNames = useMemo(
    () => allAttachments.map((item) => item.file_name),
    [allAttachments],
  );

  const contextProfession =
    normalizedProfession && normalizedProfession !== 'ALL' ? normalizedProfession : 'ALL';
  const { data: contextList } = useEligibilityPaged({
    active_only: '1',
    page: 1,
    limit: 50,
    profession_code: contextProfession,
    search: searchParams.get('q') ?? undefined,
    rate_group: searchParams.get('rate_group') ?? 'all',
    department: searchParams.get('department') ?? undefined,
    sub_department: searchParams.get('sub_department') ?? undefined,
    license_status: (searchParams.get('license_status') as LicenseStatusFilter) ?? 'all',
  });

  const personOptions = useMemo(() => {
    const rows = contextList?.items ?? [];
    const options = rows
      .slice()
      .sort((a, b) => Number(b.eligibility_id ?? 0) - Number(a.eligibility_id ?? 0))
      .map((row) => {
        const fullName = `${row.title ?? ''}${row.first_name ?? '-'} ${row.last_name ?? ''}`.trim();
        const professionLabel = resolveProfessionLabel(row.profession_code ?? '-');
        return { id: String(row.eligibility_id), label: `${fullName} (${professionLabel})` };
      });

    if (data?.eligibility_id && !options.some((o) => o.id === String(data.eligibility_id))) {
      const fullName =
        `${data?.title ?? ''}${data?.first_name ?? '-'} ${data?.last_name ?? ''}`.trim();
      const professionLabel = resolveProfessionLabel(data?.profession_code ?? '-');
      options.unshift({
        id: String(data.eligibility_id),
        label: `${fullName} (${professionLabel})`,
      });
    }
    return options;
  }, [contextList?.items, data]);

  useEffect(() => {
    setLatestOcrResults([]);
  }, [data?.eligibility_id]);

  const submission = useMemo(
    () => parseSubmission(sourceRequest?.submission_data) as Record<string, unknown>,
    [sourceRequest?.submission_data],
  );

  const submissionPositionName =
    getSubmissionString(submission, ['position_name', 'positionName']) ?? data?.position_name;
  const submissionDepartment =
    getSubmissionString(submission, ['department']) ?? data?.department;
  const submissionSubDepartment =
    getSubmissionString(submission, ['sub_department', 'subDepartment']) ?? data?.sub_department;
  const sourceRequestMainDuty =
    getSubmissionString(submission, ['main_duty', 'mainDuty']) ?? sourceRequest?.main_duty ?? '-';
  const sourceRequestStartedAt =
    sourceRequest?.step_started_at ??
    sourceRequest?.actions?.[0]?.action_date ??
    sourceRequest?.created_at ??
    data?.created_at ??
    null;

  const fullName = `${data?.title ?? ''}${data?.first_name ?? '-'} ${data?.last_name ?? ''}`.trim();
  const professionLabel = resolveProfessionLabel(data?.profession_code ?? '-');
  const groupNo =
    data?.group_no !== null && data?.group_no !== undefined ? String(data.group_no) : '-';
  const itemNo = data?.item_no !== null && data?.item_no !== undefined ? String(data.item_no) : '-';
  const subItemNo =
    data?.sub_item_no !== null && data?.sub_item_no !== undefined ? String(data.sub_item_no) : null;
  const itemLabel = formatRateItemLabel(itemNo, subItemNo);
  const rateAmount = Number(data?.rate_amount ?? 0);
  const isPermanentLicense = isPermanentLicenseDate(license?.valid_until ?? null);
  const licenseStatusKey = resolveLicenseBadgeStatus(license);
  const licenseStatus = licenseStatusConfig[licenseStatusKey];

  const requestTypeLabel = sourceRequest?.request_type
    ? (REQUEST_TYPE_LABELS[sourceRequest.request_type] ?? sourceRequest.request_type)
    : '-';
  const sourceRequestStatus = sourceRequest?.status ?? data?.original_status ?? null;
  const sourceRequestStatusLabel = sourceRequestStatus
    ? getStatusLabel(sourceRequestStatus, sourceRequest?.current_step ?? null)
    : '-';
  const sourceRequestId = sourceRequest?.request_id ?? data?.request_id ?? null;
  const sourceRequestDisplayNo = sourceRequest?.request_no ?? data?.request_no ?? sourceRequestId;
  const personnelTypeLabel = sourceRequest?.personnel_type
    ? (PERSONNEL_TYPE_LABELS[sourceRequest.personnel_type] ?? sourceRequest.personnel_type)
    : data?.emp_type
      ? (PERSONNEL_TYPE_LABELS[data.emp_type] ?? data.emp_type)
    : '-';
  const ocrDocuments = useMemo(
    () =>
      buildAllowanceOcrDocuments({
        eligibilityResults: data?.eligibility_ocr_precheck?.results ?? [],
        requestResults: sourceRequest?.ocr_precheck?.results ?? [],
        latestResults: latestOcrResults,
        visibleFileNames: visibleAttachmentFileNames,
      }),
    [
      data?.eligibility_ocr_precheck?.results,
      latestOcrResults,
      sourceRequest?.ocr_precheck?.results,
      visibleAttachmentFileNames,
    ],
  );
  const assignmentOrderSummary = useMemo(() => {
    if (!fullName || fullName === '-' || ocrDocuments.length === 0) {
      return null;
    }

    return findAssignmentOrderSummary(ocrDocuments, fullName);
  }, [fullName, ocrDocuments]);
  const memoSummary = useMemo(() => {
    if (!fullName || fullName === '-' || ocrDocuments.length === 0) {
      return null;
    }

    return findMemoSummary(ocrDocuments, fullName);
  }, [fullName, ocrDocuments]);
  const ocrResultByFileName = useMemo(
    () =>
      buildAllowanceAttachmentOcrResultMap({
        eligibilityResults: data?.eligibility_ocr_precheck?.results ?? [],
        requestResults: sourceRequest?.ocr_precheck?.results ?? [],
        latestResults: latestOcrResults,
        visibleFileNames: visibleAttachmentFileNames,
      }),
    [
      data?.eligibility_ocr_precheck?.results,
      latestOcrResults,
      sourceRequest?.ocr_precheck?.results,
      visibleAttachmentFileNames,
    ],
  );
  const clearableOcrFileNames = useMemo(
    () =>
      buildAllowanceClearableOcrFileNameSet({
        eligibilityResults: data?.eligibility_ocr_precheck?.results ?? [],
        latestResults: latestOcrResults,
        visibleFileNames: visibleAttachmentFileNames,
      }),
    [data?.eligibility_ocr_precheck?.results, latestOcrResults, visibleAttachmentFileNames],
  );
  const isUploadingAttachments = uploadEligibilityAttachments.isPending;
  const isRunningOcr = runEligibilityAttachmentsOcr.isPending || ocrRunningAttachmentId !== null;
  const isOcrProcessing = isUploadingAttachments || isRunningOcr;
  const ocrProcessingMessage = isUploadingAttachments
    ? 'กำลังอัปโหลดไฟล์และเริ่มตรวจ OCR อัตโนมัติ'
    : 'กำลังตรวจ OCR จากไฟล์ที่สั่งงาน';

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8 space-y-4">
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-xl font-semibold text-foreground">ไม่พบข้อมูลสิทธิ</h2>
        <p className="text-muted-foreground mb-6">ไม่พบข้อมูลผู้มีสิทธิรายการนี้ในระบบ</p>
        <Link href={backHref}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            กลับไปรายชื่อผู้มีสิทธิ
          </Button>
        </Link>
      </div>
    );
  }

  const handlePreview = (url: string, name: string) => {
    setPreviewUrl(url);
    setPreviewName(name);
    setPreviewOpen(true);
  };

  const mergeLatestOcrResults = (
    incoming: Array<{
      name?: string;
      ok?: boolean;
      markdown?: string;
      error?: string;
      document_kind?: string;
    }>,
  ) => {
    setLatestOcrResults((prev) => {
      const next = new Map(prev.map((item) => [String(item.name ?? '').trim(), item] as const));
      for (const item of incoming) {
        const key = String(item.name ?? '').trim();
        if (!key) continue;
        next.set(key, item);
      }
      return Array.from(next.values());
    });
  };

  const removeLatestOcrResult = (fileName: string) => {
    const target = fileName.trim().toLowerCase();
    setLatestOcrResults((prev) =>
      prev.filter(
        (item) =>
          String(item.name ?? '')
            .trim()
            .toLowerCase() !== target,
      ),
    );
  };

  const schedulePostOcrRefresh = () => {
    setTimeout(() => {
      void refetchEligibilityDetail();
    }, 2500);
    setTimeout(() => {
      void refetchEligibilityDetail();
    }, 7000);
  };

  const handleUploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (!data?.eligibility_id || selectedFiles.length === 0) return;

    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append('files[]', file);
    }

    try {
      const uploadedAttachments = await uploadEligibilityAttachments.mutateAsync({
        eligibilityId: data.eligibility_id,
        formData,
      });
      toast.success('อัปโหลดไฟล์แนบสำเร็จ');
      if (uploadedAttachments.length > 0) {
        try {
          const ocrSummary = await runEligibilityAttachmentsOcr.mutateAsync({
            eligibilityId: data.eligibility_id,
            payload: {
              attachments: uploadedAttachments.map((attachment) => ({
                attachment_id: Number(attachment.attachment_id),
                source: 'eligibility' as const,
              })),
            },
          });
          mergeLatestOcrResults(ocrSummary.results ?? []);
          schedulePostOcrRefresh();
          if (ocrSummary.count > 0) {
            toast.success(
              `ตรวจ OCR ไฟล์ใหม่ ${formatThaiNumber(ocrSummary.count)} ไฟล์ สำเร็จ ${formatThaiNumber(ocrSummary.success_count)} ไฟล์`,
            );
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'ไม่สามารถเริ่มตรวจ OCR หลังอัปโหลดได้';
          toast.error(message);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถอัปโหลดไฟล์แนบได้';
      toast.error(message);
    } finally {
      event.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!data?.eligibility_id) return;
    try {
      await deleteEligibilityAttachment.mutateAsync({
        eligibilityId: data.eligibility_id,
        attachmentId,
      });
      toast.success('ลบไฟล์แนบสำเร็จ');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถลบไฟล์แนบได้';
      toast.error(message);
    }
  };

  const handleRunAttachmentOcr = async (file: AttachmentListItem) => {
    if (!data?.eligibility_id) return;

    setOcrRunningAttachmentId(file.attachment_id);
    try {
      const ocrSummary = await runEligibilityAttachmentsOcr.mutateAsync({
        eligibilityId: data.eligibility_id,
        payload: {
          attachments: [
            {
              attachment_id: file.attachment_id,
              source: file.source,
            },
          ],
        },
      });
      mergeLatestOcrResults(ocrSummary.results ?? []);
      schedulePostOcrRefresh();
      toast.success(`ตรวจ OCR ไฟล์ ${file.file_name} เรียบร้อย`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถตรวจ OCR ไฟล์นี้ได้';
      toast.error(message);
    } finally {
      setOcrRunningAttachmentId(null);
    }
  };

  const handleClearAttachmentOcr = async (file: AttachmentListItem) => {
    if (!data?.eligibility_id) return;

    setOcrClearingFileName(file.file_name);
    try {
      await clearEligibilityAttachmentOcr.mutateAsync({
        eligibilityId: data.eligibility_id,
        payload: {
          file_name: file.file_name,
        },
      });
      removeLatestOcrResult(file.file_name);
      toast.success(`ล้างผล OCR ของไฟล์ ${file.file_name} เรียบร้อย`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถล้างผล OCR ของไฟล์นี้ได้';
      toast.error(message);
    } finally {
      setOcrClearingFileName(null);
    }
  };

  return (
    <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* 1. Navigation & Search Header - ปรับ Layout ให้อยู่ด้านบน */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <nav className="flex items-center text-sm text-muted-foreground">
            <Link
              href={backHref}
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              รายชื่อผู้มีสิทธิ
            </Link>
            <ChevronRight className="h-4 w-4 mx-1 opacity-50" />
            <span className="text-foreground font-medium">รายละเอียดสิทธิ</span>
          </nav>

          <div className="w-full md:w-[350px]">
            <Select
              value={id}
              onValueChange={(value) => {
                if (value !== id) {
                  const nextUrl = normalizedProfession
                    ? `/pts-officer/allowance-list/${value}?profession=${normalizedProfession}`
                    : `/pts-officer/allowance-list/${value}`;
                  router.push(nextUrl);
                }
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="ค้นหา / เปลี่ยนผู้มีสิทธิ..." />
              </SelectTrigger>
              <SelectContent>
                {personOptions.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 2. Title & Alert Banner */}
        <div className="flex flex-col gap-4 mt-2">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{fullName}</h1>
              <Badge variant="outline" className={`${licenseStatus.color} px-2.5 py-0.5`}>
                {licenseStatus.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
              <span className="bg-muted px-1.5 py-0.5 rounded text-xs">
                รหัสสิทธิ: {data.eligibility_id}
              </span>
              {data.request_no && <span className="text-muted-foreground/60">|</span>}
              {data.request_no && <span>เลขอ้างอิง: {data.request_no}</span>}
            </div>
          </div>

          {/* ย้าย Alert มาเป็น Full-width Banner เพื่อการมองเห็นที่ชัดเจนที่สุด */}
          {licenseStatusKey === 'expiring' && !isPermanentLicense && (
            <div className="flex gap-3 p-4 mt-2 border border-amber-200 bg-amber-50 rounded-lg items-start">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-amber-900">ใบอนุญาตใกล้หมดอายุ</p>
                <p className="text-sm text-amber-800 mt-1 leading-relaxed">
                  ใบอนุญาตจะหมดอายุในวันที่{' '}
                  <span className="font-semibold">
                    {formatThaiDate(license?.valid_until ?? null)}
                  </span>{' '}
                  โปรดตรวจสอบและส่งแจ้งเตือนเพื่อให้ดำเนินการต่ออายุใบอนุญาตให้ทันเวลา เพื่อไม่ให้สิทธินี้ถูกระงับชั่วคราว
                </p>
              </div>
            </div>
          )}

          {isOcrProcessing && (
            <div className="flex gap-3 p-4 border border-sky-200 bg-sky-50 rounded-lg items-start">
              <Loader2 className="h-5 w-5 text-sky-700 mt-0.5 flex-shrink-0 animate-spin" />
              <div>
                <p className="font-bold text-sky-900">กำลังประมวลผล OCR</p>
                <p className="text-sm text-sky-800 mt-1 leading-relaxed">
                  {ocrProcessingMessage} ระหว่างนี้คุณสามารถดูข้อมูลส่วนอื่นในหน้านี้ได้
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Left Column: Details */}
        <div className="space-y-8 lg:col-span-8">
          <Card className="shadow-sm border-border/60">
            <CardContent className="p-6">
              <SectionHeader title="ข้อมูลบุคลากร" icon={User} />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4 mb-6">
                <InfoItem
                  label="ชื่อ-นามสกุล"
                  value={fullName}
                  icon={User}
                  className="sm:col-span-2"
                />
                <InfoItem label="เลขบัตรประชาชน" value={data.citizen_id} isMono />
              </div>

              <div className="col-span-full border-t border-dashed border-border/60 my-6" />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4 mb-6">
                <InfoItem
                  label="ตำแหน่ง"
                  value={submissionPositionName ?? data.position_name ?? '-'}
                  icon={Briefcase}
                  className="sm:col-span-2"
                />
                <InfoItem label="เลขที่ตำแหน่ง" value={data.position_number ?? '-'} isMono />
                <InfoItem
                  label="หน่วยงาน"
                  value={submissionSubDepartment ?? data.sub_department ?? '-'}
                  icon={Building2}
                />
                <InfoItem label="กลุ่มงาน" value={submissionDepartment ?? data.department ?? '-'} />
              </div>

              <div className="bg-muted/30 rounded-lg p-4 mt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4">
                  <InfoItem label="อีเมล" value={data.email ?? '-'} icon={Mail} />
                  <InfoItem label="โทรศัพท์" value={data.phone ?? '-'} icon={Phone} isMono />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
            <CardContent className="p-6">
              <SectionHeader title="สิทธิและอัตรา" icon={Award} />
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                <InfoItem label="วิชาชีพ" value={professionLabel} />
                <InfoItem label="อัตราที่ได้รับ" value={`กลุ่ม ${groupNo} | ข้อ ${itemLabel}`} />
                <InfoItem
                  label="วันที่เริ่มสิทธิ"
                  value={formatThaiDate(data.effective_date)}
                  icon={Calendar}
                  isMono
                />
                <InfoItem
                  label="วันหมดอายุสิทธิ"
                  value={formatThaiDate(data.expiry_date ?? null)}
                  icon={Calendar}
                  isMono
                />
              </dl>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
            <CardContent className="p-6">
              <SectionHeader title="ใบอนุญาตวิชาชีพ" icon={FileText} />
              {license ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                  <InfoItem label="เลขที่ใบอนุญาต" value={license.license_no ?? '-'} isMono />
                  <InfoItem label="ประเภท/สาขาวิชาชีพ" value={license.license_name ?? '-'} />
                  <InfoItem
                    label="วันที่เริ่มมีสิทธิ"
                    value={formatThaiDate(license.valid_from)}
                    icon={Calendar}
                    isMono
                  />
                  {!isPermanentLicense ? (
                    <InfoItem
                      label="วันที่หมดอายุ"
                      value={formatThaiDate(license.valid_until)}
                      icon={Calendar}
                      isMono
                    />
                  ) : null}
                  <div className="sm:col-span-2 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">สถานะ:</span>
                      <Badge
                        variant="outline"
                        className={getLicenseStatusClass(license.status ?? null)}
                      >
                        {getLicenseStatusLabel(license.status ?? null)}
                      </Badge>
                    </div>
                  </div>
                </dl>
              ) : (
                <div className="flex items-center justify-center p-6 bg-muted/20 rounded-lg border border-dashed text-sm text-muted-foreground">
                  ไม่พบข้อมูลใบอนุญาตในระบบ
                </div>
              )}
            </CardContent>
          </Card>

          {memoSummary ? <MemoSummaryCard summary={memoSummary} /> : null}

          {assignmentOrderSummary ? <AssignmentOrderSummaryCard summary={assignmentOrderSummary} /> : null}

          <AttachmentListCard
            title="ไฟล์แนบ"
            count={allAttachments.length}
            items={allAttachments}
            className="shadow-sm border-border/60"
            emptyTitle="ยังไม่มีไฟล์แนบในรายการนี้"
            topContent={
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/20 p-3">
                <input
                  ref={documentInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(event) => void handleUploadFiles(event)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadEligibilityAttachments.isPending}
                  onClick={() => documentInputRef.current?.click()}
                >
                  {uploadEligibilityAttachments.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  เพิ่มโดยเจ้าหน้าที่
                </Button>
              </div>
            }
            renderItem={(file) => {
              const fileUrl = buildAttachmentUrl(file.file_path);
              const previewable = isPreviewableFile(file.file_name);
              const attachmentNotice = getAllowanceAttachmentNotice(file);
              const rawOcrResult = ocrResultByFileName.get(file.file_name);
              const ocrResult = rawOcrResult;
              const {
                documentLabel: ocrDocumentLabel,
                notice: ocrNotice,
                uiState: { hasOcrResult, canClearOcr, canRunOcr, shouldShowResetHint },
              } = buildAllowanceAttachmentOcrPolicy({
                fileName: file.file_name,
                result: ocrResult,
                personName: fullName,
                clearableFileNames: clearableOcrFileNames,
              });

              return (
                <AttachmentListItemCard
                  key={file.attachment_id}
                  fileName={file.file_name}
                  fileTypeLabel={getAttachmentLabel(file.file_name, file.file_type)}
                  badges={
                    <>
                      {file.sources.includes('eligibility') ? (
                        <Badge variant="outline" className="text-[11px]">
                          {file.sources.includes('request')
                            ? 'มีสำเนาที่เพิ่มในหน้านี้'
                            : 'เพิ่มในหน้านี้'}
                        </Badge>
                      ) : null}
                      {file.sources.includes('request') ? (
                        <Badge variant="outline" className="text-[11px]">
                          จากคำขอเดิม
                        </Badge>
                      ) : null}
                      {ocrDocumentLabel ? (
                        <Badge variant="outline" className="text-[11px]">
                          {ocrDocumentLabel}
                        </Badge>
                      ) : null}
                    </>
                  }
                  notices={
                    <>
                      {attachmentNotice ? (
                        <p className="text-[11px] leading-relaxed text-amber-700">
                          {attachmentNotice}
                        </p>
                      ) : null}
                      {ocrNotice ? (
                        <p className="text-[11px] leading-relaxed text-amber-700">{ocrNotice}</p>
                      ) : null}
                    </>
                  }
                  actions={
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {previewable && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handlePreview(fileUrl, file.file_name)}
                        >
                          <Eye className="w-3 h-3 mr-1.5" /> ดูตัวอย่าง
                        </Button>
                      )}
                      {canRunOcr ? (
                        <Button
                          type="button"
                          variant={previewable ? 'ghost' : 'outline'}
                          size="sm"
                          className="h-8 text-xs"
                          disabled={ocrRunningAttachmentId === file.attachment_id}
                          onClick={() => void handleRunAttachmentOcr(file)}
                        >
                          {ocrRunningAttachmentId === file.attachment_id ? (
                            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                          ) : (
                            <ScanText className="w-3 h-3 mr-1.5" />
                          )}
                          ตรวจด้วย OCR
                        </Button>
                      ) : null}

                      {/* ย้ายปุ่มรองต่างๆ มาไว้ด้านขวาของ Action หลัก กั้นด้วยเส้นเพื่อลด Visual Noise */}
                      <div className="flex items-center gap-1 border-l border-border/60 pl-2 ml-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="เปิดไฟล์ในแท็บใหม่"
                          asChild
                        >
                          <a href={fileUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>

                        {hasOcrResult && canClearOcr ? (
                          <ConfirmActionDialog
                            disabled={ocrClearingFileName === file.file_name}
                            title="ยืนยันการล้างผล OCR"
                            description={
                              <>
                                ระบบจะล้างเฉพาะผล OCR ของไฟล์{' '}
                                <span className="font-medium text-foreground">
                                  {file.file_name}
                                </span>
                                <br />
                                ไฟล์แนบจะยังอยู่เหมือนเดิม และคุณสามารถตรวจใหม่ได้ภายหลัง
                              </>
                            }
                            confirmText="ล้างผล OCR"
                            cancelText="ยกเลิก"
                            variant="destructive"
                            onConfirm={() => handleClearAttachmentOcr(file)}
                            trigger={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                                title="ล้างผล OCR"
                                disabled={ocrClearingFileName === file.file_name}
                              >
                                {ocrClearingFileName === file.file_name ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <X className="w-4 h-4" />
                                )}
                              </Button>
                            }
                          />
                        ) : null}

                        {file.sources.includes('eligibility') && file.delete_attachment_id ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title={
                              file.sources.includes('request')
                                ? 'ลบสำเนาที่เพิ่มในหน้านี้'
                                : 'ลบไฟล์'
                            }
                            disabled={deleteEligibilityAttachment.isPending}
                            onClick={() => void handleDeleteAttachment(file.delete_attachment_id!)}
                          >
                            {deleteEligibilityAttachment.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        ) : null}
                      </div>

                      {shouldShowResetHint && (
                        <div className="w-full mt-1">
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            ใช้ไอคอน (X) เพื่อล้างผลที่อ่านเพี้ยน หรือเริ่มตรวจใหม่
                          </p>
                        </div>
                      )}
                    </div>
                  }
                  /* ลบ trailingAction ออก เนื่องจากรวมไว้ในชุด action หลักอย่างเป็นระเบียบแล้ว */
                />
              );
            }}
          />
        </div>

        {/* Right Column: Sidebar (Sticky) */}
        <div className="space-y-6 lg:col-span-4 sticky top-6">
          <Card className="shadow-md border-primary/20 bg-primary/5 overflow-hidden">
            <CardHeader className="pb-2">
              <CardDescription className="text-primary/80">อัตราตามสิทธิ</CardDescription>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-bold text-primary font-mono tracking-tighter">
                  {formatThaiNumber(rateAmount)}
                </span>
                <span className="text-sm font-medium text-primary/80">บาท/เดือน</span>
              </div>
            </CardHeader>
            <CardContent className="pb-6">
              <Separator className="mb-4 bg-primary/15" />
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">วิชาชีพ</span>
                  <Badge
                    variant="secondary"
                    className="font-normal bg-background/50 hover:bg-background/80 text-foreground border-primary/10"
                  >
                    {professionLabel}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">กลุ่ม/ข้อ</span>
                  <span className="font-medium font-mono">
                    {groupNo} / {itemLabel}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                คำขอต้นทาง
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sourceRequest || data?.request_id ? (
                <dl className="space-y-4 text-sm">
                  <div className="flex justify-between items-start">
                    <dt className="text-muted-foreground">เลขที่คำขอ</dt>
                    <dd className="text-right">
                      {sourceRequestId ? (
                        <Link
                          href={`/pts-officer/requests/${sourceRequestId}`}
                          className="inline-flex items-center gap-1 font-medium font-mono text-primary hover:text-primary/80 hover:underline"
                        >
                          <span>{sourceRequestDisplayNo}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="font-medium font-mono">-</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between items-start">
                    <dt className="text-muted-foreground">สถานะ</dt>
                    <dd className="text-right">
                      <Badge variant="secondary" className="font-normal text-xs">
                        {sourceRequestStatusLabel}
                      </Badge>
                    </dd>
                  </div>
                  <Separator className="my-2" />
                  <div className="space-y-1">
                    <dt className="text-xs text-muted-foreground">ประเภทคำขอ</dt>
                    <dd className="font-medium">{requestTypeLabel}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs text-muted-foreground">ประเภทบุคลากร</dt>
                    <dd className="font-medium">{personnelTypeLabel}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs text-muted-foreground">หน้าที่หลัก</dt>
                    <dd className="font-medium">{sourceRequestMainDuty}</dd>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="bg-muted/30 p-2 rounded text-xs">
                      <div className="text-muted-foreground mb-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> อัปเดตล่าสุด
                      </div>
                      <div className="font-medium">
                        {formatThaiDateTime(sourceRequest?.updated_at ?? data.created_at ?? null)}
                      </div>
                    </div>
                    <div className="bg-muted/30 p-2 rounded text-xs">
                      <div className="text-muted-foreground mb-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> เริ่มขั้นตอน
                      </div>
                      <div className="font-medium">
                        {formatThaiDateTime(sourceRequestStartedAt)}
                      </div>
                    </div>
                  </div>
                </dl>
              ) : (
                <div className="flex items-center justify-center p-4 bg-muted/20 rounded-lg text-xs text-muted-foreground text-center border border-dashed">
                  ไม่พบข้อมูลคำขอต้นทาง
                  <br />
                  หรือไม่สามารถเข้าถึงข้อมูลได้
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Hash className="w-4 h-4 text-muted-foreground" />
                รหัสอ้างอิง
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">รหัสสิทธิ์</span>
                <span className="font-mono text-xs">{data.eligibility_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">รหัสอัตรา</span>
                <span className="font-mono text-xs">{data.master_rate_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">รหัสคำขอ</span>
                <span className="font-mono text-xs">{data.request_id ?? '-'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">สร้างเมื่อ</span>
                <span className="font-mono text-xs">
                  {formatThaiDateTime(data.created_at ?? null)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AttachmentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        previewUrl={previewUrl}
        previewName={previewName}
      />
    </div>
  );
}
