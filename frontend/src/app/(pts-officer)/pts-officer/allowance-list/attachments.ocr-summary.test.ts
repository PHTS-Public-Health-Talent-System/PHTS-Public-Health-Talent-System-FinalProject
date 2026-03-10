import { getAllowanceAttachmentOcrSummary } from './attachments'

describe('getAllowanceAttachmentOcrSummary', () => {
  test('returns OCR summary preview when OCR found text for the file', () => {
    expect(
      getAllowanceAttachmentOcrSummary({
        name: 'page-5-6.pdf',
        ok: true,
        markdown: 'คำสั่งกลุ่มงานเภสัชกรรม\nเรื่อง ยกเลิกและมอบหมายเจ้าหน้าที่รับผิดชอบ',
        document_kind: 'general',
      }),
    ).toEqual({
      tone: 'success',
      text: 'OCR พบข้อความ: คำสั่งกลุ่มงานเภสัชกรรม',
    })
  })

  test('returns OCR summary when OCR completed but no text was found', () => {
    expect(
      getAllowanceAttachmentOcrSummary({
        name: 'page-5-6.pdf',
        ok: true,
        markdown: '',
      }),
    ).toEqual({
      tone: 'muted',
      text: 'ตรวจ OCR แล้ว แต่ยังไม่พบข้อความที่นำมาใช้ได้',
    })
  })

  test('skips noisy first line and shows first readable OCR line', () => {
    expect(
      getAllowanceAttachmentOcrSummary({
        name: 'page-2.pdf',
        ok: true,
        markdown: 'ง 1 เร\nใบอนุญาตปี ๒๕๑๑๓๑๕๐๕๑',
      }),
    ).toEqual({
      tone: 'success',
      text: 'OCR พบข้อความ: ใบอนุญาตปี ๒๕๑๑๓๑๕๐๕๑',
    })
  })
})
