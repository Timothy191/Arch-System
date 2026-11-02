/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useScrollReveal } from './useScrollReveal';

type ObserverCallback = (entries: Array<{ isIntersecting: boolean; target: Element }>) => void;

const setupIntersectionObserverMock = () => {
  let activeCallback: ObserverCallback | null = null;
  const observe = jest.fn();
  const unobserve = jest.fn();
  const disconnect = jest.fn();

  class MockIntersectionObserver {
    constructor(callback: ObserverCallback) {
      activeCallback = callback;
    }
    observe = observe;
    unobserve = unobserve;
    disconnect = disconnect;
  }

  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  });

  return {
    observe,
    unobserve,
    disconnect,
    triggerIntersection(isIntersecting: boolean, target: Element) {
      if (activeCallback) {
        activeCallback([{ isIntersecting, target }]);
      }
    },
  };
};

const setupMatchMediaMock = (matchesReducedMotion: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({
      matches: matchesReducedMotion,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

describe('Given useScrollReveal', () => {
  afterEach(() => {
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });
  });

  it('When element intersects viewport and triggerOnce is true, Then it marks visible and unobserves', () => {
    setupMatchMediaMock(false);
    const observerMock = setupIntersectionObserverMock();
    const dummyDiv = document.createElement('div');

    const { result, unmount } = renderHook(() => useScrollReveal({ triggerOnce: true }));
    expect(result.current.isVisible).toBe(false);

    act(() => {
      result.current.ref(dummyDiv);
    });

    expect(observerMock.observe).toHaveBeenCalledWith(dummyDiv);

    act(() => {
      observerMock.triggerIntersection(true, dummyDiv);
    });

    expect(result.current.isVisible).toBe(true);
    expect(observerMock.unobserve).toHaveBeenCalledWith(dummyDiv);

    unmount();
    expect(observerMock.disconnect).toHaveBeenCalled();
  });

  it('When prefers-reduced-motion is enabled, Then it immediately reveals without observing', () => {
    setupMatchMediaMock(true);
    const observerMock = setupIntersectionObserverMock();

    const { result } = renderHook(() => useScrollReveal());

    expect(result.current.shouldReduceMotion).toBe(true);
    expect(result.current.isVisible).toBe(true);
    expect(observerMock.observe).not.toHaveBeenCalled();
  });

  it('When triggerOnce is false, Then it toggles visibility as element enters and leaves viewport', () => {
    setupMatchMediaMock(false);
    const observerMock = setupIntersectionObserverMock();
    const dummyDiv = document.createElement('div');

    const { result } = renderHook(() => useScrollReveal({ triggerOnce: false }));

    act(() => {
      result.current.ref(dummyDiv);
    });

    act(() => {
      observerMock.triggerIntersection(true, dummyDiv);
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      observerMock.triggerIntersection(false, dummyDiv);
    });
    expect(result.current.isVisible).toBe(false);
  });
});
