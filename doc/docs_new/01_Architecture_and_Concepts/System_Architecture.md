# System Architecture & Tech Stack

> เอกสารอธิบายสถาปัตยกรรมภาพรวมของระบบ PHTS (Public Health Talent System)
> ฉบับปรับปรุงสำหรับการทำงานจริง (Runtime Environment)

## 1. High-Level Architecture

ระบบถูกออกแบบด้วยสถาปัตยกรรมแบบ **Decoupled Architecture** แยกส่วนการทำงานระหว่าง Frontend, Backend และ AI Services ออกจากกันอย่างชัดเจน เพื่อความยืดหยุ่นในการขยายระบบ (Scalability) และการดูแลรักษา (Maintainability)

### Diagram Overview

```mermaid
graph TD
    User[Client / Browser] -->|HTTPS| Frontend[Frontend App (Next.js)]
    Frontend -->|REST API| Backend[Backend API (Node.js/Express)]
    Backend <-->|SQL| DB[(MySQL Database)]
    Backend <-->|Redis Protocol| Queue[(Redis Queue)]

    subgraph "AI / OCR Services"
        Worker[OCR Worker] -->|Dequeue Job| Queue
        Worker -->|HTTP| OCR_Service[Typhoon OCR Service]
        OCR_Service -.->|Fallback| Local_OCR[Local Docker (CPU)]
        OCR_Service -.->|Primary| Cloud_OCR[Typhoon Cloud API]
    end
```

---

## 2. Technology Stack

### 2.1 Frontend (User Interface)

- **Framework:** Next.js 16.1.x (App Router)
- **Language:** TypeScript / React 19
- **Styling:** Tailwind CSS + Radix UI (Headless Component)
- **State Management:** TanStack React Query (Server State), React Context (Client State)
- **Form Management:** React Hook Form + Zod (Validation)
- **HTTP Client:** Axios

### 2.2 Backend (Core API)

- **Runtime:** Node.js
- **Framework:** Express.js + TypeScript
- **Authentication:** Passport.js (JWT Strategy)
- **Report Generation:** ExcelJS (Excel), PDFKit (PDF)
- **Job Queue:** BullMQ / IORedis (สำหรับการประมวลผล OCR แบบ Asynchronous)

### 2.3 Database & Storage

**RDBMS:**

- MySQL 8.x
- Schema หลัก: `phts_system`
- ORM/Query Builder: `mysql2` (Direct driver with raw SQL/Helpers)

**File Storage:**

- Local Disk Storage (ภายใต้ `backend/uploads/*`)
- มีการแยกโฟลเดอร์ตามเดือนและประเภทไฟล์เพื่อประสิทธิภาพ

### 2.4 AI & OCR Service

- **Engine:** Typhoon OCR 1.5 (2B Parameter Model)
- **Deployment Strategy:** Hybrid (Cloud First, Local Fallback)
- **Integration:** แยกเป็น Microservice รันบน Docker Container
- **Communication:** RESTful API ระหว่าง Worker และ OCR Service

---

## 3. Core System Modules

### 3.1 Authentication & Authorization

- **Login:** ใช้เลขบัตรประชาชน (Citizen ID) และรหัสผ่าน
- **Session:** Stateless JWT (JSON Web Token)
- **RBAC:** ควบคุมสิทธิ์ตาม Role 9 ระดับ (User, Head Ward, Head Dept, PTS Officer, etc.)
- **Scope Resolution:** ระบบจะตรวจสอบสิทธิ์การเข้าถึงข้อมูลตามหน่วยงาน (Unit/Department Scope) โดยอัตโนมัติ

### 3.2 Payroll Calculation Engine

- **Logic:** คำนวณแบบ Daily Accumulation (สะสมรายวัน)
- **Precision:** ทศนิยม 2 ตำแหน่ง, ปัดเศษแบบ Half-Up ที่ยอดรวมท้ายสุด
- **Retroactive:** รองรับการคำนวณตกเบิกย้อนหลัง (Diff Calculation) และยอดติดลบ (Debt)

### 3.3 OCR Pipeline

1. **Upload:** ผู้ใช้แนบไฟล์ -> Backend บันทึกไฟล์ -> สร้าง Job ลง Redis
2. **Process:** Worker รับ Job -> ส่งไฟล์ให้ OCR Service วิเคราะห์
3. **Result:** บันทึกผลลัพธ์ (Raw Text + Confidence) ลงตาราง `req_ocr_results`
4. **Gate:** ระบบจะไม่อนุญาตให้ "ส่งคำขอ" (Submit) จนกว่าไฟล์แนบทั้งหมดจะมีสถานะ `COMPLETED`

---

## 4. Key Database Schema Overview

- **Auth & Users:** `users`, `emp_profiles` (เก็บข้อมูลบุคลากร)
- **Requests:**
  - `req_submissions`: หัวตารางคำขอ
  - `req_approvals`: ประวัติการอนุมัติแต่ละขั้น
  - `req_attachments`: ไฟล์แนบ
- **Payroll:**
  - `pay_periods`: งวดการจ่ายเงิน
  - `pay_results`: ผลลัพธ์การคำนวณเงินรายคน
  - `pay_result_items`: รายละเอียดการคำนวณรายวัน (Audit Log)
- **OCR:** `req_ocr_results` (เก็บผลลัพธ์การอ่านไฟล์)

---

## 5. Environment Variables (Configuration)

ตัวแปรสภาพแวดล้อมที่จำเป็นสำหรับ Production

| Category     | Variable                                   | Description                                  |
| ------------ | ------------------------------------------ | -------------------------------------------- |
| **Database** | `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` | การเชื่อมต่อ MySQL                           |
| **Security** | `JWT_SECRET`                               | คีย์สำหรับเข้ารหัส Token                     |
| **CORS**     | `CORS_ORIGIN`                              | โดเมน Frontend ที่อนุญาต                     |
| **OCR**      | `OCR_ENABLED`                              | เปิด/ปิด ระบบ OCR                            |
| **OCR**      | `OCR_SERVICE_URL`                          | ที่อยู่ของ OCR Service (Docker internal URL) |
| **OCR**      | `OCR_API_KEY`                              | API Key สำหรับ Cloud Fallback                |
