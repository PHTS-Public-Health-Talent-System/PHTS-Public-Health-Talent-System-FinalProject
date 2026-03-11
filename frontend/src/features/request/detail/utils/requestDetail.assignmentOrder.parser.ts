import type { AssignmentOrderSummary } from './requestDetail.assignmentOrder';
import {
  normalizeAssignmentOrderWhitespace,
  splitAssignmentOrderLines,
} from './requestDetail.assignmentOrder.normalizer';

export type OcrAssignmentCanonicalDocument = {
  fileName?: string | null;
  markdown?: string | null;
};

const PERSON_TITLES = ['นาย', 'นางสาว', 'นาง', 'แพทย์หญิง', 'แพทย์ชาย'];

const ORDER_NO_PATTERN = /^(?:ที่|ที)\s+([^\n\)]+)/m;
const SUBJECT_PATTERN = /(?:เรื่อง|เรอง)\s+([^\n]+)/;
const EFFECTIVE_DATE_PATTERN = /(?:ทั้งนี้\s*)?(?:ตั้งแต่วันที่|ต้งแต่วันที่)\s+([^\n]+)/;
const SIGNED_DATE_PATTERN = /(?:สั่ง\s*ณ\s*วันที่|สง\s*ณ\s*วันที่)\s+([^\n]+)/;
const SIGNED_DATE_ANCHOR_PATTERN = /(?:สั่ง\s*ณ\s*วันที่|สง\s*ณ\s*วันที่)/;
const MAJOR_SECTION_PATTERN = /^[0-9๑๒๓๔๕๖๗๘๙]+\.\s+/;
const MAJOR_SECTION_HEADING_PATTERN = /^[0-9๑๒๓๔๕๖๗๘๙]+\.\s*งาน/;
const SUB_SECTION_PATTERN = /^([0-9๑๒๓๔๕๖๗๘๙]+\.[0-9๑๒๓๔๕๖๗๘๙]+(?:\.[0-9๑๒๓๔๕๖๗๘๙]+)*)\s+/;
const DUTY_ANCHOR_PATTERN = /โดยมีหน้าที่/;
const SIGNER_NAME_PATTERN = /[\(（]([^()（）]{2,120})[\)）]/;
const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const THAI_MONTH_PATTERN =
  /(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)/;
const MAX_DUTY_HIGHLIGHTS = 4;

const extractFirst = (markdown: string, patterns: RegExp[]): string | null => {
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    const value = match?.[1] ? normalizeAssignmentOrderWhitespace(match[1]) : '';
    if (value) return value;
  }
  return null;
};

const normalizeNameForMatch = (value: string) => {
  let normalized = normalizeAssignmentOrderWhitespace(value);
  for (const title of PERSON_TITLES) {
    if (normalized.startsWith(title)) {
      normalized = normalized.slice(title.length).trim();
      break;
    }
  }
  return normalized.replace(/\s+/g, '').toLowerCase();
};

const normalizeNameTokensForMatch = (value: string): string[] => {
  let normalized = normalizeAssignmentOrderWhitespace(value);
  for (const title of PERSON_TITLES) {
    if (normalized.startsWith(title)) {
      normalized = normalized.slice(title.length).trim();
      break;
    }
  }
  return normalized
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
};

const extractPersonNameParts = (value: string): { firstName: string; lastName: string | null } => {
  let normalized = normalizeAssignmentOrderWhitespace(value);
  for (const title of PERSON_TITLES) {
    if (normalized.startsWith(title)) {
      normalized = normalized.slice(title.length).trim();
      break;
    }
  }
  const parts = normalized.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.length >= 2 ? parts[parts.length - 1] : null,
  };
};

const normalizePersonLine = (value: string): string =>
  normalizeAssignmentOrderWhitespace(value).replace(/^[^\d๑๒๓๔๕๖๗๘๙]+\/?\s*/, '');

const normalizeSectionTitle = (value: string): string =>
  normalizeAssignmentOrderWhitespace(value).replace(/^[.\-•]+\s*/, '');

const toArabicDigits = (value: string): string =>
  value.replace(/[๐-๙]/g, (char) => String(THAI_DIGITS.indexOf(char)));

