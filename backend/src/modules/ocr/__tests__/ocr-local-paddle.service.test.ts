jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}));

jest.mock('node:fs/promises', () => ({
  mkdtemp: jest.fn(),
  writeFile: jest.fn(),
  readdir: jest.fn(),
  rm: jest.fn(),
}));

describe('runLocalPaddle', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('renders PDF and runs python paddle script per page', async () => {
    const childProcess = await import('node:child_process');
    const fs = await import('node:fs/promises');

    (fs.mkdtemp as jest.Mock).mockResolvedValue('/tmp/ocr-paddle');
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue(['page-1.png']);
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
    (childProcess.execFile as jest.Mock)
      .mockImplementationOnce((_cmd, _args, callback) =>
        callback(null, { stdout: '', stderr: '' }),
      )
      .mockImplementationOnce((_cmd, _args, _options, callback) =>
        callback(null, { stdout: '{"text":"บันทึกข้อความ"}', stderr: '' }),
      );

    const { runLocalPaddle } = await import('@/modules/ocr/services/ocr-local-paddle.service.js');
    const result = await runLocalPaddle('sample.pdf', Buffer.from('pdf'));

    expect(childProcess.execFile).toHaveBeenNthCalledWith(
      1,
      'pdftoppm',
      ['-r', '300', '-png', '/tmp/ocr-paddle/sample.pdf', '/tmp/ocr-paddle/page'],
      expect.any(Function),
    );
    expect(childProcess.execFile).toHaveBeenNthCalledWith(
      2,
      'python3',
      expect.arrayContaining(['-c', expect.any(String), '/tmp/ocr-paddle/page-1.png']),
      expect.objectContaining({
        env: expect.any(Object),
        maxBuffer: 10 * 1024 * 1024,
      }),
      expect.any(Function),
    );
    expect(result.ok).toBe(true);
    expect(result.engine_used).toBe('paddle');
  });
});
