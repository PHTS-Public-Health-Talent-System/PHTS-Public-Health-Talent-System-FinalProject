export function getAttachmentLabel(fileName: string, fileType?: string) {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".pdf")) return "ไฟล์ PDF"
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "ไฟล์รูปภาพ"
  return fileType || "ไฟล์"
}

