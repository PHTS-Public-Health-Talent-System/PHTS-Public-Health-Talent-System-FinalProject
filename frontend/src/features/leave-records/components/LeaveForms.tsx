'use client';

import { useId, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PersonPicker } from '@/components/person-picker';
import { CalendarCheck, Eye, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { LeaveRecord } from '@/features/leave-records/components/leaveRecords.types';
import { leaveTypes } from '@/features/leave-records/components/leaveTypes';
import {
  isValidDateRange,
  validateOptionalDateRange,
} from '@/features/leave-records/utils/dateRange';

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const months = [
    'ม.ค.',
    'ก.พ.',
    'มี.ค.',
    'เม.ย.',
    'พ.ค.',
    'มิ.ย.',
    'ก.ค.',
    'ส.ค.',
    'ก.ย.',
    'ต.ค.',
    'พ.ย.',
    'ธ.ค.',
  ];
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const day = parseInt(parts[2]);
  const month = months[parseInt(parts[1]) - 1];
  const year = parseInt(parts[0]);
  if (Number.isNaN(year)) return dateStr;
  return `${day} ${month} ${year + 543}`;
}

function DateInputField({
  label,
  value,
  onChange,
  name,
  disabled,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  name: string;
  disabled?: boolean;
  min?: string;
  max?: string;
}) {
  const inputId = useId();
  const normalizedValue = value ? value.split('T')[0].split(' ')[0] : '';
  const normalizedMin = min ? min.split('T')[0].split(' ')[0] : undefined;
  const normalizedMax = max ? max.split('T')[0].split(' ')[0] : undefined;
  const displayValue = normalizedValue ? formatDateDisplay(normalizedValue) : '';
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        name={name}
        type="date"
        value={normalizedValue}
        min={normalizedMin}
        max={normalizedMax}
        onChange={(e) => onChange(e.target.value)}
        className="bg-secondary border-border"
        autoComplete="off"
        disabled={disabled}
      />
      {displayValue && <p className="text-xs text-muted-foreground">แสดงผล: {displayValue}</p>}
    </div>
  );
}

