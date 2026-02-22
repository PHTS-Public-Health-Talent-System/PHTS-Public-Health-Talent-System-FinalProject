'use client'

import { List, Pencil, Search } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatThaiNumber } from '@/shared/utils/thai-locale'
import { PayrollIssueStatusBadge } from '../../common/PayrollIssueStatusBadge'
import type { PayrollRow } from '../model/detail.types'
import type { PayrollIssueFilter, PayrollSortBy } from '../model/detail.view-model'
import { PAYROLL_ISSUE_FILTER_OPTIONS, PAYROLL_SORT_OPTIONS } from '../model/detail.constants'

type PayrollPayoutTableSectionProps = {
  activeProfessionLabel: string
  filteredPersonsCount: number
  sortedPersons: PayrollRow[]
  availableGroups: string[]
  availableDepartments: string[]
  canEditPayout: boolean
  searchQuery: string
  onSearchChange: (value: string) => void
  rateFilter: string
  onRateFilterChange: (value: string) => void
  departmentFilter: string
  onDepartmentFilterChange: (value: string) => void
  issueFilter: PayrollIssueFilter
  onIssueFilterChange: (value: PayrollIssueFilter) => void
  sortBy: PayrollSortBy
  onSortByChange: (value: PayrollSortBy) => void
  onOpenAllowanceDetail: (person: PayrollRow) => void
  onOpenChecks: (person: PayrollRow) => void
  onEditRow: (person: PayrollRow) => void
}

