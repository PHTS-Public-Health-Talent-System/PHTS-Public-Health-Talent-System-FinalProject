'use client';
import { CloudUpload, FileText, Lightbulb, Eye, X } from 'lucide-react';
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AttachmentPreviewDialog } from '@/components/common';
import { AttachmentList } from '@/components/common';
import { toast } from 'sonner';

import { RequestFormData } from '@/types/request.types';

interface Step3Props {
  data: RequestFormData;
  onUpload: (file: File) => void;
  onRemove: (index: number) => void;
  showExistingAttachments?: boolean;
}

export function Step3Attachments({
  data,
  onUpload,
  onRemove,
  showExistingAttachments = false,
}: Step3Props) {
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const oversizedFiles: string[] = [];
      Array.from(e.target.files).forEach((file) => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          oversizedFiles.push(file.name);
          return;
        }
        onUpload(file);
      });
      if (oversizedFiles.length > 0) {
        const previewNames = oversizedFiles.slice(0, 2).join(', ');
        const suffix = oversizedFiles.length > 2 ? ` และอีก ${oversizedFiles.length - 2} ไฟล์` : '';
        toast.error(`ไฟล์เกินขนาด 5MB: ${previewNames}${suffix}`);
      }
      e.target.value = '';
    }
  };

  const handlePreview = (url: string, name: string) => {
    setPreviewUrl(url);
    setPreviewName(name);
    setPreviewOpen(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-primary">แนบเอกสารประกอบ</h3>
        <p className="text-muted-foreground">
          กรุณาแนบเอกสารที่เกี่ยวข้อง เช่น ใบประกอบวิชาชีพ, คำสั่งแต่งตั้ง หรือหลักฐานอื่นๆ
        </p>
      </div>

      <Alert className="bg-blue-50 border-blue-100 text-blue-800">
        <Lightbulb className="h-4 w-4 text-blue-600" />
        <AlertDescription>
          สามารถแนบไฟล์ได้หลายไฟล์ (รองรับ PDF, JPG, PNG ขนาดไม่เกิน 5MB)
        </AlertDescription>
      </Alert>

      {/* Upload Area */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-blue-300/30 rounded-2xl blur opacity-30 group-hover:opacity-75 transition duration-500"></div>
        <div className="relative border-2 border-dashed border-primary/20 bg-background hover:bg-secondary/20 transition-all rounded-xl p-10 text-center cursor-pointer">
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            multiple
          />
          <div className="flex flex-col items-center justify-center gap-4 pointer-events-none">
            <div className="p-4 bg-primary/10 rounded-full text-primary group-hover:scale-110 transition-transform duration-300">
              <CloudUpload className="h-10 w-10" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                คลิกเพื่อเลือกไฟล์
              </p>
              <p className="text-sm text-muted-foreground mt-1">หรือลากไฟล์มาวางที่นี่</p>
            </div>
          </div>
        </div>
      </div>

      {/* File Lists */}
      <div className="space-y-6">
        {/* New Uploads */}
        {data.files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">ไฟล์ที่เลือก ({data.files.length})</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.files.map((file, idx) => (
                <div
                  key={idx}
                  className="relative flex items-start gap-3 p-3 rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow group"
                >
                  <div className="p-2.5 bg-primary/10 rounded-md shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate pr-6">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => handlePreview(URL.createObjectURL(file), file.name)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> ดูตัวอย่าง
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(idx)}
                    className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing Attachments (Server) */}
        {showExistingAttachments && data.attachments && data.attachments.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-dashed">
            <Label className="text-base font-medium text-muted-foreground">
              ไฟล์เดิมในระบบ ({data.attachments.length})
            </Label>
            <div className="opacity-80">
              <AttachmentList
                items={data.attachments.map((att) => ({
                  id: att.attachment_id,
                  name: att.file_name,
                  type: att.file_type,
                  path: att.file_path,
                }))}
                onPreview={handlePreview}
              />
            </div>
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <AttachmentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        previewUrl={previewUrl}
        previewName={previewName}
      />
    </div>
  );
}
