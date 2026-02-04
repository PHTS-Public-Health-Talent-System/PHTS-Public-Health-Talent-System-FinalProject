# UI Components & Form Specifications

เอกสารกำกับดูแลงานออกแบบส่วนหน้า (Frontend Design System)
และการจัดการแบบฟอร์ม (Form Handling) ของระบบ PHTS

---

## 1. Design System Foundation

### 1.1 Tech Stack & Libraries

- **Framework:** Next.js 16.1 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Primitives:** Radix UI (Headless components for accessibility)
- **Icons:** Lucide React
- **Form Logic:** React Hook Form + Zod Resolver
- **Data Fetching:** TanStack Query (React Query)

### 1.2 Theme & Layout (Global)

- **Font:** Inter (หรือฟอนต์ไทยที่รองรับเช่น Sarabun)
- **Colors:**
  - Primary: Blue/Indigo shades (ราชการ/ทางการ)
  - Status Colors:
    - `Success` (Green): Approved, Completed
    - `Warning` (Yellow/Orange): Pending, Returned
    - `Error` (Red): Rejected, Overdue
    - `Neutral` (Gray): Draft, Closed
- **Responsive:** Mobile-First Strategy (รองรับการใช้งานบนมือถือสำหรับ User ทั่วไป)

---

## 2. Key Page Specifications

### 2.1 Login & Authentication

- **Path:** `/login`
- **UI Components:**
  - Input: `Citizen ID` (13 digits numeric only)
  - Input: `Password` (Masked)
  - Button: "เข้าสู่ระบบ"
- **Validation:**
  - Citizen ID ต้องเป็นตัวเลข 13 หลักเท่านั้น
  - Password ต้องไม่ว่างเปล่า
- **Feedback:** หาก Login ผิดพลาด ให้แจ้งเตือน "เลขบัตรประชาชนหรือรหัสผ่านไม่ถูกต้อง" (ไม่ระบุเจาะจงเพื่อ Security)

### 2.2 Dashboard (Landing Page)

- **Path:** `/dashboard`
- **Components:**
  - **Stats Cards:** แสดงสถานะคำขอปัจจุบัน (Draft, Pending, Approved)
  - **Action Button:** "ยื่นคำขอใหม่" (Floating Action Button on Mobile, Top Right on Desktop)
  - **Announcement Widget:** แจ้งเตือนข่าวสารจาก Admin/HR
  - **Current Period Info:** แสดงงวดเดือนปัจจุบันและสถานะ (เปิด/ปิด)

### 2.3 My Requests List

- **Path:** `/requests/my-requests`
- **Table/List View:**
  - Columns: วันที่ยื่น, ประเภทคำขอ, งวดเดือน, สถานะ (Badge), Action (ดู/แก้ไข)
  - **Filter:** ปีงบประมาณ, สถานะ

---

## 3. The "Request Form" Specification (Core Feature)

อ้างอิง Flow จาก `Wireframe_Request_Form_TH.md` แบ่งเป็น 4 ขั้นตอน (Step Wizard)

### Step 1: ข้อมูลทั่วไป (General Info)

- **Source:** Prefill from `/api/requests/prefill`
- **Fields:**
  - `citizen_id`: Read-only
  - `full_name`: Read-only
  - `position`: Read-only
  - `department`: Read-only
  - `request_type`: Dropdown (ยื่นใหม่, ปรับปรุง, เปลี่ยนเรท)
  - `effective_date`: Date Picker (วันที่เริ่มมีผล - Default คือวันที่บรรจุ หรือแก้ไขได้ตามจริง)

### Step 2: ข้อมูลใบประกอบวิชาชีพ (License)

- **Logic:** ดึงข้อมูลใบล่าสุดจาก DB มาแสดง ถ้าไม่มีให้กรอกใหม่
- **Fields:**
  - `license_no`: Text Input
  - `issue_date`: Date Picker
  - `expire_date`: Date Picker (ระบบต้องแจ้งเตือนทันทีหากเลือกวันที่ในอดีต)

### Step 3: รายละเอียดการปฏิบัติงาน (Work Details)

