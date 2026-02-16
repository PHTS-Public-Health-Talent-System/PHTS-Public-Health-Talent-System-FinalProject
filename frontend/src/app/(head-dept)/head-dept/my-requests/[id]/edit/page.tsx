'use client';

import { HeadScopeMyRequestEditPage } from '@/features/head-approval/screens/head-scope-my-request-edit-page';

export default function HeadDeptMyRequestEditPage({ params }: { params: Promise<{ id: string }> }) {
  return <HeadScopeMyRequestEditPage params={params} basePath="/head-dept" />;
}
