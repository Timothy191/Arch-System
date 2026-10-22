import { act, fireEvent, render, screen } from '@testing-library/react';
import { ArchCursorWaitIndicator } from './ArchCursorWaitIndicator';

let mockFetching = 0;
let mockMutating = 0;

jest.mock('@tanstack/react-query', () => ({
  useIsFetching: () => mockFetching,
  useIsMutating: () => mockMutating,
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/hub',
}));

describe('ArchCursorWaitIndicator', () => {
  beforeEach(() => {
    mockFetching = 0;
    mockMutating = 0;
    delete document.documentElement.dataset.cursorWait;
  });

  it('should remain hidden when no loading or wait process is active', () => {
    render(<ArchCursorWaitIndicator />);
    fireEvent.mouseMove(window, { clientX: 120, clientY: 180 });
    const indicator = screen.getByTestId('arch-cursor-wait-indicator');
    expect(indicator).toHaveAttribute('data-active', 'false');
    expect(indicator).toHaveClass('opacity-0');
  });

  it('should display the bouncing Antigravity logo next to the cursor when queries or mutations are active', () => {
    mockFetching = 1;
    render(<ArchCursorWaitIndicator />);
    fireEvent.mouseMove(window, { clientX: 100, clientY: 200 });

    const indicator = screen.getByTestId('arch-cursor-wait-indicator');
    expect(indicator).toHaveAttribute('data-active', 'true');
    expect(indicator).toHaveClass('opacity-100');
    expect(indicator.style.transform).toBe('translate3d(120px, 206px, 0)');
  });

  it('should activate on aria-busy elements and arch:cursor-wait custom events and hide on mouseleave', () => {
    render(
      <div>
        <button type="button" aria-busy="true" data-testid="busy-btn">
          Saving
        </button>
        <ArchCursorWaitIndicator />
      </div>
    );

    const busyBtn = screen.getByTestId('busy-btn');
    fireEvent.mouseMove(busyBtn, { clientX: 50, clientY: 60 });

    const indicator = screen.getByTestId('arch-cursor-wait-indicator');
    expect(indicator).toHaveAttribute('data-active', 'true');

    fireEvent.mouseLeave(document);
    expect(indicator).toHaveAttribute('data-active', 'false');

    fireEvent.mouseMove(window, { clientX: 80, clientY: 90 });
    act(() => {
      window.dispatchEvent(new CustomEvent('arch:cursor-wait', { detail: { active: false } }));
    });
  });
});
