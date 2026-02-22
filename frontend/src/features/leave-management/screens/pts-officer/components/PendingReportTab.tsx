import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { LeaveTable } from '@/features/leave-management/components/table/LeaveTable';
import type { LeaveRecord } from '@/features/leave-management/types/leaveManagement.types';
import { UserCheck } from 'lucide-react';

export function PendingReportTab({
  records,
  onViewDetail,
  onEdit,
  onDelete,
  onRecordReport,
  getLeaveTypeColor,
  formatDateDisplay,
  isLoading,
  isError,
  onRetry,
}: {
  records: LeaveRecord[];
  onViewDetail: (record: LeaveRecord) => void;
  onEdit: (record: LeaveRecord) => void;
  onDelete: (record: LeaveRecord) => void;
  onRecordReport: (record: LeaveRecord) => void;
  getLeaveTypeColor: (type: string) => string;
  formatDateDisplay: (date: string) => string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  return (
    <TabsContent value="pending-report">
      <Card className="border-border shadow-sm">
        <CardHeader className="py-4 px-6 border-b bg-muted/10">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-muted-foreground" />
            รายการรอรายงานตัว
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <LeaveTable
            records={records}
            onViewDetail={onViewDetail}
            onEdit={onEdit}
            onDelete={onDelete}
            onRecordReport={onRecordReport}
            getLeaveTypeColor={getLeaveTypeColor}
            formatDateDisplay={formatDateDisplay}
            showReportButton
            isLoading={isLoading}
            isError={isError}
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    </TabsContent>
  );
}
