import type { RowDataPacket } from 'mysql2/promise';
import {
  TransformMonitorRepository,
  type TransformRuleRow,
} from '@/modules/sync/repositories/transform-monitor.repository.js';

type ApplyRuleResult = {
  row: RowDataPacket;
  changed: boolean;
};

const parseRegex = (pattern: string): RegExp => {
  // Accept "/.../flags" or plain regex text.
  const wrapped = /^\/(.+)\/([a-z]*)$/i.exec(pattern);
  if (wrapped) {
    return new RegExp(wrapped[1], wrapped[2]);
  }
  return new RegExp(pattern, 'g');
};

const normalizeDateValue = (raw: unknown): string | null => {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return text;
  let year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year > 2400) {
    year -= 543;
  }
  const y = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
};

const applyRule = (row: RowDataPacket, rule: TransformRuleRow): ApplyRuleResult => {
  const current = row[rule.target_field];
  const before = current == null ? '' : String(current);
  let after = before;

  if (rule.rule_type === 'MAP_VALUE') {
    if ((rule.match_pattern ?? '') === before) {
      after = rule.replace_value ?? '';
    }
  }

  if (rule.rule_type === 'REGEX_REPLACE') {
    if (rule.match_pattern) {
      const regex = parseRegex(rule.match_pattern);
      after = before.replace(regex, rule.replace_value ?? '');
    }
  }

  if (rule.rule_type === 'DATE_NORMALIZE') {
    after = normalizeDateValue(current) ?? '';
  }

  if (rule.rule_type === 'CLASSIFY_LEAVE_TYPE') {
    if (rule.match_pattern) {
      const regex = parseRegex(rule.match_pattern);
      const context = `${String(row.leave_type ?? '')} ${String(row.remark ?? '')}`;
      if (regex.test(context)) {
        after = rule.replace_value ?? before;
      }
    }
  }

  if (after === before) {
    return { row, changed: false };
  }

  return {
    row: {
      ...row,
      [rule.target_field]: after,
    },
    changed: true,
  };
};

export class TransformRuleEngine {
  private readonly rulesByView = new Map<string, TransformRuleRow[]>();
  private readonly batchId: number;

  private constructor(batchId: number, rules: TransformRuleRow[]) {
    this.batchId = batchId;
    for (const rule of rules) {
      const viewRules = this.rulesByView.get(rule.target_view) ?? [];
      viewRules.push(rule);
      this.rulesByView.set(rule.target_view, viewRules);
    }
  }

  static async create(batchId: number): Promise<TransformRuleEngine> {
    const activeRules = await TransformMonitorRepository.getActiveTransformRules();
    return new TransformRuleEngine(batchId, activeRules);
  }

  async applyRow(params: {
    targetView: string;
    sourceKey: string;
    row: RowDataPacket;
  }): Promise<RowDataPacket> {
    const rules = this.rulesByView.get(params.targetView);
    if (!rules?.length) {
      return params.row;
    }

    let currentRow: RowDataPacket = params.row;
    const logs: Array<{
      batchId: number;
      targetView: string;
      sourceKey: string;
      fieldName: string;
      beforeValue: string | null;
      afterValue: string | null;
      ruleId: number | null;
    }> = [];

    for (const rule of rules) {
      try {
        const beforeValue = currentRow[rule.target_field];
        const applied = applyRule(currentRow, rule);
        if (!applied.changed) continue;
        currentRow = applied.row;
        const afterValue = currentRow[rule.target_field];
        logs.push({
          batchId: this.batchId,
          targetView: params.targetView,
          sourceKey: params.sourceKey,
          fieldName: rule.target_field,
          beforeValue: beforeValue == null ? null : String(beforeValue),
          afterValue: afterValue == null ? null : String(afterValue),
          ruleId: rule.rule_id,
        });
      } catch (error) {
        await TransformMonitorRepository.createDataIssue({
          batchId: this.batchId,
          targetView: params.targetView,
          sourceKey: params.sourceKey,
          issueCode: 'RULE_APPLY_ERROR',
          issueDetail: `rule_id=${rule.rule_id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          severity: 'HIGH',
        });
      }
    }

    if (logs.length) {
      await TransformMonitorRepository.insertTransformLogs(logs);
    }
    return currentRow;
  }
}
