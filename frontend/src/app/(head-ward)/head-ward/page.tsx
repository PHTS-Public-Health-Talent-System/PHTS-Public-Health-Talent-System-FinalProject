'use client';

export const dynamic = 'force-dynamic';

import { HeadScopeDashboardPage } from '@/features/head-approval/screens/head-scope-dashboard-page';

export default function HeadWardDashboardPage() {
  return <HeadScopeDashboardPage basePath="/head-ward" roleTitle="หัวหน้าตึก/หัวหน้างาน" />;
}
