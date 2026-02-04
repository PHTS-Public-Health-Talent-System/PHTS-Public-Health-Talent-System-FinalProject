# Database Schema & Data Dictionary

> เอกสารอ้างอิงโครงสร้างฐานข้อมูล MySQL ของระบบ PHTS (Public Health Talent System)
> Schema Name: `phts_system`
> Engine: InnoDB / Charset: utf8mb4

## 1. Authentication & User Management

ตารางจัดการผู้ใช้งาน การเข้าสู่ระบบ และการตั้งค่าส่วนตัว

### 1.1 `users`

ตารางหลักสำหรับเก็บข้อมูล Credential ในการ Login และสิทธิ์การใช้งาน

- **Primary Key:** `id` (UUID)

| Column          | Type         | Description                                                                                                                         |
| :-------------- | :----------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | CHAR(36)     | รหัสอ้างอิงผู้ใช้งาน (UUID)                                                                                                         |
| `citizen_id`    | VARCHAR(13)  | เลขบัตรประชาชน (ใช้เป็น Username)                                                                                                   |
| `password_hash` | VARCHAR(255) | รหัสผ่านที่เข้ารหัสแล้ว (Bcrypt/Argon2)                                                                                             |
| `role`          | ENUM         | บทบาทผู้ใช้งาน (`USER`, `HEAD_WARD`, `HEAD_DEPT`, `PTS_OFFICER`, `HEAD_HR`, `HEAD_FINANCE`, `DIRECTOR`, `FINANCE_OFFICER`, `ADMIN`) |
| `is_active`     | TINYINT(1)   | สถานะบัญชี (1=ใช้งาน, 0=ระงับ)                                                                                                      |
| `last_login_at` | DATETIME     | เวลาที่เข้าสู่ระบบล่าสุด                                                                                                            |
| `created_at`    | DATETIME     | เวลาที่สร้างบัญชี                                                                                                                   |

### 1.2 `sig_images`

เก็บไฟล์ลายเซ็นดิจิทัลของผู้ใช้งาน

- **Foreign Key:** `user_id` -> `users.id`

| Column        | Type         | Description                                          |
| :------------ | :----------- | :--------------------------------------------------- |
| `id`          | INT (AI)     | รหัสรูปภาพลายเซ็น                                    |
| `user_id`     | CHAR(36)     | เจ้าของลายเซ็น                                       |
| `file_path`   | VARCHAR(255) | path ที่เก็บไฟล์ใน Server (`uploads/signatures/...`) |
| `is_current`  | TINYINT(1)   | เป็นลายเซ็นปัจจุบันที่ใช้งานอยู่ (1=ใช่)             |
| `uploaded_at` | DATETIME     | เวลาที่อัปโหลด                                       |

---

## 2. Employee Profile (HRMS Data)

ตารางเก็บข้อมูลบุคลากรที่ Sync มาจากระบบ HRMS หรือนำเข้าเพื่อใช้คำนวณสิทธิ์

### 2.1 `emp_profiles`

ข้อมูลส่วนตัวและตำแหน่งงานปัจจุบันของบุคลากร

- **Unique Key:** `citizen_id`

| Column            | Type         | Description                                                     |
| :---------------- | :----------- | :-------------------------------------------------------------- |
| `id`              | CHAR(36)     | รหัสโปรไฟล์ (UUID)                                              |
| `citizen_id`      | VARCHAR(13)  | เลขบัตรประชาชน (Link กับตาราง users)                            |
| `prefix`          | VARCHAR(50)  | คำนำหน้าชื่อ (นาย, นาง, นางสาว, ดร., พญ., นพ., ทพ.)             |
| `fname`           | VARCHAR(100) | ชื่อจริง (ภาษาไทย)                                              |
| `lname`           | VARCHAR(100) | นามสกุล (ภาษาไทย)                                               |
| `position_name`   | VARCHAR(150) | ชื่อตำแหน่งตามสายงาน (เช่น พยาบาลวิชาชีพชำนาญการ)               |
| `level`           | VARCHAR(50)  | ระดับตำแหน่ง (ปฏิบัติการ, ชำนาญการ, เชี่ยวชาญ)                  |
| `department_code` | VARCHAR(20)  | รหัสหน่วยงาน/แผนก                                               |
| `ward_code`       | VARCHAR(20)  | รหัสหอผู้ป่วย/ฝ่ายงานย่อย                                       |
| `work_status`     | ENUM         | สถานะการทำงาน (`ACTIVE`, `RESIGNED`, `RETIRED`, `TRANSFER_OUT`) |

### 2.2 `emp_licenses`

ข้อมูลใบอนุญาตประกอบวิชาชีพ (สำคัญมากสำหรับการคำนวณเงิน)

- **Foreign Key:** `profile_id` -> `emp_profiles.id`

