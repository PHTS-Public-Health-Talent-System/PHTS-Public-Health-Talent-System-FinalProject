import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
import { leaveTypes } from '@/features/leave-management/constants/leaveTypes';
import { LeaveTable } from '@/features/leave-management/components/table/LeaveTable';
import type { LeaveRecord } from '@/features/leave-management/types/leaveManagement.types';
import { FileText, Search } from 'lucide-react';

type SortBy = 'start_date' | 'name';
type SortDir = 'asc' | 'desc';

export function AllLeavesTab({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  fiscalYearFilter,
  onFiscalYearFilterChange,
  fiscalYearOptions,
  sortBy,
  sortDir,
  onSortChange,
  leaveRecords,
  onViewDetail,
  onEdit,
  onDelete,
  onRecordReport,
  getLeaveTypeColor,
  formatDateDisplay,
  isLoading,
  isError,
  onRetry,
  showingFrom,
  showingTo,
  totalRecords,
  page,
  totalPages,
  canPrevPage,
  canNextPage,
  onPrevPage,
  onNextPage,
}: {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  fiscalYearFilter: number | 'all';
  onFiscalYearFilterChange: (value: number | 'all') => void;
  fiscalYearOptions: number[];
  sortBy: SortBy;
  sortDir: SortDir;
  onSortChange: (sortBy: SortBy, sortDir: SortDir) => void;
  leaveRecords: LeaveRecord[];
  onViewDetail: (record: LeaveRecord) => void;
  onEdit: (record: LeaveRecord) => void;
  onDelete: (record: LeaveRecord) => void;
  onRecordReport: (record: LeaveRecord) => void;
  getLeaveTypeColor: (type: string) => string;
  formatDateDisplay: (date: string) => string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  showingFrom: number;
  showingTo: number;
  totalRecords: number;
  page: number;
  totalPages: number;
  canPrevPage: boolean;
  canNextPage: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
}) {
  return (
    <TabsContent value="all">
      <Card className="border-border shadow-sm">
        <CardHeader className="py-4 px-6 border-b bg-muted/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              รายการวันลาทั้งหมด
            </CardTitle>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อ, แผนก..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="bg-background pl-9 h-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={onTypeFilterChange}>
                <SelectTrigger className="w-full sm:w-[140px] bg-background h-9">
                  <SelectValue placeholder="ประเภท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(fiscalYearFilter)}
                onValueChange={(value) => onFiscalYearFilterChange(value === 'all' ? 'all' : Number(value))}
              >
                <SelectTrigger className="w-full sm:w-[120px] bg-background h-9">
                  <SelectValue placeholder="ปีงบ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกปีงบ</SelectItem>
                  {fiscalYearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={`${sortBy}:${sortDir}`}
                onValueChange={(value) => {
                  const [nextSortBy, nextSortDir] = value.split(':') as [SortBy, SortDir];
                  onSortChange(nextSortBy, nextSortDir);
                }}
              >
                <SelectTrigger className="w-full sm:w-[160px] bg-background h-9">
                  <SelectValue placeholder="เรียงลำดับ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="start_date:desc">วันที่ลา (ใหม่สุด)</SelectItem>
                  <SelectItem value="start_date:asc">วันที่ลา (เก่าสุด)</SelectItem>
                  <SelectItem value="name:asc">ชื่อ (ก-ฮ)</SelectItem>
                  <SelectItem value="name:desc">ชื่อ (ฮ-ก)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <LeaveTable
            records={leaveRecords}
            onViewDetail={onViewDetail}
            onEdit={onEdit}
            onDelete={onDelete}
            onRecordReport={onRecordReport}
            getLeaveTypeColor={getLeaveTypeColor}
            formatDateDisplay={formatDateDisplay}
            isLoading={isLoading}
            isError={isError}
            onRetry={onRetry}
          />
          <div className="flex items-center justify-between border-t bg-muted/5 px-4 py-3 text-xs text-muted-foreground">
            <span>
              แสดง {showingFrom}-{showingTo} จาก {totalRecords} รายการ
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={!canPrevPage} onClick={onPrevPage}>
                ก่อนหน้า
              </Button>
              <span>
                หน้า {Math.min(page + 1, totalPages)} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={!canNextPage} onClick={onNextPage}>
                ถัดไป
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
