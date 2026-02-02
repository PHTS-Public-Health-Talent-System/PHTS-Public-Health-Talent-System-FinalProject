import request from "supertest";
import path from "path";
import { Pool } from "mysql2/promise";
import {
  createTestPool,
  setupSchema,
  seedBaseData,
  cleanTables,
  resetTestData,
  signAdminToken,
  TestHelper,
} from "./utils.js";

let pool: Pool;
let app: any;
let h: TestHelper;

jest.setTimeout(20000);

beforeAll(async () => {
  pool = await createTestPool();
  await setupSchema(pool);
  await cleanTables(pool);
  await seedBaseData(pool);
  h = new TestHelper(pool);

  jest.doMock("../../../config/database.js", () => ({
    __esModule: true,
    default: pool,
    query: async (sql: string, params?: any[]) => {
      const [results] = await pool.execute(sql, params);
      return results;
    },
    execute: pool.execute.bind(pool),
    getConnection: pool.getConnection.bind(pool),
  }));

  const appPath = path.join(process.cwd(), "src/index.ts");
  const imported = await import(appPath);
  app = imported.default;
});

afterEach(async () => {
  await resetTestData(pool);
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe("Payroll Period Items", () => {
  test("TC-PAY-PERIOD-ITEM-01: list periods", async () => {
    await h.createPeriod(2024, 10, "OPEN");
    await h.createPeriod(2024, 9, "CLOSED");

    const adminToken = signAdminToken();
    const res = await request(app)
      .get("/api/payroll/period")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const found = res.body.data.find(
      (p: any) => p.period_year === 2024 && p.period_month === 10,
    );
    expect(found).toBeTruthy();
  });

  test("TC-PAY-PERIOD-ITEM-02: add items and fetch detail", async () => {
    const periodId = await h.createPeriod(2024, 1, "OPEN");
    const [requestRow]: any = await pool.query(
      `INSERT INTO req_submissions
       (user_id, citizen_id, request_no, request_type, status, current_step, requested_amount, effective_date)
       VALUES (1, 'CID001', 'REQ-001', 'NEW_ENTRY', 'PENDING', 3, 2000, '2024-01-01')`,
    );
    const requestId = requestRow.insertId as number;

    await pool.query(
      `INSERT INTO req_verification_snapshots
       (request_id, citizen_id, master_rate_id, effective_date, snapshot_data)
       VALUES (?, 'CID001', 1, '2024-01-01', JSON_OBJECT('note','ok'))`,
      [requestId],
    );

    const adminToken = signAdminToken();
    await request(app)
      .post(`/api/payroll/period/${periodId}/items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ request_ids: [requestId] })
      .expect(200);

    const detail = await request(app)
      .get(`/api/payroll/period/${periodId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(detail.body.success).toBe(true);
    expect(detail.body.data.items).toHaveLength(1);
    expect(detail.body.data.items[0].request_id).toBe(requestId);
  });

  test("TC-PAY-PERIOD-ITEM-03: remove item", async () => {
    const periodId = await h.createPeriod(2024, 2, "OPEN");
    const [requestRow]: any = await pool.query(
      `INSERT INTO req_submissions
       (user_id, citizen_id, request_no, request_type, status, current_step, requested_amount, effective_date)
       VALUES (1, 'CID002', 'REQ-002', 'NEW_ENTRY', 'PENDING', 3, 2000, '2024-02-01')`,
    );
    const requestId = requestRow.insertId as number;
    await pool.query(
      `INSERT INTO req_verification_snapshots
       (request_id, citizen_id, master_rate_id, effective_date, snapshot_data)
       VALUES (?, 'CID002', 1, '2024-02-01', JSON_OBJECT('note','ok'))`,
      [requestId],
    );

    const adminToken = signAdminToken();
    await request(app)
      .post(`/api/payroll/period/${periodId}/items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ request_ids: [requestId] })
      .expect(200);

    const detail = await request(app)
      .get(`/api/payroll/period/${periodId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const itemId = detail.body.data.items[0].period_item_id;

    await request(app)
      .delete(`/api/payroll/period/${periodId}/items/${itemId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const detailAfter = await request(app)
      .get(`/api/payroll/period/${periodId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(detailAfter.body.data.items).toHaveLength(0);
  });
});
