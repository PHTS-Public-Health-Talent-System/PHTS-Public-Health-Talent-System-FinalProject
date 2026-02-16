"use client"
export const dynamic = "force-dynamic"

import { use, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
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
  type LucideIcon,
} from "lucide-react"
import { useEligibilityDetail, useEligibilityPaged, useRequestDetail } from "@/features/request/hooks"
import { AttachmentPreviewDialog } from "@/components/common/attachment-preview-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { resolveProfessionLabel } from "../utils"
import type { RequestWithDetails } from "@/types/request.types"
import { buildAttachmentUrl, isPreviewableFile } from "@/features/request/detail/requestDetail.attachments"
import { ELIGIBILITY_EXPIRING_DAYS } from "@/features/request/constants"
import {
  formatThaiDateTime as formatThaiDateTimeValue,
  formatThaiDate as formatThaiDateValue,
  formatThaiNumber,
} from "@/shared/utils/thai-locale"

// --- Components ---

const InfoItem = ({
  label,
  value,
  icon: Icon,
  className,
  isMono = false,
}: {
  label: string
  value: ReactNode
  icon?: LucideIcon
  className?: string
  isMono?: boolean
}) => (
  <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
    <dt className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
      {Icon && <Icon className="w-3.5 h-3.5 opacity-70" />}
      {label}
    </dt>
    <dd className={`text-sm font-medium text-foreground break-words ${isMono ? "font-mono tracking-tight" : ""}`}>
      {value}
    </dd>
  </div>
)

const SectionHeader = ({ title, icon: Icon }: { title: string; icon: LucideIcon }) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/40">
    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
      <Icon className="w-4 h-4" />
    </div>
    <h3 className="font-semibold text-base text-foreground">{title}</h3>
  </div>
)

// --- Constants & Helpers ---
// ... (คงเดิม ไม่เปลี่ยนแปลง) ...
const PERSONNEL_TYPE_LABELS: Record<string, string> = {
  CIVIL_SERVANT: "ข้าราชการ",
  GOV_EMPLOYEE: "พนักงานราชการ",
  PH_EMPLOYEE: "พนักงานกระทรวงสาธารณสุข",
  TEMP_EMPLOYEE: "ลูกจ้างชั่วคราว",
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  NEW_ENTRY: "ขอรับ พ.ต.ส. ครั้งแรก",
  EDIT_INFO_SAME_RATE: "แก้ไขข้อมูล (อัตราเดิม)",
  EDIT_INFO_NEW_RATE: "แก้ไขข้อมูล (อัตราใหม่)",
}

const getAttachmentLabel = (fileName: string, fileType?: string | null) => {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".pdf")) return "ไฟล์ PDF"
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "ไฟล์รูปภาพ"
  return fileType || "ไฟล์"
}

function formatThaiDate(value?: string | null): string {
  return formatThaiDateValue(value)
}

function formatThaiDateTime(value?: string | null): string {
  return formatThaiDateTimeValue(value)
}

const getLicenseStatusLabel = (status?: string | null) => {
  switch (status) {
    case "ACTIVE": return "มีผลใช้บังคับ"
    case "EXPIRED": return "หมดอายุ"
    case "INACTIVE": return "ไม่อยู่ในสถานะใช้งาน"
    case "UNKNOWN": return "ไม่สามารถระบุสถานะ"
    default: return status ? status : "ไม่พบข้อมูล"
  }
}

const getLicenseStatusClass = (status?: string | null) => {
  switch (status) {
    case "ACTIVE": return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
    case "EXPIRED": return "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50"
    case "INACTIVE": return "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100"
    case "UNKNOWN": return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50"
    default: return "bg-muted text-muted-foreground border-border"
  }
}

function resolveLicenseStatus(expiryDate?: string | null): "active" | "expiring" | "expired" {
  if (!expiryDate) return "active"
  const expiry = new Date(expiryDate)
  if (Number.isNaN(expiry.getTime())) return "active"
  const now = new Date()
  const diffMs = expiry.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return "expired"
  if (diffDays <= ELIGIBILITY_EXPIRING_DAYS) return "expiring"
  return "active"
}