- **Dynamic UI:** เปลี่ยนตามกลุ่มวิชาชีพ (Medical, Nurse, Dentist, etc.)
- **Position Group Selection:** Radio Button/Cards เลือกกลุ่มเรท (กลุ่ม 1, 2, 3)
- **Conditions:** Checkbox list ตามกฎเกณฑ์ของกลุ่มนั้นๆ
  - _Example (Nurse Group 2):_ [ ] ER [ ] OR [ ] IC [ ] Dialysis
- **Validation:**
  - ต้องเลือกอย่างน้อย 1 เงื่อนไข
  - หากเลือกกลุ่ม 3 ต้องแนบเอกสารวุฒิบัตรเพิ่มเติมใน Step 4

### Step 4: เอกสารแนบ (Attachments)

- **UI:** File Upload Zone (Drag & Drop)
- **Required Files:**
  1.  สำเนาคำสั่งแต่งตั้ง (Order)
  2.  สำเนาใบประกอบวิชาชีพ (License)
  3.  วุฒิบัตร/หนังสือรับรอง (Certificate) - เฉพาะบางเรท
- **OCR Integration:**
  - เมื่ออัปโหลดเสร็จ แสดง Progress Bar "กำลังวิเคราะห์เอกสาร..."
  - เมื่อ OCR เสร็จ แสดงสถานะ "ตรวจสอบแล้ว" (Green Check)
  - **Blocking Rule:** ปุ่ม "ยืนยันการส่ง" (Submit) จะ Disabled จนกว่าไฟล์สำคัญจะผ่าน OCR

---

## 4. Approval Workflow UI (For Approvers)

### 4.1 Pending Approvals List

- **Path:** `/approvals/pending`
- **UI:** Card List หรือ Table
- **Group By:** แยกตามหน่วยงาน/แผนก (Department)

### 4.2 Approval Detail Modal/Page

- **Path:** `/approvals/:id`
- **Components:**
  - **Comparison View:** แสดงข้อมูลเดิม vs ข้อมูลใหม่ (กรณีแก้ไข)
  - **Attachment Preview:** ดูไฟล์แนบ PDF/Image
  - **Action Panel (Sticky Bottom):**
    - Button: "อนุมัติ" (Approve) -> สีเขียว
    - Button: "ส่งคืนแก้ไข" (Return) -> สีเหลือง (บังคับกรอกเหตุผล)
    - Button: "ไม่อนุมัติ" (Reject) -> สีแดง (บังคับกรอกเหตุผล)

---

## 5. Form Validation Schema (Zod)

### 5.1 Request Form Schema

```typescript
import { z } from 'zod';

export const requestFormSchema = z.object({
  requestType: z.enum(['NEW', 'RENEW', 'CHANGE_RATE']),
  effectiveDate: z.date({
    required_error: 'กรุณาระบุวันที่มีผล',
  }),
  license: z.object({
    number: z.string().min(5, 'เลขใบอนุญาตไม่ถูกต้อง'),
    expireDate: z.date().refine((date) => date > new Date(), {
      message: 'ใบอนุญาตหมดอายุแล้ว',
    }),
  }),
  positionGroup: z.string().min(1, 'กรุณาเลือกกลุ่มงาน'),
  conditions: z.array(z.string()).min(1, 'ต้องเลือกเงื่อนไขอย่างน้อย 1 ข้อ'),
  attachments: z
    .array(
      z.object({
        fileId: z.string(),
        ocrStatus: z.enum(['COMPLETED', 'PENDING', 'FAILED']),
      }),
    )
    .refine((files) => files.every((f) => f.ocrStatus === 'COMPLETED'), {
      message: 'กรุณารอผลการตรวจสอบเอกสารให้ครบถ้วน',
    }),
});
```

---

## 6. Feedback & Notification Components

### 6.1 Toast Notifications (Sonner/React-Hot-Toast)

- ใช้แจ้งเตือนผลการกระทำชั่วคราว (Success/Error)
- _Position:_ Top-Right (Desktop), Top-Center (Mobile)

### 6.2 Alert Dialogs

- ใช้สำหรับยืนยันการกระทำที่สำคัญ (Destructive/Commit)
- _Example:_ "ยืนยันการส่งคำขอ? ข้อมูลจะไม่สามารถแก้ไขได้ระหว่างการตรวจสอบ"

### 6.3 Skeleton Loaders

- ใช้แสดงระหว่างโหลดข้อมูล (Data Fetching) แทน Spinner เพื่อประสบการณ์ที่ดีกว่า

```

```
