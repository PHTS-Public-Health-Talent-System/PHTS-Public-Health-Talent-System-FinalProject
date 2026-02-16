'use client';

import * as React from 'react';
import { Calendar as CalendarIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// --- Constants ---

const thaiMonths = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

const shortThaiMonths = [
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

const currentYear = new Date().getFullYear() + 543;

// --- MonthYearPicker ---

interface MonthYearPickerProps {
  value: { month: number; year: number };
  onChange: (value: { month: number; year: number }) => void;
  minYear?: number;
  maxYear?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MonthYearPicker({
  value,
  onChange,
  minYear = currentYear - 10,
  maxYear = currentYear + 10,
  placeholder = 'เลือกเดือน/ปี',
  disabled = false,
  className,
}: MonthYearPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [viewYear, setViewYear] = React.useState(value.year || currentYear);
  const [mode, setMode] = React.useState<'month' | 'year'>('month'); // Switch between picking month or year

  // Reset view to selected year when opening
  React.useEffect(() => {
    if (open) {
      setViewYear(value.year || currentYear);
      setMode('month');
    }
  }, [open, value.year]);

  const handleMonthSelect = (monthIndex: number) => {
    onChange({ month: monthIndex + 1, year: viewYear });
    setOpen(false);
  };

  const years = React.useMemo(() => {
    const y = [];
    for (let i = minYear; i <= maxYear; i++) {
      y.push(i);
    }
    return y;
  }, [minYear, maxYear]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !value.month && 'text-muted-foreground',
            className,
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
          {value.month && value.year ? (
            `${thaiMonths[value.month - 1]} ${value.year}`
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="p-3">
          {/* Header (Switch Mode) */}
          <div className="flex items-center justify-center mb-4">
            <Button
              variant="ghost"
              size="sm"
              className="font-semibold text-lg hover:bg-secondary w-full"
              onClick={() => setMode(mode === 'month' ? 'year' : 'month')}
            >
              {mode === 'month' ? `พ.ศ. ${viewYear}` : 'เลือกปี พ.ศ.'}
            </Button>
          </div>

          {/* Month Selection Mode */}
          {mode === 'month' && (
            <div className="grid grid-cols-3 gap-2">
              {shortThaiMonths.map((month, index) => {
                const isSelected = value.month === index + 1 && value.year === viewYear;
                const isCurrentMonth =
                  new Date().getMonth() === index && new Date().getFullYear() + 543 === viewYear;
                return (
                  <Button
                    key={month}
                    variant={isSelected ? 'default' : 'outline'}
                    className={cn(
                      'h-9 text-xs font-normal',
                      isSelected && 'font-semibold',
                      !isSelected &&
                        'border-transparent bg-transparent hover:bg-secondary hover:text-foreground',
                      isCurrentMonth && !isSelected && 'border-primary/20 text-primary',
                    )}
                    onClick={() => handleMonthSelect(index)}
                  >
                    {month}
                  </Button>
                );
              })}
            </div>
          )}

          {/* Year Selection Mode */}
          {mode === 'year' && (
            <ScrollArea className="h-[240px] pr-3">
              <div className="grid grid-cols-3 gap-2">
                {years.map((year) => {
                  const isSelected = viewYear === year;
                  const isCurrentYear = currentYear === year;
                  return (
                    <Button
                      key={year}
                      variant={isSelected ? 'default' : 'ghost'}
                      className={cn(
                        'h-9 text-sm font-normal',
                        isSelected && 'font-semibold',
                        isCurrentYear && !isSelected && 'text-primary font-medium',
                      )}
                      onClick={() => {
                        setViewYear(year);
                        setMode('month'); // Go back to month selection after picking year
                      }}
                    >
                      {year}
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer (Quick Action) */}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs h-8"
            onClick={() => {
              const now = new Date();
              onChange({ month: now.getMonth() + 1, year: now.getFullYear() + 543 });
              setOpen(false);
            }}
          >
            เดือนปัจจุบัน
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// --- YearPicker (Standalone) ---

interface YearPickerProps {
  value: number;
  onChange: (year: number) => void;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
  className?: string;
}

export function YearPicker({
  value,
  onChange,
  minYear = currentYear - 10,
  maxYear = currentYear + 10,
  disabled = false,
  className,
}: YearPickerProps) {
  const [open, setOpen] = React.useState(false);

  const years = React.useMemo(() => {
    const y = [];
    for (let i = minYear; i <= maxYear; i++) {
      y.push(i);
    }
    return y;
  }, [minYear, maxYear]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[120px] justify-between font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
          disabled={disabled}
        >
          {value || 'เลือกปี'}
          <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <ScrollArea className="h-[300px]">
          <div className="p-2 space-y-1">
            {years.map((year) => (
              <Button
                key={year}
                variant="ghost"
                className={cn(
                  'w-full justify-between font-normal h-8 px-2',
                  value === year && 'bg-secondary font-medium',
                )}
                onClick={() => {
                  onChange(year);
                  setOpen(false);
                }}
              >
                {year}
                {value === year && <Check className="h-4 w-4 opacity-50" />}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
