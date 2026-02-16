'use client';

import { HeadScopeRequestsPage } from '@/features/head-approval/screens/head-scope-requests-page';

export default function HeadDeptRequestsPage() {
  return (
    <HeadScopeRequestsPage
      basePath="/head-dept"
      approverTitle="อนุมัติคำขอ (หัวหน้ากลุ่มงาน)"
      approverDescription="ตรวจสอบคำขอ พ.ต.ส. ใน scope ของกลุ่มงานที่รับผิดชอบก่อนส่งต่อขั้นถัดไป"
    />
  );
}
