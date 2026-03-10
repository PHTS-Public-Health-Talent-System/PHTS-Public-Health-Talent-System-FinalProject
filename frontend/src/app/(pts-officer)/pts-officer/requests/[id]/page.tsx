"use client";
export const dynamic = "force-dynamic";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import {
  useCreateVerificationSnapshot,
  useRunRequestAttachmentsOcr,
  useClearRequestAttachmentOcr,
  useProcessAction,
  useRequestDetail,
} from "@/features/request";
import { useRateHierarchy } from "@/features/master-data/hooks";
import { AttachmentPreviewDialog } from "@/components/common/attachment-preview-dialog";
import { AttachmentListCard, AttachmentListItemCard } from "@/components/common";
import type { RequestWithDetails } from "@/types/request.types";
import {
  formatThaiDate,
  formatThaiDateTime,
  toDateOnly,
} from "@/features/request/detail/utils";
import {
  getStatusColor,
  getStatusLabel,
} from "@/features/request/detail/utils";
import { getAttachmentLabel } from "@/features/request/detail/utils";
import {
  InfoItem,
  SectionHeader,
} from "@/features/request/detail/utils";
import { RequestTimelineCard } from "@/features/request/detail/timeline";
import {
  isEmptyRateMapping,
  normalizeRateMapping,
  resolveRateMappingDisplay,
} from "@/features/request/detail/utils";
import {
  buildAttachmentUrl,
  isPreviewableFile,
} from "@/features/request/detail/utils";
import { AssignmentOrderSummaryCard } from "@/features/request/detail/cards";
import { findAssignmentOrderSummary } from "@/features/request/detail/utils";
import {
  findMemoSummary,
} from "@/features/request/detail/utils";
import { MemoSummaryCard } from "@/features/request/detail/cards";
import { formatThaiNumber } from "@/shared/utils/thai-locale";
import { getOnBehalfMetadata } from "@/features/request";
import {
  buildAllowanceAttachmentOcrPolicy,
  buildAllowanceAttachmentOcrResultMap,
  buildAllowanceClearableOcrFileNameSet,
  buildAllowanceOcrDocuments,
} from "@/app/(pts-officer)/pts-officer/allowance-list/attachments";

type AssessmentVerdict = "correct" | "incorrect";

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
  const hasIncorrect = items.some((i) => verdictMap[i.key] === "incorrect");

  return (
    <div
      className={`mt-6 rounded-lg border transition-colors ${
        isAllChecked && !hasIncorrect
          ? "border-emerald-200 bg-emerald-50/30"
          : hasIncorrect
            ? "border-rose-200 bg-rose-50/30"
            : "border-border/60 bg-muted/20"
      } p-4 ${className ?? ""}`}
    >
      <div className="flex justify-between items-center mb-3">
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            isAllChecked && !hasIncorrect
              ? "text-emerald-700"
              : hasIncorrect
                ? "text-rose-700"
                : "text-muted-foreground"
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
                verdict === "correct"
                  ? "bg-emerald-50/50 border-emerald-100"
                  : verdict === "incorrect"
                    ? "bg-rose-50/50 border-rose-100"
                    : "bg-background/80 border-border/50"
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.description}
                  </p>
                </div>
                {verdict === "correct" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                )}
                {verdict === "incorrect" && (
                  <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`h-7 px-3 text-xs ${
                    verdict === "correct"
                      ? "border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      : "hover:bg-emerald-50 hover:text-emerald-600"
                  }`}
                  onClick={() => onSelect(item.key, "correct")}
                >
                  ถูกต้อง
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`h-7 px-3 text-xs ${
                    verdict === "incorrect"
                      ? "border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-200"
                      : "hover:bg-rose-50 hover:text-rose-600"
                  }`}
                  onClick={() => onSelect(item.key, "incorrect")}
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
  CIVIL_SERVANT: "ข้าราชการ",
  GOV_EMPLOYEE: "พนักงานราชการ",
  PH_EMPLOYEE: "พนักงานกระทรวงสาธารณสุข",
  TEMP_EMPLOYEE: "ลูกจ้างชั่วคราว",
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  NEW_ENTRY: "ขอรับสิทธิ พ.ต.ส. ครั้งแรก",
  EDIT_INFO_SAME_RATE: "แก้ไขข้อมูล (อัตราเดิม)",
  EDIT_INFO_NEW_RATE: "แก้ไขข้อมูล (อัตราใหม่)",
};

const WORK_ATTRIBUTE_LABELS: Record<string, string> = {
  operation: "ปฏิบัติการ",
  planning: "วางแผน",
  coordination: "ประสานงาน",
  service: "ให้บริการ",
};

const EMPLOYEE_MINIMUM_CHECKLIST: MinimumChecklistItem[] = [
  {
    key: "basic_form_data",
    label: "ข้อมูลในแบบคำขอครบและตรงกับข้อมูลบุคคล",
    description:
      "ชื่อ-สกุล ตำแหน่ง สังกัด สถานที่ปฏิบัติงาน กรอกครบถ้วน และตรงกับข้อมูลในระบบ",
  },
];

const ELIGIBILITY_MINIMUM_CHECKLIST: MinimumChecklistItem[] = [
  {
    key: "healthcare_definition",
    label: "เข้าเกณฑ์ผู้ปฏิบัติงานด้านการสาธารณสุขตามระเบียบ",
    description:
      "สำเร็จการศึกษาตามเกณฑ์ มีใบอนุญาตฯ และใช้ใบอนุญาตในการให้บริการด้านสุขภาพ",
  },
  {
    key: "assignment_order_match",
    label: "มีคำสั่ง/หนังสือมอบหมายงาน",
    description:
      "มีหลักฐานการมอบหมายงาน และงานที่ปฏิบัติสอดคล้องกับกลุ่ม/ข้อที่ขอรับ",
  },
  {
    key: "rate_mapping_correct",
    label: "กลุ่ม/ข้อ/อัตราที่ขอรับถูกต้อง",
    description:
      "อัตราไม่เกินบัญชีท้ายระเบียบ และได้รับอัตราสูงสุดเพียงอัตราเดียว",
  },
  {
    key: "effective_date_correct",
    label: "วันที่เริ่มมีสิทธิถูกต้อง",
    description:
      "วันที่เริ่มมีผลสอดคล้องกับวันที่เริ่มปฏิบัติงาน/คำสั่งมอบหมายงาน",
  },
];

