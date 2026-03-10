import { formatThaiDate } from './requestDetail.format';
import {
  detectOcrDocumentKind,
  normalizeOcrAnalysisText,
} from './requestDetail.ocrDocuments';

type OcrResultLike = {
  name?: string;
  ok?: boolean;
  markdown?: string;
  document_kind?: string;
  fields?: Record<string, unknown>;
};

export type LicenseOcrCheck = {
  label: string;
  expectedValue: string;
  extractedValue: string;
  status: 'match' | 'near' | 'review';
};

export type LicenseOcrSummary = {
  fileName: string;
  checks: LicenseOcrCheck[];
  reviewCount: number;
  nearCount: number;
  summaryStatus: 'match' | 'near' | 'review';
};

type LicenseCandidate = LicenseOcrSummary & {
  matchCount: number;
  nearCount: number;
  extractedValueCount: number;
};

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

function toArabicDigits(value: string): string {
  return value.replace(/[๐-๙]/g, (char) => String(THAI_DIGITS.indexOf(char)));
}

function normalizeDigits(value: string): string {
  return toArabicDigits(value).replace(/\D+/g, '');
}

function normalizePersonName(value: string): string {
  return toArabicDigits(normalizeOcrAnalysisText(value))
    .replace(/(นางสาว|นาง|นาย|แพทย์หญิง|แพทย์ชาย)/g, ' ')
    .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const matrix = Array.from({ length: left.length + 1 }, () =>
    new Array<number>(right.length + 1).fill(0),
  );

  for (let index = 0; index <= left.length; index += 1) {
    matrix[index][0] = index;
  }
  for (let index = 0; index <= right.length; index += 1) {
    matrix[0][index] = index;
  }

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      );
    }
  }

  return matrix[left.length][right.length];
}

function isClosePersonNameMatch(expectedRaw: string, extractedRaw: string): boolean {
  const expected = normalizePersonName(expectedRaw);
  const extracted = normalizePersonName(extractedRaw);
  if (!expected || !extracted) return false;
  if (expected === extracted) return true;
  if (expected.includes(extracted) || extracted.includes(expected)) return true;

  const expectedTokens = expected.split(' ').filter(Boolean);
  const extractedTokens = extracted.split(' ').filter(Boolean);
  if (expectedTokens.length === extractedTokens.length && expectedTokens.length > 0) {
    let matchedTokens = 0;
    let surnameMatched = false;
    for (let index = 0; index < expectedTokens.length; index += 1) {
      const expectedToken = expectedTokens[index];
      const extractedToken = extractedTokens[index];
      const maxLength = Math.max(expectedToken.length, extractedToken.length);
      const distance = levenshteinDistance(expectedToken, extractedToken);
      const similarity = maxLength > 0 ? 1 - distance / maxLength : 0;
      if (similarity >= 0.8) {
        matchedTokens += 1;
      }
      if (index === expectedTokens.length - 1 && similarity >= 0.95) {
        surnameMatched = true;
      }
    }
    if (matchedTokens === expectedTokens.length) return true;
    if (
      surnameMatched &&
      expectedTokens.length >= 2 &&
      matchedTokens >= expectedTokens.length - 1
    ) {
      return true;
    }
  }

  const maxLength = Math.max(expected.length, extracted.length);
  const distance = levenshteinDistance(expected, extracted);
  const similarity = maxLength > 0 ? 1 - distance / maxLength : 0;
  return similarity >= 0.82;
}