const normalizeCommonOcrTypos = (value: string): string =>
  value
    .replace(/คําสั่ง/g, 'คำสั่ง')
    .replace(/บําบัด/g, 'บำบัด')
    .replace(/(?:ไ+ด้รับ|ไ+ดรับ|ไได้รับ|ไดรับ|ด้รับ)/g, 'ได้รับ');

const normalizeYearDigits = (value: string): string =>
  value.replace(/(พ\.ศ\.\s*)([0-9๐-๙]{4})/g, (_, prefix: string, year: string) => {
    return `${prefix}${toArabicDigits(String(year))}`;
  });

const normalizeAllDigits = (value: string): string => toArabicDigits(value);

const trimDateNoiseTail = (value: string): string =>
  value.replace(/\s+[A-Za-z]{2,}\.?$/, '');

const normalizeSummaryText = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = normalizeAssignmentOrderWhitespace(
    normalizeYearDigits(normalizeCommonOcrTypos(value)),
  );
  return normalized || null;
};

const sanitizeDutyNoise = (value: string): string => {
  const rawTokens = value.split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return value;

  const isSuspiciousDigitToken = (token: string): boolean => {
    const normalized = token.replace(/[.,:;|/()]/g, '');
    if (!normalized) return false;
    if (!/[0-9๐-๙]/.test(normalized)) return false;
    if (!/[ก-ฮ]/.test(normalized)) return false;
    return normalized.length <= 4;
  };

  const isShortThaiToken = (token: string): boolean => {
    const normalized = token.replace(/[.,:;|/()]/g, '');
    if (!normalized) return false;
    return /^[ก-ฮ]{1,2}$/.test(normalized);
  };

  return rawTokens
    .filter((token, index) => {
      if (isSuspiciousDigitToken(token)) return false;
      if (isShortThaiToken(token)) {
        const prev = rawTokens[index - 1] || '';
        const next = rawTokens[index + 1] || '';
        if (isSuspiciousDigitToken(prev) || isSuspiciousDigitToken(next)) {
          return false;
        }
      }
      return true;
    })
    .join(' ')
    .trim();
};

const normalizeOrdinalPrefix = (value: string): string =>
  value
    .replace(/^([๐-๙])\.([0-9])/, (_, thaiMajor: string, minor: string) => {
      return `${toArabicDigits(thaiMajor)}.${minor}`;
    })
    .replace(/^([0-9])\.([๐-๙])/, (_, major: string, thaiMinor: string) => {
      return `${major}.${toArabicDigits(thaiMinor)}`;
    });

const sanitizeOrderNo = (value: string | null): string | null => {
  const normalized = normalizeSummaryText(value);
  if (!normalized) return null;

  const compact = normalizeAllDigits(normalized).replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/');
  const match = compact.match(/([0-9]{1,4}\/[0-9]{1,5})/);
  return match?.[1] ?? compact;
};

const sanitizeDateText = (value: string | null): string | null => {
  const normalized = normalizeSummaryText(value);
  if (!normalized) return null;

  const cleaned = normalizeAllDigits(trimDateNoiseTail(normalized));
  if (!THAI_MONTH_PATTERN.test(cleaned)) return cleaned;

  const yearMatch = cleaned.match(/(?:พ\.ศ\.\s*)?([0-9]{4})/);
  if (yearMatch?.[1]) {
    const year = Number(yearMatch[1]);
    if (Number.isFinite(year) && (year < 2500 || year > 2600)) {
      return null;
    }
  }

  return cleaned;
};

const containsThaiYear = (value: string): boolean => /(?:25\d{2}|๒๕[๐-๙]{2})/.test(value);

