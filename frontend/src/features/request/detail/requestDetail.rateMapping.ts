type RateMappingPayload = {
  groupId?: string | number | null;
  group_no?: string | number | null;
  itemId?: string | number | null;
  item_no?: string | number | null;
  subItemId?: string | number | null;
  sub_item_no?: string | number | null;
  amount?: string | number | null;
  rateId?: number | null;
  rate_id?: number | null;
  professionCode?: string | null;
  profession_code?: string | null;
};

export type NormalizedRateMapping = {
  groupId?: string;
  itemId?: string;
  subItemId?: string;
  amount?: number;
  professionCode?: string;
  rateId?: number;
};

export type RateHierarchyCriterion = {
  id: string;
  label: string;
  description?: string;
  subCriteria?: RateHierarchyCriterion[];
  choices?: string[];
};

export type RateHierarchyGroup = {
  id: string;
  name: string;
  rate: number;
  criteria: RateHierarchyCriterion[];
};

export type RateHierarchyProfession = {
  id: string;
  name: string;
  groups: RateHierarchyGroup[];
};

type SubmissionData = Record<string, unknown> | string | null | undefined;

const parseSubmissionData = (value: SubmissionData): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value as Record<string, unknown>;
};

const toOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined) return undefined;
  const num = typeof value === 'number' ? value : Number(String(value));
  if (Number.isNaN(num)) return undefined;
  return num;
};

export const normalizeRateMapping = (submissionData: SubmissionData): NormalizedRateMapping | null => {
  const submission = parseSubmissionData(submissionData);
  const rateMapping = (submission.rate_mapping as RateMappingPayload | undefined)
    ?? (submission.rateMapping as RateMappingPayload | undefined)
    ?? (submission.classification as RateMappingPayload | undefined);

  if (!rateMapping) return null;

  const groupId =
    toOptionalString(rateMapping.groupId) ??
    toOptionalString(rateMapping.group_no);
  const itemId =
    toOptionalString(rateMapping.itemId) ??
    toOptionalString(rateMapping.item_no);
  const subItemId =
    toOptionalString(rateMapping.subItemId) ??
    toOptionalString(rateMapping.sub_item_no);
  const amount = toOptionalNumber(rateMapping.amount);
  const professionCode =
    toOptionalString(rateMapping.professionCode) ??
    toOptionalString(rateMapping.profession_code);
  const rateId =
    toOptionalNumber(rateMapping.rateId) ??
    toOptionalNumber(rateMapping.rate_id);

  return {
    groupId,
    itemId,
    subItemId,
    amount,
    professionCode,
    rateId,
  };
};

export const isEmptyRateMapping = (mapping: NormalizedRateMapping | null): boolean => {
  if (!mapping) return true;
  const hasGroup = !!mapping.groupId;
  const amount = mapping.amount ?? 0;
  return !hasGroup && amount <= 0;
};

export const resolveRateMappingDisplay = (
  mapping: NormalizedRateMapping,
  hierarchy?: RateHierarchyProfession[],
) => {
  const profession = hierarchy?.find((item) => item.id === mapping.professionCode);
  const group = profession?.groups.find((item) => item.id === mapping.groupId);
  const isNoneItem = !mapping.itemId || mapping.itemId === '__NONE__';
  const criteria = isNoneItem
    ? (group?.criteria.find((item) => item.id === '') ?? (group?.criteria.length === 1 ? group?.criteria[0] : undefined))
    : group?.criteria.find((item) => item.id === mapping.itemId);
  const subCriteria = mapping.subItemId
    ? criteria?.subCriteria?.find((item) => item.id === mapping.subItemId)
    : undefined;

  return {
    professionLabel: profession?.name ?? mapping.professionCode ?? undefined,
    groupLabel: group?.name ?? mapping.groupId ?? undefined,
    criteriaLabel: criteria?.description ?? criteria?.label ?? (isNoneItem ? undefined : (mapping.itemId ?? undefined)),
    subCriteriaLabel: subCriteria?.description ?? subCriteria?.label ?? mapping.subItemId ?? undefined,
  };
};
