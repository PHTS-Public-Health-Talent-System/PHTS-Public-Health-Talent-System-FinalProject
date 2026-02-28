import { OPS_JOB_TIMEZONE } from '@/modules/workforce-compliance/constants/workforce-compliance-policy.js';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: OPS_JOB_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const formatOpsDate = (value: Date | string): string =>
  DATE_FORMATTER.format(new Date(value));
