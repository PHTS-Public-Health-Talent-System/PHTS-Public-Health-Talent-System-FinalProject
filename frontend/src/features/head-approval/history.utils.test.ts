import { describe, expect, it } from 'vitest';
import type { ApprovalAction } from '@/types/request.types';
import { isActionRoleMatched, pickLatestHistoryAction } from './history.utils';

const makeAction = (partial: Partial<ApprovalAction>): ApprovalAction => ({
  action: 'APPROVE',
  actor: {
    first_name: 'A',
    last_name: 'B',
    role: 'HEAD_SCOPE',
  },
  comment: null,
  action_date: '2026-03-11T14:16:00.000Z',
  step_no: 1,
  ...partial,
});

describe('history.utils', () => {
  it('matches HEAD_SCOPE role with WARD_SCOPE and DEPT_SCOPE actions', () => {
    expect(isActionRoleMatched('WARD_SCOPE', 'HEAD_SCOPE')).toBe(true);
    expect(isActionRoleMatched('DEPT_SCOPE', 'HEAD_SCOPE')).toBe(true);
    expect(isActionRoleMatched('HEAD_SCOPE', 'HEAD_SCOPE')).toBe(true);
  });

  it('prefers higher step when action_date is identical', () => {
    const actions: ApprovalAction[] = [
      makeAction({
        step_no: 1,
        actor: { first_name: 'Ward', last_name: 'Actor', role: 'HEAD_SCOPE' },
      }),
      makeAction({
        step_no: 2,
        actor: { first_name: 'Dept', last_name: 'Actor', role: 'HEAD_SCOPE' },
      }),
    ];

    const latest = pickLatestHistoryAction(actions, {
      actionMode: 'important',
      roleKey: 'HEAD_SCOPE',
      allowedSteps: [1, 2],
    });

    expect(latest?.step_no).toBe(2);
    expect(latest?.actor?.first_name).toBe('Dept');
  });

  it('respects allowedSteps to show only current level actor', () => {
    const actions: ApprovalAction[] = [
      makeAction({
        step_no: 1,
        actor: { first_name: 'Ward', last_name: 'Actor', role: 'HEAD_SCOPE' },
      }),
      makeAction({
        step_no: 2,
        actor: { first_name: 'Dept', last_name: 'Actor', role: 'HEAD_SCOPE' },
      }),
    ];

    const latest = pickLatestHistoryAction(actions, {
      actionMode: 'important',
      roleKey: 'HEAD_SCOPE',
      allowedSteps: [2],
    });

    expect(latest?.step_no).toBe(2);
    expect(latest?.actor?.first_name).toBe('Dept');
  });
});