const extractLeadingMajorOrdinal = (line: string): number | null => {
  const match = normalizeAssignmentOrderWhitespace(line).match(/^([0-9๑๒๓๔๕๖๗๘๙]+)\.\s+/);
  if (!match?.[1]) return null;
  const parsed = Number(toArabicDigits(match[1]));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const extractLeadingDutyOrdinal = (line: string): number | null => {
  const match = normalizeAssignmentOrderWhitespace(line).match(/^([0-9๑๒๓๔๕๖๗๘๙]+)\.\s+/);
  if (!match?.[1]) return null;
  const parsed = Number(toArabicDigits(match[1]));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const toThaiDigits = (value: string): string =>
  value.replace(/[0-9]/g, (char) => THAI_DIGITS[Number(char)] ?? char);

const formatDutyOrdinalLikeSource = (sourceLine: string, ordinal: number): string => {
  const rawPrefix = normalizeAssignmentOrderWhitespace(sourceLine).match(/^([0-9๑๒๓๔๕๖๗๘๙]+)\./)?.[1] ?? '';
  if (/[๑๒๓๔๕๖๗๘๙๐]/.test(rawPrefix)) {
    return toThaiDigits(String(ordinal));
  }
  return String(ordinal);
};

const rewriteDutyOrdinal = (line: string, expectedOrdinal: number): string =>
  line.replace(
    /^([0-9๑๒๓๔๕๖๗๘๙]+)\./,
    `${formatDutyOrdinalLikeSource(line, expectedOrdinal)}.`,
  );

const isLikelyMajorSectionHeading = (line: string, expectedMajorOrdinal: number | null): boolean => {
  const normalized = normalizeAssignmentOrderWhitespace(line);
  if (!normalized || !MAJOR_SECTION_PATTERN.test(normalized)) return false;
  if (!MAJOR_SECTION_HEADING_PATTERN.test(normalized)) return false;
  if (!/งาน/.test(normalized)) return false;

  if (expectedMajorOrdinal === null) return true;
  const ordinal = extractLeadingMajorOrdinal(normalized);
  if (ordinal === expectedMajorOrdinal) return true;
  return normalized.startsWith(String(expectedMajorOrdinal));
};

const isLikelyWorkSectionLine = (line: string): boolean => {
  const normalized = normalizeAssignmentOrderWhitespace(line);
  if (!normalized) return false;
  if (
    /^(?:เรื่อง|ทั้งนี้|สั่ง|คำสั่ง|คําสั่ง|โดยมีหน้าที่)/.test(normalized) ||
    SUB_SECTION_PATTERN.test(normalized)
  ) {
    return false;
  }

  return (
    /^งาน/.test(normalized) ||
    /^[.\-•]\s*งาน/.test(normalized) ||
    /^[0-9๑๒๓๔๕๖๗๘๙]+\s*งาน/.test(normalized)
  );
};

const hasAssignmentHeading = (lines: string[]): boolean => {
  const headerWindow = lines.filter((line) => /[ก-๙A-Za-z]/.test(line)).slice(0, 28);

  const hasTitle = headerWindow.some((line) => /(?:คำสั่ง|คําสั่ง|คำสัง|คําสัง)/.test(line));
  if (!hasTitle) return false;

  return headerWindow.some(
    (line) =>
      /(มอบหมาย|รับผิดชอบ|ปฏิบัติงาน)/.test(line) ||
      /^(?:ที่|ที)\s*[0-9๐-๙]+\s*\//.test(line) ||
      /กลุ่มงานเภสัชกรรม/.test(line),
  );
};

const findPersonMajorSectionIndex = (lines: string[], personIndex: number | null): number | null => {
  if (personIndex === null || personIndex < 0) return null;
  for (let index = personIndex; index >= 0; index -= 1) {
    const line = normalizeAssignmentOrderWhitespace(lines[index] || '');
    if (!line) continue;
    if (MAJOR_SECTION_PATTERN.test(line)) return index;
  }
  for (let index = personIndex; index >= Math.max(0, personIndex - 20); index -= 1) {
    const line = normalizeAssignmentOrderWhitespace(lines[index] || '');
    if (!line) continue;
    if (isLikelyWorkSectionLine(line)) return index;
  }
  return null;
};

const isLikelySignerTitleLine = (line: string): boolean => {
  const normalized = normalizeAssignmentOrderWhitespace(line);
  if (!normalized) return false;
  if (
    /^(?:สั่ง|ทั้งนี้|เรื่อง|ที่|คำสั่ง|คําสั่ง|โดยมีหน้าที่)/.test(normalized) ||
    MAJOR_SECTION_PATTERN.test(normalized) ||
    SUB_SECTION_PATTERN.test(normalized)
  ) {
    return false;
  }
  return /(หัวหน้า|ผู้อำนวยการ|หัวหน้ากลุ่มงาน|รองผู้อำนวยการ|ผู้ช่วยผู้อำนวยการ|นายก|เลขาธิการ)/.test(
    normalized,
  );
};

const extractSigner = (lines: string[]): { signerName: string | null; signerTitle: string | null } => {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = normalizeAssignmentOrderWhitespace(lines[index] || '');
    if (!line) continue;
    const match = line.match(SIGNER_NAME_PATTERN);
    const rawName = match?.[1] ? normalizeAssignmentOrderWhitespace(match[1]) : '';
    if (!rawName || !/[ก-๙]/.test(rawName)) continue;

    let signerTitle: string | null = null;
    for (let nextIndex = index + 1; nextIndex < Math.min(lines.length, index + 4); nextIndex += 1) {
      const nextLine = normalizeAssignmentOrderWhitespace(lines[nextIndex] || '');
      if (!nextLine) continue;
      if (isLikelySignerTitleLine(nextLine)) {
        signerTitle = nextLine;
        break;
      }
    }

    return {
      signerName: rawName,
      signerTitle,
    };
  }

  return {
    signerName: null,
    signerTitle: null,
  };
};

const extractSignedDate = (lines: string[]): string | null => {
  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeAssignmentOrderWhitespace(lines[index] || '');
    if (!line || !SIGNED_DATE_ANCHOR_PATTERN.test(line)) continue;

    const inlineValue = normalizeAssignmentOrderWhitespace(line.replace(SIGNED_DATE_ANCHOR_PATTERN, ''));
    const parts: string[] = [];
    if (inlineValue) parts.push(inlineValue);

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = normalizeAssignmentOrderWhitespace(lines[nextIndex] || '');
      if (!nextLine) continue;
      if (
        /^(?:เรื่อง|ทั้งนี้|โดยมีหน้าที่|คำสั่ง|คําสั่ง)/.test(nextLine) ||
        MAJOR_SECTION_PATTERN.test(nextLine) ||
        SUB_SECTION_PATTERN.test(nextLine) ||
        /^[\(（]/.test(nextLine)
      ) {
        break;
      }
      parts.push(nextLine);
      if (containsThaiYear(nextLine) || parts.length >= 3) break;
    }

    const value = normalizeAssignmentOrderWhitespace(parts.join(' '));
    if (value) return trimDateNoiseTail(value);
  }

  const markdown = lines.join('\n');
  const fallback = extractFirst(markdown, [SIGNED_DATE_PATTERN]);
  return fallback ? trimDateNoiseTail(fallback) : null;
};

