import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseAssignmentOrderSummary } from './requestDetail.assignmentOrder'

const extractDocumentMarkdown = (text: string, fileName: string): string => {
  const escapedName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const blockPattern = new RegExp(`เอกสาร:\\s*${escapedName}\\s*\\n([\\s\\S]*?)(?=\\nเอกสาร:|$)`)
  const match = text.match(blockPattern)
  return (match?.[1] ?? '').trim()
}

describe('parseAssignmentOrderSummary golden OCR files', () => {
  test('extracts core assignment data from tesseract and paddle output for page-5-6.pdf', () => {
    const tesseractText = readFileSync(
      join(process.cwd(), '..', 'ocr', 'output_text', 'OCR_tesseract_local_tuned.txt'),
      'utf8',
    )
    const paddleText = readFileSync(
      join(process.cwd(), '..', 'ocr', 'output_text', 'OCR_paddle_local_tuned.txt'),
      'utf8',
    )

    const tesseractSummary = parseAssignmentOrderSummary(
      {
        fileName: 'page-5-6.pdf',
        engineUsed: 'tesseract',
        markdown: extractDocumentMarkdown(tesseractText, 'page-5-6.pdf'),
      },
      'นางสาว จริยา ใจใหญ่',
    )

    const paddleSummary = parseAssignmentOrderSummary(
      {
        fileName: 'page-5-6.pdf',
        engineUsed: 'paddle',
        markdown: extractDocumentMarkdown(paddleText, 'page-5-6.pdf'),
      },
      'นางสาว จริยา ใจใหญ่',
    )

    expect(tesseractSummary).not.toBeNull()
    expect(tesseractSummary?.personMatched).toBe(true)
    expect(tesseractSummary?.personLine).toContain('นางสาวจริยา')
    expect(tesseractSummary?.personLine).toContain('ใจใหญ่')
    expect(tesseractSummary?.sectionTitle).toMatch(/งานเตรียมหรือผลิตยาเคมีบ(?:ำ|ํา)บัด/)
    expect(tesseractSummary?.signedDate).toMatch(/ตุลาคม/)
    expect(tesseractSummary?.dutyHighlights.length).toBeGreaterThanOrEqual(3)
    expect(tesseractSummary?.dutyHighlights.join('\n')).toMatch(/เคมีบ(?:ำ|ํา)บัด/)
    expect(tesseractSummary?.dutyHighlights.join('\n')).not.toMatch(/วัณโรค/)

    expect(paddleSummary).not.toBeNull()
    expect(paddleSummary?.personMatched).toBe(true)
    expect(paddleSummary?.personLine).toContain('นางสาวจริยา')
    expect(paddleSummary?.personLine).toContain('ใจใหญ่')
    expect(paddleSummary?.sectionTitle).toMatch(/งานเตรียมหรือผลิตยาเคมีบ(?:ำ|ํา)บัด/)
    expect(paddleSummary?.signedDate).toMatch(/ตุลาคม/)
    expect(paddleSummary?.dutyHighlights.length).toBeGreaterThanOrEqual(3)
    expect(paddleSummary?.dutyHighlights.join('\n')).toMatch(/เคมีบ(?:ำ|ํา)บัด/)
    expect(paddleSummary?.dutyHighlights.join('\n')).not.toMatch(/วัณโรค/)
  })

  test('matches multiple personnel names on real OCR text with section-specific duties', () => {
    const paddleText = readFileSync(
      join(process.cwd(), '..', 'ocr', 'output_text', 'OCR_paddle_local_tuned.txt'),
      'utf8',
    )
    const markdown = extractDocumentMarkdown(paddleText, 'page-5-6.pdf')

    const hivSummary = parseAssignmentOrderSummary(
      {
        fileName: 'page-5-6.pdf',
        engineUsed: 'paddle',
        markdown,
      },
      'นางสาวอรจิตรา จันทร์ตระกูล',
    )

    const hivSummary2 = parseAssignmentOrderSummary(
      {
        fileName: 'page-5-6.pdf',
        engineUsed: 'paddle',
        markdown,
      },
      'นางสาวพิชญ์สินี ฝั้นจักรสาย',
    )

    expect(hivSummary).not.toBeNull()
    expect(hivSummary?.personMatched).toBe(true)
    expect(hivSummary?.sectionTitle).toMatch(/HIV/)
    expect(hivSummary?.dutyHighlights.join('\n')).toMatch(/HIV/)

    expect(hivSummary2).not.toBeNull()
    expect(hivSummary2?.personMatched).toBe(true)
    expect(hivSummary2?.sectionTitle).toMatch(/HIV/)
    expect(hivSummary2?.dutyHighlights.join('\n')).toMatch(/HIV/)
  })
})
