import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyText } from './clipboard';

afterEach(() => {
  delete navigator.clipboard;
  delete document.execCommand;
  vi.restoreAllMocks();
});

describe('copyText', () => {
  it('优先使用 navigator.clipboard 成功复制', async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const result = await copyText('高数练习');

    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith('高数练习');
  });

  it('navigator.clipboard 被拒时降级 execCommand', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    document.execCommand = vi.fn().mockReturnValue(true);

    const result = await copyText('高数练习');

    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith('高数练习');
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('无 clipboard 且 execCommand 失败时返回 false', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    document.execCommand = vi.fn().mockReturnValue(false);

    const result = await copyText('高数练习');

    expect(result).toBe(false);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });
});