const lineMatchesPerson = (line: string, personName: string): boolean => {
  const normalizedPerson = normalizeNameForMatch(personName);
  if (!normalizedPerson) return false;

  const compactLine = normalizeNameForMatch(line);
  if (compactLine.includes(normalizedPerson)) return true;

  const tokens = normalizeNameTokensForMatch(personName);
  if (tokens.length < 2) return false;

  const spacedLine = normalizeAssignmentOrderWhitespace(line).toLowerCase();
  let cursor = 0;
  for (const token of tokens) {
    const index = spacedLine.indexOf(token, cursor);
    if (index < 0) return false;
    cursor = index + token.length;
  }
  return true;
};

const finalizePersonLine = (
  value: string,
  lines: string[],
  index: number,
  personName: string,
): string => {
  const normalized = normalizePersonLine(value);
  const base = normalized || normalizeAssignmentOrderWhitespace(value);
  const { firstName, lastName } = extractPersonNameParts(personName);
  if (!firstName || !lastName) return base;

  const compactBase = normalizeNameForMatch(base);
  const compactFirst = normalizeNameForMatch(firstName);
  const compactLast = normalizeNameForMatch(lastName);
  if (!compactBase.includes(compactFirst) || compactBase.includes(compactLast)) {
    return base;
  }

  const nearLines = [lines[index - 1], lines[index + 1], lines[index + 2]]
    .map((line) => normalizeAssignmentOrderWhitespace(line || ''))
    .filter(Boolean);

  const hasNearbyLastName = nearLines.some((line) => normalizeNameForMatch(line).includes(compactLast));
  if (!hasNearbyLastName) return base;

  return `${base} ${lastName}`.trim();
};

