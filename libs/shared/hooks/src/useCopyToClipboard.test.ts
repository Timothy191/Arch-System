/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useCopyToClipboard } from './useCopyToClipboard';

const RESET_DELAY_MS = 200;

const defineClipboard = (writeText: jest.Mock) => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
};

describe('Given useCopyToClipboard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
  });

  it('When text is copied successfully, Then it stores the copied value until timeout feedback clears', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    defineClipboard(writeText);

    const { result } = renderHook(() => useCopyToClipboard(RESET_DELAY_MS));

    await act(async () => {
      await expect(result.current.copy('dispatch-code')).resolves.toBe(true);
    });

    expect(writeText).toHaveBeenCalledWith('dispatch-code');
    expect(result.current.value).toBe('dispatch-code');
    expect(result.current.copied).toBe(true);

    act(() => {
      jest.advanceTimersByTime(RESET_DELAY_MS);
    });

    expect(result.current.value).toBe('dispatch-code');
    expect(result.current.copied).toBe(false);
  });

  it('When reset is called, Then it clears copied state and cancels pending feedback', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    defineClipboard(writeText);

    const { result } = renderHook(() => useCopyToClipboard(RESET_DELAY_MS));

    await act(async () => {
      await result.current.copy('dispatch-code');
    });

    act(() => {
      result.current.reset();
      jest.advanceTimersByTime(RESET_DELAY_MS);
    });

    expect(result.current.value).toBeNull();
    expect(result.current.copied).toBe(false);
  });

  it('When clipboard access is unavailable, Then it reports copy failure without changing state', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useCopyToClipboard(RESET_DELAY_MS));

    await act(async () => {
      await expect(result.current.copy('dispatch-code')).resolves.toBe(false);
    });

    expect(result.current.value).toBeNull();
    expect(result.current.copied).toBe(false);
  });

  it('When clipboard write fails, Then it reports copy failure and leaves copied state false', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('denied'));
    defineClipboard(writeText);

    const { result } = renderHook(() => useCopyToClipboard(RESET_DELAY_MS));

    await act(async () => {
      await expect(result.current.copy('dispatch-code')).resolves.toBe(false);
    });

    expect(writeText).toHaveBeenCalledWith('dispatch-code');
    expect(result.current.value).toBeNull();
    expect(result.current.copied).toBe(false);
  });
});
