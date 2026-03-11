import {
  buildAllowanceAttachmentOcrResultMap,
  buildAllowanceClearableOcrFileNameSet,
  buildAllowanceOcrDocuments,
} from './attachments'

describe('allowance attachment OCR result collections', () => {
  test('prefers latest OCR result immediately over stored results with same file name', () => {
    const resultMap = buildAllowanceAttachmentOcrResultMap({
      eligibilityResults: [
        {
          name: 'page-5-6.pdf',
          ok: true,
          markdown: 'ข้อความเก่า',
        },
      ],
      requestResults: [
        {
          name: 'request.pdf',
          ok: true,
          markdown: 'request text',
        },
      ],
      latestResults: [
        {
          name: 'page-5-6.pdf',
          ok: true,
          markdown: 'ข้อความใหม่',
        },
      ],
    })

    expect(resultMap.get('page-5-6.pdf')).toEqual(
      expect.objectContaining({
        markdown: 'ข้อความใหม่',
      }),
    )
    expect(resultMap.get('request.pdf')).toEqual(
      expect.objectContaining({
        markdown: 'request text',
      }),
    )
  })

  test('builds visible OCR documents from both source request and eligibility OCR', () => {
    const documents = buildAllowanceOcrDocuments({
      eligibilityResults: [
        {
          name: 'page-5-6.pdf',
          ok: true,
          markdown: 'คำสั่งกลุ่มงานเภสัชกรรม',
          engine_used: 'tesseract',
        },
      ],
      requestResults: [
        {
          name: 'memo.pdf',
          ok: true,
          markdown: 'บันทึกข้อความ',
        },
      ],
      visibleFileNames: ['page-5-6.pdf', 'memo.pdf'],
    })

    expect(documents).toEqual([
      {
        fileName: 'page-5-6.pdf',
        markdown: 'คำสั่งกลุ่มงานเภสัชกรรม',
        engineUsed: 'tesseract',
      },
      {
        fileName: 'memo.pdf',
        markdown: 'บันทึกข้อความ',
        engineUsed: null,
      },
    ])
  })

  test('marks only eligibility-side OCR results as clearable', () => {
    const clearable = buildAllowanceClearableOcrFileNameSet({
      eligibilityResults: [
        {
          name: 'page-5-6.pdf',
          ok: true,
          markdown: 'คำสั่งกลุ่มงานเภสัชกรรม',
        },
      ],
      latestResults: [
        {
          name: 'new-upload.pdf',
          ok: true,
          markdown: 'ใหม่',
        },
      ],
      visibleFileNames: ['page-5-6.pdf', 'new-upload.pdf'],
    })

    expect(clearable.has('page-5-6.pdf')).toBe(true)
    expect(clearable.has('new-upload.pdf')).toBe(true)
    expect(clearable.has('memo.pdf')).toBe(false)
  })

  test('ignores stale OCR results whose files are no longer visible in allowance attachments', () => {
    const resultMap = buildAllowanceAttachmentOcrResultMap({
      eligibilityResults: [
        {
          name: '20260213-004.pdf',
          ok: true,
          markdown: 'บันทึกข้อความ',
        },
      ],
      requestResults: [
        {
          name: 'page-5-6.pdf',
          ok: true,
          markdown: 'คำสั่งกลุ่มงานเภสัชกรรม',
        },
      ],
      visibleFileNames: ['page-5-6.pdf'],
    })

    expect(resultMap.has('20260213-004.pdf')).toBe(false)
    expect(resultMap.has('page-5-6.pdf')).toBe(true)
  })
})