const scorePersonLineCandidate = (line: string, tokens: string[]): number => {
  const normalized = normalizeAssignmentOrderWhitespace(line).toLowerCase();
  if (!normalized) return 0;

  let score = 0;
  for (const token of tokens) {
    if (normalized.includes(token)) score += 2;
  }
  if (PERSON_TITLES.some((title) => normalized.includes(title))) score += 1;
  if (/[0-9๑๒๓๔๕๖๗๘๙]+\./.test(normalized)) score += 1;
  return score;
};

const pickBestPersonLine = (
  candidates: Array<{ line: string; index: number }>,
  tokens: string[],
): { line: string; index: number } | null => {
  let best: { line: string; index: number; score: number } | null = null;
  for (const candidate of candidates) {
    const score = scorePersonLineCandidate(candidate.line, tokens);
    if (!best || score > best.score) {
      best = { ...candidate, score };
    }
  }

  if (!best || best.score <= 0) return null;
  return { line: best.line, index: best.index };
};

const findPersonMatch = (
  lines: string[],
  personName: string,
): { personLine: string; personIndex: number } | null => {
  if (!normalizeNameForMatch(personName)) return null;
  const tokens = normalizeNameTokensForMatch(personName);
  const anchorToken = tokens[0] ?? null;

  const normalizeLine = (value: string | undefined): string =>
    normalizeAssignmentOrderWhitespace(value || '').toLowerCase();

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeAssignmentOrderWhitespace(lines[index] || '');
    if (!line) continue;
    if (lineMatchesPerson(line, personName)) {
      return { personLine: finalizePersonLine(line, lines, index, personName), personIndex: index };
    }

    const next = normalizeAssignmentOrderWhitespace(lines[index + 1] || '');
    if (next && lineMatchesPerson(`${line} ${next}`, personName)) {
      const best = pickBestPersonLine(
        [
          { line, index },
          { line: next, index: index + 1 },
        ],
        tokens,
      );
      if (best) {
        return {
          personLine: finalizePersonLine(best.line, lines, best.index, personName),
          personIndex: best.index,
        };
      }
      return { personLine: finalizePersonLine(line, lines, index, personName), personIndex: index };
    }

    const third = normalizeAssignmentOrderWhitespace(lines[index + 2] || '');
    if (next && third && lineMatchesPerson(`${line} ${next} ${third}`, personName)) {
      const best = pickBestPersonLine(
        [
          { line, index },
          { line: next, index: index + 1 },
          { line: third, index: index + 2 },
        ],
        tokens,
      );
      if (best) {
        return {
          personLine: finalizePersonLine(best.line, lines, best.index, personName),
          personIndex: best.index,
        };
      }
      return { personLine: finalizePersonLine(line, lines, index, personName), personIndex: index };
    }

    if (anchorToken && tokens.length > 1 && normalizeLine(line).includes(anchorToken)) {
      const neighborhood = [
        normalizeLine(lines[index - 2]),
        normalizeLine(lines[index - 1]),
        normalizeLine(lines[index]),
        normalizeLine(lines[index + 1]),
        normalizeLine(lines[index + 2]),
      ] 
        .filter(Boolean)
        .join(' ');
      if (tokens.every((token) => neighborhood.includes(token))) {
        const best = pickBestPersonLine(
          [
            { line: lines[index - 1] || '', index: index - 1 },
            { line, index },
            { line: lines[index + 1] || '', index: index + 1 },
          ],
          tokens,
        );
        if (best) {
          return {
            personLine: finalizePersonLine(best.line, lines, best.index, personName),
            personIndex: best.index,
          };
        }
        return { personLine: finalizePersonLine(line, lines, index, personName), personIndex: index };
      }
    }
  }
  return null;
};

const findNearestSectionTitle = (lines: string[], personIndex: number | null): string | null => {
  if (personIndex === null || personIndex < 0) return null;
  for (let index = personIndex - 1; index >= 0; index -= 1) {
    const line = normalizeAssignmentOrderWhitespace(lines[index] || '');
    if (!line) continue;
    if (MAJOR_SECTION_PATTERN.test(line) || isLikelyWorkSectionLine(line)) {
      return normalizeSectionTitle(line);
    }
  }
  return null;
};

