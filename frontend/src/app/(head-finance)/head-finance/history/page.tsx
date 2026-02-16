import { HeadScopeHistoryPage } from '@/features/head-approval/screens/head-scope-history-page';

export const dynamic = 'force-dynamic';

export default function HeadFinanceHistoryPage() {
  return (
    <HeadScopeHistoryPage
      basePath="/head-finance"
      roleTitle="หัวหน้าการเงิน"
      roleKey="HEAD_FINANCE"
    />
  );
}

