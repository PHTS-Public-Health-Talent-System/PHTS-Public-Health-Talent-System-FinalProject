# Payroll Calculation Logic & Algorithm

เอกสารอธิบายอัลกอริทึมการคำนวณเงิน พ.ต.ส. เชิงลึก
ครอบคลุมการจ่ายปกติ (Normal Run) และการตกเบิกย้อนหลัง (Retroactive Run)

---

## 1. Core Concept: Daily Accumulation

ระบบใช้หลักการ "คำนวณละเอียดรายวัน" (Daily Accumulation) แทนการหักสัดส่วน เพื่อความแม่นยำสูงสุดในการตรวจสอบ (Audit Trail) และการจัดการวันลาที่ซับซ้อน

### 1.1 สูตรพื้นฐาน (Base Formula)

```
Total_Month_Pay = Sum(Daily_Pay_Items);
Daily_Pay_Item = Daily_Rate × Eligible_Flag;
```

- **Daily Rate:** `Approved_Full_Rate / Days_In_Month`
  - _Note:_ ใช้จำนวนวันจริงของเดือนนั้น (28, 29, 30, 31) ไม่ใช้ 30 วันคงที่
  - _Precision:_ เก็บค่าทศนิยมละเอียดระหว่างคำนวณ (เช่น 166.6666...) ห้ามปัดเศษระหว่างทาง

- **Eligible Flag (1 or 0):**
  - `1`: วันที่มีสิทธิ์ (License Active AND Not Exceed Leave Quota)
  - `0`: วันที่ไม่มีสิทธิ์ (License Expired OR Leave Exceed Quota)

### 1.2 การปัดเศษ (Rounding Rule)

- **Rule:** "Sum First, Round Last"
- ให้รวมยอด `Daily_Pay_Item` ทุกวันในเดือนให้เสร็จสิ้นก่อน
- จากนั้นปัดเศษทศนิยม 2 ตำแหน่งด้วยวิธี **Half-Up** (>= 0.5 ปัดขึ้น) ที่ยอดรวมท้ายสุด

---

## 2. Leave Deduction Logic (อัลกอริทึมตัดวันลา)

### 2.1 โหมดการนับ (Counting Modes)

ต้องแยก Logic การนับวันลาตามประเภท (`leave_type_config`):

1. **Mode A: Calendar Days (นับทุกวัน)**
   - _Example:_ ลาคลอด, ลาบวช, ลาศึกษาต่อ
   - _Logic:_ นับต่อเนื่อง `Start_Date` ถึง `End_Date` รวมเสาร์-อาทิตย์และวันหยุด

2. **Mode B: Business Days (นับเฉพาะวันทำการ)**
   - _Example:_ ลาป่วย, ลากิจ, ลาพักผ่อน
   - _Logic:_ Loop เช็คแต่ละวันในช่วงลา
     - ถ้าเป็น Sat/Sun หรือ Holiday -> `Count = 0`
     - ถ้าเป็น Work Day -> `Count = 1`

### 2.2 การตัดโควตา (Quota Exceeded Check)

ระบบต้องดึงประวัติการลา "ทั้งปีงบประมาณ" (Fiscal Year) มาคำนวณสะสม

**Algorithm Steps:**

1. ดึง `Used_Quota` ของประเภทการลานั้นๆ จากต้นปีงบประมาณถึงเดือนก่อนหน้า
2. เริ่ม Loop คำนวณวันในเดือนปัจจุบัน
3. ในแต่ละวันที่ลา:

- บวก `Current_Used` เพิ่มขึ้นทีละ 1 (หรือ 0.5)
- ตรวจสอบ: `IF (Used_Quota + Current_Used) > Max_Quota`
- **TRUE:** `Eligible_Flag = 0` (โดนหักเงิน)
- **FALSE:** `Eligible_Flag = 1` (ได้เงินปกติ)

---

## 3. Retroactive Calculation (ระบบคำนวณตกเบิก)

### 3.1 Trigger Conditions

ระบบจะคำนวณตกเบิกเมื่อ:

1. มีการอนุมัติคำขอที่ `effective_date` ย้อนหลังไปในเดือนที่ "ปิดงวด" (Closed) ไปแล้ว
2. มีการเปลี่ยนแปลงเรทเงิน (Rate Change) ระหว่างเดือน
3. มีการแก้ไขข้อมูลวันลา หรือ ใบประกอบวิชาชีพย้อนหลัง

### 3.2 The "Diff" Algorithm

ใช้หลักการคำนวณใหม่เทียบกับยอดเดิม (Re-calculate & Compare)

**Pseudocode:**

```typescript
function calculateRetro(employeeId, currentPeriod) {
  let totalRetroAmount = 0;

  // 1. หาเดือนย้อนหลังทั้งหมดที่ต้องคำนวณใหม่ (ตั้งแต่วันที่มีผล - เดือนปัจจุบัน)
  let affectedMonths = findAffectedMonths(employeeId, currentPeriod);

  for (let month of affectedMonths) {
    // A. คำนวณยอดที่ "ควรจะได้รับ" (New Calculation)
    // ใช้ Data ปัจจุบัน (ใบประกอบใหม่, วันลาใหม่)
    let expectedAmount = calculateNormalPay(employeeId, month);

    // B. หายอดที่ "จ่ายจริงไปแล้ว" (History)
    // ดึงจากตาราง pay_results ของเดือนนั้น
    let paidAmount = getPaidHistory(employeeId, month);

    // C. หาผลต่าง (Diff)
    let diff = expectedAmount - paidAmount;

    // D. บันทึกผลต่างลงในรายการตกเบิก
    totalRetroAmount += diff;
  }

  return totalRetroAmount; // ค่านี้จะถูกนำไปบวก/ลบ ในยอดเดือนปัจจุบัน
}
```

### 3.3 Handling Negative Diff (กรณีต้องคืนเงิน)

- หาก `expectedAmount < paidAmount` (เช่น ลาเกินโควตามาแก้ทีหลัง หรือถูกลดเรท) ค่า `diff` จะติดลบ
- ยอดติดลบจะถูกนำไปหักออกจาก `Net_Amount` ของเดือนปัจจุบัน
- _Safety Check:_ หากหักแล้วยอดรวมเดือนปัจจุบันติดลบ (ติดหนี้) ระบบจะแสดงยอดสุทธิเป็นลบ เพื่อให้การเงินดำเนินการเรียกคืน (Debt Collection)

---

## 4. Implementation Details (Node.js)

### 4.1 Sequence Flow

1. **Prepare Data:**

- Fetch Employee Profile & Rate
- Fetch Active License (ช่วงเวลา)
- Fetch Leaves (ช่วงเวลา) & Holidays
- Fetch Previous Payment History (กรณี Retro)

2. **Generate Calendar Map:**

- สร้าง Array ของ object วันที่ในเดือนนั้น (1..30/31)
- Mark วันหยุด (IsHoliday)

3. **Calculate Daily Items:**

- Loop `day` in `CalendarMap`:
- Check License Status -> `hasLicense`
- Check Leave Status -> `isLeave`, `isExceedQuota`
- `isEligible = hasLicense && !isExceedQuota`
- `dailyAmount = isEligible ? (Rate/Days) : 0`

4. **Summarize & Round:**

- `Total = Sum(dailyAmount)`
- `Final = RoundHalfUp(Total, 2)`

5. **Retro Process (If needed):**

- Loop ย้อนหลัง -> Calculate Diff -> Add to Final

### 4.2 Code Structure Example

```typescript
// payroll.service.ts

interface DailyResult {
  date: string;
  rate: number;
  isEligible: boolean;
  remark?: string;
}

export const calculateMonthlyPay = (
  rate: number,
  daysInMonth: number,
  eligibilityMap: boolean[],
): number => {
  const dailyRate = rate / daysInMonth;
  let total = 0;

  eligibilityMap.forEach((isEligible) => {
    if (isEligible) {
      total += dailyRate;
    }
  });

  return Math.round(total * 100) / 100; // Standard Rounding
};
```
