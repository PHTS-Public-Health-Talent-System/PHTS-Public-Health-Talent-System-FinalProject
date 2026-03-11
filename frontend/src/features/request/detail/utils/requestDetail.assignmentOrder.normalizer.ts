const THAI_NUMERIC_DOT_PATTERN = /^([๐-๙])\.([0-9])/;

export const normalizeAssignmentOrderWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').replace(/[ \t]+$/gm, '').trim();

export const normalizeAssignmentOrderMarkdown = (input: {
  markdown?: string | null;
  engineUsed?: string | null;
}): string => {
  const base = String(input.markdown ?? '');
  const normalizedEngine = String(input.engineUsed ?? '').trim().toLowerCase();

  if (!normalizedEngine) {
    return base;
  }

  if (normalizedEngine.includes('tesseract')) {
    return base
      .replace(/Aseptc\s*Tech[กg]?ique/gi, 'Aseptic Technique')
      .replace(/โดยมีหน้าที่\s*[ัั]*งนี้/g, 'โดยมีหน้าที่ ดังนี้')
      .replace(/โดยมีหน้าที่\s*ดั+งนี้/g, 'โดยมีหน้าที่ ดังนี้')
      .replace(/สั่งณ\s*วันที่/g, 'สั่ง ณ วันที่')
      .replace(/([๐-๙])2\.\s*งาน/g, '$1. งาน')
      .replace(/([๐-๙])\.([0-9])/g, '$1.$2');
  }

  if (normalizedEngine.includes('paddle')) {
    return base
      .replace(/Aseptc\s*Tech[กg]?ique/gi, 'Aseptic Technique')
      .replace(/สั่งณ\s*วันที่/g, 'สั่ง ณ วันที่')
      .replace(/โดยมีหน้าที่\s*[ัั]*งนี้/g, 'โดยมีหน้าที่ ดังนี้')
      .replace(/โดยมีหน้าที่\s*ดั+งนี้/g, 'โดยมีหน้าที่ ดังนี้');
  }

  return base;
};

export const splitAssignmentOrderLines = (markdown: string): string[] =>
  markdown
    .split(/\r?\n/)
    .map((line) => normalizeAssignmentOrderWhitespace(line))
    .map((line) => line.replace(THAI_NUMERIC_DOT_PATTERN, '$1.$2'))
    .filter(Boolean);
