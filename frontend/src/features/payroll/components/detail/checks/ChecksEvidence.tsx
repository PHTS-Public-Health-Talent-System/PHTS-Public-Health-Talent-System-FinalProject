'use client';

import type React from 'react';
import { cn } from '@/lib/utils';
import { formatThaiNumber } from '@/shared/utils/thai-locale';
import { ReturnReportStatusBadge } from '@/components/common';
import {
  formatThaiShortDate,
  leaveTypeLabel,
  localizePayrollText,
  normalizeLicenseStatusLabel,
  normalizeReturnReportStatus,
  quotaUnitLabel,
  toNumber,
} from './checks.helpers';

export function SummaryWithBoldMoney({ summary }: { summary: string }) {
  const re = /([+-]?\d[\d,]*(?:\.\d+)?)(\s*บาท)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;

  for (const match of summary.matchAll(re)) {
    const idx = match.index ?? 0;
    if (idx > last) parts.push(summary.slice(last, idx));
    const amount = match[1] ?? '';
    const unit = match[2] ?? ' บาท';
    parts.push(
      <span key={`${idx}-${amount}`} className="inline-flex items-baseline gap-1 mx-1">
        <span className="font-bold tabular-nums text-slate-900">{amount}</span>
        <span className="text-xs font-medium text-slate-500">{unit}</span>
      </span>,
    );
    last = idx + match[0].length;
  }
  if (last < summary.length) parts.push(summary.slice(last));
  return <>{parts.length ? parts : summary}</>;
}

export function EvidenceBlock({
  evidence,
  variant,
}: {
  evidence: unknown;
  variant: 'danger' | 'warning';
}) {
  return (
    <div
      className={cn(
        'py-3 pl-4 pr-4 transition-all relative bg-white border border-slate-200/60 rounded-lg shadow-sm hover:shadow-md',
        variant === 'danger'
          ? 'border-l-[4px] border-l-rose-500'
          : 'border-l-[4px] border-l-amber-400',
      )}
    >
      <EvidenceLine evidence={evidence} />
    </div>
  );
}

type EvidenceGridItem = {
  label: string;
  value: React.ReactNode;
  align?: 'left' | 'right';
  colSpan?: 1 | 2;
};

function formatGenericEvidenceValue(_key: string, value: unknown): React.ReactNode {
  return <span className="break-words">{String(value)}</span>;
}

