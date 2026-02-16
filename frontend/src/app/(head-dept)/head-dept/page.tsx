'use client';

export const dynamic = 'force-dynamic';

import { HeadScopeDashboardPage } from '@/features/head-approval/screens/head-scope-dashboard-page';

export default function HeadDeptDashboardPage() {
  return <HeadScopeDashboardPage basePath="/head-dept" roleTitle="หัวหน้ากลุ่มงาน" />;
}
