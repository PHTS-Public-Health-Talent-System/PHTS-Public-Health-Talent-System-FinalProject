import { normalizeText } from '@/modules/identity/services/identity-role-policy.service.js';

describe('roleAssignmentService helpers', () => {
  test('normalizeText trims and handles nullish', () => {
    expect(normalizeText('  abc  ')).toBe('abc');
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });
});