| Column        | Type        | Description                                       |
| :------------ | :---------- | :------------------------------------------------ |
| `id`          | INT (AI)    | รหัสรายการใบอนุญาต                                |
| `profile_id`  | CHAR(36)    | เจ้าของใบอนุญาต                                   |
| `license_no`  | VARCHAR(50) | เลขที่ใบอนุญาต                                    |
| `issue_date`  | DATE        | วันที่ออกใบอนุญาต                                 |
| `expire_date` | DATE        | วันที่หมดอายุ (ใช้ตัดสิทธิ์การจ่ายเงินหากหมดอายุ) |
| `is_active`   | TINYINT(1)  | สถานะใบอนุญาต (1=ใช้งานได้)                       |

### 2.3 `emp_movements`

ประวัติการเคลื่อนไหว/คำสั่งแต่งตั้ง/การเปลี่ยนตำแหน่ง

- **Foreign Key:** `profile_id` -> `emp_profiles.id`

| Column           | Type         | Description                                                               |
| :--------------- | :----------- | :------------------------------------------------------------------------ |
| `id`             | INT (AI)     | รหัสรายการเคลื่อนไหว                                                      |
| `profile_id`     | CHAR(36)     | บุคลากรที่ถูกสั่ง                                                         |
| `movement_type`  | ENUM         | ประเภทคำสั่ง (`NEW_ENTRY`, `PROMOTION`, `TRANSFER_IN`, `CHANGE_POSITION`) |
| `doc_ref_no`     | VARCHAR(100) | เลขที่คำสั่งอ้างอิง                                                       |
| `effective_date` | DATE         | วันที่มีผลบังคับใช้                                                       |
| `remark`         | TEXT         | หมายเหตุเพิ่มเติม                                                         |

---

## 3. Request System (Workflow)

ตารางหลักสำหรับการยื่นคำขอและกระบวนการอนุมัติ

### 3.1 `req_submissions`

Header ของคำขอแต่ละรายการ

- **Status Flow:** `DRAFT` -> `SUBMITTED` -> `APPROVED_1` -> ... -> `COMPLETED`

| Column         | Type     | Description                                                                        |
| :------------- | :------- | :--------------------------------------------------------------------------------- |
| `id`           | CHAR(36) | รหัสคำขอ (UUID)                                                                    |
| `user_id`      | CHAR(36) | ผู้ยื่นคำขอ                                                                        |
| `request_type` | ENUM     | ประเภทคำขอ (`NEW`, `RENEW`, `CHANGE_RATE`, `EDIT_INFO`)                            |
| `current_step` | INT      | ขั้นตอนปัจจุบัน (0-6)                                                              |
| `status`       | ENUM     | สถานะคำขอ (`DRAFT`, `SUBMITTED`, `RETURNED`, `REJECTED`, `COMPLETED`, `CANCELLED`) |
| `period_month` | INT      | เดือนของงวดที่ยื่น (1-12)                                                          |
| `period_year`  | INT      | ปีงบประมาณ (พ.ศ.)                                                                  |
| `submitted_at` | DATETIME | เวลากดยืนยันส่งคำขอ                                                                |

### 3.2 `req_eligibility`

ข้อมูลคุณสมบัติที่ผู้ใช้กรอกมาในคำขอ (Snapshot ของข้อมูล ณ ตอนยื่น)

- **Foreign Key:** `request_id` -> `req_submissions.id`

| Column           | Type          | Description                                |
| :--------------- | :------------ | :----------------------------------------- |
| `request_id`     | CHAR(36)      | รหัสคำขอ                                   |
| `position_group` | VARCHAR(50)   | กลุ่มตำแหน่งที่ขอเบิก (เช่น Nurse_Group_2) |
| `requested_rate` | DECIMAL(10,2) | อัตราเงินที่ขอเบิก (บาท)                   |
| `license_no`     | VARCHAR(50)   | เลขใบอนุญาตที่ใช้อ้างอิงในคำขอนี้          |
| `work_condition` | TEXT          | ลักษณะงานที่ปฏิบัติ (Checkbox list JSON)   |

### 3.3 `req_approvals`

Log การอนุมัติในแต่ละขั้นตอน (Audit Trail)

- **Foreign Key:** `request_id` -> `req_submissions.id`

| Column        | Type     | Description                                       |
| :------------ | :------- | :------------------------------------------------ |
| `id`          | INT (AI) | รหัสรายการอนุมัติ                                 |
| `request_id`  | CHAR(36) | รหัสคำขอ                                          |
| `approver_id` | CHAR(36) | ผู้ดำเนินการอนุมัติ/ตีกลับ                        |
| `step_role`   | ENUM     | บทบาทในขั้นตอนนี้ (`HEAD_WARD`, `HEAD_DEPT`, ...) |
| `action`      | ENUM     | การกระทำ (`APPROVE`, `RETURN`, `REJECT`)          |
| `comment`     | TEXT     | ความเห็นเพิ่มเติม                                 |
| `action_at`   | DATETIME | เวลาที่ดำเนินการ                                  |

### 3.4 `req_attachments`