export function PayrollPayoutTableSection({
  activeProfessionLabel,
  filteredPersonsCount,
  sortedPersons,
  availableGroups,
  availableDepartments,
  canEditPayout,
  searchQuery,
  onSearchChange,
  rateFilter,
  onRateFilterChange,
  departmentFilter,
  onDepartmentFilterChange,
  issueFilter,
  onIssueFilterChange,
  sortBy,
  onSortByChange,
  onOpenAllowanceDetail,
  onOpenChecks,
  onEditRow,
}: PayrollPayoutTableSectionProps) {
  return (
    <Card className="mx-6 border-border shadow-sm md:mx-8">
      <CardHeader className="border-b bg-muted/5 px-6 py-4">
        <div className="space-y-3">
          <CardTitle className="flex min-w-0 items-center gap-2 text-lg">
            <List className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="shrink-0">รายชื่อผู้รับเงิน</span>
            {activeProfessionLabel ? <span className="truncate">- {activeProfessionLabel}</span> : null}
            <span className="ml-2 whitespace-nowrap text-sm font-normal text-muted-foreground">
              (ทั้งหมด {filteredPersonsCount} รายการ)
            </span>
          </CardTitle>
          <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2 lg:grid-cols-6 xl:grid-cols-7">
            <div className="relative w-full sm:col-span-2 lg:col-span-2 xl:col-span-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อ, เลขบัตร, ตำแหน่ง, หน่วยงาน..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-9 bg-background pl-9"
              />
            </div>
            <Select value={rateFilter} onValueChange={onRateFilterChange}>
              <SelectTrigger className="h-9 w-full bg-background">
                <SelectValue placeholder="ทุกกลุ่มอัตรา" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกกลุ่มอัตรา</SelectItem>
                {availableGroups.map((group) => (
                  <SelectItem key={group} value={group}>
                    กลุ่มที่ {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={onDepartmentFilterChange}>
              <SelectTrigger className="h-9 w-full bg-background">
                <SelectValue placeholder="ทุกหน่วยงาน" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกหน่วยงาน</SelectItem>
                {availableDepartments.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={issueFilter} onValueChange={(v) => onIssueFilterChange(v as PayrollIssueFilter)}>
              <SelectTrigger className="h-9 w-full bg-background">
                <SelectValue placeholder="ทุกสถานะตรวจ" />
              </SelectTrigger>
              <SelectContent>
                {PAYROLL_ISSUE_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => onSortByChange(v as PayrollSortBy)}>
              <SelectTrigger className="h-9 w-full bg-background">
                <SelectValue placeholder="เรียงลำดับ" />
              </SelectTrigger>
              <SelectContent>
                {PAYROLL_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/50 shadow-sm">
            <TableRow>
              <TableHead className="w-[50px] text-center">#</TableHead>
              <TableHead className="sticky left-0 z-20 min-w-[220px] bg-background/95 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                ชื่อ - นามสกุล / เลขบัตร
              </TableHead>
              <TableHead className="min-w-[180px]">ตำแหน่ง / หน่วยงาน</TableHead>
              <TableHead className="w-[80px] text-center">กลุ่ม</TableHead>
              <TableHead className="w-[100px] text-right">อัตรา</TableHead>
              <TableHead className="w-[100px] text-right">ตกเบิก</TableHead>
              <TableHead className="w-[100px] text-right text-orange-600">หัก</TableHead>
              <TableHead className="w-[120px] text-right font-bold text-foreground">
                สุทธิ
              </TableHead>
              <TableHead className="w-[100px] text-center">สถานะ</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPersons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                  ไม่พบข้อมูลที่ค้นหา
                </TableCell>
              </TableRow>
            ) : (
              sortedPersons.map((person, index) => {
                const hasChecks = person.checkCount > 0 || person.issues.length > 0
                const warnCount = person.warningCount > 0 ? person.warningCount : person.issues.length

                return (
                  <TableRow key={person.id} className="group transition-colors hover:bg-muted/30">
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {index + 1}
                    </TableCell>

                    <TableCell className="sticky left-0 z-10 bg-background shadow-[1px_0_0_0_rgba(0,0,0,0.05)] transition-colors group-hover:bg-muted/30">
                      <div
                        className="flex cursor-pointer flex-col"
                        onClick={() => onOpenAllowanceDetail(person)}
                      >
                        <span className="text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                          {person.name}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {person.citizenId}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex max-w-[200px] flex-col">
                        <span className="truncate text-xs font-medium" title={person.position}>
                          {person.position}
                        </span>
                        <span
                          className="truncate text-[11px] text-muted-foreground"
                          title={person.department}
                        >
                          {person.department}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className="h-5 bg-background px-1.5 text-[10px] font-normal"
                      >
                        {person.groupNo} / {person.itemNo}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {formatThaiNumber(person.baseRate)}
                    </TableCell>

                    <TableCell className="text-right text-sm tabular-nums">
                      <span
                        className={cn(
                          'font-medium',
                          person.retroactiveAmount > 0
                            ? 'text-blue-600'
                            : person.retroactiveAmount < 0
                              ? 'text-orange-600'
                              : 'text-muted-foreground',
                        )}
                      >
                        {person.retroactiveAmount !== 0 &&
                          formatThaiNumber(person.retroactiveAmount)}
                      </span>
                    </TableCell>

                    <TableCell className="text-right text-sm tabular-nums">
                      {person.deductionAmount > 0 ? (
                        <span className="font-medium text-orange-700">
                          -{formatThaiNumber(person.deductionAmount)}
                        </span>
                      ) : (
                        <span className="font-medium tabular-nums text-muted-foreground">0</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right tabular-nums">
                      <span
                        className={cn(
                          'rounded px-2 py-0.5 text-sm font-bold',
                          person.totalAmount > 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'text-muted-foreground',
                        )}
                      >
                        {formatThaiNumber(person.totalAmount)}
                      </span>
                    </TableCell>

                    <TableCell className="text-center">
                      <button
                        type="button"
                        className={cn(
                          'transition-opacity',
                          hasChecks
                            ? 'cursor-pointer hover:opacity-80'
                            : 'cursor-default opacity-50 grayscale',
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!hasChecks) return;
                          onOpenChecks(person);
                        }}
                        disabled={!hasChecks}
                        title={hasChecks ? 'เปิดดูสิ่งที่ต้องตรวจสอบ' : undefined}
                      >
                        <PayrollIssueStatusBadge
                          checkCount={person.checkCount}
                          blockerCount={person.blockerCount}
                          warningCount={warnCount}
                        />
                      </button>
                    </TableCell>

                    <TableCell className="text-center">
                      {canEditPayout && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditRow(person);
                          }}
                          title="แก้ไขรายการจ่าย (งวดนี้)"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t bg-muted/5 px-4 py-3 text-xs text-muted-foreground">
        <span>แสดง {sortedPersons.length} รายการ</span>
      </div>
    </Card>
  );
}
