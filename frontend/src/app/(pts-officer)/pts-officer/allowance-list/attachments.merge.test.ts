import { getAllowanceAttachmentNotice, mergeAllowanceAttachments } from './attachments'

describe('mergeAllowanceAttachments', () => {
  test('prefers request source for OCR when the same file appears in both sources', () => {
    const items = mergeAllowanceAttachments({
      requestAttachments: [
        {
          attachment_id: 328,
          file_name: 'สรุปการดำเนินการปรับปรุงและแก้ไขระบบCMES.pdf',
          file_path: 'uploads/request.pdf',
          file_type: 'OTHER',
        },
      ],
      eligibilityAttachments: [
        {
          attachment_id: 11,
          file_name: 'สรุปการดำเนินการปรับปรุงและแก้ไขระบบCMES.pdf',
          file_path: 'uploads/eligibility.pdf',
          file_type: 'OTHER',
        },
      ],
    })

    expect(items).toEqual([
      {
        attachment_id: 328,
        delete_attachment_id: 11,
        file_name: 'สรุปการดำเนินการปรับปรุงและแก้ไขระบบCMES.pdf',
        file_path: 'uploads/request.pdf',
        file_type: 'OTHER',
        source: 'request',
        sources: ['request', 'eligibility'],
      },
    ])
  })

  test('returns a clear notice when file has both source request and local copy', () => {
    const [item] = mergeAllowanceAttachments({
      requestAttachments: [
        {
          attachment_id: 328,
          file_name: 'สรุปการดำเนินการปรับปรุงและแก้ไขระบบCMES.pdf',
          file_path: 'uploads/request.pdf',
          file_type: 'OTHER',
        },
      ],
      eligibilityAttachments: [
        {
          attachment_id: 11,
          file_name: 'สรุปการดำเนินการปรับปรุงและแก้ไขระบบCMES.pdf',
          file_path: 'uploads/eligibility.pdf',
          file_type: 'OTHER',
        },
      ],
    })

    expect(getAllowanceAttachmentNotice(item)).toBe(
      'ไฟล์นี้มีทั้งต้นฉบับจากคำขอเดิมและสำเนาที่เพิ่มในหน้านี้ ปุ่มลบจะลบเฉพาะสำเนาที่เพิ่มในหน้านี้',
    )
  })
})
