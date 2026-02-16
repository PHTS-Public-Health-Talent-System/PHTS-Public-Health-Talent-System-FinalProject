import { HeadScopeHistoryPage } from '@/features/head-approval/screens/head-scope-history-page';

export const dynamic = 'force-dynamic';

export default function DirectorHistoryPage() {
  return (
    <HeadScopeHistoryPage
      basePath="/director"
      roleTitle="ผู้อำนวยการ"
      roleKey="DIRECTOR"
    />
  );
}

