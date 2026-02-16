'use client';

import { HeadScopeRequestDetailPage } from '@/features/head-approval/screens/head-scope-request-detail-page';

export default function HeadDeptRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <HeadScopeRequestDetailPage params={params} basePath="/head-dept" />;
}
