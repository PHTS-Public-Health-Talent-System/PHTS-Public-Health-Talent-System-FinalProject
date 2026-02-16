import { HeadScopeHistoryPage } from '@/features/head-approval/screens/head-scope-history-page';

export const dynamic = 'force-dynamic';

export default function HeadWardHistoryPage() {
  return (
    <HeadScopeHistoryPage
      basePath="/head-ward"
      roleTitle="หัวหน้าตึก/หัวหน้างาน"
      roleKey="HEAD_WARD"
    />
  );
}
