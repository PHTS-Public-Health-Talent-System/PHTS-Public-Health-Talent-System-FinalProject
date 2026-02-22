import { normalizeText } from '@/modules/sync/services/role-assignment.service.js';

describe('roleAssignmentService helpers', () => {
  test('normalizeText trims and handles nullish', () => {
    expect(normalizeText('  abc  ')).toBe('abc');
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });
});