const findRelevantDutyAnchorIndex = (
  lines: string[],
  personIndex: number | null,
  personMajorSectionIndex: number | null,
): number => {
  if (personIndex === null || personIndex < 0 || personMajorSectionIndex === null) {
    return lines.findIndex((line) => DUTY_ANCHOR_PATTERN.test(normalizeAssignmentOrderWhitespace(line || '')));
  }

  const currentMajorOrdinal = extractLeadingMajorOrdinal(lines[personMajorSectionIndex] || '');
  const nextMajorOrdinal = currentMajorOrdinal !== null ? currentMajorOrdinal + 1 : null;

  let nextMajorSectionIndex = lines.length;
  for (let index = personMajorSectionIndex + 1; index < lines.length; index += 1) {
    const line = normalizeAssignmentOrderWhitespace(lines[index] || '');
    if (
      isLikelyMajorSectionHeading(line, nextMajorOrdinal) ||
      (isLikelyWorkSectionLine(line) && index > personMajorSectionIndex + 1)
    ) {
      nextMajorSectionIndex = index;
      break;
    }
  }

  for (let index = personMajorSectionIndex; index < nextMajorSectionIndex; index += 1) {
    if (DUTY_ANCHOR_PATTERN.test(normalizeAssignmentOrderWhitespace(lines[index] || ''))) {
      return index;
    }
  }

  if (personIndex !== null && personIndex >= 0 && nextMajorSectionIndex === lines.length) {
    for (let index = personIndex; index < Math.min(lines.length, personIndex + 30); index += 1) {
      if (DUTY_ANCHOR_PATTERN.test(normalizeAssignmentOrderWhitespace(lines[index] || ''))) {
        return index;
      }
    }
  }

  return -1;
};

const extractDutyHighlights = (
  lines: string[],
  personIndex: number | null,
  personMajorSectionIndex: number | null,
): string[] => {
  const anchorIndex = findRelevantDutyAnchorIndex(lines, personIndex, personMajorSectionIndex);
  if (anchorIndex < 0) return [];

  let nextMajorSectionIndex = lines.length;
  const currentMajorOrdinal =
    personMajorSectionIndex !== null
      ? extractLeadingMajorOrdinal(lines[personMajorSectionIndex] || '')
      : null;
  const nextMajorOrdinal = currentMajorOrdinal !== null ? currentMajorOrdinal + 1 : null;
  if (personMajorSectionIndex !== null) {
    for (let index = personMajorSectionIndex + 1; index < lines.length; index += 1) {
      const line = normalizeAssignmentOrderWhitespace(lines[index] || '');
      if (
        isLikelyMajorSectionHeading(line, nextMajorOrdinal) ||
        (isLikelyWorkSectionLine(line) && index > personMajorSectionIndex + 1)
      ) {
        nextMajorSectionIndex = index;
        break;
      }
    }
  }

  const isDutyStartLine = (line: string): boolean =>
    /^[0-9๑๒๓๔๕๖๗๘๙]+\.\s+/.test(line) ||
    /^[0-9๑๒๓๔๕๖๗๘๙]+\.[0-9๑๒๓๔๕๖๗๘๙]+\s+/.test(line);

  const highlights: string[] = [];
  let lastDutyOrdinal: number | null = null;
  let index = anchorIndex + 1;
  while (index < Math.min(lines.length, nextMajorSectionIndex)) {
    const line = normalizeAssignmentOrderWhitespace(lines[index] || '');
    if (!line) {
      if (highlights.length > 0) break;
      index += 1;
      continue;
    }

    if (highlights.length > 0 && /^[0-9๑๒๓๔๕๖๗๘๙]+\.\s*งาน/.test(line)) {
      break;
    }

    if (isDutyStartLine(line)) {
      if (highlights.length > 0 && /^[0-9๑๒๓๔๕๖๗๘๙]+\.[0-9๑๒๓๔๕๖๗๘๙]+\s+งาน/.test(line)) {
        break;
      }

      const ordinal = extractLeadingDutyOrdinal(line);
      if (highlights.length > 0 && ordinal !== null && lastDutyOrdinal !== null && ordinal <= lastDutyOrdinal) {
        break;
      }

      let merged = line;
      let lookAhead = index + 1;
      while (lookAhead < Math.min(lines.length, nextMajorSectionIndex)) {
        const nextLine = normalizeAssignmentOrderWhitespace(lines[lookAhead] || '');
        if (!nextLine) break;
        if (isDutyStartLine(nextLine)) break;
        if (/^[0-9๑๒๓๔๕๖๗๘๙]+\.\s*งาน/.test(nextLine)) break;
        merged = `${merged} ${nextLine}`.trim();
        lookAhead += 1;
      }

      let normalizedDuty = merged;
      if (ordinal !== null) {
        if (lastDutyOrdinal !== null && ordinal > lastDutyOrdinal + 1) {
          const expected: number = lastDutyOrdinal + 1;
          normalizedDuty = rewriteDutyOrdinal(merged, expected);
          lastDutyOrdinal = expected;
        } else {
          lastDutyOrdinal = ordinal;
        }
      }
      highlights.push(normalizedDuty);
      if (highlights.length === MAX_DUTY_HIGHLIGHTS) break;
      index = lookAhead;
      continue;
    }

    index += 1;
  }
  return highlights;
};

