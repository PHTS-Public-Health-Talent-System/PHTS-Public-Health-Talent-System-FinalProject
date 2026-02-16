'use client';

import { use } from 'react';
import { PayrollDetailContent } from '@/features/payroll/components/PayrollDetailContent';
import { usePayrollReviewProgress } from '@/features/payroll/usePayrollReviewProgress';

export default function HeadFinancePayrollDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { reviewedCodes } = usePayrollReviewProgress(id);

  return (
    <PayrollDetailContent
      periodId={id}
      selectedProfession="all"
      basePath={`/head-finance/payroll/${id}`}
      approvalRole="HEAD_FINANCE"
      showTable={false}
      showSummary={false}
      showSelector
      reviewedProfessionCodes={reviewedCodes}
    />
  );
}
