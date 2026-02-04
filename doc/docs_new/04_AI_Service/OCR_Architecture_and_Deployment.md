# OCR Architecture & Deployment Guide

เอกสารกำกับดูแลระบบ AI/OCR สำหรับตรวจสอบเอกสารแนบ (Attachment Verification)
Engine: **Typhoon OCR 1.5 (2B)**
Deployment Mode: **Hybrid (Cloud First + Local Fallback)**

---

## 1. Architecture Overview

ระบบ OCR ถูกแยกออกมาเป็น **Microservice** (รันบน Docker) เพื่อไม่ให้กระทบประสิทธิภาพของ Backend หลัก โดยสื่อสารกันผ่าน HTTP และใช้ Redis Queue ในการจัดการ Load

### 1.1 Diagram

```mermaid
graph LR
    BE[Backend API] -->|Enqueue Job| Redis[(Redis Queue)]
    Worker[OCR Worker] -->|Dequeue| Redis

    subgraph "OCR Microservice (Docker)"
        Worker -->|POST File| Gateway[FastAPI Gateway]
        Gateway -.->|1. Try Cloud| Cloud[Typhoon Cloud API]
        Gateway -.->|2. Fallback| Local[Local Model (CPU/GPU)]
    end

    Worker -->|Update Status| DB[(MySQL)]

```

### 1.2 Core Components

1. **Backend Producer:** เมื่อ User อัปโหลดไฟล์ ระบบจะสร้าง Job สถานะ `PENDING` ลงใน Redis
2. **OCR Worker:** Process ที่คอยดึง Job ไปประมวลผล (Background Process)
3. **OCR Service (`ocr-typhoon`):** Container ที่รัน Python/FastAPI ทำหน้าที่เป็น Gateway ตัดสินใจว่าจะส่งไป Cloud หรือรัน Local

---

## 2. Service Specification

### 2.1 Docker Container (`ocr-typhoon`)

- **Base Image:** `python:3.10-slim`
- **Dependencies:** `fastapi`, `uvicorn`, `requests`, `torch` (cpu/cuda), `transformers`
- **Port Expose:** `8000` (Internal)

### 2.2 API Interface

Interface ที่ Worker เรียกใช้งาน

- **Endpoint:** `POST /v1/ocr`
- **Input:** `multipart/form-data` (file)
- **Output (JSON):**

```json
{
  "status": "success",
  "text": "ข้อความที่อ่านได้...",
  "confidence": 0.95,
  "source": "cloud" // หรือ "local"
}
```

---

## 3. Configuration & Environment Variables

การตั้งค่าในไฟล์ `.env` ของ Project

### 3.1 Backend Side (Node.js)

```bash
OCR_ENABLED=true
OCR_SERVICE_URL=http://ocr-typhoon:8000
OCR_QUEUE_NAME=phts_ocr_queue
OCR_MAX_RETRIES=3
```

### 3.2 OCR Service Side (Python)

```bash
MODEL_SERVER_MODE=auto
CLOUD_BASE_URL=https://api.opentyphoon.ai/v1
CLOUD_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
CLOUD_MODEL_NAME=typhoon-ocr
LOCAL_MODEL_PATH=./models/typhoon-ocr-1.5-2b-q4.gguf
LOCAL_DEVICE=cpu
```

LOCAL_MODEL_PATH=./models/typhoon-ocr-1.5-2b-q4.gguf
LOCAL_DEVICE=cpu # หรือ cuda หากมี GPU

````

---

## 4. Operational Flow & Fallback Logic

### 4.1 "Auto" Mode Logic

เพื่อความเสถียรสูงสุด ระบบจะทำงานดังนี้:

1. **Attempt Cloud:** ส่งรูปไปที่ Typhoon Cloud API ก่อน
2. **Success:** คืนค่าผลลัพธ์ทันที (Fast & Accurate)
3. **Failure (Network/Timeout/Quota):**
   - Log Error
   - **Fallback to Local:** โหลดโมเดล Local (GGUF) ขึ้นมาประมวลผลแทน (ช้าหน่อยแต่ทำงานต่อได้)
4. **Critical Failure:** หาก Local ก็พัง -> คืนค่า Error ให้ Worker -> Worker จะ Retry 3 ครั้ง ก่อน Mark as `FAILED`

### 4.2 Submission Gate (Business Rule)

- ระบบ **ไม่อนุญาต** ให้ผู้ใช้กด "ยืนยันคำขอ" (Submit Request) หากไฟล์แนบยัง `PROCESSING` หรือ `FAILED`
- User ต้องรอจนกว่าสถานะเป็น `COMPLETED` (สีเขียว) เท่านั้น

---

## 5. Troubleshooting & Maintenance

### 5.1 Common Issues

| อาการ                               | สาเหตุที่เป็นไปได้                                  | การแก้ไข                                                 |
| ----------------------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| **Status ค้างที่ `PENDING**`        | Worker ตาย หรือ Redis ล่ม                           | Restart Worker Service (`docker compose restart worker`) |
| **Status ค้างที่ `PROCESSING` นาน** | Local Model ประมวลผลช้า (CPU)                       | ปรับลด Concurrency ของ Worker หรือเพิ่ม CPU Resource     |
| **Status `FAILED` บ่อย**            | ไฟล์ภาพไม่ชัด / Cloud Key หมดอายุ / Local RAM ไม่พอ | เช็ค Log `ocr-typhoon` และตรวจสอบโควต้า Cloud API        |

### 5.2 การดูแลรักษา (Maintenance)

- **Log Rotation:** หมั่นเคลียร์ Docker Logs ของ `ocr-typhoon` เพราะอาจมีขนาดใหญ่จากการ Log รูปภาพ base64 (ควรปิด Debug Log ใน Production)
- **Model Update:** หาก Typhoon มีเวอร์ชันใหม่ (เช่น 1.6) ให้เปลี่ยนไฟล์ `.gguf` ในโฟลเดอร์ `models/` และแก้ env `LOCAL_MODEL_PATH`

---

## 6. Development Setup (Localhost)

หากต้องการรันเพื่อทดสอบในเครื่องตัวเองโดยไม่ใช้ Docker:

1. **Start Redis:** `docker run -d -p 6379:6379 redis`
2. **Start OCR Service:**

```bash
cd ocr_service
pip install -r requirements.txt
uvicorn main:app --port 8000

````

3. **Start Backend:** ตั้งค่า `OCR_SERVICE_URL=http://localhost:8000`

```

```