export const parseCanonicalAssignmentOrderSummary = (
  document: OcrAssignmentCanonicalDocument,
  personName: string,
): AssignmentOrderSummary | null => {
  const rawMarkdown = String(document.markdown ?? '');
  if (!rawMarkdown.trim()) {
    return null;
  }

  const lines = splitAssignmentOrderLines(rawMarkdown);
  if (!hasAssignmentHeading(lines)) {
    return null;
  }

  const markdown = lines.join('\n');
  const personMatch = findPersonMatch(lines, personName);
  const personLine = personMatch?.personLine ?? null;
  const personIndex = personMatch?.personIndex ?? null;
  const personMajorSectionIndex = findPersonMajorSectionIndex(lines, personIndex);
  const signer = extractSigner(lines);
  const orderNo = sanitizeOrderNo(extractFirst(markdown, [ORDER_NO_PATTERN]));
  const subject = normalizeSummaryText(extractFirst(markdown, [SUBJECT_PATTERN]));
  const department = normalizeSummaryText(
    extractFirst(markdown, [/^คำสั่ง([^\n\(]+)/m, /(กลุ่มงาน[^\n\(]+)/]),
  );
  const effectiveDate = sanitizeDateText(extractFirst(markdown, [EFFECTIVE_DATE_PATTERN]));
  const signedDate = sanitizeDateText(extractSignedDate(lines));
  const normalizedPersonLine = normalizeSummaryText(
    personLine ? normalizeOrdinalPrefix(personLine) : null,
  );
  const sectionTitle = normalizeSummaryText(findNearestSectionTitle(lines, personIndex));
  const dutyHighlights = extractDutyHighlights(lines, personIndex, personMajorSectionIndex)
    .map((item) => normalizeSummaryText(sanitizeDutyNoise(item)))
    .filter((item): item is string => Boolean(item));

  const warnings: string[] = [];
  if (!personLine) warnings.push('ไม่พบชื่อบุคลากรครบถ้วนในเอกสาร');
  if (!orderNo) warnings.push('ไม่พบเลขที่คำสั่งชัดเจน');
  if (!signedDate || !THAI_MONTH_PATTERN.test(signedDate)) warnings.push('วันที่ลงนามอาจคลาดเคลื่อน');
  if (!effectiveDate || !THAI_MONTH_PATTERN.test(effectiveDate)) warnings.push('วันเริ่มมีผลอาจคลาดเคลื่อน');

  return {
    fileName: document.fileName?.trim() || 'เอกสาร OCR',
    orderNo,
    subject,
    department,
    effectiveDate,
    signedDate,
    signerName: normalizeSummaryText(signer.signerName),
    signerTitle: normalizeSummaryText(signer.signerTitle),
    personMatched: Boolean(personLine),
    personLine: normalizedPersonLine,
    sectionTitle,
    dutyHighlights,
    warnings,
  };
};
