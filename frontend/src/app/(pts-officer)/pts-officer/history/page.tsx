import { HeadScopeHistoryPage } from '@/features/head-approval/screens/head-scope-history-page';

export const dynamic = 'force-dynamic';

export default function PtsOfficerHistoryPage() {
  return (
    <HeadScopeHistoryPage
      basePath="/pts-officer"
      roleTitle="เจ้าหน้าที่ พ.ต.ส."
      roleKey="PTS_OFFICER"
    />
  );
}

