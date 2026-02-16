/**
 * PHTS System - Payment Rate Service
 *
 * Manages position allowance rates (P.T.S. rates).
 */

import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { query } from '@config/database.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';

export const getMasterRates = async (): Promise<any[]> => {
  const rates = await query<RowDataPacket[]>(
    `SELECT
       r.*,
       COALESCE(ec.eligible_count, 0) AS eligible_count
     FROM cfg_payment_rates r
     LEFT JOIN (
       SELECT master_rate_id, COUNT(*) AS eligible_count
       FROM req_eligibility
       WHERE is_active = 1
       GROUP BY master_rate_id
     ) ec ON ec.master_rate_id = r.rate_id
     ORDER BY r.profession_code, r.group_no, r.item_no`,
  );
  return rates;
};

export const updateMasterRate = async (
  rateId: number,
  payload: {
    profession_code: string;
    group_no: number;
    item_no: string | null;
    sub_item_no: string | null;
    amount: number;
    condition_desc: string;
    detailed_desc: string;
    is_active: boolean;
  },
  actorId?: number,
): Promise<void> => {
  await query<ResultSetHeader>(
    `UPDATE cfg_payment_rates
     SET profession_code = ?,
         group_no = ?,
         item_no = ?,
         sub_item_no = ?,
         amount = ?,
         condition_desc = ?,
         detailed_desc = ?,
         is_active = ?
     WHERE rate_id = ?`,
    [
      payload.profession_code,
      payload.group_no,
      payload.item_no,
      payload.sub_item_no,
      payload.amount,
      payload.condition_desc,
      payload.detailed_desc,
      payload.is_active ? 1 : 0,
      rateId,
    ],
  );

  await emitAuditEvent({
    eventType: AuditEventType.MASTER_RATE_UPDATE,
    entityType: "payment_rate",
    entityId: rateId,
    actorId: actorId ?? null,
    actorRole: null,
    actionDetail: {
      action: "update",
      ...payload,
    },
  });
};

export const deleteMasterRate = async (
  rateId: number,
  actorId?: number,
): Promise<void> => {
  await query<ResultSetHeader>(
    "UPDATE cfg_payment_rates SET is_active = ? WHERE rate_id = ?",
    [0, rateId],
  );

  await emitAuditEvent({
    eventType: AuditEventType.MASTER_RATE_UPDATE,
    entityType: "payment_rate",
    entityId: rateId,
    actorId: actorId ?? null,
    actorRole: null,
    actionDetail: {
      action: "delete",
    },
  });
};

export const createMasterRate = async (
  profession_code: string,
  group_no: number,
  item_no: string | null,
  sub_item_no: string | null,
  amount: number,
  condition_desc: string,
  detailed_desc: string,
  is_active: number,
  actorId?: number,
): Promise<number> => {
  const result = await query<ResultSetHeader>(
    "INSERT INTO cfg_payment_rates (profession_code, group_no, item_no, sub_item_no, amount, condition_desc, detailed_desc, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [profession_code, group_no, item_no, sub_item_no, amount, condition_desc, detailed_desc, is_active],
  );

  const rateId = result.insertId;

  await emitAuditEvent({
    eventType: AuditEventType.MASTER_RATE_UPDATE,
    entityType: "payment_rate",
    entityId: rateId,
    actorId: actorId ?? null,
    actorRole: null,
    actionDetail: {
      action: "create",
      profession_code,
      group_no,
      amount,
    },
  });

  return rateId;
};

export const getMasterRateById = async (rateId: number): Promise<any | null> => {
  const rows = await query<RowDataPacket[]>(
    "SELECT * FROM cfg_payment_rates WHERE rate_id = ?",
    [rateId],
  );
  return (rows[0] as any) ?? null;
};

/**
 * Get payment rates filtered by profession code.
 * This is used for the simplified dropdown in the request wizard.
 */
export const getRatesByProfession = async (
  professionCode: string,
): Promise<any[]> => {
  const rates = await query<RowDataPacket[]>(
    `SELECT rate_id, profession_code, group_no, item_no, sub_item_no, amount, condition_desc
     FROM cfg_payment_rates
     WHERE profession_code = ? AND is_active = 1
     ORDER BY group_no, item_no, sub_item_no`,
    [professionCode],
  );
  return rates;
};

/**
 * Get distinct profession codes that have active rates.
 */
export const getProfessions = async (): Promise<string[]> => {
  const rows = await query<RowDataPacket[]>(
    `SELECT DISTINCT profession_code FROM cfg_payment_rates WHERE is_active = 1 ORDER BY profession_code`,
  );
  return rows.map((r) => r.profession_code);
};

