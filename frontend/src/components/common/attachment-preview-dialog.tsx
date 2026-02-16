"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ExternalLink, FileText, Image as ImageIcon, FileQuestion, Download } from "lucide-react"
import Image from "next/image"

interface AttachmentPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  previewUrl: string
  previewName: string
}

const isPdfFile = (url: string, name: string) => {
  const lowerUrl = url.toLowerCase()
  const lowerName = name.toLowerCase()
  return (
    lowerUrl.endsWith(".pdf") ||
    lowerName.endsWith(".pdf") ||
    lowerUrl.startsWith("data:application/pdf")
  )
}

const isImageFile = (url: string, name: string) => {
  const lowerUrl = url.toLowerCase()
  const lowerName = name.toLowerCase()
  return (
    lowerUrl.startsWith("data:image") ||
    [".png", ".jpg", ".jpeg", ".gif", ".webp"].some((ext) =>
      lowerUrl.endsWith(ext) || lowerName.endsWith(ext),
    )
  )
}

export function AttachmentPreviewDialog({
  open,
  onOpenChange,
  previewUrl,
  previewName,
}: AttachmentPreviewDialogProps) {
  if (!previewUrl) return null

  const isPdf = isPdfFile(previewUrl, previewName)
  const isImage = isImageFile(previewUrl, previewName)

  // Determine Icon based on type
  const FileIcon = isPdf ? FileText : isImage ? ImageIcon : FileQuestion

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0 flex flex-col overflow-hidden border-border shadow-2xl">

        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-background shrink-0 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
            <div className="p-2 bg-primary/10 rounded-md text-primary">
                <FileIcon className="h-5 w-5" />
            </div>
            <span className="truncate max-w-[300px] sm:max-w-md" title={previewName}>
                {previewName || "ตัวอย่างไฟล์"}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-slate-50/50 relative flex items-center justify-center p-4 w-full">
          {isPdf && (
            <iframe
              title={previewName}
              src={previewUrl}
              className="w-full h-full rounded-lg border bg-white shadow-sm"
            />
          )}

          {isImage && (
            <div className="relative w-full h-full flex items-center justify-center">
              <Image
                src={previewUrl}
                alt={previewName}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          )}

          {!isPdf && !isImage && (
            <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="p-4 bg-muted rounded-full">
                <FileQuestion className="h-10 w-10 opacity-50" />
              </div>
              <p>ไม่สามารถแสดงตัวอย่างไฟล์ประเภทนี้ได้</p>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <a href={previewUrl} download={previewName}>
                    <Download className="mr-2 h-4 w-4" /> ดาวน์โหลดไฟล์
                </a>
              </Button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t bg-background shrink-0 flex justify-between items-center gap-2">
          <div className="text-xs text-muted-foreground hidden sm:block">
             {isPdf ? "เอกสาร PDF" : isImage ? "ไฟล์รูปภาพ" : "ไฟล์ที่ไม่ทราบประเภท"}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button asChild variant="default" size="sm" className="w-full sm:w-auto">
                <a href={previewUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                เปิดไฟล์ต้นฉบับ
                </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                ปิด
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  )
}
