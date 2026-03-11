import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Sparkles } from 'lucide-react';

import type { AssignmentOrderSummary } from '../utils/requestDetail.assignmentOrder';

const Field = ({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) => (
  <div className="space-y-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p
      className={`text-sm font-medium text-foreground break-words ${
        multiline ? 'whitespace-pre-wrap leading-relaxed' : ''
      }`}
    >
      {value}
    </p>
  </div>
);

export function AssignmentOrderSummaryCard({ summary }: { summary: AssignmentOrderSummary }) {
  return (
    <Card className="shadow-sm border-border/60 overflow-hidden">
      {/* ปรับพื้นหลัง Header ให้แตกต่างจาก Content เพื่อแยกสัดส่วน */}
      <CardHeader className="pb-4 bg-muted/10 border-b border-border/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              คำสั่งมอบหมายงาน
            </CardTitle>
            <CardDescription className="mt-1">ข้อมูลสำคัญที่สกัดได้จากเอกสาร</CardDescription>
          </div>
          {/* ปรับ Badge ให้สื่อความหมายถึงระบบอัตโนมัติมากขึ้น */}
          <Badge
            variant="secondary"
            className="shrink-0 font-normal flex items-center gap-1.5 bg-primary/10 text-primary hover:bg-primary/20"
          >
            <Sparkles className="w-3 h-3" />
            อ่านด้วย OCR
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Group 1: Metadata (ใช้ Grid 2 คอลัมน์เพื่อประหยัดพื้นที่แนวตั้ง) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-4">
          <div className="sm:col-span-2">
            <Field label="ไฟล์ต้นทาง" value={summary.fileName} />
          </div>
          {summary.orderNo && <Field label="เลขที่คำสั่ง" value={summary.orderNo} />}
          {summary.department && <Field label="หน่วยงานในคำสั่ง" value={summary.department} />}
          {summary.signedDate && <Field label="วันที่ลงนามคำสั่ง" value={summary.signedDate} />}
          {summary.effectiveDate && (
            <Field label="วันเริ่มมีผลตามคำสั่ง" value={summary.effectiveDate} />
          )}
          {summary.signerName && <Field label="ผู้ลงนามคำสั่ง" value={summary.signerName} />}
          {summary.signerTitle && <Field label="ตำแหน่งผู้ลงนาม" value={summary.signerTitle} />}
        </div>

        {/* Group 2: Content Details (แยกด้วยเส้นประ) */}
        {(summary.subject || summary.sectionTitle || summary.personLine) && (
          <div className="space-y-5 pt-5 border-t border-dashed border-border/60">
            {summary.subject && <Field label="เรื่อง" value={summary.subject} multiline />}
            {summary.sectionTitle && (
              <Field label="งานที่ได้รับมอบหมาย" value={summary.sectionTitle} multiline />
            )}
            {summary.personLine && (
              <Field label="บรรทัดที่พบชื่อ" value={summary.personLine} multiline />
            )}
          </div>
        )}

        {/* Group 3: Highlights */}
        {summary.dutyHighlights.length > 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">หน้าที่สำคัญ</p>
            <div className="grid gap-2.5">
              {summary.dutyHighlights.map((item, index) => (
                <div
                  key={index}
                  // เพิ่มแถบสีด้านซ้าย (Accent border) เพื่อให้ดูเหมือนการ Highlight ข้อความ
                  className="relative rounded-md border border-border/60 bg-muted/20 p-3.5 pl-4 text-sm text-foreground leading-relaxed overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary/40"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {summary.warnings && summary.warnings.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <p className="font-medium">หมายเหตุความครบถ้วนข้อมูล OCR</p>
            <p>{summary.warnings.join(' / ')}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
