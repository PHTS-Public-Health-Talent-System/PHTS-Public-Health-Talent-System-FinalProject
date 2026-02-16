import { HeadScopeHistoryPage } from '@/features/head-approval/screens/head-scope-history-page';

export const dynamic = 'force-dynamic';

export default function HeadDeptHistoryPage() {
  return (
    <HeadScopeHistoryPage
      basePath="/head-dept"
      roleTitle="หัวหน้ากลุ่มงาน"
      roleKey="HEAD_DEPT"
    />
  );
}
