'use client';

import { HeadScopeMyRequestDetailPage } from '@/features/head-approval/screens/head-scope-my-request-detail-page';

export default function HeadWardMyRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <HeadScopeMyRequestDetailPage params={params} basePath="/head-ward" />;
}
