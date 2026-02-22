import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';
import { AttachmentPreviewDialog } from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle, Edit } from 'lucide-react';
import type { LeaveReturnReportEvent } from '@/features/leave-management/api';
import { LeaveDetailContent } from '@/features/leave-management/components/detail/LeaveDetailContent';
import {
  AddLeaveForm,
  EditLeaveForm,
  RecordReportForm,
} from '@/features/leave-management/components/forms/LeaveForms';
import type { LeaveRecord, LeaveRecordDocument } from '@/features/leave-management/types/leaveManagement.types';

export function LeaveManagementDialogs({
  showAddDialog,
  onShowAddDialogChange,
  showEditDialog,
  onShowEditDialogChange,
  showDetailDialog,
  onShowDetailDialogChange,
  showReportDialog,
  onShowReportDialogChange,
  showDeleteAlert,
  onShowDeleteAlertChange,
  showSuccessDialog,
  onShowSuccessDialogChange,
  successMessage,
  selectedLeave,
  editingReturnEventId,
  personnel,
  documents,
  returnReportEvents,
  previewOpen,
  previewUrl,
  previewName,
  onPreviewOpenChange,
  onAddLeave,
  onEditLeave,
  onRecordReport,
  onDeleteLeave,
  onEditReturnEvent,
  onDeleteReturnEvent,
  onDeleteDocument,
  onOpenPreview,
  onOpenEditFromDetail,
  onCloseReportDialog,
  getLeaveTypeColor,
  formatDateDisplay,
}: {
  showAddDialog: boolean;
  onShowAddDialogChange: (open: boolean) => void;
  showEditDialog: boolean;
  onShowEditDialogChange: (open: boolean) => void;
  showDetailDialog: boolean;
  onShowDetailDialogChange: (open: boolean) => void;
  showReportDialog: boolean;
  onShowReportDialogChange: (open: boolean) => void;
  showDeleteAlert: boolean;
  onShowDeleteAlertChange: (open: boolean) => void;
  showSuccessDialog: boolean;
  onShowSuccessDialogChange: (open: boolean) => void;
  successMessage: string;
  selectedLeave: LeaveRecord | null;
  editingReturnEventId: number | null;
  personnel: Array<{ id: string; name: string; position: string; department: string }>;
  documents: LeaveRecordDocument[];
  returnReportEvents: LeaveReturnReportEvent[];
  previewOpen: boolean;
  previewUrl: string;
  previewName: string;
  onPreviewOpenChange: (open: boolean) => void;
  onAddLeave: (payload: Partial<LeaveRecord> & { leaveRecordId?: number; files?: File[] }) => Promise<void>;
  onEditLeave: (payload: LeaveRecord & { files?: File[] }) => Promise<void>;
  onRecordReport: (payload: {
    reportDate: string;
    resumeDate?: string;
    note: string;
    resumeStudyProgram?: string;
  }) => Promise<void>;
  onDeleteLeave: () => Promise<void>;
  onEditReturnEvent: (eventId: number) => void;
  onDeleteReturnEvent: (eventId?: number) => void;
  onDeleteDocument: (documentId: number) => Promise<void>;
  onOpenPreview: (url: string, name: string) => void;
  onOpenEditFromDetail: () => void;
  onCloseReportDialog: () => void;
  getLeaveTypeColor: (type: string) => string;
  formatDateDisplay: (date: string) => string;
}) {
  return (
    <>
      <Dialog open={showAddDialog} onOpenChange={onShowAddDialogChange}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>เพิ่มรายการวันลา</DialogTitle>
            <DialogDescription>เพิ่มรายการวันลาตามเอกสารทางราชการ</DialogDescription>
          </DialogHeader>
          <AddLeaveForm
            onClose={() => onShowAddDialogChange(false)}
            onSave={onAddLeave}
            personnel={personnel}
            onPreview={onOpenPreview}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={onShowEditDialogChange}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขรายการวันลา</DialogTitle>
            <DialogDescription>แก้ไขข้อมูลวันลาของ {selectedLeave?.personName}</DialogDescription>
          </DialogHeader>
          {selectedLeave && (
            <EditLeaveForm
              leave={selectedLeave}
              onClose={() => onShowEditDialogChange(false)}
              onSave={onEditLeave}
              onPreview={onOpenPreview}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailDialog} onOpenChange={onShowDetailDialogChange}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>รายละเอียดการลา</DialogTitle>
            <DialogDescription>ข้อมูลการลาของ {selectedLeave?.personName}</DialogDescription>
          </DialogHeader>
          {selectedLeave && (
            <LeaveDetailContent
              leave={selectedLeave}
              getLeaveTypeColor={getLeaveTypeColor}
              formatDateDisplay={formatDateDisplay}
              documents={documents}
              returnReportEvents={returnReportEvents}
              onEditReturnReportEvent={(event) => onEditReturnEvent(Number(event.event_id ?? 0))}
              onDeleteReturnReportEvent={(event) => onDeleteReturnEvent(event.event_id)}
              onPreview={onOpenPreview}
              onDeleteDocument={onDeleteDocument}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onShowDetailDialogChange(false)}>
              ปิด
            </Button>
            <Button variant="outline" onClick={onOpenEditFromDetail}>
              <Edit className="mr-2 h-4 w-4" /> แก้ไข
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showReportDialog}
        onOpenChange={(open) => {
          onShowReportDialogChange(open);
          if (!open) onCloseReportDialog();
        }}
      >
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {editingReturnEventId !== null ? 'แก้ไขการรายงานตัว' : 'บันทึกการรายงานตัว'}
            </DialogTitle>
            <DialogDescription>
              {selectedLeave?.personName} กลับมารายงานตัวหลังจากลา
            </DialogDescription>
          </DialogHeader>
          <RecordReportForm
            key={`${selectedLeave?.id ?? 'none'}:${editingReturnEventId ?? 'new'}`}
            leave={selectedLeave}
            initialEvent={
              returnReportEvents.find(
                (event) => Number(event.event_id ?? -1) === Number(editingReturnEventId ?? -2),
              ) ?? null
            }
            onClose={onCloseReportDialog}
            onSave={onRecordReport}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteAlert} onOpenChange={onShowDeleteAlertChange}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription>
              คุณต้องการลบรายการวันลาของ {selectedLeave?.personName} หรือไม่?
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void onDeleteLeave()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showSuccessDialog} onOpenChange={onShowSuccessDialogChange}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-4">
            <div className="p-3 rounded-full bg-emerald-500/10 mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <DialogTitle className="text-center mb-2">สำเร็จ</DialogTitle>
            <p className="text-muted-foreground text-center">{successMessage}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => onShowSuccessDialogChange(false)} className="w-full">
              ตกลง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AttachmentPreviewDialog
        open={previewOpen}
        onOpenChange={onPreviewOpenChange}
        previewUrl={previewUrl}
        previewName={previewName}
      />
    </>
  );
}