// Types for the hierarchy response
export interface CriterionNode {
  id: string;
  label: string;
  description?: string;
  subCriteria?: CriterionNode[];
}

export interface GroupNode {
  id: string;
  name: string;
  rate: number;
  criteria: CriterionNode[];
}

export interface ProfessionNode {
  id: string;
  name: string;
  groups: GroupNode[];
}

export const getRateHierarchy = async (): Promise<ProfessionNode[]> => {
  // Fetch active rates sorted by hierarchy
  const rows = await query<RowDataPacket[]>(
    `SELECT
       rate_id, profession_code, group_no, item_no, sub_item_no, amount, condition_desc, detailed_desc
     FROM cfg_payment_rates
     WHERE is_active = 1
     ORDER BY
       CASE
         WHEN profession_code = 'DOCTOR' THEN 1
         WHEN profession_code = 'DENTIST' THEN 2
         WHEN profession_code = 'PHARMACIST' THEN 3
         WHEN profession_code = 'NURSE' THEN 4
         ELSE 5
       END,
       profession_code, group_no, item_no, sub_item_no`
  );

  // Helper to map profession codes to Thai names (Static for now, could be another table)
  const getProfName = (code: string) => {
    switch (code) {
      case "DOCTOR": return "กลุ่มแพทย์";
      case "DENTIST": return "กลุ่มทันตแพทย์";
      case "PHARMACIST": return "กลุ่มเภสัชกร";
      case "NURSE": return "กลุ่มพยาบาลวิชาชีพ";
      case "ALLIED": return "กลุ่มสหวิชาชีพ";
      case "SPECIAL_EDU": return "กลุ่มการศึกษาพิเศษ";
      default: return code;
    }
  };

  const hierarchy: ProfessionNode[] = [];

  for (const row of rows) {
    // 1. Find or create Profession Node
    let prof = hierarchy.find(p => p.id === row.profession_code);
    if (!prof) {
      prof = {
        id: row.profession_code,
        name: getProfName(row.profession_code),
        groups: []
      };
      hierarchy.push(prof);
    }

    // 2. Find or create Group Node
    // Conversion: group_no (int) -> string id
    const groupId = String(row.group_no);
    let group = prof.groups.find(g => g.id === groupId);
    if (!group) {
        // Group Name logic
        let groupName = `กลุ่มที่ ${row.group_no}`;
        if (row.profession_code === 'ALLIED') groupName = `กลุ่มที่ ${row.group_no}`; // keep standard

        group = {
            id: groupId,
            name: groupName,
            rate: Number(row.amount), // Assuming rate is at group level per rules
            criteria: []
        };
        prof.groups.push(group);
    }

    // 3. Handle Criteria (Items) vs SubCriteria (Sub-Items)
    // If item_no is NULL, it might be a base group rule (like Doctor G1)
    // Use condition_desc as label

    // Normalize string handling
    const itemNo = row.item_no ? String(row.item_no) : "";
    const subItemNo = row.sub_item_no ? String(row.sub_item_no) : "";
    const label = row.condition_desc || "";
    const description = row.detailed_desc || label; // Fallback to label if detailed is missing

    if (!itemNo) {
        // Case: No specific item (e.g. "General Rule"), treat as a criteria with empty ID or special handling
        // For frontend compatibility, we push it as a criterion if it has description
        if (label) {
             group.criteria.push({
                 id: "",
                 label: label,
                 description: description
             });
        }
        continue;
    }

    // Find or create Item (Criterion)
    let criterion = group.criteria.find(c => c.id === itemNo);
    if (!criterion) {
        criterion = {
            id: itemNo,
            label: label,
            description: description,
                          // Actually, usually the parent row exists as well or we deduce it.
                          // In cfg_payment_rates:
                          // 2.2 (Parent) might exist? Or just 2.2.1?
                          // Let's check logic: Data has 2.2 AND 2.2.1.
                          // If this row IS the parent (sub_item_no is null), use it.
            subCriteria: []
        };
        group.criteria.push(criterion);
    }

    if (!subItemNo) {
        // This is a main item. Update label/desc if needed (e.g. if created implicitly before)
        criterion.label = label;
        criterion.description = description;
    } else {
        // This is a sub-item. Add to parent's subCriteria
        criterion.subCriteria?.push({
            id: subItemNo,
            label: label,
            description: description
        });
    }
  }

  return hierarchy;
};