const licenseStatusConfig = {
  active: { label: "สิทธิยังใช้งานได้", color: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50" },
  expiring: { label: "สิทธิใกล้หมดอายุ", color: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50" },
  expired: { label: "สิทธิหมดอายุแล้ว", color: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50" },
}

function parseSubmission(value: RequestWithDetails["submission_data"]) {
  if (!value) return {}
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch { return {} }
  }
  return value
}

function getSubmissionString(submission: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = submission[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return undefined
}

type LicenseStatusFilter = "all" | "active" | "expiring" | "expired"

// --- Main Page Component ---

export default function AllowanceEligibilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const profession = searchParams.get("profession")
  const normalizedProfession = profession ? profession.toUpperCase() : null
  const sp = new URLSearchParams(searchParams.toString())
  sp.delete("profession")
  const backHref = normalizedProfession
    ? `/pts-officer/allowance-list/profession/${normalizedProfession}${sp.toString() ? `?${sp.toString()}` : ""}`
    : "/pts-officer/allowance-list"

  const { data, isLoading } = useEligibilityDetail(id)
  const { data: sourceRequest } = useRequestDetail(data?.request_id ?? undefined)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState("")
  const [previewName, setPreviewName] = useState("")

  const attachments = data?.attachments ?? []
  const license = data?.license ?? null

  const contextProfession = normalizedProfession && normalizedProfession !== "ALL" ? normalizedProfession : "ALL"
  const { data: contextList } = useEligibilityPaged({
    active_only: "1",
    page: 1,
    limit: 50,
    profession_code: contextProfession,
    search: searchParams.get("q") ?? undefined,
    rate_group: searchParams.get("rate_group") ?? "all",
    department: searchParams.get("department") ?? undefined,
    sub_department: searchParams.get("sub_department") ?? undefined,
    license_status: (searchParams.get("license_status") as LicenseStatusFilter) ?? "all",
  })

  const personOptions = useMemo(() => {
    const rows = contextList?.items ?? []
    const options = rows
      .slice()
      .sort((a, b) => (Number(b.eligibility_id ?? 0) - Number(a.eligibility_id ?? 0)))
      .map((row) => {
        const fullName = `${row.title ?? ""}${row.first_name ?? "-"} ${row.last_name ?? ""}`.trim()
        const professionLabel = resolveProfessionLabel(row.profession_code ?? "-")
        return { id: String(row.eligibility_id), label: `${fullName} (${professionLabel})` }
      })

    if (data?.eligibility_id && !options.some((o) => o.id === String(data.eligibility_id))) {
      const fullName = `${data?.title ?? ""}${data?.first_name ?? "-"} ${data?.last_name ?? ""}`.trim()
      const professionLabel = resolveProfessionLabel(data?.profession_code ?? "-")
      options.unshift({ id: String(data.eligibility_id), label: `${fullName} (${professionLabel})` })
    }
    return options
  }, [contextList?.items, data])

  const submission = useMemo(
    () => parseSubmission(sourceRequest?.submission_data) as Record<string, unknown>,
    [sourceRequest?.submission_data],
  )

  const submissionPositionName = getSubmissionString(submission, ["position_name", "positionName"])
  const submissionDepartment = getSubmissionString(submission, ["department"])
  const submissionSubDepartment = getSubmissionString(submission, ["sub_department", "subDepartment"])

  const fullName = `${data?.title ?? ""}${data?.first_name ?? "-"} ${data?.last_name ?? ""}`.trim()
  const professionLabel = resolveProfessionLabel(data?.profession_code ?? "-")
  const groupNo = data?.group_no !== null && data?.group_no !== undefined ? String(data.group_no) : "-"
  const itemNo = data?.item_no !== null && data?.item_no !== undefined ? String(data.item_no) : "-"
  const subItemNo = data?.sub_item_no !== null && data?.sub_item_no !== undefined ? String(data.sub_item_no) : null
  const itemLabel = subItemNo ? `${itemNo}.${subItemNo}` : itemNo
  const rateAmount = Number(data?.rate_amount ?? 0)
  const licenseStatusKey = resolveLicenseStatus(data?.expiry_date ?? null)
  const licenseStatus = licenseStatusConfig[licenseStatusKey]

  const requestTypeLabel = sourceRequest?.request_type
    ? (REQUEST_TYPE_LABELS[sourceRequest.request_type] ?? sourceRequest.request_type)
    : "-"
  const personnelTypeLabel = sourceRequest?.personnel_type
    ? (PERSONNEL_TYPE_LABELS[sourceRequest.personnel_type] ?? sourceRequest.personnel_type)
    : "-"
  // Keep workAttributes for future display; avoid computing unless needed.

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8 space-y-4">
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-xl font-semibold text-foreground">ไม่พบข้อมูลสิทธิ</h2>
        <p className="text-muted-foreground mb-6">รายการนี้อาจไม่มีอยู่ในระบบ</p>
        <Link href={backHref}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            กลับไปหน้าบอร์ด
          </Button>
        </Link>
      </div>
    )
  }

  const handlePreview = (url: string, name: string) => {
    setPreviewUrl(url)
    setPreviewName(name)
    setPreviewOpen(true)
  }

  return (
    <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">

      {/* 1. Navigation & Header */}
      <div className="flex flex-col gap-4">
        <nav className="flex items-center text-sm text-muted-foreground">
          <Link href={backHref} className="hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            รายชื่อผู้มีสิทธิ
          </Link>
          <ChevronRight className="h-4 w-4 mx-1 opacity-50" />
          <span className="text-foreground font-medium">รายละเอียดสิทธิ</span>
        </nav>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
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

          <div className="w-full md:w-[400px]">
            <Select
              value={id}
              onValueChange={(value) => {
                if (value !== id) {
                  const nextUrl = normalizedProfession
                    ? `/pts-officer/allowance-list/${value}?profession=${normalizedProfession}`
                    : `/pts-officer/allowance-list/${value}`
                  router.push(nextUrl)
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
      </div>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Left Column: Details */}
        <div className="space-y-8 lg:col-span-8">
          <Card className="shadow-sm border-border/60">
            <CardContent className="p-6">
              <SectionHeader title="ข้อมูลส่วนบุคคลและตำแหน่งงาน" icon={User} />

              {/* Grouping 1: Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4 mb-6">
                 <InfoItem label="ชื่อ-นามสกุล" value={fullName} icon={User} className="sm:col-span-2" />
                 <InfoItem label="เลขบัตรประชาชน" value={data.citizen_id} isMono />
              </div>

              <div className="col-span-full border-t border-dashed border-border/60 my-6" />

              {/* Grouping 2: Job Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4 mb-6">
                <InfoItem label="ตำแหน่ง" value={submissionPositionName ?? data.position_name ?? "-"} icon={Briefcase} className="sm:col-span-2" />
                <InfoItem label="เลขที่ตำแหน่ง" value={data.position_number ?? "-"} isMono />
                <InfoItem label="หน่วยงาน" value={submissionSubDepartment ?? data.sub_department ?? "-"} icon={Building2} />
                <InfoItem label="กลุ่มงาน" value={submissionDepartment ?? data.department ?? "-"} />
              </div>

              <div className="bg-muted/30 rounded-lg p-4 mt-6">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4">
                    <InfoItem label="อีเมล" value={data.email ?? "-"} icon={Mail} />
                    <InfoItem label="โทรศัพท์" value={data.phone ?? "-"} icon={Phone} isMono />
                 </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
            <CardContent className="p-6">
              <SectionHeader title="รายละเอียดสิทธิและอัตรา" icon={Award} />
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                <InfoItem label="วิชาชีพ" value={professionLabel} />
                <InfoItem label="อัตราที่ได้รับ" value={`กลุ่ม ${groupNo} | ข้อ ${itemLabel}`} />
                <InfoItem label="วันที่เริ่มสิทธิ" value={formatThaiDate(data.effective_date)} icon={Calendar} isMono />
                <InfoItem label="วันหมดอายุสิทธิ" value={formatThaiDate(data.expiry_date ?? null)} icon={Calendar} isMono />
              </dl>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
            <CardContent className="p-6">
              <SectionHeader title="ข้อมูลใบอนุญาตประกอบวิชาชีพ" icon={FileText} />
              {license ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                  <InfoItem label="เลขที่ใบอนุญาต" value={license.license_no ?? "-"} isMono />
                  <InfoItem label="ประเภท/สาขาวิชาชีพ" value={license.license_name ?? "-"} />
                  <InfoItem label="วันที่เริ่มมีผล" value={formatThaiDate(license.valid_from)} icon={Calendar} isMono />
                  <InfoItem label="วันที่หมดอายุ" value={formatThaiDate(license.valid_until)} icon={Calendar} isMono />
                  <div className="sm:col-span-2 mt-2">
                     <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">สถานะ:</span>
                        <Badge variant="outline" className={getLicenseStatusClass(license.status ?? null)}>
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

          <Card className="shadow-sm border-border/60">
            <CardContent className="p-6">
              <SectionHeader title={`ไฟล์แนบจากคำขอต้นทาง (${attachments.length})`} icon={FileText} />
              {data.request_id ? (
                attachments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                    <FileText className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium">ไม่มีไฟล์เอกสารแนบ</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {attachments.map((file) => {
                      const fileUrl = buildAttachmentUrl(file.file_path)
                      const previewable = isPreviewableFile(file.file_name)
                      return (
                        <div
                          key={file.attachment_id}
                          className="group flex flex-col p-3 rounded-lg border border-border bg-card hover:bg-muted/40 hover:border-primary/20 transition-all duration-200"
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <div className="h-10 w-10 shrink-0 rounded bg-primary/10 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate" title={file.file_name}>
                                    {file.file_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {getAttachmentLabel(file.file_name, file.file_type)}
                                </p>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-auto">
                            {previewable && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 h-8 text-xs"
                                    onClick={() => handlePreview(fileUrl, file.file_name)}
                                >
                                    <Eye className="w-3 h-3 mr-1.5" /> ดูตัวอย่าง
                                </Button>
                            )}
                            <Button
                                variant={previewable ? "ghost" : "outline"}
                                size="sm"
                                className={`h-8 text-xs ${!previewable ? "flex-1" : ""}`}
                                asChild
                            >
                                <a href={fileUrl} target="_blank" rel="noreferrer">
                                    <ExternalLink className="w-3 h-3 mr-1.5" /> เปิดไฟล์
                                </a>
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center p-6 bg-muted/20 rounded-lg border border-dashed text-sm text-muted-foreground">
                    รายการนี้ไม่มีคำขอต้นทาง จึงไม่มีไฟล์แนบ
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Sidebar (Sticky) */}
        <div className="space-y-6 lg:col-span-4 sticky top-6">

          {/* UX Improvement: Alerts First */}
          {licenseStatusKey === "expiring" && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <div className="p-2 bg-amber-100 rounded-full h-fit">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-800">สิทธิใกล้หมดอายุ</p>
                    <p className="text-sm text-amber-700/90 mt-1 leading-relaxed">
                      สิทธินี้จะหมดอายุในวันที่ <span className="font-semibold">{formatThaiDate(data.expiry_date ?? null)}</span>
                      <br/>โปรดตรวจสอบหรือดำเนินการต่ออายุ
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-md border-primary/20 bg-primary/5 overflow-hidden">
            <CardHeader className="pb-2">
                <CardDescription className="text-primary/80">อัตราเงินเพิ่มตามสิทธิ</CardDescription>
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
                  <Badge variant="secondary" className="font-normal bg-background/50 hover:bg-background/80 text-foreground border-primary/10">
                    {professionLabel}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">กลุ่ม/ข้อ</span>
                  <span className="font-medium font-mono">{groupNo} / {itemLabel}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* UX Improvement: Context before Technical IDs */}
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-4">
                 <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    ข้อมูลจากคำขอต้นทาง
                 </CardTitle>
            </CardHeader>
            <CardContent>
              {sourceRequest ? (
                <dl className="space-y-4 text-sm">
                  <div className="flex justify-between items-start">
                     <dt className="text-muted-foreground">เลขที่คำขอ</dt>
                     <dd className="font-medium font-mono text-right">{sourceRequest.request_no ?? sourceRequest.request_id}</dd>
                  </div>
                  <div className="flex justify-between items-start">
                     <dt className="text-muted-foreground">สถานะ</dt>
                     <dd className="text-right">
                        <Badge variant="secondary" className="font-normal text-xs">{sourceRequest.status}</Badge>
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
                     <dd className="font-medium">{sourceRequest.main_duty || "-"}</dd>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                     <div className="bg-muted/30 p-2 rounded text-xs">
                        <div className="text-muted-foreground mb-0.5 flex items-center gap-1"><Clock className="w-3 h-3"/> อัปเดตล่าสุด</div>
                        <div className="font-medium">{formatThaiDateTime(sourceRequest.updated_at)}</div>
                     </div>
                     <div className="bg-muted/30 p-2 rounded text-xs">
                        <div className="text-muted-foreground mb-0.5 flex items-center gap-1"><Clock className="w-3 h-3"/> เริ่มขั้นตอน</div>
                        <div className="font-medium">{formatThaiDateTime(sourceRequest.step_started_at)}</div>
                     </div>
                  </div>
                </dl>
              ) : (
                <div className="flex items-center justify-center p-4 bg-muted/20 rounded-lg text-xs text-muted-foreground text-center">
                    ไม่มีข้อมูลคำขอต้นทาง<br/>หรือข้อมูลไม่สามารถเข้าถึงได้
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
             <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                    <Hash className="w-4 h-4 text-muted-foreground" />
                    ข้อมูลอ้างอิง
                </CardTitle>
             </CardHeader>
             <CardContent className="space-y-3 text-sm">
                 <div className="flex justify-between py-1 border-b border-border/40">
                     <span className="text-muted-foreground">รหัสสิทธิ์</span>
                     <span className="font-mono text-xs">{data.eligibility_id}</span>
                 </div>
                 <div className="flex justify-between py-1 border-b border-border/40">
                     <span className="text-muted-foreground">รหัสอัตราหลัก</span>
                     <span className="font-mono text-xs">{data.master_rate_id}</span>
                 </div>
                 <div className="flex justify-between py-1 border-b border-border/40">
                     <span className="text-muted-foreground">รหัสคำขอ</span>
                     <span className="font-mono text-xs">{data.request_id ?? "-"}</span>
                 </div>
                 <div className="flex justify-between py-1">
                     <span className="text-muted-foreground">สร้างเมื่อ</span>
                     <span className="font-mono text-xs">{formatThaiDateTime(data.created_at ?? null)}</span>
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
  )
}
