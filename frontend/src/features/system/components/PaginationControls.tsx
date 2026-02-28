import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
};

export function PaginationControls({ page, totalPages, onPrev, onNext }: PaginationControlsProps) {
  // UX Best Practice: ซ่อน Pagination หากข้อมูลมีเพียง 1 หน้าหรือไม่ถึง 1 หน้า
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
      <div className="text-sm text-muted-foreground">
        หน้า <span className="font-medium text-foreground">{page}</span> จาก {totalPages}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={onPrev}
          className="gap-1 px-3"
        >
          <ChevronLeft className="h-4 w-4" />
          {/* ซ่อนข้อความบนจอมือถือ เพื่อประหยัดพื้นที่ */}
          <span className="hidden sm:inline">ก่อนหน้า</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={onNext}
          className="gap-1 px-3"
        >
          <span className="hidden sm:inline">ถัดไป</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