const LICENSE_MINIMUM_CHECKLIST: MinimumChecklistItem[] = [
  {
    key: "license_active",
    label: "ใบอนุญาตยังมีผลใช้บังคับ",
    description: "ตรวจวันหมดอายุ และประเภท/สาขาใบอนุญาตสอดคล้องกับงานที่ขอรับ",
  },
];

const ATTACHMENT_MINIMUM_CHECKLIST: MinimumChecklistItem[] = [
  {
    key: "minimum_documents",
    label: "เอกสารครบถ้วน",
    description:
      "มีหลักฐานคุณวุฒิ ใบอนุญาต คำสั่งมอบหมายงาน และเอกสารเงื่อนไขเฉพาะ",
  },
];

const PTS_OFFICER_APPROVAL_STEP = 3;

const ALL_CHECKLIST_ITEMS = [
  ...EMPLOYEE_MINIMUM_CHECKLIST,
  ...ELIGIBILITY_MINIMUM_CHECKLIST,
  ...LICENSE_MINIMUM_CHECKLIST,
  ...ATTACHMENT_MINIMUM_CHECKLIST,
];

const CHECKLIST_INCORRECT_REASON_BY_KEY: Record<string, string> = {
  basic_form_data:
    "ข้อมูลชื่อ-สกุล ตำแหน่ง สังกัด หรือสถานที่ปฏิบัติงาน ยังไม่ครบถ้วนหรือไม่ตรงกับข้อมูลในระบบ",
  healthcare_definition:
    "คุณสมบัติผู้ปฏิบัติงานด้านการสาธารณสุขยังไม่ครบตามเกณฑ์ หรือข้อมูลใบอนุญาต/การใช้ใบอนุญาตยังไม่ชัดเจน",
  assignment_order_match:
    "หลักฐานคำสั่ง/หนังสือมอบหมายงานยังไม่ครบ หรือรายละเอียดงานยังไม่สอดคล้องกับกลุ่ม/ข้อที่ยื่นขอ",
  rate_mapping_correct:
    "กลุ่ม/ข้อ/อัตราที่ยื่นขอยังไม่ถูกต้องตามหลักเกณฑ์ หรือมีความเสี่ยงรับซ้ำซ้อนเกินสิทธิ",
  effective_date_correct:
    "วันที่เริ่มมีสิทธิยังไม่สอดคล้องกับวันที่เริ่มปฏิบัติงานหรือวันที่ในคำสั่งมอบหมาย",
  license_active:
    "สถานะใบอนุญาตยังไม่ยืนยันว่าใช้บังคับได้ตลอดช่วงที่ยื่นขอ หรือประเภท/สาขาไม่สอดคล้องกับงาน",
  minimum_documents:
    "เอกสารประกอบยังไม่ครบถ้วน ชัดเจน หรือยังไม่เพียงพอสำหรับยืนยันสิทธิ",
};

// --- HELPERS ---

const parseSubmission = (value: RequestWithDetails["submission_data"]) => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
};

const parseChecklistStateFromSnapshot = (
  value: RequestWithDetails["latest_verification_snapshot"] extends { snapshot_data?: infer T }
    ? T
    : unknown,
): Record<string, AssessmentVerdict | undefined> => {
  if (!value) return {};
  const raw =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : (value as Record<string, unknown>);

  const checklist = raw.checklist as { items?: unknown[] } | undefined;
  const items = Array.isArray(checklist?.items) ? checklist.items : [];
  const allowedKeys = new Set(ALL_CHECKLIST_ITEMS.map((item) => item.key));
  const next: Record<string, AssessmentVerdict | undefined> = {};

  items.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    const key = typeof row.key === "string" ? row.key : "";
    const verdict = row.verdict;
    if (!allowedKeys.has(key)) return;
    if (verdict === "correct" || verdict === "incorrect") {
      next[key] = verdict;
    }
  });

  return next;
};

const buildChecklistFingerprint = (
  checklistState: Record<string, AssessmentVerdict | undefined>,
) =>
  JSON.stringify(
    ALL_CHECKLIST_ITEMS.map((item) => ({
      key: item.key,
      verdict: checklistState[item.key] ?? null,
    })),
  );

