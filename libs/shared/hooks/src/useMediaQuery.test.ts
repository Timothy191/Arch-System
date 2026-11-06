/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import {
  breakpoints,
  useBreakpointBetween,
  useBreakpointDown,
  useBreakpointUp,
  useMediaQuery,
} from './useMediaQuery';

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

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn((query: string) => ({
        matches,
        media: query,
        onchange: null,
        addEventListener,
        removeEventListener,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  }

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

describe('Given useMediaQuery and styled-breakpoints query builders', () => {
  afterEach(() => {
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: undefined,
      });
    }
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
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: undefined,
      });
    }

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

    expect(result.current).toBe(false);
  });

  it('When building responsive queries via breakpoints.up / down / between / only, Then it enforces -0.02px upper-bound precision', () => {
    expect(breakpoints.up('md')).toBe('(min-width: 768px)');
    expect(breakpoints.down('md')).toBe('(max-width: 767.98px)');
    expect(breakpoints.between('sm', 'lg')).toBe('(min-width: 640px) and (max-width: 1023.98px)');
    expect(breakpoints.only('md')).toBe('(min-width: 768px) and (max-width: 1023.98px)');
    expect(breakpoints.only('2xl')).toBe('(min-width: 1536px)');
  });

  it('When invoking useBreakpointUp, useBreakpointDown, and useBreakpointBetween, Then they evaluate typed breakpoint strings', () => {
    mockMediaQuery(true);

    const { result: upResult } = renderHook(() => useBreakpointUp('lg'));
    const { result: downResult } = renderHook(() => useBreakpointDown('md'));
    const { result: betweenResult } = renderHook(() => useBreakpointBetween('sm', 'xl'));

    expect(upResult.current).toBe(true);
    expect(downResult.current).toBe(true);
    expect(betweenResult.current).toBe(true);
  });
});
