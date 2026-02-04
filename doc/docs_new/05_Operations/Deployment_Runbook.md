# Deployment & Operations Runbook

คู่มือการติดตั้ง (Installation), การนำขึ้นใช้งานจริง (Deployment), และการดูแลระบบ (Operations)
สำหรับระบบ PHTS (Public Health Talent System)

---

## 1. Prerequisites (สิ่งที่ต้องเตรียมก่อนติดตั้ง)

### 1.1 Server Requirements

- **OS:** Ubuntu 22.04 LTS (Recommended) or Linux-based OS
- **CPU:** 4 Cores (เนื่องจากต้องรัน OCR Worker)
- **RAM:** 8 GB Minimum (แนะนำ 16 GB หากรัน Local OCR Model)
- **Disk:** 50 GB SSD (รองรับการเก็บไฟล์แนบและ Logs)

### 1.2 Software Dependencies

- **Docker & Docker Compose:** สำหรับรัน OCR Service และ Redis
- **Node.js:** v20.x LTS (ใช้ Runtime หลักของ Backend/Frontend)
- **MySQL:** v8.0 (Database)
- **PM2:** สำหรับรัน Node.js Process ในโหมด Production

---

## 2. Installation Steps (ขั้นตอนการติดตั้ง)

### Step 1: Clone Repository

ดึง Source Code ลงมาที่ Server (สมมติว่าใช้ path `/opt/phts`)

```bash
cd /opt
git clone https://github.com/your-org/phts-system.git phts
cd phts
```

### Step 2: Setup Environment Variables

คัดลอกไฟล์ตัวอย่าง `.env.example` เป็น `.env` แล้วแก้ไขค่าให้ถูกต้อง

```bash
cp .env.example .env
nano .env
```

**ค่าที่ต้องกำหนด (Critical Configs):**

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`: เชื่อมต่อ MySQL
- `JWT_SECRET`: คีย์สุ่มยาวๆ สำหรับเข้ารหัส Token
- `OCR_ENABLED`: `true`
- `OCR_SERVICE_URL`: `http://localhost:8000` (หรือ URL ของ Docker Container)

### Step 3: Install Dependencies

ติดตั้ง Library ของทั้ง Frontend และ Backend

```bash
# Backend
cd backend
npm install
npm run build

# Frontend
cd ../frontend
npm install
npm run build

```

---

## 3. Database Initialization (เตรียมฐานข้อมูล)

### Step 1: Create Database

สร้าง Database schema ว่างๆ ใน MySQL

```sql
CREATE DATABASE phts_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Step 2: Run Migrations

สร้างตารางต่างๆ ผ่าน Script ของ Backend

```bash
cd backend
npm run db:migrate
```

### Step 3: Seed Initial Data (Optional)

สร้างข้อมูลตั้งต้น เช่น User Admin คนแรก หรือรหัสหน่วยงาน

```bash
npm run db:seed

```

---

## 4. Starting the Services (การเริ่มระบบ)

### 4.1 Start OCR & Queue (Docker)

รัน Service ที่เป็น Docker Container (OCR + Redis)

```bash
cd /opt/phts
docker compose up -d

```

_ตรวจสอบสถานะ:_ `docker compose ps` (ต้องสถานะ Up)

### 4.2 Start Backend & Frontend (PM2)

ใช้ PM2 เพื่อคุม Process ให้ทำงานเบื้องหลังและ Auto-restart

```bash
cd /opt/phts
pm2 start ecosystem.config.js

```

_(หากไม่มี ecosystem config ให้รันแยกคำสั่งดังนี้)_

```bash
# Backend
pm2 start backend/dist/main.js --name "phts-backend"

# Frontend
pm2 start "npm start" --name "phts-frontend" --cwd ./frontend

```

---

## 5. Routine Operations (งานดูแลประจำวัน)

### 5.1 การสำรองข้อมูล (Backup)

ตั้ง Cronjob เพื่อ Dump Database ทุกวัน เวลา 02:00 น.

```bash
0 2 * * * mysqldump -u [user] -p[pass] phts_system > /backup/phts_$(date +\%F).sql

```

_ข้อควรระวัง:_ อย่าลืม backup โฟลเดอร์ `backend/uploads` ด้วย เพราะเก็บไฟล์แนบจริง

### 5.2 การตรวจสอบ Logs (Monitoring)

- **Application Logs:** `pm2 logs` (ดู Error ของระบบหลัก)
- **OCR Logs:** `docker compose logs -f worker` (ดูการทำงานของ AI)

### 5.3 การอัปเดตระบบ (Update Patch)

เมื่อมีการแก้ Bug หรือเพิ่มฟีเจอร์ใหม่

1. `git pull origin main`
2. `cd backend && npm install && npm run build`
3. `cd ../frontend && npm install && npm run build`
4. `pm2 restart all`

---

## 6. Emergency & Rollback (กรณีฉุกเฉิน)

### กรณีระบบล่ม (Crash Loop)

1. เช็ค Logs: `pm2 logs --lines 100`
2. ถ้าเกิดจาก Database Connection: เช็ค MySQL Service
3. ถ้าเกิดจาก Code Bug: ใช้ `git checkout [last-stable-commit]` แล้ว build ใหม่

### กรณี OCR ค้าง (Stuck Jobs)

1. Restart OCR Service: `docker compose restart ocr-typhoon`
2. Flush Redis Queue (ระวัง Job หาย): `docker exec -it phts-redis redis-cli FLUSHALL`
