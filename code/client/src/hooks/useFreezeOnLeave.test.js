import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useFreezeOnLeave from './useFreezeOnLeave';

describe('useFreezeOnLeave', () => {
  let mockTimer;

  beforeEach(() => {
    mockTimer = {
      phase: 'studying',
      frozen: false,
      freeze: vi.fn(),
      thaw: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('visibilitychange hidden → 调用 freeze', () => {
    // 模拟 document.hidden = true
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });

    renderHook(() => useFreezeOnLeave(mockTimer));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockTimer.freeze).toHaveBeenCalledTimes(1);
    expect(mockTimer.thaw).not.toHaveBeenCalled();
  });

  it('visibilitychange visible → 调用 thaw（当 frozen=true 时）', () => {
    mockTimer.frozen = true;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });

    renderHook(() => useFreezeOnLeave(mockTimer));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockTimer.thaw).toHaveBeenCalledTimes(1);
    expect(mockTimer.freeze).not.toHaveBeenCalled();
  });

  it('visibilitychange visible → 不调用 thaw（当 frozen=false 时）', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });

    renderHook(() => useFreezeOnLeave(mockTimer));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockTimer.thaw).not.toHaveBeenCalled();
    expect(mockTimer.freeze).not.toHaveBeenCalled();
  });

  it('blur → 调用 freeze（studying 态且未冻结）', () => {
    renderHook(() => useFreezeOnLeave(mockTimer));
    window.dispatchEvent(new Event('blur'));

    expect(mockTimer.freeze).toHaveBeenCalledTimes(1);
  });

  it('blur → 不调用 freeze（已冻结时）', () => {
    mockTimer.frozen = true;

    renderHook(() => useFreezeOnLeave(mockTimer));
    window.dispatchEvent(new Event('blur'));

    expect(mockTimer.freeze).not.toHaveBeenCalled();
  });

  it('blur → 不调用 freeze（非 studying 态）', () => {
    mockTimer.phase = 'paused';

    renderHook(() => useFreezeOnLeave(mockTimer));
    window.dispatchEvent(new Event('blur'));

    expect(mockTimer.freeze).not.toHaveBeenCalled();
  });

  it('focus → 调用 thaw（frozen=true 时）', () => {
    mockTimer.frozen = true;

    renderHook(() => useFreezeOnLeave(mockTimer));
    window.dispatchEvent(new Event('focus'));

    expect(mockTimer.thaw).toHaveBeenCalledTimes(1);
  });

  it('focus → 不调用 thaw（frozen=false 时）', () => {
    renderHook(() => useFreezeOnLeave(mockTimer));
    window.dispatchEvent(new Event('focus'));

    expect(mockTimer.thaw).not.toHaveBeenCalled();
  });
});