ไฟล์เอกสารแนบประกอบคำขอ

- **Foreign Key:** `request_id` -> `req_submissions.id`

| Column          | Type         | Description                                               |
| :-------------- | :----------- | :-------------------------------------------------------- |
| `id`            | INT (AI)     | รหัสไฟล์แนบ                                               |
| `request_id`    | CHAR(36)     | รหัสคำขอ                                                  |
| `file_type`     | ENUM         | ประเภทเอกสาร (`LICENSE`, `ORDER`, `CERTIFICATE`, `OTHER`) |
| `file_path`     | VARCHAR(255) | Path ไฟล์                                                 |
| `original_name` | VARCHAR(255) | ชื่อไฟล์เดิมที่อัปโหลด                                    |

---

## 4. OCR & Verification Results

ตารางเก็บผลลัพธ์จากการประมวลผล AI/OCR

### 4.1 `req_ocr_results`

ผลการอ่านข้อความจากไฟล์แนบ (Typhoon OCR Output)

- **Foreign Key:** `attachment_id` -> `req_attachments.id`

| Column           | Type        | Description                                                |
| :--------------- | :---------- | :--------------------------------------------------------- |
| `attachment_id`  | INT         | ไฟล์ที่ถูกประมวลผล                                         |
| `status`         | ENUM        | สถานะ OCR (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`) |
| `raw_text`       | LONGTEXT    | ข้อความดิบทั้งหมดที่อ่านได้                                |
| `confidence`     | FLOAT       | ค่าความมั่นใจเฉลี่ย (0.0 - 1.0)                            |
| `processed_at`   | DATETIME    | เวลาที่ประมวลผลเสร็จ                                       |
| `engine_version` | VARCHAR(50) | รุ่นของโมเดลที่ใช้ (เช่น Typhoon-1.5-2B)                   |

---

## 5. Payroll & Payment (Calculation)

ตารางเก็บผลงวดการจ่ายเงินและการคำนวณ

### 5.1 `pay_periods`

งวดการจ่ายเงินแต่ละเดือน

- **Primary Key:** `id` (YYYYMM Format, e.g., 202510)

| Column         | Type          | Description                                        |
| :------------- | :------------ | :------------------------------------------------- |
| `id`           | INT           | รหัสงวด (YYYYMM)                                   |
| `month`        | INT           | เดือน (1-12)                                       |
| `year_be`      | INT           | ปี พ.ศ.                                            |
| `status`       | ENUM          | สถานะงวด (`OPEN`, `CALCULATING`, `CLOSED`, `PAID`) |
| `total_amount` | DECIMAL(15,2) | ยอดรวมจ่ายทั้งงวด                                  |
| `closed_at`    | DATETIME      | เวลาที่ปิดงวด (Lock ข้อมูล)                        |

### 5.2 `pay_results`

สรุปยอดจ่ายรายบุคคลในแต่ละงวด (Payslip Header)

- **Foreign Key:** `period_id` -> `pay_periods.id`

| Column         | Type          | Description                    |
| :------------- | :------------ | :----------------------------- |
| `id`           | CHAR(36)      | รหัสรายการจ่าย                 |
| `period_id`    | INT           | รหัสงวด                        |
| `user_id`      | CHAR(36)      | ผู้รับเงิน                     |
| `base_rate`    | DECIMAL(10,2) | อัตราเต็มเดือนที่ได้รับอนุมัติ |
| `work_days`    | INT           | จำนวนวันทำการที่มีสิทธิ์       |
| `deduct_days`  | INT           | จำนวนวันที่ถูกหัก (ลาเกิน/ขาด) |
| `net_amount`   | DECIMAL(10,2) | ยอดเงินสุทธิที่จะได้รับ        |
| `retro_amount` | DECIMAL(10,2) | ยอดตกเบิกรับ/คืน (บวกหรือลบ)   |
| `total_pay`    | DECIMAL(10,2) | ยอดรวมรับจริง (Net + Retro)    |

### 5.3 `pay_result_items`

รายละเอียดการคำนวณรายวัน (สำหรับการตรวจสอบ/Audit)

- **Foreign Key:** `pay_result_id` -> `pay_results.id`

| Column          | Type          | Description                               |
| :-------------- | :------------ | :---------------------------------------- |
| `id`            | BIGINT (AI)   | รหัสรายการย่อย                            |
| `pay_result_id` | CHAR(36)      | รายการจ่ายหลัก                            |
| `date_calc`     | DATE          | วันที่คำนวณ                               |
| `is_eligible`   | TINYINT(1)    | ได้สิทธิ์ในวันนี้หรือไม่ (1/0)            |
| `leave_code`    | VARCHAR(20)   | รหัสการลา (ถ้ามี) เช่น `sick`, `vacation` |
| `daily_amount`  | DECIMAL(10,2) | ยอดเงินที่ได้ในวันนี้                     |
| `note`          | VARCHAR(100)  | หมายเหตุ (เช่น "ลาเกินโควตา")             |
