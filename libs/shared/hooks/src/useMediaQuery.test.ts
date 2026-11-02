/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery';

type MediaChangeHandler = () => void;

const mockMediaQuery = (initialMatches: boolean) => {
  let matches = initialMatches;
  const handlers = new Set<MediaChangeHandler>();
  const addEventListener = jest.fn((_eventName: string, handler: MediaChangeHandler) => {
    handlers.add(handler);
  });
  const removeEventListener = jest.fn((_eventName: string, handler: MediaChangeHandler) => {
    handlers.delete(handler);
  });

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({
      matches,
      media: '(min-width: 768px)',
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  return {
    addEventListener,
    removeEventListener,
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      for (const handler of handlers) {
        handler();
      }
    },
  };
};

describe('Given useMediaQuery', () => {
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });
  });

  it('When matchMedia matches, Then it returns true', () => {
    mockMediaQuery(true);

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

    expect(result.current).toBe(true);
  });

  it('When the media query changes, Then it updates and cleans up the listener', () => {
    const mediaQueryMock = mockMediaQuery(false);

    const { result, unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));

    expect(result.current).toBe(false);

    act(() => {
      mediaQueryMock.setMatches(true);
    });

    expect(result.current).toBe(true);

    unmount();

    expect(mediaQueryMock.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(mediaQueryMock.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('When matchMedia is unavailable, Then it returns false', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

    expect(result.current).toBe(false);
  });
});
