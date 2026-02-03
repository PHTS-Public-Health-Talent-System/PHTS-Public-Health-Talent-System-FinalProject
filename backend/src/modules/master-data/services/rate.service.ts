/**
 * PHTS System - Payment Rate Service
 *
 * Manages position allowance rates (P.T.S. rates).
 */

import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { query } from "../../../config/database.js";
import { logAuditEvent, AuditEventType } from "../../audit/services/audit.service.js";

export const getMasterRates = async (): Promise<any[]> => {
  const rates = await query<RowDataPacket[]>(
    "SELECT * FROM cfg_payment_rates ORDER BY profession_code, group_no, item_no",
  );
  return rates;
};

export const updateMasterRate = async (
  rateId: number,
  amount: number,
  condition_desc: string,
  is_active: number,
  actorId?: number,
): Promise<void> => {
  await query<ResultSetHeader>(
    "UPDATE cfg_payment_rates SET amount = ?, condition_desc = ?, is_active = ? WHERE rate_id = ?",
    [amount, condition_desc, is_active, rateId],
  );

  await logAuditEvent({
    eventType: AuditEventType.MASTER_RATE_UPDATE,
    entityType: "payment_rate",
    entityId: rateId,
    actorId: actorId ?? null,
    actorRole: null,
    actionDetail: {
      amount,
      condition_desc,
      is_active,
    },
  });
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

export const getClassificationHierarchy = async (): Promise<ProfessionNode[]> => {
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
      case "OTHERS": return "กลุ่มสหวิชาชีพ (กลุ่ม 5)";
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
        if (row.profession_code === 'OTHERS') groupName = "อัตราปกติ"; // Special case

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