function formatThaiDateStrict(value?: string | Date | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = date.getDate();
  const month = THAI_MONTHS[date.getMonth()] ?? '';
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

function extractThaiDateKey(value: string): string | null {
  const normalized = toArabicDigits(value)
    .replace(/[|/\\,:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const match = normalized.match(
    /(\d{1,2})\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(\d{4})/,
  );
  if (!match) return null;
  return `${match[1]} ${match[2]} ${match[3]}`;
}

function extractThaiDateParts(value: string): {
  day: string;
  month: string;
  year: string;
} | null {
  const normalized = toArabicDigits(value)
    .replace(/[|/\\,:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const match = normalized.match(
    /(\d{1,2})\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(\d{4})/,
  );
  if (!match) return null;
  return { day: match[1], month: match[2], year: match[3] };
}

function detectThaiMonthFromNoisyText(value: string): string | null {
  const normalized = toArabicDigits(normalizeOcrAnalysisText(value)).replace(/\s+/g, ' ');
  const monthMatchers: Array<[string, RegExp]> = [
    ['มกราคม', /มกร|มกรา/],
    ['กุมภาพันธ์', /กุมภ|กมภ/],
    ['มีนาคม', /มีนา|มีน|มีนํค|มีนาคม/],
    ['เมษายน', /เมษ|เมษายน/],
    ['พฤษภาคม', /พฤษภ|พค/],
    ['มิถุนายน', /มิถุน|มิย/],
    ['กรกฎาคม', /กรกฎ|กค/],
    ['สิงหาคม', /สิงหา|สค/],
    ['กันยายน', /กันยา|กย/],
    ['ตุลาคม', /ตุลา|ตค/],
    ['พฤศจิกายน', /พฤศจิ|พย/],
    ['ธันวาคม', /ธันวา|ธค/],
  ];

  for (const [month, pattern] of monthMatchers) {
    if (pattern.test(normalized)) return month;
  }
  return null;
}

function normalizeExtractedThaiDateDisplay(value: string): string {
  const analyzedValue = normalizeOcrAnalysisText(value);
  const direct = extractThaiDateParts(analyzedValue);
  if (direct) {
    return `${direct.day} ${direct.month} ${direct.year}`;
  }

  const normalized = toArabicDigits(analyzedValue).replace(/\s+/g, ' ').trim();
  const month = detectThaiMonthFromNoisyText(normalized);
  const numbers = Array.from(normalized.matchAll(/\d{1,4}/g)).map((match) => match[0]);
  const day = numbers.find((item) => item.length <= 2) ?? '';
  const year = numbers.find((item) => item.length === 4) ?? '';

  if (day && month && year) {
    return `${day} ${month} ${year}`;
  }

  return analyzedValue.trim() || '-';
}

function getDigitSimilarity(leftRaw: string, rightRaw: string): number {
  const left = normalizeDigits(leftRaw);
  const right = normalizeDigits(rightRaw);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) return 0;
  return 1 - levenshteinDistance(left, right) / maxLength;
}

function getEffectiveDocumentKind(item: OcrResultLike): string {
  const backendKind = String(item.document_kind ?? '')
    .trim()
    .toLowerCase();
  if (backendKind && backendKind !== 'general') {
    return backendKind;
  }
  return detectOcrDocumentKind({
    fileName: String(item.name ?? ''),
    markdown: String(item.markdown ?? ''),
  });
}

function extractedThaiDateKeyMatches(expectedDate: string, extractedDate: string): boolean {
  const expectedKey = extractThaiDateKey(expectedDate);
  const extractedKey = extractThaiDateKey(extractedDate);
  if (!expectedKey || !extractedKey) return false;
  return expectedKey === extractedKey;
}

function evaluateLicenseNumberStatus(
  expectedValue: string,
  extractedValue: string,
): LicenseOcrCheck['status'] {
  const similarity = getDigitSimilarity(expectedValue, extractedValue);
  if (similarity >= 0.999) return 'match';
  if (similarity >= 0.6) return 'near';
  return 'review';
}

function evaluateThaiDateStatus(
  expectedDate: string,
  extractedDate: string,
): LicenseOcrCheck['status'] {
  if (extractedThaiDateKeyMatches(expectedDate, extractedDate)) return 'match';
  const expected = extractThaiDateParts(expectedDate);
  const extracted = extractThaiDateParts(extractedDate);
  if (!expected || !extracted) return 'review';
  if (
    expected.month === extracted.month &&
    (expected.day === extracted.day || expected.year === extracted.year)
  ) {
    return 'near';
  }
  return 'review';
}

export function findLicenseOcrSummary(params: {
  results?: OcrResultLike[] | null;
  fullName?: string | null;
  licenseNo?: string | null;
  validUntil?: string | Date | null;
}): LicenseOcrSummary | null {
  const expectedName = String(params.fullName ?? '').trim();
  const expectedLicenseNo = String(params.licenseNo ?? '').trim();
  const expectedValidUntil = formatThaiDateStrict(params.validUntil);
  const candidates: LicenseCandidate[] = [];

  for (const item of params.results ?? []) {
    if (!item?.ok) continue;
    if (getEffectiveDocumentKind(item) !== 'license') continue;

    const fields = item.fields ?? {};
    const extractedName = String(fields.person_name ?? '').trim();
    const extractedLicenseNo = String(fields.license_no ?? '').trim();
    const extractedValidUntil = String(fields.license_valid_until ?? '').trim();

    if (extractedName && expectedName && !isClosePersonNameMatch(expectedName, extractedName)) {
      continue;
    }

    const checks: LicenseOcrCheck[] = [];

    if (expectedName && expectedName !== '-') {
      checks.push({
        label: 'ชื่อผู้ถือใบอนุญาต',
        expectedValue: expectedName,
        extractedValue: extractedName || '-',
        status: isClosePersonNameMatch(expectedName, extractedName) ? 'match' : 'review',
      });
    }

    if (expectedLicenseNo && expectedLicenseNo !== '-') {
      checks.push({
        label: 'เลขที่ใบอนุญาต',
        expectedValue: expectedLicenseNo,
        extractedValue: extractedLicenseNo || '-',
        status: evaluateLicenseNumberStatus(expectedLicenseNo, extractedLicenseNo),
      });
    }

    if (expectedValidUntil !== '-' && expectedValidUntil) {
      checks.push({
        label: 'วันหมดอายุ',
        expectedValue: formatThaiDate(params.validUntil) || '-',
        extractedValue: normalizeExtractedThaiDateDisplay(extractedValidUntil || '-'),
        status: evaluateThaiDateStatus(expectedValidUntil, extractedValidUntil),
      });
    }

    if (checks.length === 0) return null;

    const reviewCount = checks.filter((check) => check.status === 'review').length;
    const matchCount = checks.filter((check) => check.status === 'match').length;
    const nearCount = checks.filter((check) => check.status === 'near').length;
    const extractedValueCount = checks.filter(
      (check) => check.extractedValue && check.extractedValue !== '-',
    ).length;

    if (extractedValueCount === 0) {
      continue;
    }

    candidates.push({
      fileName: String(item.name ?? '').trim() || 'ไฟล์ใบอนุญาต',
      checks,
      reviewCount,
      nearCount,
      summaryStatus: reviewCount > 0 ? 'review' : nearCount > 0 ? 'near' : 'match',
      matchCount,
      extractedValueCount,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((left, right) => {
    if (right.matchCount !== left.matchCount) {
      return right.matchCount - left.matchCount;
    }
    if (right.extractedValueCount !== left.extractedValueCount) {
      return right.extractedValueCount - left.extractedValueCount;
    }
    if (left.reviewCount !== right.reviewCount) {
      return left.reviewCount - right.reviewCount;
    }
    return left.fileName.localeCompare(right.fileName, 'th');
  });

  const best = candidates[0];
  return {
    fileName: best.fileName,
    checks: best.checks,
    reviewCount: best.reviewCount,
    nearCount: best.nearCount,
    summaryStatus: best.summaryStatus,
  };
}

export function getLicenseOcrNotice(params: {
  result?: OcrResultLike | null;
  fullName?: string | null;
}): string | null {
  const item = params.result;
  const expectedName = String(params.fullName ?? '').trim();
  if (!item?.ok || !expectedName) return null;
  if (getEffectiveDocumentKind(item) !== 'license') return null;

  const extractedName = String(item.fields?.person_name ?? '').trim();
  if (!extractedName) {
    return 'ระบบอ่านชื่อผู้ถือใบอนุญาตได้ไม่ชัด';
  }
  if (!isClosePersonNameMatch(expectedName, extractedName)) {
    return 'ชื่อผู้ถือใบอนุญาตไม่ตรงกับบุคลากรคนนี้';
  }
  return null;
}

export function shouldSuppressLicenseOcrUi(params: {
  result?: OcrResultLike | null;
  fullName?: string | null;
}): boolean {
  return getLicenseOcrNotice(params) !== null;
}
