import type { OcrBatchResultItem } from '@/modules/ocr/entities/ocr-precheck.entity.js';

export type OcrDocumentKind = 'license' | 'memo' | 'assignment_order' | 'general';

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').replace(/[ \t]+$/gm, '').trim();

const buildLines = (markdown: string): string[] =>
  markdown
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

export const classifyOcrDocument = (item: OcrBatchResultItem): OcrDocumentKind => {
  const markdown = normalizeWhitespace(item.markdown || '');
  const lines = buildLines(item.markdown || '');
  const fileName = normalizeWhitespace(item.name || '').toLowerCase();
  const memoSignalCount = [
    lines.some((line) => /(?:บันทึกข้อความ|บนทกขอความ|บันทึกขอความ)/.test(line)),
    lines.some((line) => /^ส่วนราชการ\s+/.test(line)),
    lines.some((line) => /^เรียน\s+/.test(line)),
    lines.some((line) => /(?:เรื่อง|เรอง)\s+/.test(line)),
    lines.some((line) => /วันที่\s+/.test(line)),
  ].filter(Boolean).length;

  if (/คำสั่ง/.test(markdown) && /(มอบหมาย|รับผิดชอบ|ปฏิบัติงาน)/.test(markdown)) {
    return 'assignment_order';
  }
  if (memoSignalCount >= 3) {
    return 'memo';
  }
  if (
    [
      lines.some((line) => /(ใบอนุญาต|ไบอนุญาต|บอนญาต)/.test(line)),
      lines.some((line) => /(ประกอบวิชา|วิชาจีพ|วิชาชีพ)/.test(line) && /(พยาบาล|ผยาบาล|แยายาล|เภสัช)/.test(line)),
      lines.some((line) => /(ต่ออายุครั้งที่|ตออายุตรงท|ตอยอายุตรงท)/.test(line)),
      lines.some((line) => /(หมดอายุ|หผดอายุ|ทมดอาย|มดอายุ|หผดอาย)/.test(line)),
      lines.some((line) => /(ออกใบอนุญาตนี้ให้แก่|ออกใบอนุญาตนี้ให้แก|จอกใบอนุญาต|ลอกใบอนญาต)/.test(line)),
    ].filter(Boolean).length >= 2 ||
    /ใบอนุญาตประกอบวิชาชีพ/.test(markdown) ||
    fileName.includes('license') ||
    fileName.includes('ใบอนุญาต')
  ) {
    return 'license';
  }
  return 'general';
};
