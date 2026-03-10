jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}));

jest.mock('node:fs/promises', () => ({
  mkdtemp: jest.fn(),
  writeFile: jest.fn(),
  readdir: jest.fn(),
  rm: jest.fn(),
}));

describe('runLocalTesseract', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('renders PDF at higher DPI and uses tuned Tesseract arguments', async () => {
    const childProcess = await import('node:child_process');
    const fs = await import('node:fs/promises');

    (fs.mkdtemp as jest.Mock).mockResolvedValue('/tmp/ocr-local');
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue(['page-1.png']);
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
    (childProcess.execFile as jest.Mock)
      .mockImplementationOnce((_cmd, _args, callback) => callback(null, { stdout: '', stderr: '' }))
      .mockImplementationOnce((_cmd, _args, _options, callback) =>
        callback(null, { stdout: 'บันทึกข้อความ\nเรื่อง ทดสอบ', stderr: '' }),
      );

    const { runLocalTesseract } = await import('@/modules/ocr/services/ocr-local-tesseract.service.js');
    await runLocalTesseract('sample.pdf', Buffer.from('pdf'));

    expect(childProcess.execFile).toHaveBeenNthCalledWith(
      1,
      'pdftoppm',
      ['-r', '200', '-png', '/tmp/ocr-local/sample.pdf', '/tmp/ocr-local/page'],
      expect.any(Function),
    );
    expect(childProcess.execFile).toHaveBeenNthCalledWith(
      2,
      'tesseract',
      [
        '/tmp/ocr-local/page-1.png',
        'stdout',
        '-l',
        'tha+eng',
        '--oem',
        '1',
        '--psm',
        '11',
        '-c',
        'preserve_interword_spaces=1',
      ],
      expect.objectContaining({
        env: expect.objectContaining({
          OMP_THREAD_LIMIT: '1',
        }),
      }),
      expect.any(Function),
    );
  });
});
