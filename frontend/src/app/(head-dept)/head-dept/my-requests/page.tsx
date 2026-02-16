'use client';

export const dynamic = 'force-dynamic';

import { HeadScopeMyRequestsPage } from '@/features/head-approval/screens/head-scope-my-requests-page';

export default function HeadDeptMyRequestsPage() {
  return <HeadScopeMyRequestsPage basePath="/head-dept" />;
}