function EvidenceGrid({ label, items }: { label: string; items: EvidenceGridItem[] }) {
  const filtered = items.filter(Boolean) as EvidenceGridItem[];
  if (!label && filtered.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {label ? (
        <div className="text-xs font-bold text-slate-700 tracking-wide uppercase border-b border-slate-100 pb-1.5 mb-2">
          {label}
        </div>
      ) : null}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {filtered.map((item, idx) => (
          <div
            key={`${label}-${idx}-${item.label}`}
            className={cn(
              'flex flex-col justify-center gap-1 rounded-lg bg-slate-50/80 px-3.5 py-2.5 border border-slate-100/80',
              item.colSpan === 2 && 'col-span-2',
              item.align === 'right' ? 'items-end text-right' : 'items-start text-left',
            )}
          >
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {item.label}
            </span>
            <span className="text-sm font-semibold text-slate-800 leading-snug">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceLine({ evidence }: { evidence: unknown }) {
  if (!evidence || typeof evidence !== 'object') return <span className="text-sm">{String(evidence)}</span>;
  const ev = evidence as Record<string, unknown>;
  const type = String(ev.type ?? '');

  if (type === 'eligibility') {
    const effectiveDate = formatThaiShortDate(ev.effective_date);
    const expiryDate = ev.expiry_date ? formatThaiShortDate(ev.expiry_date) : 'ปัจจุบัน';
    const groupValue = ev.group ?? ev.group_no;
    const itemValue = ev.item ?? ev.item_no;
    const groupText = groupValue !== null && groupValue !== undefined ? `กลุ่ม ${groupValue}` : '';
    const itemText = itemValue !== null && itemValue !== undefined ? `ข้อ ${itemValue}` : '';
    const groupItemLabel = [groupText, itemText].filter(Boolean).join(' / ');

    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm leading-tight font-semibold text-slate-900">
            <span className="tabular-nums">{effectiveDate}</span> - <span className="tabular-nums">{expiryDate}</span>
          </span>
          {groupItemLabel ? (
            <span className="text-xs font-medium text-slate-500 bg-slate-100/80 px-1.5 py-0.5 rounded border border-slate-200/50 w-fit">{groupItemLabel}</span>
          ) : null}
        </div>
        <div className="shrink-0 text-right pr-1">
          <span className="inline-flex items-baseline whitespace-nowrap text-lg font-bold leading-none text-indigo-600 tabular-nums bg-indigo-50/50 px-2.5 py-1 rounded-md border border-indigo-100/50">
            {formatThaiNumber(toNumber(ev.rate))} ฿
          </span>
        </div>
      </div>
    );
  }

  if (type === 'eligibility_gap') {
    const toDate = (value: unknown): Date | null => {
      const parsed = new Date(String(value ?? ''));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const inclusiveDays = (start: unknown, end: unknown): number => {
      const s = toDate(start);
      const e = toDate(end);
      if (!s || !e || s > e) return 0;
      const msPerDay = 24 * 60 * 60 * 1000;
      return Math.floor((e.getTime() - s.getTime()) / msPerDay) + 1;
    };

    const missing = Array.isArray(ev.missing_ranges)
      ? (ev.missing_ranges as Array<Record<string, unknown>>)
      : [];
    const totalMissingDays = missing.reduce(
      (sum, range) => sum + inclusiveDays(range?.start, range?.end),
      0,
    );
    const missingRangeSummary = missing
      .map((range) => `${formatThaiShortDate(range?.start)} - ${formatThaiShortDate(range?.end)}`)
      .join(', ');

    if (missing.length === 0) return null;

    if (missing.length === 1) {
      return (
        <div className="flex items-center justify-between bg-rose-50/50 border border-rose-100/80 px-3.5 py-3 rounded-lg">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-rose-800">
              ช่วงที่ไม่มีสิทธิ <span className="text-rose-600">({formatThaiNumber(totalMissingDays)} วัน)</span>
            </span>
            <span className="text-[11px] font-semibold text-rose-600/90 tabular-nums bg-white px-2 py-0.5 rounded shadow-sm border border-rose-100/50 w-fit">
              {missingRangeSummary}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2.5 bg-rose-50/50 border border-rose-100/80 px-3.5 py-3 rounded-lg">
        <span className="text-xs font-bold text-rose-800">
          ไม่มีสิทธิรวม <span className="text-rose-600">{formatThaiNumber(totalMissingDays)} วัน</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {missing.map((range, idx) => (
            <span
              key={`gap-${idx}`}
              className="text-[10px] font-bold bg-white text-rose-600 px-2 py-1 rounded-md border border-rose-100 shadow-sm tabular-nums"
            >
              {formatThaiShortDate(range?.start)} - {formatThaiShortDate(range?.end)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'leave') {
    const quotaLimitRaw = ev.quota_limit;
    const quotaLimit =
      quotaLimitRaw === null || quotaLimitRaw === undefined ? null : Number(quotaLimitRaw);
    const leaveDurationRaw = ev.leave_duration;
    const leaveDuration =
      leaveDurationRaw === null || leaveDurationRaw === undefined ? null : Number(leaveDurationRaw);
    const unit = String(ev.quota_unit ?? '');
    const leaveType = String(ev.leave_type ?? '');
    const start = formatThaiShortDate(ev.start_date);
    const end = formatThaiShortDate(ev.end_date);
    const exceed = ev.exceed_date ? formatThaiShortDate(ev.exceed_date) : null;

    const overQuota = Boolean(ev.over_quota);
    const isNoPay = Boolean(ev.is_no_pay);
    const returnReportStatus = String(ev.return_report_status ?? '').trim();
    const returnReportBadge = normalizeReturnReportStatus(returnReportStatus);
    const hasReturnReportTracking = Object.prototype.hasOwnProperty.call(ev, 'return_report_status');
    const isPendingReturnReport = hasReturnReportTracking && returnReportBadge !== 'reported';

    return (
      <EvidenceGrid
        label={`รายการลา (${leaveTypeLabel(leaveType)})`}
        items={[
          {
            label: 'เลขที่อ้างอิง',
            value: <span className="font-mono text-slate-500 text-xs bg-slate-200/50 px-1.5 py-0.5 rounded border border-slate-200">#{String(ev.leave_record_id ?? '-')}</span>,
          },
          {
            label: 'ช่วงวันที่ลา',
            value: (
              <span className="tabular-nums">
                {start} - {end}
              </span>
            ),
            colSpan: 2,
          },
          {
            label: 'สถานะรายการ',
            value: isNoPay ? (
              <span className="text-rose-700 font-bold bg-rose-100/50 px-2 py-0.5 rounded border border-rose-200/50 text-[11px]">ไม่ได้รับเงิน พ.ต.ส.</span>
            ) : overQuota ? (
              <span className="text-amber-700 font-bold bg-amber-100/50 px-2 py-0.5 rounded border border-amber-200/50 text-[11px]">ลาเกินโควตา</span>
            ) : isPendingReturnReport ? (
              <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50 text-[11px]">ยังไม่รายงานตัวกลับ</span>
            ) : (
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/50 text-[11px]">ลาปกติ</span>
            ),
          },
          ...(overQuota
            ? [
                {
                  label: 'เกินสิทธิตั้งแต่',
                  value: (
                    <span className="tabular-nums font-bold text-amber-700">
                      {exceed ?? '-'}
                    </span>
                  ),
                  colSpan: 2 as const,
                },
              ]
            : []),
          ...(overQuota && quotaLimit !== null && Number.isFinite(quotaLimit)
            ? [
                {
                  label: 'โควตาตั้งต้น',
                  value: (
                    <span className="tabular-nums">
                      {formatThaiNumber(quotaLimit)}{' '}
                          <span className="text-[10px] font-semibold text-slate-500 uppercase">
                            {quotaUnitLabel(unit)}
                          </span>
                    </span>
                  ),
                },
              ]
            : []),
          ...(overQuota && leaveDuration !== null && Number.isFinite(leaveDuration)
            ? [
                {
                  label: 'ลารอบนี้',
                  value: (
                    <span className="tabular-nums">
                      {formatThaiNumber(leaveDuration)}{' '}
                      <span className="text-[10px] font-semibold text-slate-500 uppercase">วัน</span>
                    </span>
                  ),
                },
              ]
            : []),
          ...(hasReturnReportTracking
            ? [
                {
                  label: 'สถานะรายงานตัว',
                  value: returnReportBadge ? (
                    <ReturnReportStatusBadge status={returnReportBadge} tone="soft" />
                  ) : (
                    <span className="text-slate-500 text-[11px] font-medium">ยังไม่รายงานตัว</span>
                  ),
                  colSpan: 2 as const,
                },
              ]
            : []),
        ]}
      />
    );
  }

  if (type === 'license') {
    return (
      <EvidenceGrid
        label="ข้อมูลใบอนุญาตประกอบวิชาชีพ"
        items={[
          {
            label: 'สถานะใบอนุญาต',
            value: (
              <span className="font-semibold text-slate-800">
                {normalizeLicenseStatusLabel(ev.status)}
              </span>
            ),
          },
          {
            label: 'วันที่มีผล',
            value: <span className="tabular-nums">{formatThaiShortDate(ev.valid_from)}</span>,
          },
          {
            label: 'วันหมดอายุ',
            value: (
              <span className="tabular-nums font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                {formatThaiShortDate(ev.valid_until)}
              </span>
            ),
            colSpan: 2,
          },
        ]}
      />
    );
  }

  if (type === 'movement') {
    return (
      <EvidenceGrid
        label="ประวัติความเคลื่อนไหว (บุคลากร)"
        items={[
          {
            label: 'ประเภทรายการ',
            value: (
              <span className="font-semibold text-slate-800">
                {localizePayrollText(String(ev.movement_type ?? '-'))}
              </span>
            ),
            colSpan: 2,
          },
          {
            label: 'วันที่มีผล',
            value: <span className="tabular-nums">{formatThaiShortDate(ev.effective_date)}</span>,
            colSpan: 2,
          },
        ]}
      />
    );
  }

  if (type === 'retro') {
    const diff = Number(ev.diff ?? 0);
    const ref = `${String(ev.reference_month ?? '-').padStart(2, '0')}/${String(ev.reference_year ?? '-')}`;
    const remarkText = String(ev.remark ?? '').trim();
    const remarkParts = remarkText
      ? remarkText
          .split('•')
          .map((part) => part.trim())
          .filter(Boolean)
      : [];
    const summaryPart = remarkParts[0] ?? '';
    const comparePart = remarkParts.find((part) => part.startsWith('คำนวณใหม่')) ?? '';
    const factorsPart = remarkParts.find((part) => part.startsWith('ปัจจัย:')) ?? '';
    const hasMissingPaidData = remarkParts.some((part) =>
      part.includes('ไม่พบข้อมูลจ่ายเดิมของงวดนี้'),
    );
    const compareMatch = comparePart.match(
      /คำนวณใหม่\s+([+-]?\d[\d,]*(?:\.\d+)?)\s+เทียบเคยจ่าย\s+([+-]?\d[\d,]*(?:\.\d+)?)/,
    );
    const compareMatchNoHistory = comparePart.match(
      /คำนวณใหม่\s+([+-]?\d[\d,]*(?:\.\d+)?)\s+บาท/,
    );
    const recalculatedAmount = compareMatch?.[1] ?? compareMatchNoHistory?.[1] ?? null;
    const previouslyPaidAmount = compareMatch?.[2] ?? null;
    const factorsText = factorsPart.replace(/^ปัจจัย:\s*/, '').trim();

    return (
      <EvidenceGrid
        label="รายละเอียดส่วนต่างตกเบิก"
        items={[
          {
            label: 'งวดที่อ้างอิง',
            value: <span className="tabular-nums bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded border border-slate-300/50 font-bold">{ref}</span>,
          },
          {
            label: 'ส่วนต่างที่ต้องปรับ',
            value: (
              <span
                className={cn(
                  'tabular-nums font-bold text-base',
                  diff < 0 ? 'text-rose-700' : 'text-emerald-700',
                )}
              >
                {diff >= 0 ? '+' : ''}
                {formatThaiNumber(diff)}{' '}
                <span className="text-[10px] font-semibold uppercase opacity-70">บาท</span>
              </span>
            ),
            colSpan: 2,
          },
          ...(recalculatedAmount
            ? [
                {
                  label: 'ยอดคำนวณใหม่',
                  value: (
                    <span className="tabular-nums font-semibold text-slate-800">
                      {recalculatedAmount} <span className="text-[10px] font-medium text-slate-500 uppercase">บาท</span>
                    </span>
                  ),
                },
              ]
            : []),
          ...(previouslyPaidAmount
            ? [
                {
                  label: 'ยอดเคยจ่ายเดิม',
                  value: (
                    <span className="tabular-nums font-semibold text-slate-800">
                      {previouslyPaidAmount} <span className="text-[10px] font-medium text-slate-500 uppercase">บาท</span>
                    </span>
                  ),
                },
              ]
            : hasMissingPaidData
              ? [
                  {
                    label: 'ยอดเคยจ่ายเดิม',
                    value: (
                      <span className="font-medium text-slate-500 text-[11px] bg-slate-200/50 px-1.5 py-0.5 rounded">ไม่มีข้อมูลเดิม</span>
                    ),
                  },
                ]
              : []),
          ...(factorsText
            ? [
                {
                  label: 'ปัจจัยที่กระทบ',
                  value: <span className="font-normal text-slate-700 text-[13px] leading-relaxed">{factorsText}</span>,
                  colSpan: 2 as const,
                },
              ]
            : []),
          ...(summaryPart
            ? [
                {
                  label: 'สรุป',
                  value: <span className="font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200/50 text-[13px] leading-relaxed">{summaryPart}</span>,
                  colSpan: 2 as const,
                },
              ]
            : []),
        ]}
      />
    );
  }

  const genericEntries = Object.entries(ev).filter(
    ([key, value]) => key !== 'type' && value !== null && value !== undefined && value !== '',
  );

  if (genericEntries.length > 0) {
    const labelMap: Record<string, string> = {
      detail: 'รายละเอียด',
      source: 'แหล่งข้อมูล',
      remark: 'หมายเหตุ',
      message: 'ข้อความ',
      status: 'สถานะ',
    };

    return (
      <EvidenceGrid
        label="รายละเอียดเพิ่มเติม"
        items={genericEntries.map(([key, value]) => ({
          label: labelMap[key] ?? key,
          value: formatGenericEvidenceValue(key, value),
          colSpan: 2 as const,
        }))}
      />
    );
  }

  return (
    <div className="text-[11px] font-mono text-slate-500 p-3 bg-slate-100 rounded-lg break-all border border-slate-200 shadow-inner">
      {JSON.stringify(ev)}
    </div>
  );
}