const getSubmissionString = (
  submission: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const value = submission[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

const getLicenseStatusClass = (status?: string | null) => {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "EXPIRED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "INACTIVE":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "UNKNOWN":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getLicenseStatusLabel = (status?: string | null) => {
  switch (status) {
    case "ACTIVE":
      return "มีผลใช้บังคับ";
    case "EXPIRED":
      return "หมดอายุ";
    case "INACTIVE":
      return "ไม่อยู่ในสถานะใช้งาน";
    case "UNKNOWN":
      return "ไม่สามารถระบุสถานะ";
    default:
      return "ไม่พบข้อมูล";
  }
};

type OcrPrecheckPayload = {
  status?: "queued" | "processing" | "completed" | "failed" | "skipped";
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
    engine_used?: string;
    fallback_used?: boolean;
    document_kind?: string;
    fields?: Record<string, unknown>;
    missing_fields?: string[];
    fallback_reason?: string;
    quality?: {
      required_fields?: number;
      captured_fields?: number;
      passed?: boolean;
    };
  }>;
};

// --- MAIN PAGE ---

export default function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHistoryView = searchParams.get("from") === "history";
  const backHref = isHistoryView
    ? "/pts-officer/history"
    : "/pts-officer/requests";
  const backLabel = isHistoryView ? "ประวัติการอนุมัติ" : "รายการคำขอที่รอดำเนินการ";
  const queryClient = useQueryClient();
  const { data: request, isLoading } = useRequestDetail(id);
  const { data: rateHierarchy } = useRateHierarchy();
  const processAction = useProcessAction();
  const createVerificationSnapshot = useCreateVerificationSnapshot();
  const runRequestAttachmentsOcr = useRunRequestAttachmentsOcr();
  const clearRequestAttachmentOcr = useClearRequestAttachmentOcr();

  const [actionDialog, setActionDialog] = useState<
    "approve" | "reject" | "return" | null
  >(null);
  const [comment, setComment] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewName, setPreviewName] = useState("");
  const [ocrRunningAttachmentId, setOcrRunningAttachmentId] = useState<number | null>(null);
  const [ocrClearingFileName, setOcrClearingFileName] = useState<string | null>(null);
  const [latestOcrResults, setLatestOcrResults] = useState<
    Array<{
      name?: string;
      ok?: boolean;
      markdown?: string;
      error?: string;
      suppressed?: boolean;
      document_kind?: string;
    }>
  >([]);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [requestChecklistState, setRequestChecklistState] = useState<
    Record<string, AssessmentVerdict | undefined>
  >({});
  const [hasChecklistInteraction, setHasChecklistInteraction] = useState(false);
  const [lastSavedFingerprint, setLastSavedFingerprint] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // --- Derived State for UX ---
  const checklistStats = useMemo(() => {
    // Aggregate checklist state once, then drive all approval gating from this object.
    const values = Object.values(requestChecklistState);
    const checkedCount = values.length;
    const totalCount = ALL_CHECKLIST_ITEMS.length;
    const correctItems = ALL_CHECKLIST_ITEMS.filter(
      (item) => requestChecklistState[item.key] === "correct",
    );
    const incorrectItems = ALL_CHECKLIST_ITEMS.filter(
      (item) => requestChecklistState[item.key] === "incorrect",
    );
    const correctCount = correctItems.length;
    const incorrectCount = incorrectItems.length;

    return {
      checkedCount,
      totalCount,
      correctCount,
      correctItems,
      incorrectCount,
      incorrectItems,
      progress: Math.round((checkedCount / totalCount) * 100),
      isComplete: checkedCount === totalCount,
      hasIncorrect: incorrectCount > 0,
      canApprove: checkedCount === totalCount && incorrectCount === 0,
    };
  }, [requestChecklistState]);
  const checklistFingerprint = useMemo(
    // Stable fingerprint used to detect unsaved checklist changes for autosave.
    () => buildChecklistFingerprint(requestChecklistState),
    [requestChecklistState],
  );
  const snapshotChecklistState = useMemo(
    () =>
      parseChecklistStateFromSnapshot(
        request?.latest_verification_snapshot?.snapshot_data ?? null,
      ),
    [request?.latest_verification_snapshot?.snapshot_data],
  );
  useEffect(() => {
    if (!request) return;
    if (hasChecklistInteraction) return;
    if (Object.keys(requestChecklistState).length > 0) return;
    if (Object.keys(snapshotChecklistState).length === 0) return;

    setRequestChecklistState(snapshotChecklistState);
    setLastSavedFingerprint(buildChecklistFingerprint(snapshotChecklistState));
    const savedAtRaw = request.latest_verification_snapshot?.created_at;
    if (savedAtRaw) {
      setLastSavedAt(new Date(savedAtRaw).toISOString());
    }
    setAutosaveStatus("saved");
  }, [
    hasChecklistInteraction,
    request,
    requestChecklistState,
    snapshotChecklistState,
  ]);

  // Submission Parsing
  const submission = useMemo(
    // Normalize `submission_data` (JSON string/object) into a single shape for display.
    () => parseSubmission(request?.submission_data) as Record<string, unknown>,
    [request?.submission_data],
  );
  const ocrPrecheck = useMemo(() => {
    if (!request?.ocr_precheck || typeof request.ocr_precheck !== "object") {
      return null;
    }
    return request.ocr_precheck as OcrPrecheckPayload;
  }, [request?.ocr_precheck]);
  const submissionTitle = getSubmissionString(submission, ["title"]);
  const submissionFirstName = getSubmissionString(submission, [
    "first_name",
    "firstName",
  ]);
  const submissionLastName = getSubmissionString(submission, [
    "last_name",
    "lastName",
  ]);
  const submissionPositionName = getSubmissionString(submission, [
    "position_name",
    "positionName",
  ]);
  const submissionDepartment = getSubmissionString(submission, ["department"]);
  const submissionSubDepartment = getSubmissionString(submission, [
    "sub_department",
    "subDepartment",
  ]);
  const submissionPositionNumber = getSubmissionString(submission, [
    "position_number",
    "positionNumber",
  ]);
  const onBehalfMeta = useMemo(() => getOnBehalfMetadata(submission), [submission]);

  const requesterName = useMemo(() => {
    const firstName = submissionFirstName ?? request?.requester?.first_name;
    const lastName = submissionLastName ?? request?.requester?.last_name;
    return (
      [submissionTitle, firstName, lastName].filter(Boolean).join(" ").trim() ||
      "-"
    );
  }, [
    request?.requester,
    submissionTitle,
    submissionFirstName,
    submissionLastName,
  ]);

  const positionName =
    submissionPositionName ?? request?.requester?.position ?? "-";
  const department = submissionDepartment ?? request?.current_department ?? "-";
  const subDepartment = submissionSubDepartment ?? "-";
  const attachments = useMemo(() => request?.attachments ?? [], [request?.attachments]);
  const visibleAttachmentFileNames = useMemo(
    () => attachments.map((file) => file.file_name),
    [attachments],
  );
  const requestOcrResultMap = useMemo(
    () =>
      buildAllowanceAttachmentOcrResultMap({
        requestResults: ocrPrecheck?.results,
        latestResults: latestOcrResults,
        visibleFileNames: visibleAttachmentFileNames,
      }),
    [latestOcrResults, ocrPrecheck?.results, visibleAttachmentFileNames],
  );
  const clearableOcrFileNames = useMemo(
    () =>
      buildAllowanceClearableOcrFileNameSet({
        eligibilityResults: ocrPrecheck?.results,
        latestResults: latestOcrResults,
        visibleFileNames: visibleAttachmentFileNames,
      }),
    [latestOcrResults, ocrPrecheck?.results, visibleAttachmentFileNames],
  );
  const ocrDocuments = useMemo(
    () =>
      buildAllowanceOcrDocuments({
        requestResults: ocrPrecheck?.results,
        latestResults: latestOcrResults,
        visibleFileNames: visibleAttachmentFileNames,
      }),
    [latestOcrResults, ocrPrecheck?.results, visibleAttachmentFileNames],
  );
  const assignmentOrderSummary = useMemo(() => {
    if (requesterName === "-" || ocrDocuments.length === 0) {
      return null;
    }
    return findAssignmentOrderSummary(ocrDocuments, requesterName);
  }, [ocrDocuments, requesterName]);
  const memoSummary = useMemo(() => {
    if (requesterName === "-" || ocrDocuments.length === 0) {
      return null;
    }
    return findMemoSummary(ocrDocuments, requesterName);
  }, [ocrDocuments, requesterName]);
  const displayId = request ? (request.request_no ?? "-") : id;

  const rateMapping = useMemo(
    () => normalizeRateMapping(request?.submission_data ?? null),
    [request?.submission_data],
  );
  const rateDisplay = useMemo(() => {
    if (!rateMapping) return null;
    return resolveRateMappingDisplay(rateMapping, rateHierarchy);
  }, [rateMapping, rateHierarchy]);

  const rateAmount = rateMapping?.amount ?? request?.requested_amount ?? null;
  const isRateMappingEmpty = useMemo(
    () => isEmptyRateMapping(rateMapping),
    [rateMapping],
  );
  const licenseNo = request?.requester?.license_no?.trim() || "-";
  const licenseName = request?.requester?.license_name?.trim() || "-";
  const licenseValidFrom = request?.requester?.license_valid_from ?? null;
  const licenseValidUntil = request?.requester?.license_valid_until ?? null;
  const licenseStatus = request?.requester?.license_status ?? null;

  const personnelTypeLabel = request?.personnel_type
    ? PERSONNEL_TYPE_LABELS[request.personnel_type] || request.personnel_type
    : "-";
  const requestTypeLabel = request?.request_type
    ? REQUEST_TYPE_LABELS[request.request_type] || request.request_type
    : "-";
  const mainDuty = request?.main_duty || "-";
  const workAttributes = request?.work_attributes
    ? Object.entries(request.work_attributes)
        .filter(([, enabled]) => Boolean(enabled))
        .map(([key]) => WORK_ATTRIBUTE_LABELS[key] || key)
    : [];
  const effectiveDateLabel = request?.effective_date
    ? formatThaiDate(request.effective_date)
    : null;

  const submitAction = (request?.actions ?? []).find(
    (a) => a.action === "SUBMIT",
  );
  const linkedEligibility = request?.linked_eligibility ?? null;
  const canAct =
    !isHistoryView &&
    request?.status === "PENDING" &&
    request?.current_step === PTS_OFFICER_APPROVAL_STEP;
  const isApprovedRequest = request?.status === "APPROVED";
  const allowanceDetailHref = linkedEligibility
    ? `/pts-officer/allowance-list/${linkedEligibility.eligibility_id}${
        linkedEligibility.profession_code
          ? `?profession=${encodeURIComponent(linkedEligibility.profession_code)}`
          : ""
      }`
    : null;
  const useAllowanceOcrAfterApproval = isApprovedRequest && Boolean(allowanceDetailHref);
  const hasVerificationSnapshot = Boolean(
    request?.has_verification_snapshot ||
      request?.latest_verification_snapshot?.snapshot_id,
  );

  const isSubmitting = processAction.isPending;
  const isSnapshotSaving =
    createVerificationSnapshot.isPending || autosaveStatus === "saving";
  const isActionBusy = isSubmitting || isSnapshotSaving;

  const persistVerificationSnapshot = useCallback(
    async ({
      silent = false,
      source = "PTS_OFFICER_DETAIL_PAGE",
    }: {
      silent?: boolean;
      source?: string;
    } = {}) => {
      if (!request) return false;
      if (!rateMapping?.rateId) {
        if (!silent) toast.error("ยังไม่พบข้อมูลอัตราที่ใช้ตรวจสอบ (rate_id)");
        return false;
      }
      const effectiveDateOnly = toDateOnly(request.effective_date);
      if (!effectiveDateOnly) {
        if (!silent)
          toast.error("ยังไม่พบวันที่เริ่มมีผลสำหรับบันทึกการตรวจสอบ");
        return false;
      }

      const checkedAt = new Date().toISOString();
      const checklistItems = ALL_CHECKLIST_ITEMS.map((item) => ({
        key: item.key,
        label: item.label,
        verdict: requestChecklistState[item.key] ?? null,
        checked_at: checkedAt,
      }));
      const checkedCount = checklistItems.filter(
        (item) => item.verdict !== null,
      ).length;
      const correctCount = checklistItems.filter(
        (item) => item.verdict === "correct",
      ).length;
      const incorrectCount = checklistItems.filter(
        (item) => item.verdict === "incorrect",
      ).length;

      // Snapshot is the auditable "state at decision time" so approvals/rejections are traceable.
      const snapshotData: Record<string, unknown> = {
        request_no: request.request_no,
        request_type: request.request_type,
        personnel_type: request.personnel_type,
        requested_amount: request.requested_amount,
        verification_source: source,
        rate_mapping: rateMapping,
        ocr_result: null,
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
        setAutosaveStatus("saving");
        await createVerificationSnapshot.mutateAsync({
          id,
          payload: {
            master_rate_id: rateMapping.rateId,
            effective_date: effectiveDateOnly,
            snapshot_data: snapshotData,
          },
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["request", String(id)] }),
          queryClient.invalidateQueries({ queryKey: ["pending-approvals"] }),
        ]);
        setLastSavedFingerprint(checklistFingerprint);
        setLastSavedAt(checkedAt);
        setAutosaveStatus("saved");
        if (!silent) toast.success("บันทึกการตรวจสอบเรียบร้อย");
        return true;
      } catch {
        setAutosaveStatus("error");
        if (!silent) toast.error("ไม่สามารถบันทึกการตรวจสอบได้");
        return false;
      }
    },
    [
      checklistFingerprint,
      createVerificationSnapshot,
      id,
      queryClient,
      rateMapping,
      request,
      requestChecklistState,
    ],
  );

  useEffect(() => {
    // Debounced autosave: reduce write frequency while keeping officer checklist progress durable.
    if (!hasChecklistInteraction) return;
    if (checklistFingerprint === lastSavedFingerprint) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      void persistVerificationSnapshot({
        silent: true,
        source: "PTS_OFFICER_AUTOSAVE",
      });
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [
    checklistFingerprint,
    hasChecklistInteraction,
    lastSavedFingerprint,
    persistVerificationSnapshot,
  ]);

  const openActionDialog = (dialog: "approve" | "reject" | "return" | null) => {
    if (isActionBusy) return;
    setActionDialog(dialog);
    if (dialog === "return" || dialog === "reject") {
      const formatChecklistLines = (
        items: MinimumChecklistItem[],
        mode: "correct" | "incorrect",
      ): string[] =>
        items.map((item, index) => {
          const reasonText =
            mode === "correct"
              ? item.description
              : (CHECKLIST_INCORRECT_REASON_BY_KEY[item.key] ??
                "ข้อมูลในรายการนี้ยังไม่ผ่านเกณฑ์ โปรดทบทวนและแก้ไขก่อนส่งใหม่");
          return `${index + 1}. ${item.label}\n   - เหตุผล: ${reasonText}`;
        });

      const uncheckedItems = ALL_CHECKLIST_ITEMS.filter(
        (item) => !requestChecklistState[item.key],
      );

      const lines: string[] = ["จากการตรวจสอบคำขอโดยเจ้าหน้าที่ พ.ต.ส. สรุปดังนี้"];

      if (checklistStats.incorrectItems.length > 0) {
        lines.push(`รายการที่ต้องแก้ไข (${checklistStats.incorrectItems.length} รายการ):`);
        lines.push(...formatChecklistLines(checklistStats.incorrectItems, "incorrect"));
      }

      if (checklistStats.correctItems.length > 0) {
        lines.push(`รายการที่ตรวจผ่าน (${checklistStats.correctItems.length} รายการ):`);
        lines.push(...formatChecklistLines(checklistStats.correctItems, "correct"));
      }

      if (uncheckedItems.length > 0) {
        lines.push(`รายการที่ยังไม่ได้ประเมิน (${uncheckedItems.length} รายการ):`);
        lines.push(...uncheckedItems.map((item, index) => `${index + 1}. ${item.label}`));
      }

      if (lines.length === 1) {
        lines.push("ยังไม่มีผลการประเมินรายการตรวจสอบ");
      }

      const issues = lines.join("\n");
      setComment((prev) =>
        prev ? prev : issues,
      );
    }
  };

  const handlePreview = (url: string, name: string) => {
    setPreviewUrl(url);
    setPreviewName(name);
    setPreviewOpen(true);
  };

  const setRequestChecklistVerdict = (
    key: string,
    verdict: AssessmentVerdict,
  ) => {
    setHasChecklistInteraction(true);
    setAutosaveStatus("idle");
    setRequestChecklistState((prev) => ({
      ...prev,
      [key]: prev[key] === verdict ? undefined : verdict,
    }));
  };

  const handleAction = async (action: "approve" | "reject" | "return") => {
    const trimmed = comment.trim();
    if ((action === "reject" || action === "return") && !trimmed) {
      toast.error("กรุณาระบุเหตุผล");
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    // Block workflow transition unless latest verification snapshot is saved successfully.
    const saved = await persistVerificationSnapshot({
      silent: true,
      source: "PTS_OFFICER_ACTION_SUBMIT",
    });
    if (!saved) {
      toast.error("ไม่สามารถบันทึกการตรวจสอบก่อนดำเนินการคำขอได้");
      return;
    }

    try {
      await processAction.mutateAsync({
        id,
        payload: {
          action:
            action === "approve"
              ? "APPROVE"
              : action === "reject"
                ? "REJECT"
                : "RETURN",
          comment: trimmed || undefined,
        },
      });
      toast.success("ดำเนินการคำขอเรียบร้อย");
      setActionDialog(null);
      setComment("");
      router.push("/pts-officer/requests");
    } catch {
      toast.error("ไม่สามารถดำเนินการคำขอได้");
    }
  };

  useEffect(() => {
    setLatestOcrResults([]);
  }, [request?.request_id]);

  const runRequestAttachmentOcr = async (attachmentId: number) => {
    try {
      setOcrRunningAttachmentId(attachmentId);
      const result = await runRequestAttachmentsOcr.mutateAsync({
        requestId: id,
        payload: {
          attachments: [{ attachment_id: attachmentId }],
        },
      });
      setLatestOcrResults(result.results ?? []);
      toast.success("ตรวจ OCR เรียบร้อย");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ไม่สามารถตรวจ OCR ได้";
      toast.error(message);
    } finally {
      setOcrRunningAttachmentId(null);
    }
  };

  const clearRequestOcr = async (fileName: string) => {
    try {
      setOcrClearingFileName(fileName);
      await clearRequestAttachmentOcr.mutateAsync({
        requestId: id,
        payload: { file_name: fileName },
      });
      setLatestOcrResults((prev) => [
        ...prev.filter(
          (item) => String(item.name ?? "").trim().toLowerCase() !== fileName.trim().toLowerCase(),
        ),
        { name: fileName, suppressed: true },
      ]);
      toast.success("ล้างผล OCR เรียบร้อย");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ไม่สามารถล้างผล OCR ได้";
      toast.error(message);
    } finally {
      setOcrClearingFileName(null);
    }
  };

  const isSectionComplete = (items: MinimumChecklistItem[]) => {
    return items.every((item) => requestChecklistState[item.key] === "correct");
  };


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
        <h2 className="text-xl font-semibold text-foreground">
          ไม่พบข้อมูลคำขอ
        </h2>
        <p className="text-muted-foreground mb-6">
          ไม่พบคำขอรายการนี้ในระบบ
        </p>
        <Link href={backHref}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {`กลับไป${backLabel}`}
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
            href={backHref}
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {backLabel}
          </Link>
          <ChevronRight className="h-4 w-4 mx-1 opacity-50" />
          <span className="text-foreground font-medium">รายละเอียด</span>
        </nav>

        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {displayId}
              </h1>
              <Badge
                variant="outline"
                className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${getStatusColor(request.status)}`}
              >
                {getStatusLabel(request.status, request.current_step)}
              </Badge>
              {onBehalfMeta.isOfficerCreated ? (
                <Badge
                  variant="outline"
                  className="border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary"
                >
                  เจ้าหน้าที่สร้างแทน
                </Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground text-sm">
              สร้างเมื่อ {formatThaiDateTime(request.created_at)}
            </p>
            {onBehalfMeta.isOfficerCreated ? (
              <p className="text-sm text-muted-foreground">
                คำขอนี้ถูกบันทึกโดยเจ้าหน้าที่ พ.ต.ส. แทนผู้มีสิทธิ
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        <div className="space-y-8 lg:col-span-8">
          <Card
            className={`scroll-mt-20 shadow-sm transition-all duration-300 ${isSectionComplete(EMPLOYEE_MINIMUM_CHECKLIST) ? "border-emerald-200/60 ring-1 ring-emerald-500/20" : "border-border/60"}`}
          >
            <CardContent className="p-6">
              <SectionHeader
                title="ผู้ยื่นคำขอ"
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
                <InfoItem
                  label="เลขประจำตัวประชาชน"
                  value={request.citizen_id ?? "-"}
                />

                <div className="col-span-full border-t border-border/50 my-2"></div>

                <InfoItem
                  label="ตำแหน่ง"
                  value={positionName}
                  icon={Briefcase}
                  className="sm:col-span-2"
                />
                <InfoItem
                  label="เลขที่ตำแหน่ง"
                  value={
                    submissionPositionNumber ||
                    request.current_position_number ||
                    "-"
                  }
                />

                <InfoItem
                  label="กลุ่มงาน"
                  value={department}
                  icon={Building2}
                />
                <InfoItem label="หน่วยงาน" value={subDepartment} />
              </dl>
              {canAct ? (
                <MinimumChecklist
                  title="รายการตรวจผู้ยื่นคำขอ"
                  items={EMPLOYEE_MINIMUM_CHECKLIST}
                  verdictMap={requestChecklistState}
                  onSelect={setRequestChecklistVerdict}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card
            className={`scroll-mt-20 shadow-sm transition-all duration-300 ${isSectionComplete(ELIGIBILITY_MINIMUM_CHECKLIST) ? "border-emerald-200/60 ring-1 ring-emerald-500/20" : "border-border/60"}`}
          >
            <CardContent className="p-6">
              <SectionHeader
                title="สิทธิ พ.ต.ส."
                icon={CreditCard}
                isComplete={isSectionComplete(ELIGIBILITY_MINIMUM_CHECKLIST)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4 mb-6">
                <InfoItem
                  label="ประเภทคำขอ"
                  value={requestTypeLabel}
                  className="sm:col-span-2"
                />
                <InfoItem label="ประเภทบุคลากร" value={personnelTypeLabel} />
                <InfoItem
                  label="วันที่เริ่มมีผล"
                  value={effectiveDateLabel || "-"}
                />
                <InfoItem
                  label="งานที่ได้รับมอบหมาย"
                  value={mainDuty}
                  className="sm:col-span-2"
                />
                <InfoItem
                  label="ลักษณะงาน"
                  value={
                    workAttributes.length > 0 ? workAttributes.join(", ") : "-"
                  }
                  className="sm:col-span-2"
                />
              </div>

              <div className="bg-muted/30 rounded-lg p-5 border border-border/50">
                <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-primary rounded-full"></span>
                  อัตราสิทธิ พ.ต.ส.
                </h4>

                {isRateMappingEmpty ? (
                  <div className="text-sm text-muted-foreground text-center py-4 italic">
                    ยังไม่มีข้อมูลอัตราสิทธิ
                  </div>
                ) : (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4">
                    <InfoItem
                      label="กลุ่มวิชาชีพ"
                      value={rateDisplay?.professionLabel || "-"}
                    />
                    <InfoItem
                      label="กลุ่ม"
                      value={rateDisplay?.groupLabel || "-"}
                    />
                    <InfoItem
                      label="หลักเกณฑ์"
                      value={rateDisplay?.criteriaLabel || "-"}
                      className="sm:col-span-2"
                    />
                    <InfoItem
                      label="รายละเอียดเพิ่มเติม"
                      value={rateDisplay?.subCriteriaLabel || "-"}
                      className="sm:col-span-2"
                    />

                    <div className="sm:col-span-2 mt-2 pt-4 border-t border-border/50 flex justify-between items-center">
                      <span className="text-sm font-medium">
                        อัตราเงินตามสิทธิ
                      </span>
                      <span className="text-lg font-bold text-primary">
                        {rateAmount !== null
                          ? formatThaiNumber(Number(rateAmount))
                          : "-"}
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                          บาท/เดือน
                        </span>
                      </span>
                    </div>
                  </dl>
                )}
              </div>
              {canAct ? (
                <MinimumChecklist
                  title="รายการตรวจสิทธิ"
                  items={ELIGIBILITY_MINIMUM_CHECKLIST}
                  verdictMap={requestChecklistState}
                  onSelect={setRequestChecklistVerdict}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card
            className={`scroll-mt-20 shadow-sm transition-all duration-300 ${isSectionComplete(LICENSE_MINIMUM_CHECKLIST) ? "border-emerald-200/60 ring-1 ring-emerald-500/20" : "border-border/60"}`}
          >
            <CardContent className="p-6">
              <SectionHeader
                title="ใบอนุญาตวิชาชีพ"
                icon={FileText}
                isComplete={isSectionComplete(LICENSE_MINIMUM_CHECKLIST)}
              />
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4">
                <InfoItem label="เลขที่ใบอนุญาต" value={licenseNo} />
                <InfoItem label="ประเภท/สาขาวิชาชีพ" value={licenseName} />
                <InfoItem
                  label="วันที่เริ่มมีผล"
                  value={formatThaiDate(licenseValidFrom)}
                />
                <InfoItem
                  label="วันที่หมดอายุ"
                  value={formatThaiDate(licenseValidUntil)}
                />
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-muted-foreground mb-1">
                    สถานะใบอนุญาต
                  </dt>
                  <dd>
                    <Badge
                      variant="outline"
                      className={getLicenseStatusClass(licenseStatus)}
                    >
                      {getLicenseStatusLabel(licenseStatus)}
                    </Badge>
                  </dd>
                </div>
              </dl>
              {canAct ? (
                <MinimumChecklist
                  title="รายการตรวจใบอนุญาต"
                  items={LICENSE_MINIMUM_CHECKLIST}
                  verdictMap={requestChecklistState}
                  onSelect={setRequestChecklistVerdict}
                />
              ) : null}
            </CardContent>
          </Card>

          {memoSummary ? <MemoSummaryCard summary={memoSummary} /> : null}

          {assignmentOrderSummary ? (
            <AssignmentOrderSummaryCard summary={assignmentOrderSummary} />
          ) : null}

          <AttachmentListCard
            title="ไฟล์แนบ"
            count={attachments.length}
            items={attachments}
            className={`scroll-mt-20 shadow-sm transition-all duration-300 ${isSectionComplete(ATTACHMENT_MINIMUM_CHECKLIST) ? "border-emerald-200/60 ring-1 ring-emerald-500/20" : "border-border/60"}`}
            emptyTitle="ยังไม่มีไฟล์แนบในคำขอนี้"
            topContent={
              useAllowanceOcrAfterApproval && allowanceDetailHref ? (
                <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-medium text-foreground">
                    คำขอนี้อนุมัติแล้ว
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    หากต้องการตรวจ OCR เพิ่มเติม ให้ไปที่หน้าผู้มีสิทธิ
                  </p>
                  <Button asChild variant="outline" className="mt-3">
                    <Link href={allowanceDetailHref}>
                      ไปหน้าผู้มีสิทธิ
                    </Link>
                  </Button>
                </div>
              ) : null
            }
            renderItem={(file) => {
              const fileUrl = buildAttachmentUrl(file.file_path);
              const previewable = isPreviewableFile(file.file_name);
              const ocrResult = requestOcrResultMap.get(file.file_name) ?? null;
              const {
                documentLabel: ocrDocumentLabel,
                notice: ocrNotice,
                uiState: ocrUiState,
              } = buildAllowanceAttachmentOcrPolicy({
                fileName: file.file_name,
                result: ocrResult,
                personName: requesterName,
                suppressActions: useAllowanceOcrAfterApproval,
                clearableFileNames: clearableOcrFileNames,
              });
              return (
                <AttachmentListItemCard
                  key={file.attachment_id}
                  fileName={file.file_name}
                  fileTypeLabel={getAttachmentLabel(file.file_name, file.file_type)}
                  badges={
                    ocrDocumentLabel ? (
                      <>
                        <Badge variant="outline" className="text-[11px]">
                          {ocrDocumentLabel}
                        </Badge>
                      </>
                    ) : null
                  }
                  notices={
                    ocrNotice ? (
                      <p className="text-[11px] leading-relaxed text-muted-foreground">{ocrNotice}</p>
                    ) : null
                  }
                  actions={
                    <>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {previewable && (
                          <button
                            onClick={() => handlePreview(fileUrl, file.file_name)}
                            className="text-xs flex items-center hover:text-primary transition-colors hover:underline"
                          >
                            <Eye className="w-3 h-3 mr-1" /> ดูตัวอย่าง
                          </button>
                        )}
                        {canAct && ocrUiState.canRunOcr ? (
                          <button
                            onClick={() => void runRequestAttachmentOcr(file.attachment_id)}
                            disabled={ocrRunningAttachmentId === file.attachment_id}
                            className="text-xs flex items-center hover:text-primary transition-colors hover:underline disabled:opacity-50"
                          >
                            {ocrRunningAttachmentId === file.attachment_id ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                            )}
                            ตรวจด้วย OCR
                          </button>
                        ) : null}
                        {canAct && ocrUiState.canClearOcr ? (
                          <button
                            onClick={() => void clearRequestOcr(file.file_name)}
                            disabled={ocrClearingFileName === file.file_name}
                            className="text-xs flex items-center hover:text-primary transition-colors hover:underline disabled:opacity-50"
                          >
                            {ocrClearingFileName === file.file_name ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3 mr-1" />
                            )}
                            ล้างผล OCR
                          </button>
                        ) : null}
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs flex items-center hover:text-primary transition-colors hover:underline"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" /> เปิดไฟล์
                        </a>
                      </div>
                      {canAct && ocrUiState.shouldShowResetHint ? (
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          ใช้เมื่อต้องการล้างผลที่อ่านเพี้ยน หรือเริ่มตรวจใหม่
                        </p>
                      ) : null}
                    </>
                  }
                />
              );
            }}
            bottomContent={
              canAct ? (
                <MinimumChecklist
                  title="รายการตรวจไฟล์"
                  items={ATTACHMENT_MINIMUM_CHECKLIST}
                  verdictMap={requestChecklistState}
                  onSelect={setRequestChecklistVerdict}
                />
              ) : null
            }
          />
        </div>

        <div className="hidden lg:block space-y-6 lg:col-span-4 sticky top-6">
          {canAct && (
            <Card className="shadow-lg border-primary/20 ring-1 ring-primary/5">
              <CardHeader className="pb-3 bg-muted/20 rounded-t-lg">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>การดำเนินการ</span>
                  {checklistStats.isComplete &&
                    !checklistStats.hasIncorrect && (
                      <CheckCircle2 className="text-emerald-500 w-5 h-5" />
                    )}
                  {checklistStats.hasIncorrect && (
                    <AlertTriangle className="text-rose-500 w-5 h-5" />
                  )}
                </CardTitle>
                <CardDescription>
                  {checklistStats.hasIncorrect
                    ? "พบจุดที่ต้องแก้ไข ควรส่งกลับ"
                    : checklistStats.isComplete
                      ? "ตรวจสอบครบถ้วน พร้อมอนุมัติ"
                      : "กรุณาตรวจสอบให้ครบก่อนดำเนินการ"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-muted-foreground">ความคืบหน้า</span>
                    <span
                      className={
                        checklistStats.isComplete
                          ? "text-emerald-600"
                          : "text-foreground"
                      }
                    >
                      {checklistStats.checkedCount} /{" "}
                      {checklistStats.totalCount} รายการ
                    </span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${checklistStats.hasIncorrect ? "bg-rose-500" : "bg-emerald-500"}`}
                      style={{ width: `${checklistStats.progress}%` }}
                    />
                  </div>
                </div>

                {checklistStats.hasIncorrect && (
                  <div className="rounded-md bg-rose-50 border border-rose-200 p-3 flex gap-2 items-start mt-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-rose-700">
                        พบจุดที่ต้องแก้ไข
                      </p>
                      <ul className="text-[10px] text-rose-600 list-disc list-inside">
                        {checklistStats.incorrectItems.slice(0, 2).map((i) => (
                          <li key={i.key} className="truncate max-w-[200px]">
                            {i.label}
                          </li>
                        ))}
                        {checklistStats.incorrectItems.length > 2 && (
                          <li>
                            และอีก {checklistStats.incorrectItems.length - 2} จุด
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="mb-3 rounded-md border border-border/60 bg-muted/20 p-3 mt-4">
                  <p className="text-xs text-muted-foreground mb-1">
                    บันทึกการตรวจสอบ
                  </p>
                  <p className="text-sm font-medium">
                    {hasVerificationSnapshot
                      ? "บันทึกแล้ว"
                      : "ยังไม่ได้บันทึก"}
                  </p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    {autosaveStatus === "saving"
                      ? "กำลังบันทึกอัตโนมัติ..."
                      : autosaveStatus === "saved" && lastSavedAt
                        ? `บันทึกล่าสุด ${formatThaiDateTime(lastSavedAt)}`
                        : autosaveStatus === "error"
                          ? "บันทึกอัตโนมัติไม่สำเร็จ"
                          : "ระบบจะบันทึกอัตโนมัติเมื่อมีการเปลี่ยนแปลง"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Dialog
                    open={actionDialog === "approve"}
                    onOpenChange={(open) =>
                      openActionDialog(open ? "approve" : null)
                    }
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="success"
                        className="w-full disabled:opacity-50"
                        disabled={!checklistStats.canApprove || isActionBusy}
                      >
                        <Check className="w-4 h-4 mr-2" /> อนุมัติ
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>ยืนยันอนุมัติ</DialogTitle>
                        <DialogDescription>
                          คำขอ {displayId} จะถูกส่งต่อไปยังขั้นตอนถัดไป
                        </DialogDescription>
                      </DialogHeader>
                      <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
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
                          variant="success"
                          onClick={() => handleAction("approve")}
                          disabled={isActionBusy}
                        >
                          {isActionBusy ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                              กำลังบันทึก...
                            </>
                          ) : (
                            "ยืนยัน"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog
                    open={actionDialog === "return"}
                    onOpenChange={(open) =>
                      openActionDialog(open ? "return" : null)
                    }
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant={
                          checklistStats.hasIncorrect ? "default" : "outline"
                        }
                        className={`w-full ${checklistStats.hasIncorrect ? "bg-orange-500 hover:bg-orange-600 text-white border-transparent" : ""}`}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        ส่งกลับแก้ไข
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-orange-600 flex items-center gap-2">
                          <RotateCcw className="w-5 h-5" /> ส่งกลับแก้ไข
                        </DialogTitle>
                        <DialogDescription>ระบุเหตุผลที่ส่งกลับ</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2">
                        <Textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="ระบุเหตุผลที่ส่งกลับ"
                          className="min-h-[120px]"
                        />
                        {checklistStats.hasIncorrect && (
                          <p className="text-xs text-muted-foreground italic">
                            ระบบดึงเหตุผลจากรายการที่เลือก
                            &quot;ไม่ถูกต้อง&quot; มาให้แล้ว
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
                          onClick={() => handleAction("return")}
                          disabled={isActionBusy}
                        >
                          {isActionBusy ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                              กำลังส่ง...
                            </>
                          ) : (
                            "ส่งกลับ"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog
                    open={actionDialog === "reject"}
                    onOpenChange={(open) =>
                      openActionDialog(open ? "reject" : null)
                    }
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="dangerGhost"
                        className="w-full"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        ไม่อนุมัติ
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-rose-600">
                          ยืนยันไม่อนุมัติ
                        </DialogTitle>
                        <DialogDescription>ระบุเหตุผลที่ไม่อนุมัติ</DialogDescription>
                      </DialogHeader>
                      <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="ระบุเหตุผลที่ไม่อนุมัติ"
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
                          onClick={() => handleAction("reject")}
                          disabled={isActionBusy}
                        >
                          {isActionBusy ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                              กำลังส่ง...
                            </>
                          ) : (
                            "ยืนยัน"
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
              <p className="text-sm font-medium text-primary/80 mb-1">
                ยอดเงินเบิกจ่าย
              </p>
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
                  <span className="text-muted-foreground">
                    วันที่ยื่นเรื่อง
                  </span>
                  <span className="text-foreground">
                    {submitAction?.action_date
                      ? formatThaiDate(submitAction.action_date)
                      : "-"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <RequestTimelineCard request={request} />
        </div>
      </div>

      {canAct && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t z-50 lg:hidden flex gap-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          {checklistStats.canApprove ? (
            <Button
              variant="success"
              className="flex-1"
              onClick={() => openActionDialog("approve")}
              disabled={isActionBusy}
            >
              <Check className="w-4 h-4 mr-2" /> อนุมัติ
            </Button>
          ) : (
            <div className="flex-1 flex gap-2">
              <Button
                variant={checklistStats.hasIncorrect ? "default" : "outline"}
                className={`flex-1 ${checklistStats.hasIncorrect ? "bg-orange-500 text-white" : ""}`}
                onClick={() => openActionDialog("return")}
                disabled={isActionBusy}
              >
                <RotateCcw className="w-4 h-4 mr-2" /> ส่งกลับ
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-rose-600"
                onClick={() => openActionDialog("reject")}
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
    </div>
  );
}
