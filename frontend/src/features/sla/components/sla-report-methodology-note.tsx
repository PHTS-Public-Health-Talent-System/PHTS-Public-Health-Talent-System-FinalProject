import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function SlaReportMethodologyNote() {
  return (
    <Card className="border-dashed border-border/80 bg-muted/20">
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">
              ที่มาของข้อมูล / สูตรคำนวณ / เกณฑ์ประเมิน
            </p>
            <p className="text-xs text-muted-foreground">
              สูตรหลัก: อัตราปิดงานตรงเวลา = (จำนวนที่ปิดภายใน SLA /
              จำนวนที่ปิดทั้งหมด) x 100, มัธยฐาน/P90 = ค่ากลางและเปอร์เซ็นไทล์ 90
              ของระยะเวลาดำเนินการ (วันทำการ)
            </p>
            <p className="text-xs text-muted-foreground">
              เกณฑ์ประเมินภาพรวม: A+ &gt;= 95%, A &gt;= 85%, B &gt;= 75%, C
              &gt;= 60%, ต่ำกว่า 60% = ต้องปรับปรุง
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
