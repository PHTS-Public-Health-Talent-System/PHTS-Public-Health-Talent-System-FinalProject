import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { OcrBatchResultItem } from '@/modules/ocr/entities/ocr-precheck.entity.js';
import { enrichOcrBatchResult } from '@/modules/ocr/services/ocr-gateway-analysis.service.js';

const execFile = promisify(execFileCallback);
const DEFAULT_TESSERACT_LANG = 'tha+eng';
const DEFAULT_TESSERACT_OEM = '1';
const DEFAULT_TESSERACT_PSM = '11';
const DEFAULT_PDF_RENDER_DPI = '200';
const DEFAULT_TESSERACT_THREAD_LIMIT = '1';
const DEFAULT_TESSERACT_PREPROCESS = 'none';
const LOCAL_ENGINE_NAME = 'tesseract';

const isPdf = (fileName: string): boolean => fileName.toLowerCase().endsWith('.pdf');

const getEnvNumberString = (
  value: string | undefined,
  fallback: string,
  min: number,
  max: number,
): string => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return String(Math.floor(parsed));
};

const getTesseractLang = (): string =>
  (process.env.OCR_TESSERACT_LANG || DEFAULT_TESSERACT_LANG).trim() || DEFAULT_TESSERACT_LANG;

const getTesseractOem = (): string =>
  getEnvNumberString(process.env.OCR_TESSERACT_OEM, DEFAULT_TESSERACT_OEM, 0, 3);

const getTesseractPsm = (): string =>
  getEnvNumberString(process.env.OCR_TESSERACT_PSM, DEFAULT_TESSERACT_PSM, 0, 13);

const getPdfRenderDpi = (): string =>
  getEnvNumberString(process.env.OCR_TESSERACT_PDF_DPI, DEFAULT_PDF_RENDER_DPI, 72, 600);

const getThreadLimit = (): string =>
  getEnvNumberString(process.env.OCR_TESSERACT_THREAD_LIMIT, DEFAULT_TESSERACT_THREAD_LIMIT, 1, 16);

const getThresholdingMethod = (): string | null => {
  const raw = process.env.OCR_TESSERACT_THRESHOLDING_METHOD;
  if (raw === undefined || raw === '') return null;
  return getEnvNumberString(raw, '0', 0, 2);
};

const getThresholdingWindowSize = (): string | null => {
  const raw = process.env.OCR_TESSERACT_THRESHOLDING_WINDOW_SIZE;
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 5) return null;
  return String(parsed);
};

const getThresholdingKFactor = (): string | null => {
  const raw = process.env.OCR_TESSERACT_THRESHOLDING_KFACTOR;
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 2) return null;
  return String(parsed);
};

const getPreprocessMode = (): string =>
  (process.env.OCR_TESSERACT_PREPROCESS || DEFAULT_TESSERACT_PREPROCESS).trim().toLowerCase();

const preprocessWithImageMagick = async (imagePath: string, outputPath: string): Promise<string> => {
  await execFile('convert', [
    imagePath,
    '-colorspace',
    'Gray',
    '-deskew',
    '40%',
    '-normalize',
    '-contrast-stretch',
    '1%x1%',
    '-sharpen',
    '0x1.0',
    outputPath,
  ]);
  return outputPath;
};

const runTesseractOnImage = async (imagePath: string): Promise<string> => {
  const preprocessMode = getPreprocessMode();
  let inputPath = imagePath;
  if (preprocessMode === 'gray-deskew') {
    const preprocessedPath = `${imagePath}.pre.png`;
    try {
      inputPath = await preprocessWithImageMagick(imagePath, preprocessedPath);
    } catch {
      inputPath = imagePath;
    }
  }

  const tesseractLang = getTesseractLang();
  const tesseractOem = getTesseractOem();
  const tesseractPsm = getTesseractPsm();
  const args: string[] = [
    inputPath,
    'stdout',
    '-l',
    tesseractLang,
    '--oem',
    tesseractOem,
    '--psm',
    tesseractPsm,
    '-c',
    'preserve_interword_spaces=1',
  ];
  const thresholdingMethod = getThresholdingMethod();
  if (thresholdingMethod !== null) {
    args.push('-c', `thresholding_method=${thresholdingMethod}`);
  }
  const thresholdingWindowSize = getThresholdingWindowSize();
  if (thresholdingWindowSize !== null) {
    args.push('-c', `thresholding_window_size=${thresholdingWindowSize}`);
  }
  const thresholdingKFactor = getThresholdingKFactor();
  if (thresholdingKFactor !== null) {
    args.push('-c', `thresholding_kfactor=${thresholdingKFactor}`);
  }

  const { stdout } = await execFile('tesseract', args, {
    env: {
      ...process.env,
      OMP_THREAD_LIMIT: getThreadLimit(),
    },
  });
  return stdout.trim();
};

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

export const runLocalTesseract = async (
  fileName: string,
  fileBuffer: Buffer,
): Promise<OcrBatchResultItem> => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'phts-ocr-local-'));
  try {
    const tempInputPath = path.join(tempDir, fileName);
    await writeFile(tempInputPath, fileBuffer);

    let markdown = '';
    if (isPdf(fileName)) {
      const pages = await renderPdfPages(tempInputPath, path.join(tempDir, 'page'));
      const pageTexts: string[] = [];
      for (const page of pages) {
        pageTexts.push(await runTesseractOnImage(page));
      }
      markdown = pageTexts.filter(Boolean).join('\n\n');
    } else {
      markdown = await runTesseractOnImage(tempInputPath);
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
      message.includes('spawn tesseract ENOENT') ||
      message.includes('spawn pdftoppm ENOENT')
    ) {
      throw new Error('OCR_MAIN_SERVICE_UNAVAILABLE');
    }
    throw error;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
};
