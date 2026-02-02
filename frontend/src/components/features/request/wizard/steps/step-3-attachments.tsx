"use client"
import { CloudUpload, FileText, X, AlertCircle, Lightbulb } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

import { Attachment, RequestFormData } from "@/types/request.types"

interface Step3Props {
  data: RequestFormData
  onUpload: (type: keyof RequestFormData['files'], file: File) => void
  onRemove: (type: keyof RequestFormData['files']) => void
}

type FileType = keyof RequestFormData['files']

interface UploadZoneProps {
  type: FileType
  title: string
  desc: string
  file: File | null
  existing?: Attachment
  onUpload: (type: FileType, file: File) => void
  onRemove: (type: FileType) => void
}

function UploadZone({ type, title, desc, file, existing, onUpload, onRemove }: UploadZoneProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(type, e.target.files[0])
    }
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"
  const existingUrl = existing ? `${apiBase}/${existing.file_path}` : ""

  return (
    <div className="space-y-2">
      <Label className="font-semibold text-base">{title}</Label>
      <p className="text-sm text-muted-foreground mb-2">{desc}</p>

      {existing && !file && (
        <Card className="border-muted/50 bg-muted/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 bg-white rounded-md border">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="grid gap-1">
                <p className="text-sm font-medium truncate max-w-[200px]">{existing.file_name}</p>
                {existing.ocr_status && (
                  <p className="text-xs text-muted-foreground">สถานะ OCR: {existing.ocr_status}</p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={existingUrl} target="_blank" rel="noopener noreferrer">
                ดาวน์โหลด
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {!file ? (
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 hover:bg-muted/30 transition-colors text-center cursor-pointer relative group">
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 bg-primary/10 rounded-full group-hover:scale-110 transition-transform">
              <CloudUpload className="h-6 w-6 text-primary" />
            </div>
            <div className="text-sm font-medium">
              คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
            </div>
            <div className="text-xs text-muted-foreground">
              รองรับ PDF, JPG, PNG (ไม่เกิน 5MB)
            </div>
          </div>
        </div>
      ) : (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 bg-white rounded-md border">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="grid gap-1">
                <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onRemove(type)} className="text-muted-foreground hover:text-destructive">
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function Step3Attachments({ data, onUpload, onRemove }: Step3Props) {
  const getExisting = (type: FileType) =>
    data.attachments?.find((att) => att.file_type === type)
  const existingLicense = getExisting("LICENSE")

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1">
        <h3 className="text-lg font-medium text-primary">แนบเอกสารประกอบ</h3>
        <p className="text-sm text-muted-foreground">
          กรุณาแนบเอกสารเพื่อใช้ในการตรวจสอบสิทธิและคำนวณเงิน (ระบบจะทำการอ่านข้อมูลอัตโนมัติ)
        </p>
      </div>

      <Alert className="bg-blue-50 border-blue-100 text-blue-800">
        <AlertCircle className="h-4 w-4 text-blue-800" />
        <AlertDescription className="flex items-center gap-2">
           <Lightbulb className="h-4 w-4 text-amber-500" />
           <span><strong>คำแนะนำ:</strong> กรุณาใช้ไฟล์ภาพหรือ PDF ที่ชัดเจน เพื่อความแม่นยำในการตรวจสอบข้อมูล</span>
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        <UploadZone
          type="LICENSE"
          title="1. ใบประกอบวิชาชีพ (License)"
          desc="จำเป็นต้องใช้เพื่อตรวจสอบวันหมดอายุและเลขที่ใบอนุญาต"
          file={data.files.LICENSE}
          existing={existingLicense}
          onUpload={onUpload}
          onRemove={onRemove}
        />
        {!data.files.LICENSE && !existingLicense && (
          <Alert className="bg-amber-50 border-amber-200 text-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-800" />
            <AlertDescription>
              ต้องแนบใบประกอบวิชาชีพก่อนดำเนินการขั้นถัดไป
            </AlertDescription>
          </Alert>
        )}
        <UploadZone
          type="ORDER"
          title="2. คำสั่งมอบหมายงาน (Order)"
          desc="คำสั่งแต่งตั้งหรือมอบหมายหน้าที่การงานในเดือนปัจจุบัน"
          file={data.files.ORDER}
          existing={getExisting("ORDER")}
          onUpload={onUpload}
          onRemove={onRemove}
        />
        <UploadZone
          type="OTHER"
          title="3. วุฒิบัตร / เอกสารอื่นๆ (Other)"
          desc="เช่น ประกาศนียบัตรการอบรมเฉพาะทาง (ถ้ามี)"
          file={data.files.OTHER}
          existing={getExisting("OTHER")}
          onUpload={onUpload}
          onRemove={onRemove}
        />
      </div>
    </div>
  )
}
