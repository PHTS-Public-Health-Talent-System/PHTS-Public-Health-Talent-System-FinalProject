'use client';

import { HeadScopeRequestsPage } from '@/features/head-approval/screens/head-scope-requests-page';

export default function HeadWardRequestsPage() {
  return (
    <HeadScopeRequestsPage
      basePath="/head-ward"
      approverTitle="อนุมัติคำขอ (หัวหน้าตึก/หัวหน้างาน)"
      approverDescription="ตรวจสอบคำขอ พ.ต.ส. ใน scope ของหน่วยงานที่รับผิดชอบก่อนส่งต่อขั้นถัดไป"
    />
  );
}
