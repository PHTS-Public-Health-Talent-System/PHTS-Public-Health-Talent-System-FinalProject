"use client"
import { CloudUpload, FileText, Lightbulb, Trash2, Eye } from "lucide-react"
import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

import { RequestFormData } from "@/types/request.types"

interface Step3Props {
  data: RequestFormData
  onUpload: (file: File) => void
  onRemove: (index: number) => void
}

export function Step3Attachments({ data, onUpload, onRemove }: Step3Props) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState("")
  const [previewName, setPreviewName] = useState("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Add all selected files
      Array.from(e.target.files).forEach((file) => {
        onUpload(file)
      })
      // Reset input
      e.target.value = ""
    }
  }

  const handlePreview = (url: string, name: string) => {
    setPreviewUrl(url)
    setPreviewName(name)
    setPreviewOpen(true)
  }

  const isImage = (name: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name)
  const isPdf = (name: string) => /\.pdf$/i.test(name)

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1">
        <h3 className="text-lg font-medium text-primary">แนบเอกสารประกอบ</h3>
        <p className="text-sm text-muted-foreground">
          กรุณาแนบเอกสารที่เกี่ยวข้อง เช่น ใบประกอบวิชาชีพ, คำสั่งแต่งตั้ง, หรือหลักฐานอื่นๆ
        </p>
      </div>

      <Alert className="bg-blue-50 border-blue-100 text-blue-800">
        <Lightbulb className="h-4 w-4 text-blue-600" />
        <AlertDescription>
           สามารถแนบไฟล์ได้หลายไฟล์ (รองรับ PDF, JPG, PNG ขนาดไม่เกิน 5MB)
        </AlertDescription>
      </Alert>

      {/* Upload Area */}
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 hover:bg-slate-50 transition-colors text-center cursor-pointer relative group bg-white">
        <input
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          multiple
        />
        <div className="flex flex-col items-center justify-center gap-3">
           <div className="p-4 bg-primary/10 rounded-full group-hover:scale-110 transition-transform text-primary">
             <CloudUpload className="h-8 w-8" />
           </div>
           <div>
             <div className="text-base font-semibold text-slate-700">
               คลิกเพื่อเลือกไฟล์
             </div>
             <div className="text-sm text-muted-foreground mt-1">
               หรือลากไฟล์มาวางที่นี่
             </div>
           </div>
        </div>
      </div>

      {/* File Lists */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* New Uploads */}
        {data.files.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm text-muted-foreground">ไฟล์ที่เลือก ({data.files.length})</Label>
              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-2">
                  {data.files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-white rounded border shrink-0">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-[10px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                         <Button variant="ghost" size="icon" onClick={() => handlePreview(URL.createObjectURL(file), file.name)} className="h-8 w-8 text-slate-500 hover:text-primary">
                            <Eye className="h-4 w-4" />
                         </Button>
                         <Button variant="ghost" size="icon" onClick={() => onRemove(idx)} className="h-8 w-8 text-slate-500 hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                         </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Existing Attachments (Server) */}
        {data.attachments && data.attachments.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm text-muted-foreground">ไฟล์เดิมในระบบ ({data.attachments.length})</Label>
              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-2">
                  {data.attachments.map((att) => (
                    <div key={att.attachment_id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50/50">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-white rounded border shrink-0">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{att.file_name}</p>
                          <p className="text-[10px] text-muted-foreground">{att.file_type}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handlePreview(`${apiBase}/${att.file_path}`, att.file_name)} className="h-8 w-8 text-slate-500 hover:text-primary">
                         <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewName}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh] flex justify-center bg-slate-100 rounded-lg p-4">
            {isImage(previewName) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={previewName} className="max-w-full h-auto object-contain" />
            )}
            {isPdf(previewName) && (
              <iframe src={previewUrl} className="w-full h-[70vh]" title={previewName} />
            )}
            {!isImage(previewName) && !isPdf(previewName) && (
               <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-2" />
                  <p>ไม่สามารถแสดงตัวอย่างไฟล์นี้ได้</p>
               </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

