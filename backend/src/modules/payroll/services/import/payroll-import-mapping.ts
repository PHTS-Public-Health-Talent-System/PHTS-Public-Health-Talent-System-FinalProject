export type ImportedRateRow = {
  rateId: number;
  professionCode: string;
  groupNo: number;
  itemNo: string | null;
  subItemNo: string | null;
  amount: number;
};

type ImportedRateSource = {
  sourceGroupNo: string | null;
  sourceClause: string | null;
  sourceItemNo: string | null;
};

type ImportedPayoutSource = {
  daysInMonth: number;
  announcedRate: number | null;
  monthlyAmount: number | null;
  retroactiveAmount: number | null;
  totalAmount: number | null;
};

const normalizeText = (value: string | null | undefined): string | null => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed === "-") return null;
  return trimmed;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

const deriveShortSubItem = (value: string | null | undefined): string | null => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const segments = normalized.split(".");
  if (segments.length < 3) return null;
  const last = normalizeText(segments[segments.length - 1]);
  if (!last) return null;
  return /^\d+$/.test(last) ? String(Number(last)) : null;
};

export const deriveImportedRateSelectors = ({
  sourceGroupNo,
  sourceClause,
  sourceItemNo,
}: ImportedRateSource): {
  groupNo: number | null;
  itemNo: string | null;
  subItemNo: string | null;
} => {
  const normalizedGroup = normalizeText(sourceGroupNo);
  const normalizedClause = normalizeText(sourceClause);
  const normalizedItem = normalizeText(sourceItemNo);
  const groupNo = normalizedGroup ? Number.parseInt(normalizedGroup, 10) : null;

  if (!Number.isFinite(groupNo ?? Number.NaN)) {
    return { groupNo: null, itemNo: null, subItemNo: null };
  }

  if (!normalizedClause) {
    return {
      groupNo,
      itemNo: normalizedItem,
      subItemNo: null,
    };
  }

  const segments = normalizedClause.split(".");
  if (segments.length >= 3) {
    return {
      groupNo,
      itemNo: `${segments[0]}.${segments[1]}`,
      subItemNo: normalizedClause,
    };
  }

  if (normalizedItem) {
    return {
      groupNo,
      itemNo: normalizedClause,
      subItemNo: `${normalizedClause}.${normalizedItem}`,
    };
  }

  return {
    groupNo,
    itemNo: normalizedClause,
    subItemNo: null,
  };
};

export const resolveImportedRateId = (
  row: ImportedRateSource & { announcedRate: number | null },
  rates: ImportedRateRow[],
  professionCode: string,
): number | null => {
  const selectors = deriveImportedRateSelectors(row);
  const normalizedClause = normalizeText(row.sourceClause);
  const normalizedGroup = normalizeText(row.sourceGroupNo);

  if (!selectors.groupNo) {
    if (professionCode === "NURSE" && normalizedClause === "1.1" && row.announcedRate === 1000) {
      const fallbackRate = rates.find(
        (rate) =>
          rate.professionCode === professionCode &&
          rate.groupNo === 1 &&
          rate.itemNo === "1.1" &&
          round2(rate.amount) === 1000,
      );
      return fallbackRate?.rateId ?? null;
    }
    return null;
  }

  if (
    professionCode === "NURSE" &&
    selectors.groupNo === 1 &&
    normalizedGroup === "1" &&
    normalizedClause === "1" &&
    row.announcedRate === 1000
  ) {
    const fallbackRate = rates.find(
      (rate) =>
        rate.professionCode === professionCode &&
        rate.groupNo === 1 &&
        rate.itemNo === "1.1" &&
        round2(rate.amount) === 1000,
    );
    if (fallbackRate) return fallbackRate.rateId;
  }

  const scopedRates = rates.filter(
    (rate) =>
      rate.professionCode === professionCode &&
      rate.groupNo === selectors.groupNo &&
      (row.announcedRate === null || round2(rate.amount) === round2(row.announcedRate)),
  );

  const subItemCandidates = [
    selectors.subItemNo,
    deriveShortSubItem(selectors.subItemNo),
    normalizeText(row.sourceItemNo),
    deriveShortSubItem(normalizedClause),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of subItemCandidates) {
    const exactSubItem = scopedRates.find(
      (rate) => normalizeText(rate.subItemNo) === candidate,
    );
    if (exactSubItem) return exactSubItem.rateId;
  }

  if (
    professionCode === "NURSE" &&
    selectors.groupNo === 2 &&
    selectors.itemNo === "2.2" &&
    selectors.subItemNo === null
  ) {
    const nursePrimaryCareRate = scopedRates.find((rate) => rate.rateId === 107);
    if (nursePrimaryCareRate) return nursePrimaryCareRate.rateId;
  }

  const exactItem = selectors.itemNo
    ? scopedRates.find(
        (rate) => rate.itemNo === selectors.itemNo && (rate.subItemNo ?? null) === null,
      )
    : null;
  if (exactItem) return exactItem.rateId;

  if (scopedRates.length === 1) return scopedRates[0].rateId;
  return null;
};

export const deriveImportedPayoutMetrics = ({
  daysInMonth,
  announcedRate,
  monthlyAmount,
  retroactiveAmount,
  totalAmount,
}: ImportedPayoutSource): {
  calculatedAmount: number;
  retroactiveAmount: number;
  totalPayable: number;
  eligibleDays: number;
  deductedDays: number;
} => {
  const calculatedAmount = round2(
    monthlyAmount ?? ((totalAmount ?? 0) - (retroactiveAmount ?? 0)),
  );
  const retroactive = round2(retroactiveAmount ?? ((totalAmount ?? 0) - calculatedAmount));
  const totalPayable = round2(totalAmount ?? (calculatedAmount + retroactive));

  if (!announcedRate || announcedRate <= 0 || daysInMonth <= 0) {
    return {
      calculatedAmount,
      retroactiveAmount: retroactive,
      totalPayable,
      eligibleDays: 0,
      deductedDays: 0,
    };
  }

  const eligibleDays = Math.max(
    0,
    Math.min(daysInMonth, round2((calculatedAmount / announcedRate) * daysInMonth)),
  );

  return {
    calculatedAmount,
    retroactiveAmount: retroactive,
    totalPayable,
    eligibleDays,
    deductedDays: round2(Math.max(0, daysInMonth - eligibleDays)),
  };
};
