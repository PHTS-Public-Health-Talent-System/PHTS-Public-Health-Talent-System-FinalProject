import {
  normalizeAssignmentOrderMarkdown,
  splitAssignmentOrderLines,
} from './requestDetail.assignmentOrder.normalizer'

describe('assignment order normalizer', () => {
  test('normalizes tesseract-specific noise for duty anchor and technique text', () => {
    const normalized = normalizeAssignmentOrderMarkdown({
      markdown: [
        'โดยมีหน้าที่ ังนี้',
        '๒. คำนวณขนาดยา และเตรียมยาโดยใช้หลัก Aseptc Techกique',
      ].join('\n'),
      engineUsed: 'tesseract',
    })

    expect(normalized).toContain('โดยมีหน้าที่ ดังนี้')
    expect(normalized).toContain('Aseptic Technique')
  })

  test('normalizes per-line whitespace and thai digit dot format', () => {
    const lines = splitAssignmentOrderLines('  ๑.6   นางสาวจริยา  \n\n  ') 
    expect(lines).toEqual(['๑.6 นางสาวจริยา'])
  })

  test('normalizes paddle technique typo', () => {
    const normalized = normalizeAssignmentOrderMarkdown({
      markdown: '๒. ใช้หลัก Aseptc Techกique',
      engineUsed: 'paddle',
    })
    expect(normalized).toContain('Aseptic Technique')
  })
})
