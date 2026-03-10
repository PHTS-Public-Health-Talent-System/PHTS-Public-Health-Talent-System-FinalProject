import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { OcrBatchResultItem } from '@/modules/ocr/entities/ocr-precheck.entity.js';
import { enrichOcrBatchResult } from '@/modules/ocr/services/ocr-gateway-analysis.service.js';

const execFile = promisify(execFileCallback);
const DEFAULT_PDF_RENDER_DPI = '300';
const LOCAL_ENGINE_NAME = 'paddle';
const DEFAULT_PADDLE_LANG = 'th';

const isPdf = (fileName: string): boolean => fileName.toLowerCase().endsWith('.pdf');

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
};

const parseOptionalNumber = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

type PaddleRuntimeConfig = {
  lang: string;
  useTextlineOrientation: boolean;
  textDetLimitSideLen?: number;
  textDetThresh?: number;
  textDetBoxThresh?: number;
  textDetUnclipRatio?: number;
  textRecScoreThresh?: number;
};

const getPaddleRuntimeConfig = (): PaddleRuntimeConfig => ({
  lang: (process.env.OCR_PADDLE_LANG || DEFAULT_PADDLE_LANG).trim() || DEFAULT_PADDLE_LANG,
  useTextlineOrientation: parseBoolean(process.env.OCR_PADDLE_USE_TEXTLINE_ORIENTATION, false),
  textDetLimitSideLen: parseOptionalNumber(process.env.OCR_PADDLE_TEXT_DET_LIMIT_SIDE_LEN),
  textDetThresh: parseOptionalNumber(process.env.OCR_PADDLE_TEXT_DET_THRESH),
  textDetBoxThresh: parseOptionalNumber(process.env.OCR_PADDLE_TEXT_DET_BOX_THRESH),
  textDetUnclipRatio: parseOptionalNumber(process.env.OCR_PADDLE_TEXT_DET_UNCLIP_RATIO),
  textRecScoreThresh: parseOptionalNumber(process.env.OCR_PADDLE_TEXT_REC_SCORE_THRESH),
});

const getPdfRenderDpi = (): string => {
  const configured = parseOptionalNumber(process.env.OCR_PADDLE_PDF_DPI);
  if (!configured || configured < 72 || configured > 600) return DEFAULT_PDF_RENDER_DPI;
  return String(Math.floor(configured));
};

const getPythonBin = (): string =>
  (process.env.OCR_PADDLE_PYTHON_BIN || 'python3').trim() || 'python3';

const renderPdfPages = async (pdfPath: string, outputPrefix: string): Promise<string[]> => {
  await execFile('pdftoppm', ['-r', getPdfRenderDpi(), '-png', pdfPath, outputPrefix]);
  const dir = path.dirname(outputPrefix);
  const base = path.basename(outputPrefix);
  const files = await readdir(dir);
  return files
    .filter((file) => file.startsWith(`${base}-`) && file.endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((file) => path.join(dir, file));
};

const runPaddleOnImage = async (imagePath: string): Promise<string> => {
  const runtimeConfig = getPaddleRuntimeConfig();
  const inlinePython = [
    'import json',
    'import sys',
    'from paddleocr import PaddleOCR',
    'image_path = sys.argv[1]',
    'runtime_config = json.loads(sys.argv[2])',
    "ocr = PaddleOCR(lang=runtime_config.get('lang', 'th'), use_textline_orientation=runtime_config.get('useTextlineOrientation', False))",
    "predict_kwargs = {'use_textline_orientation': runtime_config.get('useTextlineOrientation', False)}",
    "for key in ['textDetLimitSideLen', 'textDetThresh', 'textDetBoxThresh', 'textDetUnclipRatio', 'textRecScoreThresh']:",
    '    value = runtime_config.get(key)',
    '    if value is not None:',
    "        snake = ''.join(['_' + c.lower() if c.isupper() else c for c in key]).lstrip('_')",
    '        predict_kwargs[snake] = value',
    'result = ocr.predict(image_path, **predict_kwargs)',
    'lines = []',
    'for item in (result or []):',
    '    if not item:',
    '        continue',
    "    if isinstance(item, dict) and isinstance(item.get('rec_texts'), list):",
    "        for text in item.get('rec_texts', []):",
    '            text = str(text).strip()',
    '            if text:',
    '                lines.append(text)',
    '        continue',
    '    if isinstance(item, (list, tuple)):',
    '        for block in item:',
    '            if isinstance(block, (list, tuple)) and len(block) > 1:',
    '                rec = block[1]',
    '                if isinstance(rec, (list, tuple)) and rec:',
    '                    text = str(rec[0]).strip()',
    '                    if text:',
    '                        lines.append(text)',
    "print(json.dumps({'text': '\\n'.join(lines)}, ensure_ascii=False))",
  ].join('\n');

  const { stdout } = await execFile(getPythonBin(), ['-c', inlinePython, imagePath, JSON.stringify(runtimeConfig)], {
    env: {
      ...process.env,
      PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: process.env.OCR_PADDLE_DISABLE_MODEL_SOURCE_CHECK === 'false' ? 'False' : 'True',
    },
    maxBuffer: 10 * 1024 * 1024,
  });

  const outputLines = String(stdout || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const lastLine = outputLines[outputLines.length - 1] || '{}';
  const parsed = JSON.parse(lastLine) as { text?: string };
  return String(parsed.text ?? '').trim();
};

export const runLocalPaddle = async (
  fileName: string,
  fileBuffer: Buffer,
): Promise<OcrBatchResultItem> => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'phts-ocr-paddle-'));
  try {
    const tempInputPath = path.join(tempDir, fileName);
    await writeFile(tempInputPath, fileBuffer);

    let markdown = '';
    if (isPdf(fileName)) {
      const pages = await renderPdfPages(tempInputPath, path.join(tempDir, 'page'));
      const pageTexts: string[] = [];
      for (const page of pages) {
        pageTexts.push(await runPaddleOnImage(page));
      }
      markdown = pageTexts.filter(Boolean).join('\n\n');
    } else {
      markdown = await runPaddleOnImage(tempInputPath);
    }

    return enrichOcrBatchResult({
      name: fileName,
      ok: true,
      markdown,
      engine_used: LOCAL_ENGINE_NAME,
      fallback_used: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown OCR error';
    if (
      message.includes('No module named') ||
      (message.includes('spawn ') && message.includes(' ENOENT')) ||
      message.includes('spawn pdftoppm ENOENT')
    ) {
      throw new Error('OCR_PADDLE_UNAVAILABLE');
    }
    throw error;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
};
