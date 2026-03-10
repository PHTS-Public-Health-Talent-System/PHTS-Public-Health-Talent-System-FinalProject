import {
  classifyOcrDocument,
  enrichOcrBatchResult,
} from '@/modules/ocr/services/ocr-gateway-analysis.service.js';

describe('ocr gateway analysis', () => {
  test('classifies and enriches memo OCR result with extracted fields', () => {
    const enriched = enrichOcrBatchResult({
      name: 'memo.pdf',
      ok: true,
      markdown: `
บันทึกข้อความ
ส่วนราชการ โรงพยาบาลอุดรดิตถ์ กลุ่มภารกิจด้านการพยาบาล โทร 2216
ที่ อต 0033.104/000953
วันที่ 15 มกราคม 2569
เรื่อง ขอส่งสำเนาใบอนุญาตประกอบวิชาชีพการพยาบาลและการผดุงครรภ์ ชั้นหนึ่ง
เรียน หัวหน้ากลุ่มงานทรัพยากรบุคคล
      `,
    });

    expect(enriched).toEqual(
      expect.objectContaining({
        ok: true,
        document_kind: 'memo',
        missing_fields: [],
        quality: {
          required_fields: 3,
          captured_fields: 3,
          passed: true,
        },
        fields: expect.objectContaining({
          document_no: 'อต 0033.104/000953',
          document_date: '15 มกราคม 2569',
          subject:
            'ขอส่งสำเนาใบอนุญาตประกอบวิชาชีพการพยาบาลและการผดุงครรภ์ ชั้นหนึ่ง',
        }),
      }),
    );
  });

  test('falls back logically when assignment order misses required fields', () => {
    const enriched = enrichOcrBatchResult({
      name: 'order.pdf',
      ok: true,
      markdown: `
คำสั่งกลุ่มงานเภสัชกรรม
เรื่อง ยกเลิกและมอบหมายเจ้าหน้าที่รับผิดชอบในการปฏิบัติงาน
๑. งานเตรียมหรือผลิตยาเคมีบำบัด
      `,
    });

    expect(enriched.document_kind).toBe('assignment_order');
    expect(enriched.fallback_reason).toBe('missing_required_fields');
    expect(enriched.missing_fields).toEqual(
      expect.arrayContaining(['order_no', 'person_name']),
    );
    expect(enriched.quality).toEqual({
      required_fields: 4,
      captured_fields: 2,
      passed: false,
    });
  });

  test('classifies license documents from OCR text', () => {
    expect(
      classifyOcrDocument({
        name: 'license.pdf',
        ok: true,
        markdown: `
ใบอนุญาตประกอบวิชาชีพการพยาบาลและการผดุงครรภ์
ใบอนุญาตที่ 541134081
หมดอายุ วันที่ 28 มีนาคม 2569
        `,
      }),
    ).toBe('license');
  });

  test('classifies noisy scanned license OCR as license and extracts key fields', () => {
    const enriched = enrichOcrBatchResult({
      name: 'page-2.pdf',
      ok: true,
      markdown: `
ง 1 เร
ใบอนุญาตปี ๒๕๑๑๓๑๕๐๕๑ ตออายุตรงที ๑
ใบอนุญาตประกอบวิชาจีตการแยายาลและการผดุงครรภ์
จอกใบอนุญาตธี้ให้แก่
นางส่าวอัณตยาณัช แดงไฟ
ออูกให้ ณวันท ๒๕ ๒ือน มีนาคม แทยักาช ๒๕๑๕
หผดอายุ วันที่ ๒๕ เดียน มีนาคม ยุทธศักราช์ ๒๕๕๕
      `,
    });

    expect(enriched.document_kind).toBe('license');
    expect(enriched.fields).toEqual(
      expect.objectContaining({
        license_no: '2511315051',
        person_name: expect.stringContaining('แดงไฟ'),
        license_valid_until: expect.stringContaining('มีนาคม'),
      }),
    );
    expect(enriched.quality).toEqual({
      required_fields: 3,
      captured_fields: 3,
      passed: true,
    });
  });

  test('extracts license fields from split-name noisy OCR lines', () => {
    const enriched = enrichOcrBatchResult({
      name: 'page-3.pdf',
      ok: true,
      markdown: `
ใบอนุญาตที่ 4๙๑1๑9๔๔๓๖
ออกใบอนุญาตนี้ให้แกก่
ธรรมสุทธิ์
นางนิสยา
ทมดอาย วันที่: 19 เดือน มีนาคม พุทธศักราช์ 2574
      `,
    });

    expect(enriched.document_kind).toBe('license');
    expect(enriched.fields).toEqual(
      expect.objectContaining({
        license_no: '4911194436',
        person_name: 'ธรรมสุทธิ์ นางนิสยา',
        license_valid_until: expect.stringContaining('19 เดือน มีนาคม'),
      }),
    );
    expect(enriched.quality).toEqual({
      required_fields: 3,
      captured_fields: 3,
      passed: true,
    });
  });

  test('classifies noisy memo OCR before license keywords and extracts key fields', () => {
    const enriched = enrichOcrBatchResult({
      name: '20260213-004 3.pdf',
      ok: true,
      markdown: `
บนทกขอความ
ส่วนราชการ โรงพยาบาลอุตรดิตถ์ กลุ่มภารกิจด้านการพยาบาล โทร ๒๑๑๒
fl อต ๐๐๓๓๑๐๕/๐๐๐6                  วันที่ ๑๕ มกราคม ๒๕๖๙
เรอง ขอส่งสำเนาใบอนุญาตประกอบวิชาชีพการพยาบาลและการผดุงครรภ์ ชั้นหนึ่ง
เรียน หัวหน้ากลุ่มงานทรัพยากรบุคคล
      `,
    });

    expect(enriched.document_kind).toBe('memo');
    expect(enriched.fields).toEqual(
      expect.objectContaining({
        document_no: 'อต 0033105/0006',
        document_date: '15 มกราคม 2569',
        subject: 'ขอส่งสำเนาใบอนุญาตประกอบวิชาชีพการพยาบาลและการผดุงครรภ์ ชั้นหนึ่ง',
      }),
    );
    expect(enriched.quality).toEqual({
      required_fields: 3,
      captured_fields: 3,
      passed: true,
    });
  });
});
