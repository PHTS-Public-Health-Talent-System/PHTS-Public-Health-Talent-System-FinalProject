'use client';

import { CheckCircle2, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatThaiNumber } from '@/shared/utils/thai-locale';
import { resolveProfessionReviewTone } from '../model/detail.helpers';
import type { ProfessionCardViewModel } from '../model/detail.view-model';

type PayrollProfessionSelectorProps = {
  selectedProfession: string;
  professionCards: ProfessionCardViewModel[];
  professionTotals: Map<string, number>;
  reviewedCodeSet: Set<string>;
  onSelectProfession: (code: string) => void;
};

export function PayrollProfessionSelector({
  selectedProfession,
  professionCards,
  professionTotals,
  reviewedCodeSet,
  onSelectProfession,
}: PayrollProfessionSelectorProps) {
  // UX Fix: นับจำนวนเพื่อแสดงสถานะภาพรวม
  const totalProfessions = professionCards.length - 1; // ลบ 'all' ออก
  const reviewedCount = reviewedCodeSet.size;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
          <LayoutGrid className="h-5 w-5 text-primary" />
          สถานะการตรวจสอบรายวิชาชีพ
        </h2>
        <p className="ml-7 text-xs text-muted-foreground">
          สลับดูข้อมูลเพื่อตรวจสอบทีละกลุ่มวิชาชีพ (ตรวจแล้ว {reviewedCount}/{totalProfessions})
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-top-2 duration-300 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {professionCards.map((profession) => {
          const isActive = selectedProfession === profession.code;
          const isReviewed = reviewedCodeSet.has(profession.code.toUpperCase());
          const totalAmount = Number(professionTotals.get(profession.code) ?? 0);
          const reviewTone = resolveProfessionReviewTone({
            isReviewed,
            totalAmount,
          });

          const isAllCard = profession.code === 'all';

          return (
            <Button
              key={profession.code}
              type="button"
              variant="ghost"
              onClick={() => onSelectProfession(profession.code)}
              className={cn(
                'relative h-auto flex-col items-start gap-2.5 rounded-xl border p-4 text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive
                  ? 'border-primary shadow-md ring-1 ring-primary'
                  : 'border-border bg-card hover:border-primary/40 hover:shadow-sm',
                !isAllCard && isReviewed && !isActive
                  ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50'
                  : 'bg-card',
                isActive && !isAllCard && isReviewed && 'bg-emerald-50/30',
              )}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span
                  className={cn(
                    'truncate pr-2 text-sm font-semibold',
                    isActive ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {profession.label}
                </span>

                {!isAllCard &&
                  (reviewTone.useCheckIcon ? (
                    <CheckCircle2 className={cn('h-4 w-4 shrink-0', reviewTone.indicatorClassName)} />
                  ) : (
                    <span
                      className={cn(
                        'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                        reviewTone.indicatorClassName,
                      )}
                    />
                  ))}
              </div>

              <div className="mt-auto w-full pt-1">
                <p
                  className={cn(
                    'text-xl font-bold tracking-tight tabular-nums',
                    isActive
                      ? 'text-foreground'
                      : !isAllCard && isReviewed
                        ? 'text-slate-700'
                        : 'text-muted-foreground',
                  )}
                >
                  {formatThaiNumber(totalAmount)}
                  <span
                    className={cn(
                      'ml-1 text-[11px] font-normal',
                      !isAllCard && isReviewed ? 'text-slate-500' : 'text-muted-foreground',
                    )}
                  >
                    บาท
                  </span>
                </p>
              </div>

              {!isAllCard && (
                <div
                  className={cn(
                    'absolute bottom-0 left-0 h-1 w-full rounded-b-xl opacity-80',
                    reviewTone.barClassName,
                  )}
                />
              )}
              {isAllCard && isActive && (
                <div className="absolute bottom-0 left-0 h-1 w-full rounded-b-xl bg-primary opacity-80" />
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
