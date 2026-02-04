# Report Generation Specifications

เอกสารกำกับดูแลการออกรายงาน (Reporting System) ของระบบ PHTS
ครอบคลุมรายงานรูปแบบ PDF (Official Document) และ Excel (Data Processing)

---

## 1. Overview & Tools

### 1.1 Tech Stack

- **PDF Engine:** `pdfkit` (Node.js Backend)
  - เหตุผล: ต้องการความแม่นยำของ Layout สูงสำหรับการพิมพ์และเซ็นชื่อ
  - Font: TH Sarabun New (ฝังฟอนต์ในไฟล์ PDF)
- **Excel Engine:** `exceljs`
  - เหตุผล: ต้องการจัด Format Cell, Header, และ Data Type ให้ถูกต้องเพื่อนำไปใช้ต่อได้ทันที

### 1.2 Access Control

- **Finance / Officer:** สามารถดาวน์โหลดได้ทุกรายงาน
- **Head Ward / Dept:** ดาวน์โหลดได้เฉพาะรายงานสรุปของหน่วยงานตนเอง
- **User:** ไม่มีสิทธิ์ดาวน์โหลดรายงานภาพรวม (ดูได้เฉพาะ Payslip ส่วนตัว)

---

## 2. Report List (รายการรายงานมาตรฐาน)

### 2.1 รายงานบัญชีรายชื่อผู้มีสิทธิ์ (Eligible List)

- **Format:** PDF (A4 Landscape)
- **Frequency:** รายเดือน (Monthly)
- **Purpose:** เอกสารแนบประกอบการเบิกจ่าย เพื่อให้คณะกรรมการตรวจสอบและเซ็นกำกับ
- **Columns:**
  1. ลำดับ (No.)
  2. ชื่อ-สกุล (Name)
  3. ตำแหน่ง (Position)
  4. เลขที่ใบประกอบวิชาชีพ (License No.)
  5. วันหมดอายุใบประกอบ (Expire Date)
  6. กลุ่มงาน/อัตราที่ได้รับอนุมัติ (Rate Category)
  7. จำนวนเงิน (Amount)
  8. หมายเหตุ (Remarks) - ระบุวันลา/หักเงินถ้ามี

### 2.2 รายงานสรุปยอดการเบิกจ่าย (Payment Summary)

- **Format:** Excel (.xlsx) & PDF
- **Purpose:** สรุปยอดรวมแยกตามกลุ่มวิชาชีพ เพื่อทำเรื่องเบิกงบประมาณ
- **Structure:**
  - **Header:** ประจำงวดเดือน... ปีงบประมาณ...
  - **Group Level:** แยก Section ตามวิชาชีพ (แพทย์, ทันตแพทย์, เภสัช, พยาบาล, ฯลฯ)
  - **Summary Row:** ยอดรวมจำนวนคน และ ยอดรวมจำนวนเงินของแต่ละวิชาชีพ
  - **Grand Total:** ยอดรวมทั้งโรงพยาบาล

### 2.3 รายงานรายละเอียดการคำนวณ (Calculation Detail / Audit Log)

- **Format:** Excel (.xlsx)
- **Purpose:** สำหรับเจ้าหน้าที่ใช้ตรวจสอบที่มาของเงิน (Traceability)
- **Columns:**
  - ข้อมูลบุคคล (ID, Name, Dept)
  - ข้อมูลตั้งต้น (Base Rate, Days in Month)
  - การหักลด (Leave Days, Late Days)
  - การตกเบิก (Retro Months, Retro Amount)
  - **Net Total (ยอดสุทธิ)**

---

## 3. Implementation Details

### 3.1 PDF Layout Guidelines (Official Theme)

- **Header:**
  - ตราครุฑ หรือ ตราโรงพยาบาล (มุมบนซ้าย/กลาง)
  - ชื่อรายงานตัวหนาขนาด 16pt
  - ระบุ "งวดเดือน xxxx พ.ศ. xxxx"
- **Table:**
  - Border: เส้นบางสีดำรอบตาราง
  - Header Row: พื้นหลังสีเทาอ่อน (Light Gray) ตัวหนา
  - Row Height: ปรับอัตโนมัติตามเนื้อหา
- **Footer:**
  - ลายเซ็นคณะกรรมการ (3-5 ช่อง)
  - วันที่พิมพ์รายงาน (Timestamp)
  - หน้า x ของ y (Page x of y)

### 3.2 Excel Data Formatting

- **Money Columns:** Format `#,##0.00` (มีทศนิยม 2 ตำแหน่ง, มี Comma)
- **Date Columns:** Format `dd/mm/yyyy` (พุทธศักราช)
- **Sheet Naming:** ตั้งชื่อ Sheet ตามกลุ่มวิชาชีพ เช่น `Nurse`, `Doctor`, `Dentist`

---

## 4. UI for Report Download (Frontend)

### 4.1 Page: `/reports/monthly`

- **Filter:**
  - เลือกปีงบประมาณ (Fiscal Year)
  - เลือกงวดเดือน (Month)
- **Action Cards:**
  - **Card 1: สรุปภาพรวม (Summary)**
    - ปุ่ม [Download PDF] [Download Excel]
  - **Card 2: แยกรายวิชาชีพ**
    - List รายการวิชาชีพ (แพทย์, พยาบาล, ...)
    - ปุ่ม Download ท้ายรายการแต่ละบรรทัด
  - **Card 2: แยกรายวิชาชีพ**
    - List รายการวิชาชีพ (แพทย์, พยาบาล, ...)
    - ปุ่ม Download ท้ายรายการแต่ละบรรทัด

### 4.2 Loading State

- การ Generate PDF อาจใช้เวลา 2-5 วินาที
- **UX:** เมื่อกดปุ่ม Download ให้เปลี่ยน State ปุ่มเป็น "Creating..." พร้อม Spin icon และ Disabled ปุ่มไว้จนกว่าจะได้รับ File Stream

---

## 5. Sample Data Mapping (Input -> Output)

### ตัวอย่างการ Map ข้อมูลลงรายงาน (แพทย์)

- **Input (DB/Raw):**
  - `fname`: "สมชาย"
  - `lname`: "ใจดี"
  - `position`: "นายแพทย์ชำนาญการ"
  - `pay_net`: 5000.00
- **Output (PDF Column):**
  - `Name`: "นายสมชาย ใจดี" (Concat Prefix)
  - `Position`: "นายแพทย์ชำนาญการ"
  - `Amount`: "5,000.00" (Format String)
