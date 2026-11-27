import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_TRANSFORM, Interactive3DMachineStage } from './Interactive3DMachineStage';

const REDUCED_MOTION_CLASS = 'interactive-3d-stage--reduced-motion';
const RESET_BUTTON_NAME = /reset 3d machine view/i;
const IMAGE_ALT = 'Hitachi excavator from the active mining fleet';

function installMatchMedia(
  matches: boolean,
  onSubscribe?: (listener: (event: MediaQueryListEvent) => void) => void
) {
  const mediaQueryList = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      onSubscribe?.(listener);
    },
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(() => false),
  } as unknown as MediaQueryList;

  (window.matchMedia as unknown as jest.Mock).mockImplementation(() => mediaQueryList);
}

function installPointerEvent() {
  if (typeof window.PointerEvent === 'function') return;

  class MockPointerEvent extends MouseEvent {
    readonly pointerId: number;

    constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }

  Object.defineProperty(window, 'PointerEvent', {
    configurable: true,
    value: MockPointerEvent,
    writable: true,
  });
}

function getTransformElement(): HTMLElement {
  return screen.getByTestId('interactive-3d-transform');
}

function getTransformStyle(): string {
  return getTransformElement().style.transform;
}

describe('Interactive3DMachineStage', () => {
  beforeEach(() => {
    installMatchMedia(false);
    installPointerEvent();
  });

  it('renders the labelled stage with the real fleet image and default transform', () => {
    render(<Interactive3DMachineStage />);

    const stage = screen.getByTestId('interactive-3d-stage');
    expect(stage).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Interactive 3D machine stage' })).toBe(stage);
    expect(stage).toHaveAttribute('aria-describedby');
    expect(screen.getByRole('button', { name: RESET_BUTTON_NAME })).toBeInTheDocument();
    expect(screen.getByAltText(IMAGE_ALT)).toBeInTheDocument();
    expect(getTransformStyle()).toContain(`rotateX(${DEFAULT_TRANSFORM.rotateX}deg)`);
    expect(getTransformStyle()).toContain(`rotateY(${DEFAULT_TRANSFORM.rotateY}deg)`);
    expect(getTransformStyle()).toContain(`scale(${DEFAULT_TRANSFORM.zoom})`);
    expect(getTransformElement().style.willChange).toBe('auto');
  });

  it('changes rotation when the pointer is dragged', () => {
    render(<Interactive3DMachineStage />);
    const stage = screen.getByTestId('interactive-3d-stage');
    const before = getTransformStyle();

    fireEvent.pointerDown(stage, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 150, clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(stage, { clientX: 150, clientY: 120, pointerId: 1 });

    const after = getTransformStyle();
    expect(after).not.toBe(before);
    expect(after).toContain('rotateX(-18deg)');
    expect(after).toContain('rotateY(-3deg)');
  });

  it('pans when the pointer is dragged with Shift held', () => {
    render(<Interactive3DMachineStage />);
    const stage = screen.getByTestId('interactive-3d-stage');

    fireEvent.pointerDown(stage, {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      shiftKey: true,
    });
    fireEvent.pointerMove(stage, { clientX: 120, clientY: 110, pointerId: 1, shiftKey: true });
    fireEvent.pointerUp(stage, { clientX: 120, clientY: 110, pointerId: 1, shiftKey: true });

    expect(getTransformStyle()).toContain('translate3d(12px, 6px, 0)');
  });

  it('changes zoom on wheel events and clamps it to the supported range', () => {
    render(<Interactive3DMachineStage />);
    const stage = screen.getByTestId('interactive-3d-stage');

    fireEvent.wheel(stage, { deltaY: -120 });
    expect(getTransformStyle()).toContain('scale(1.1)');

    fireEvent.wheel(stage, { deltaY: 120 });
    expect(getTransformStyle()).toContain('scale(1)');

    for (let step = 0; step < 30; step += 1) {
      fireEvent.wheel(stage, { deltaY: -120 });
    }
    expect(getTransformStyle()).toContain('scale(1.6)');
  });

  it('supports keyboard rotation, pan and zoom', () => {
    render(<Interactive3DMachineStage />);
    const stage = screen.getByTestId('interactive-3d-stage');
    stage.focus();

    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    expect(getTransformStyle()).toContain('rotateY(-12deg)');

    fireEvent.keyDown(stage, { key: 'ArrowUp' });
    expect(getTransformStyle()).toContain('rotateX(-6deg)');

    fireEvent.keyDown(stage, { key: '+' });
    expect(getTransformStyle()).toContain('scale(1.1)');

    fireEvent.keyDown(stage, { key: 'ArrowLeft', shiftKey: true });
    expect(getTransformStyle()).toContain('translate3d(-12px, 0px, 0)');
  });

  it('restores the default transform when reset is clicked', () => {
    render(<Interactive3DMachineStage />);
    const stage = screen.getByTestId('interactive-3d-stage');

    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    fireEvent.wheel(stage, { deltaY: -120 });
    expect(getTransformStyle()).not.toContain(`rotateY(${DEFAULT_TRANSFORM.rotateY}deg)`);

    fireEvent.click(screen.getByRole('button', { name: RESET_BUTTON_NAME }));

    expect(getTransformStyle()).toContain(`rotateX(${DEFAULT_TRANSFORM.rotateX}deg)`);
    expect(getTransformStyle()).toContain(`rotateY(${DEFAULT_TRANSFORM.rotateY}deg)`);
    expect(getTransformStyle()).toContain(`scale(${DEFAULT_TRANSFORM.zoom})`);
    expect(getTransformStyle()).toContain('translate3d(0px, 0px, 0)');
  });

  it('disables transitions and marks the stage when reduced motion is preferred', () => {
    installMatchMedia(true);
    render(<Interactive3DMachineStage />);

    const stage = screen.getByTestId('interactive-3d-stage');
    expect(stage).toHaveClass(REDUCED_MOTION_CLASS);
    expect(stage).toHaveAttribute('data-reduced-motion', 'true');
    expect(getTransformElement().style.transition).toBe('none');
    expect(getTransformElement().style.willChange).toBe('auto');
  });

  it('reacts to reduced-motion preference changes from the media query', () => {
    let mediaListener: ((event: MediaQueryListEvent) => void) | undefined;
    installMatchMedia(false, (listener) => {
      mediaListener = listener;
    });
    render(<Interactive3DMachineStage />);

    const stage = screen.getByTestId('interactive-3d-stage');
    expect(stage).toHaveAttribute('data-reduced-motion', 'false');

    act(() => {
      mediaListener?.({ matches: true } as MediaQueryListEvent);
    });

    expect(stage).toHaveClass(REDUCED_MOTION_CLASS);
    expect(getTransformElement().style.transition).toBe('none');
  });
});

describe('Interactive3DMachineStage dependency guard', () => {
  it('does not add a 3D library dependency, 3D import or animation frame loop', () => {
    const readDependencies = (filePath: string) =>
      JSON.parse(readFileSync(filePath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

    const packageFiles = [
      path.resolve(__dirname, '../../package.json'),
      path.resolve(__dirname, '../../../../package.json'),
    ];
    const forbiddenPackages = ['three', '@react-three/fiber', '@react-three/drei', 'three-stdlib'];

    for (const packageFile of packageFiles) {
      const manifest = readDependencies(packageFile);
      for (const packageName of forbiddenPackages) {
        expect(manifest.dependencies?.[packageName]).toBeUndefined();
        expect(manifest.devDependencies?.[packageName]).toBeUndefined();
      }
    }

    const source = readFileSync(path.resolve(__dirname, './Interactive3DMachineStage.tsx'), 'utf8');
    expect(source).not.toMatch(/from ['"]three/);
    expect(source).not.toMatch(/requestAnimationFrame/);
  });
});