export function AddLeaveForm({
  onClose,
  onSave,
  personnel,
  onPreview,
}: {
  onClose: () => void;
  onSave: (leave: Partial<LeaveRecord> & { leaveRecordId?: number; files?: File[] }) => void;
  personnel: { id: string; name: string; position: string; department: string }[];
  onPreview: (url: string, name: string) => void;
}) {
  const [selectedPerson, setSelectedPerson] = useState('');
  const [leaveType, setLeaveType] = useState('');
  const [userStartDate, setUserStartDate] = useState('');
  const [userEndDate, setUserEndDate] = useState('');
  const [documentStartDate, setDocumentStartDate] = useState('');
  const [documentEndDate, setDocumentEndDate] = useState('');
  const [requireReport, setRequireReport] = useState(false);
  const [institution, setInstitution] = useState('');
  const [program, setProgram] = useState('');
  const [field, setField] = useState('');
  const [studyStartDate, setStudyStartDate] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const person = personnel.find((p) => p.id === selectedPerson);

  const calculateDays = () => {
    if (!userStartDate || !userEndDate) return 1;
    const start = new Date(userStartDate);
    const end = new Date(userEndDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const nextFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...nextFiles]);
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = () => {
    if (!selectedPerson || !leaveType || !userStartDate || !userEndDate) return;

    if (!isValidDateRange(userStartDate, userEndDate)) {
      toast.error('วันที่สิ้นสุด (ตาม ผู้ใช้งาน) ต้องไม่ก่อนวันที่เริ่ม');
      return;
    }

    const docError = validateOptionalDateRange(documentStartDate, documentEndDate, 'ตามเอกสาร');
    if (docError) {
      toast.error(docError);
      return;
    }

    const newLeave: Partial<LeaveRecord> = {
      personId: selectedPerson,
      personName: person?.name || '',
      personPosition: person?.position || '',
      personDepartment: person?.department || '',
      type: leaveType,
      userStartDate,
      userEndDate,
      documentStartDate: documentStartDate || undefined,
      documentEndDate: documentEndDate || undefined,
      days: calculateDays(),
      requireReport,
      note: note || undefined,
      studyInfo:
        leaveType === 'education'
          ? {
              institution,
              program,
              field,
              startDate: studyStartDate,
            }
          : undefined,
    };

    onSave({ ...newLeave, files });
  };

  const userDateRangeValid =
    Boolean(userStartDate) && Boolean(userEndDate)
      ? isValidDateRange(userStartDate, userEndDate)
      : true;
  const docDateRangeError = validateOptionalDateRange(
    documentStartDate,
    documentEndDate,
    'ตามเอกสาร',
  );
  const docDateRangeValid = !docDateRangeError;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>เลือกบุคลากร</Label>
        <PersonPicker
          persons={personnel.map((p) => ({
            id: p.id,
            name: p.name,
            position: p.position,
            department: p.department,
          }))}
          value={selectedPerson}
          onChange={setSelectedPerson}
          placeholder="ค้นหาและเลือกบุคลากร..."
        />
      </div>

      <div className="space-y-2">
        <Label>ประเภทการลา</Label>
        <Select
          value={leaveType}
          onValueChange={(value) => {
            setLeaveType(value);
            setRequireReport(['education', 'ordain', 'military'].includes(value));
          }}
        >
          <SelectTrigger className="bg-secondary border-border">
            <SelectValue placeholder="เลือกประเภท" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {leaveTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DateInputField
          label="วันที่เริ่ม (ตาม ผู้ใช้งาน)"
          value={userStartDate}
          onChange={setUserStartDate}
          name="user_start_date"
          max={userEndDate || undefined}
        />
        <DateInputField
          label="วันที่สิ้นสุด (ตาม ผู้ใช้งาน)"
          value={userEndDate}
          onChange={setUserEndDate}
          name="user_end_date"
          min={userStartDate || undefined}
        />
      </div>
      {!userDateRangeValid && userStartDate && userEndDate && (
        <p className="text-sm text-destructive">
          วันที่สิ้นสุด (ตาม ผู้ใช้งาน) ต้องไม่ก่อนวันที่เริ่ม
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <DateInputField
          label="วันที่เริ่ม (ตามเอกสาร)"
          value={documentStartDate}
          onChange={setDocumentStartDate}
          name="document_start_date"
          max={documentEndDate || undefined}
        />
        <DateInputField
          label="วันที่สิ้นสุด (ตามเอกสาร)"
          value={documentEndDate}
          onChange={setDocumentEndDate}
          name="document_end_date"
          min={documentStartDate || undefined}
        />
      </div>
      {!docDateRangeValid && docDateRangeError && (
        <p className="text-sm text-destructive">{docDateRangeError}</p>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="requireReport"
          checked={requireReport}
          onCheckedChange={(checked) => setRequireReport(checked === true)}
        />
        <Label htmlFor="requireReport">ต้องรายงานตัวหลังกลับ</Label>
      </div>

      {leaveType === 'education' && (
        <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30 space-y-4">
          <p className="text-sm font-medium text-purple-400">ข้อมูลการลาศึกษา/อบรม</p>
          <div className="space-y-2">
            <Label>สถานศึกษา</Label>
            <Input
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="bg-secondary border-border"
              placeholder="ระบุสถานศึกษา"
            />
          </div>
          <div className="space-y-2">
            <Label>หลักสูตร</Label>
            <Input
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              className="bg-secondary border-border"
              placeholder="ระบุหลักสูตร"
            />
          </div>
          <div className="space-y-2">
            <Label>สาขาวิชา</Label>
            <Input
              value={field}
              onChange={(e) => setField(e.target.value)}
              className="bg-secondary border-border"
              placeholder="ระบุสาขาวิชา"
            />
          </div>
          <div className="space-y-2">
            <DateInputField
              label="วันที่เริ่มศึกษา"
              value={studyStartDate}
              onChange={setStudyStartDate}
              name="study_start_date"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>เอกสารแนบ (ไม่บังคับ)</Label>
        <Input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          className="bg-secondary border-border"
        />
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onPreview(URL.createObjectURL(file), file.name)}
                    className="h-8 w-8 text-slate-500 hover:text-primary"
                    aria-label="ดูไฟล์แนบ"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveFile(idx)}
                    className="h-8 w-8 text-slate-500 hover:text-destructive"
                    aria-label="ลบไฟล์แนบ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>หมายเหตุ</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ระบุหมายเหตุ (ถ้ามี)"
          className="bg-secondary border-border"
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={
            !selectedPerson ||
            !leaveType ||
            !userStartDate ||
            !userEndDate ||
            !userDateRangeValid ||
            !docDateRangeValid
          }
        >
          <Save className="mr-2 h-4 w-4" />
          บันทึก
        </Button>
      </DialogFooter>
    </div>
  );
}

export function EditLeaveForm({
  leave,
  onClose,
  onSave,
  onPreview,
}: {
  leave: LeaveRecord;
  onClose: () => void;
  onSave: (leave: LeaveRecord & { files?: File[] }) => void;
  onPreview: (url: string, name: string) => void;
}) {
  const [leaveType, setLeaveType] = useState(leave.type);
  const [userStartDate, setUserStartDate] = useState(leave.userStartDate);
  const [userEndDate, setUserEndDate] = useState(leave.userEndDate);
  const [documentStartDate, setDocumentStartDate] = useState(leave.documentStartDate || '');
  const [documentEndDate, setDocumentEndDate] = useState(leave.documentEndDate || '');
  const [requireReport, setRequireReport] = useState(leave.requireReport);
  const [institution, setInstitution] = useState(leave.studyInfo?.institution || '');
  const [program, setProgram] = useState(leave.studyInfo?.program || '');
  const [field, setField] = useState(leave.studyInfo?.field || '');
  const [studyStartDate, setStudyStartDate] = useState(leave.studyInfo?.startDate || '');
  const [note, setNote] = useState(leave.note || '');
  const [files, setFiles] = useState<File[]>([]);

  const calculateDays = () => {
    if (!userStartDate || !userEndDate) return 1;
    const start = new Date(userStartDate);
    const end = new Date(userEndDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const nextFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...nextFiles]);
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = () => {
    if (!isValidDateRange(userStartDate, userEndDate)) {
      toast.error('วันที่สิ้นสุด (ตาม ผู้ใช้งาน) ต้องไม่ก่อนวันที่เริ่ม');
      return;
    }

    const docError = validateOptionalDateRange(documentStartDate, documentEndDate, 'ตามเอกสาร');
    if (docError) {
      toast.error(docError);
      return;
    }

    const updatedLeave: LeaveRecord = {
      ...leave,
      type: leave.type,
      typeName: leave.typeName,
      userStartDate,
      userEndDate,
      documentStartDate: documentStartDate || undefined,
      documentEndDate: documentEndDate || undefined,
      days: calculateDays(),
      requireReport,
      reportStatus: requireReport ? leave.reportStatus || 'pending' : undefined,
      note: note || undefined,
      studyInfo:
        leaveType === 'education'
          ? {
              institution,
              program,
              field,
              startDate: studyStartDate,
            }
          : undefined,
    };

    onSave({ ...updatedLeave, files });
  };

  const userDateRangeValid = isValidDateRange(userStartDate, userEndDate);
  const docDateRangeError = validateOptionalDateRange(
    documentStartDate,
    documentEndDate,
    'ตามเอกสาร',
  );
  const docDateRangeValid = !docDateRangeError;

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-secondary/50 border border-border">
        <p className="text-sm text-muted-foreground">ผู้ลา</p>
        <p className="font-medium">{leave.personName}</p>
        <p className="text-sm text-muted-foreground">
          {leave.personPosition} - {leave.personDepartment}
        </p>
      </div>

      <div className="space-y-2">
        <Label>ประเภทการลา</Label>
        <Select
          value={leaveType}
          onValueChange={(value) => {
            setLeaveType(value);
            setRequireReport(['education', 'ordain', 'military'].includes(value));
          }}
        >
          <SelectTrigger className="bg-secondary border-border">
            <SelectValue placeholder="เลือกประเภท" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {leaveTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DateInputField
          label="วันที่เริ่ม (ตาม ผู้ใช้งาน)"
          value={userStartDate}
          onChange={setUserStartDate}
          name="edit_user_start_date"
          max={userEndDate || undefined}
        />
        <DateInputField
          label="วันที่สิ้นสุด (ตาม ผู้ใช้งาน)"
          value={userEndDate}
          onChange={setUserEndDate}
          name="edit_user_end_date"
          min={userStartDate || undefined}
        />
      </div>
      {!userDateRangeValid && userStartDate && userEndDate && (
        <p className="text-sm text-destructive">
          วันที่สิ้นสุด (ตาม ผู้ใช้งาน) ต้องไม่ก่อนวันที่เริ่ม
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <DateInputField
          label="วันที่เริ่ม (ตามเอกสาร)"
          value={documentStartDate}
          onChange={setDocumentStartDate}
          name="edit_document_start_date"
          max={documentEndDate || undefined}
        />
        <DateInputField
          label="วันที่สิ้นสุด (ตามเอกสาร)"
          value={documentEndDate}
          onChange={setDocumentEndDate}
          name="edit_document_end_date"
          min={documentStartDate || undefined}
        />
      </div>
      {!docDateRangeValid && docDateRangeError && (
        <p className="text-sm text-destructive">{docDateRangeError}</p>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="requireReportEdit"
          checked={requireReport}
          onCheckedChange={(checked) => setRequireReport(checked === true)}
        />
        <Label htmlFor="requireReportEdit">ต้องรายงานตัวหลังกลับ</Label>
      </div>

      {leaveType === 'education' && (
        <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30 space-y-4">
          <p className="text-sm font-medium text-purple-400">ข้อมูลการลาศึกษา/อบรม</p>
          <div className="space-y-2">
            <Label>สถานศึกษา</Label>
            <Input
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="bg-secondary border-border"
              placeholder="ระบุสถานศึกษา"
            />
          </div>
          <div className="space-y-2">
            <Label>หลักสูตร</Label>
            <Input
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              className="bg-secondary border-border"
              placeholder="ระบุหลักสูตร"
            />
          </div>
          <div className="space-y-2">
            <Label>สาขาวิชา</Label>
            <Input
              value={field}
              onChange={(e) => setField(e.target.value)}
              className="bg-secondary border-border"
              placeholder="ระบุสาขาวิชา"
            />
          </div>
          <div className="space-y-2">
            <DateInputField
              label="วันที่เริ่มศึกษา"
              value={studyStartDate}
              onChange={setStudyStartDate}
              name="edit_study_start_date"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>เอกสารแนบ (ไม่บังคับ)</Label>
        <Input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          className="bg-secondary border-border"
        />
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onPreview(URL.createObjectURL(file), file.name)}
                    className="h-8 w-8 text-slate-500 hover:text-primary"
                    aria-label="ดูไฟล์แนบ"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveFile(idx)}
                    className="h-8 w-8 text-slate-500 hover:text-destructive"
                    aria-label="ลบไฟล์แนบ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>หมายเหตุ</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ระบุหมายเหตุ (ถ้ามี)"
          className="bg-secondary border-border"
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button onClick={handleSubmit} disabled={!userDateRangeValid || !docDateRangeValid}>
          <Save className="mr-2 h-4 w-4" />
          บันทึกการแก้ไข
        </Button>
      </DialogFooter>
    </div>
  );
}

export function RecordReportForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (reportDate: string, note: string) => void;
}) {
  const [reportDate, setReportDate] = useState('');
  const [note, setNote] = useState('');

  return (
    <div className="space-y-4">
      <DateInputField
        label="วันที่รายงานตัว"
        value={reportDate}
        onChange={setReportDate}
        name="report_date"
      />
      <div className="space-y-2">
        <Label>หมายเหตุ</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ระบุหมายเหตุ (ถ้ามี)"
          className="bg-secondary border-border"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button onClick={() => onSave(reportDate, note)} disabled={!reportDate}>
          <CalendarCheck className="mr-2 h-4 w-4" />
          บันทึกการรายงานตัว
        </Button>
      </DialogFooter>
    </div>
  );
}
