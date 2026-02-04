# Backend API Specification

เอกสารระบุรายการ API Endpoint หลักของระบบ PHTS
**Base URL:** `/api/v1`
**Authentication:** Bearer Token (JWT) in Header `Authorization`

---

## 1. Authentication & Profile

จัดการการเข้าสู่ระบบและข้อมูลผู้ใช้

| Method | Endpoint             | Role   | Description                                    |
| :----- | :------------------- | :----- | :--------------------------------------------- |
| `POST` | `/auth/login`        | Public | เข้าสู่ระบบด้วย Citizen ID + Password          |
| `POST` | `/auth/refresh`      | User   | ขอ Access Token ใหม่ (Refresh Token)           |
| `POST` | `/auth/logout`       | User   | ออกจากระบบ (Invalidate Token)                  |
| `GET`  | `/profile/me`        | User   | ดึงข้อมูลโปรไฟล์ปัจจุบันและสิทธิ์ (My Profile) |
| `GET`  | `/profile/signature` | User   | ดึง URL รูปลายเซ็นดิจิทัลล่าสุด                |

---

## 2. Request Management (User Side)

สำหรับผู้ใช้งานทั่วไปในการสร้างและติดตามคำขอ

| Method   | Endpoint                            | Description                                    |
| :------- | :---------------------------------- | :--------------------------------------------- |
| `GET`    | `/requests/my-requests`             | ดูรายการคำขอของฉัน (Filter by Status/Year)     |
| `GET`    | `/requests/prefill`                 | ดึงข้อมูลตั้งต้นสำหรับฟอร์ม (จาก HRMS/Profile) |
| `POST`   | `/requests`                         | สร้างคำขอใหม่ (Draft / Submit)                 |
| `GET`    | `/requests/:id`                     | ดูรายละเอียดคำขอรายฉบับ                        |
| `PUT`    | `/requests/:id`                     | แก้ไขคำขอ (เฉพาะสถานะ Draft/Returned)          |
| `DELETE` | `/requests/:id`                     | ยกเลิกคำขอ (เฉพาะสถานะ Draft)                  |
| `POST`   | `/requests/:id/attachments`         | อัปโหลดไฟล์แนบ (Trigger OCR Worker)            |
| `DELETE` | `/requests/:id/attachments/:fileId` | ลบไฟล์แนบ                                      |

---

## 3. Approval Workflow (Approver Side)

สำหรับผู้อนุมัติ (Head Ward, Head Dept, HR, Finance, Director)

| Method | Endpoint                    | Scope    | Description                                |
| :----- | :-------------------------- | :------- | :----------------------------------------- |
| `GET`  | `/approvals/pending`        | By Role  | ดูรายการรออนุมัติ (Filter ตาม Scope งาน)   |
| `GET`  | `/approvals/history`        | By Role  | ดูประวัติการอนุมัติที่ผ่านมา               |
| `POST` | `/approvals/:reqId/approve` | Approver | อนุมัติคำขอ (เลื่อนไปขั้นถัดไป)            |
| `POST` | `/approvals/:reqId/return`  | Approver | ส่งคืนแก้ไข (กลับไปขั้น Draft/User)        |
| `POST` | `/approvals/:reqId/reject`  | Approver | ปฏิเสธคำขอ (ปิดจบไม่อนุมัติ)               |
| `POST` | `/approvals/batch-approve`  | Director | อนุมัติหลายรายการพร้อมกัน (เฉพาะ Director) |

---

## 4. Payroll System (Officer/Finance)

สำหรับเจ้าหน้าที่ พ.ต.ส. และการเงิน

| Method | Endpoint                      | Role    | Description                                       |
| :----- | :---------------------------- | :------ | :------------------------------------------------ |
| `GET`  | `/payroll/periods`            | Officer | ดูรายการงวดการจ่ายเงินทั้งหมด                     |
| `POST` | `/payroll/periods`            | Admin   | เปิดงวดเดือนใหม่ (Generate Period)                |
| `POST` | `/payroll/calculate/:id`      | Officer | สั่งคำนวณเงินทั้งงวด (Trigger Calculation Engine) |
| `POST` | `/payroll/periods/:id/close`  | Finance | ปิดงวด (Lock ข้อมูล ห้ามแก้ไข)                    |
| `GET`  | `/payroll/periods/:id/report` | Finance | ดาวน์โหลดรายงาน PDF/Excel ประจำงวด                |
| `POST` | `/payroll/sync-hrms`          | Admin   | สั่ง Sync ข้อมูลวันลาจาก HRMS (Manual Trigger)    |

---

## 5. OCR Service Integration

การเชื่อมต่อกับระบบ Typhoon OCR

| Method | Endpoint                       | Description                             |
| :----- | :----------------------------- | :-------------------------------------- |
| `GET`  | `/ocr/health`                  | ตรวจสอบสถานะบริการ OCR (Cloud/Local)    |
| `GET`  | `/requests/:reqId/ocr-results` | ดึงผลการอ่าน OCR ของไฟล์แนบในคำขอ       |
| `POST` | `/ocr/retry/:attachmentId`     | สั่งให้ Worker ประมวลผลไฟล์ใหม่อีกครั้ง |

---

## 6. Reports & Data Export

ระบบรายงานสารสนเทศ

| Method | Endpoint                   | Description                               |
| :----- | :------------------------- | :---------------------------------------- |
| `GET`  | `/reports/dashboard-stats` | ข้อมูลสรุปสำหรับ Dashboard (กราฟ/ตัวเลข)  |
| `GET`  | `/reports/export/excel`    | ส่งออกข้อมูลดิบตามเงื่อนไข (Custom Query) |
| `GET`  | `/reports/audit-log`       | ดูประวัติการใช้งานระบบ (Admin Only)       |

---

## 7. Common Response Structure

### Success Response (200 OK)

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "timestamp": "2026-02-01T10:00:00Z"
}

```

### Error Response (4xx, 5xx)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATE",
    "message": "Cannot edit request in APPROVED status"
  },
  "timestamp": "2026-02-01T10:05:00Z"
}
```

---

## 8. Status Code Reference

- **200 OK:** สำเร็จ
- **201 Created:** สร้างข้อมูลใหม่สำเร็จ
- **400 Bad Request:** ข้อมูลนำเข้าไม่ถูกต้อง (Validation Error)
- **401 Unauthorized:** ไม่ได้ Login หรือ Token หมดอายุ
- **403 Forbidden:** ไม่มีสิทธิ์เข้าถึง Resource นี้ (Role/Scope ไม่ถึง)
- **404 Not Found:** ไม่พบข้อมูล
- **422 Unprocessable Entity:** ข้อมูลถูกต้องตาม Format แต่ผิด Logic (เช่น อนุมัติคำขอที่เสร็จไปแล้ว)
- **500 Internal Server Error:** ข้อผิดพลาดจากระบบ (Database/Logic Crash)
