import { HeadScopeHistoryPage } from '@/features/head-approval/screens/head-scope-history-page';

export const dynamic = 'force-dynamic';

export default function HeadHrHistoryPage() {
  return (
    <HeadScopeHistoryPage
      basePath="/head-hr"
      roleTitle="หัวหน้าทรัพยากรบุคคล"
      roleKey="HEAD_HR"
    />
  );
}

