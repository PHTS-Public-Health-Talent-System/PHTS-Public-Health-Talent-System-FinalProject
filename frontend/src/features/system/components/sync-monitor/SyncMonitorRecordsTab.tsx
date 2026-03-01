import { Database, FileJson, Filter, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TabsContent } from '@/components/ui/tabs';
import { PaginationControls } from '@/features/system';
import { cn } from '@/lib/utils';
import { formatThaiNumber } from '@/shared/utils/thai-locale';

type ActiveFilter = {
  label: string;
  value: string;
};

type SyncMonitorRecordsTabProps = {
  isLoading: boolean;
  total: number;
  rows: Record<string, unknown>[];
  targetTable?: string | undefined;
  targetTableFilter?: string | undefined;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  activeFilters: ActiveFilter[];
  onClearActiveFilter: (filter: ActiveFilter) => void;
  batchIdInput: string;
  targetTableInput: string;
  searchInput: string;
  tableOptions: string[];
  tableCounts: Record<string, number>;
  batchOptions: Array<{ batch_id: number }>;
  setBatchIdInput: (value: string) => void;
  setTargetTableInput: (value: string) => void;
  setSearchInput: (value: string) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
};

function ActiveFilterChip({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <span className="font-medium text-foreground">{label}:</span> {value}
      <XCircle className="ml-0.5 h-3.5 w-3.5" />
    </button>
  );
}

export function SyncMonitorRecordsTab({
  isLoading,
  total,
  rows,
  targetTable,
  targetTableFilter,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  activeFilters,
  onClearActiveFilter,
  batchIdInput,
  targetTableInput,
  searchInput,
  tableOptions,
  tableCounts,
  batchOptions,
  setBatchIdInput,
  setTargetTableInput,
  setSearchInput,
  onApplyFilters,
  onClearFilters,
  pageSize,
  onPageSizeChange,
  page,
  totalPages,
  onPrev,
  onNext,
}: SyncMonitorRecordsTabProps) {
  return (
    <TabsContent value="records" className="m-0 flex flex-1 flex-col focus-visible:outline-none">
      <div className="space-y-4 border-b bg-muted/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground">ข้อมูลที่ซิงก์</h3>
            <Badge variant="secondary" className="text-xs font-normal">
              {formatThaiNumber(total)} รายการ
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleAdvancedFilters}
            className={cn(
              'h-8 text-xs self-end sm:self-auto',
              showAdvancedFilters && 'bg-muted',
            )}
          >
            <Filter className="mr-1.5 h-3.5 w-3.5" /> ตัวกรอง
          </Button>
        </div>

        {showAdvancedFilters ? (
          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-4 animate-in slide-in-from-top-2">
            <Select value={batchIdInput} onValueChange={setBatchIdInput}>
              <SelectTrigger className="h-8 bg-background text-xs">
                <SelectValue placeholder="รอบซิงก์" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">ล่าสุด</SelectItem>
                {batchOptions.map((batch) => (
                  <SelectItem key={batch.batch_id} value={String(batch.batch_id)}>
                    #{batch.batch_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={targetTableInput} onValueChange={setTargetTableInput}>
              <SelectTrigger className="h-8 bg-background text-xs">
                <SelectValue placeholder="ตาราง" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">อัตโนมัติ</SelectItem>
                {tableOptions.map((table) => (
                  <SelectItem key={table} value={table}>
                    {table} ({Number(tableCounts[table] ?? 0)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="ค้นหา ID / Key..."
              className="h-8 bg-background text-xs"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-8 flex-1 text-xs" onClick={onApplyFilters}>
                ค้นหา
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={onClearFilters}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {activeFilters.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {activeFilters.map((filter) => (
              <ActiveFilterChip
                key={`${filter.label}-${filter.value}`}
                label={filter.label}
                value={filter.value}
                onClear={() => onClearActiveFilter(filter)}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <FileJson className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">ไม่พบข้อมูลที่ถูก sync ตามเงื่อนไขที่ค้นหา</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((record, index) => {
              const entries = Object.entries(record);
              const titleValue = String(
                record.citizen_id ??
                  record.id ??
                  record.ref_id ??
                  record.license_id ??
                  record.movement_id ??
                  record.signature_id ??
                  `row-${index}`,
              );
              return (
                <div key={`${titleValue}-${index}`} className="overflow-hidden rounded-lg border bg-card shadow-sm">
                  <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-sm font-semibold text-foreground">{titleValue}</p>
                    </div>
                    <Badge variant="outline" className="bg-background font-mono text-[10px]">
                      {targetTable ?? targetTableFilter ?? '-'}
                    </Badge>
                  </div>
                  <div className="p-4">
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                      {entries.map(([key, value]) => (
                        <div
                          key={key}
                          className="flex flex-col border-b border-muted/50 pb-1.5 last:border-0 sm:last:border-b-0"
                        >
                          <dt className="mb-0.5 text-muted-foreground">{key}</dt>
                          <dd className="break-words font-mono text-foreground">{String(value ?? '-')}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t bg-muted/10 p-4">
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="h-8 w-[80px] bg-background text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 / หน้า</SelectItem>
            <SelectItem value="20">20 / หน้า</SelectItem>
            <SelectItem value="50">50 / หน้า</SelectItem>
          </SelectContent>
        </Select>
        <PaginationControls page={page} totalPages={totalPages} onPrev={onPrev} onNext={onNext} />
      </div>
    </TabsContent>
  );
}
