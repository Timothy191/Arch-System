'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import { RotateCcw } from 'lucide-react';
import Image from 'next/image';
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

export interface StageTransform {
  rotateX: number;
  rotateY: number;
  zoom: number;
  panX: number;
  panY: number;
}

export const DEFAULT_TRANSFORM: StageTransform = {
  rotateX: -12,
  rotateY: -18,
  zoom: 1,
  panX: 0,
  panY: 0,
};

const PERSPECTIVE_PX = 900;
const TRANSITION_MS = 140;
const TRANSITION_EASING = 'ease-out';
const INTERACTION_HINT_MS = 160;
const ROTATION_STEP_DEG = 6;
const ZOOM_STEP = 0.1;
const PAN_STEP_PX = 12;
const DRAG_ROTATION_SENSITIVITY = 0.3;
const DRAG_PAN_SENSITIVITY = 0.6;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.6;
const MIN_ROTATION_X = -60;
const MAX_ROTATION_X = 60;
const MIN_ROTATION_Y = -75;
const MAX_ROTATION_Y = 75;
const MAX_PAN_PX = 72;
const PRECISION_FACTOR = 100;
const PRIMARY_BUTTON = 0;
const AUXILIARY_BUTTON = 1;
const SECONDARY_BUTTON = 2;
const SHADOW_DEPTH_PX = -36;
const PLATE_DEPTH_PX = -8;
const MACHINE_DEPTH_PX = 24;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const STAGE_IMAGE_SRC = '/images/fleet/hitachi-excavator.webp';
const STAGE_IMAGE_ALT = 'Hitachi excavator from the active mining fleet';
const STAGE_IMAGE_WIDTH = 640;
const STAGE_IMAGE_HEIGHT = 424;

function clampTo(minimum: number, maximum: number) {
  return (value: number): number => Math.min(maximum, Math.max(minimum, value));
}

function roundToPrecision(value: number): number {
  return Math.round(value * PRECISION_FACTOR) / PRECISION_FACTOR;
}

const clampZoom = clampTo(MIN_ZOOM, MAX_ZOOM);
const clampRotationX = clampTo(MIN_ROTATION_X, MAX_ROTATION_X);
const clampRotationY = clampTo(MIN_ROTATION_Y, MAX_ROTATION_Y);
const clampPan = clampTo(-MAX_PAN_PX, MAX_PAN_PX);

type TransformUpdater = (current: StageTransform) => StageTransform;

const rotateLeft: TransformUpdater = (current) => ({
  ...current,
  rotateY: clampRotationY(roundToPrecision(current.rotateY - ROTATION_STEP_DEG)),
});
const rotateRight: TransformUpdater = (current) => ({
  ...current,
  rotateY: clampRotationY(roundToPrecision(current.rotateY + ROTATION_STEP_DEG)),
});
const rotateUp: TransformUpdater = (current) => ({
  ...current,
  rotateX: clampRotationX(roundToPrecision(current.rotateX + ROTATION_STEP_DEG)),
});
const rotateDown: TransformUpdater = (current) => ({
  ...current,
  rotateX: clampRotationX(roundToPrecision(current.rotateX - ROTATION_STEP_DEG)),
});
const panLeft: TransformUpdater = (current) => ({
  ...current,
  panX: clampPan(roundToPrecision(current.panX - PAN_STEP_PX)),
});
const panRight: TransformUpdater = (current) => ({
  ...current,
  panX: clampPan(roundToPrecision(current.panX + PAN_STEP_PX)),
});
const panUp: TransformUpdater = (current) => ({
  ...current,
  panY: clampPan(roundToPrecision(current.panY - PAN_STEP_PX)),
});
const panDown: TransformUpdater = (current) => ({
  ...current,
  panY: clampPan(roundToPrecision(current.panY + PAN_STEP_PX)),
});
const zoomIn: TransformUpdater = (current) => ({
  ...current,
  zoom: clampZoom(roundToPrecision(current.zoom + ZOOM_STEP)),
});
const zoomOut: TransformUpdater = (current) => ({
  ...current,
  zoom: clampZoom(roundToPrecision(current.zoom - ZOOM_STEP)),
});
const resetTransform: TransformUpdater = () => DEFAULT_TRANSFORM;

const KEY_UPDATERS: Readonly<Record<string, TransformUpdater>> = {
  '+': zoomIn,
  '0': resetTransform,
  '-': zoomOut,
  '=': zoomIn,
  Add: zoomIn,
  ArrowDown: rotateDown,
  ArrowLeft: rotateLeft,
  ArrowRight: rotateRight,
  ArrowUp: rotateUp,
  Home: resetTransform,
  Subtract: zoomOut,
  _: zoomOut,
};

const SHIFT_KEY_UPDATERS: Readonly<Record<string, TransformUpdater>> = {
  ArrowDown: panDown,
  ArrowLeft: panLeft,
  ArrowRight: panRight,
  ArrowUp: panUp,
};

const SHADOW_LAYER_STYLE: CSSProperties = { transform: `translateZ(${SHADOW_DEPTH_PX}px)` };
const PLATE_LAYER_STYLE: CSSProperties = { transform: `translateZ(${PLATE_DEPTH_PX}px)` };
const MACHINE_LAYER_STYLE: CSSProperties = {
  backfaceVisibility: 'hidden',
  transform: `translateZ(${MACHINE_DEPTH_PX}px)`,
};

interface DragOrigin {
  clientX: number;
  clientY: number;
  isPan: boolean;
  transform: StageTransform;
}

export function Interactive3DMachineStage() {
  const [transform, setTransform] = useState<StageTransform>(DEFAULT_TRANSFORM);
  const [isDragging, setIsDragging] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const stageRef = useRef<HTMLButtonElement>(null);
  const dragOrigin = useRef<DragOrigin | null>(null);
  const interactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instructionsId = useId();

  const markInteracting = useCallback(() => {
    setIsInteracting(true);
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
    interactionTimer.current = setTimeout(() => setIsInteracting(false), INTERACTION_HINT_MS);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    setPrefersReducedMotion(query.matches);
    const handleChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      markInteracting();
      setTransform((current) => (event.deltaY < 0 ? zoomIn(current) : zoomOut(current)));
    };
    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel);
  }, [markInteracting]);

  useEffect(
    () => () => {
      if (interactionTimer.current) clearTimeout(interactionTimer.current);
    },
    []
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (
      event.pointerType === 'mouse' &&
      event.button !== PRIMARY_BUTTON &&
      event.button !== AUXILIARY_BUTTON &&
      event.button !== SECONDARY_BUTTON
    ) {
      return;
    }
    dragOrigin.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      isPan:
        event.shiftKey || event.button === AUXILIARY_BUTTON || event.button === SECONDARY_BUTTON,
      transform,
    };
    setIsDragging(true);
    markInteracting();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const origin = dragOrigin.current;
    if (!origin) return;
    const deltaX = event.clientX - origin.clientX;
    const deltaY = event.clientY - origin.clientY;
    const nextTransform: StageTransform = origin.isPan
      ? {
          ...origin.transform,
          panX: clampPan(roundToPrecision(origin.transform.panX + deltaX * DRAG_PAN_SENSITIVITY)),
          panY: clampPan(roundToPrecision(origin.transform.panY + deltaY * DRAG_PAN_SENSITIVITY)),
        }
      : {
          ...origin.transform,
          rotateX: clampRotationX(
            roundToPrecision(origin.transform.rotateX - deltaY * DRAG_ROTATION_SENSITIVITY)
          ),
          rotateY: clampRotationY(
            roundToPrecision(origin.transform.rotateY + deltaX * DRAG_ROTATION_SENSITIVITY)
          ),
        };
    setTransform(nextTransform);
    markInteracting();
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragOrigin.current) return;
    dragOrigin.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const updaters = event.shiftKey ? SHIFT_KEY_UPDATERS : KEY_UPDATERS;
    const updater = updaters[event.key];
    if (!updater) return;
    event.preventDefault();
    markInteracting();
    setTransform(updater);
  };

  const handleReset = useCallback(() => {
    dragOrigin.current = null;
    setIsDragging(false);
    setTransform(DEFAULT_TRANSFORM);
    markInteracting();
  }, [markInteracting]);

  const stageStyle: CSSProperties = {
    backfaceVisibility: 'hidden',
    transform: `perspective(${PERSPECTIVE_PX}px) translate3d(${transform.panX}px, ${transform.panY}px, 0) rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg) scale(${transform.zoom})`,
    transformStyle: 'preserve-3d',
    transition:
      prefersReducedMotion || isDragging
        ? 'none'
        : `transform ${TRANSITION_MS}ms ${TRANSITION_EASING}`,
    willChange: isInteracting && !prefersReducedMotion ? 'transform' : 'auto',
  };

  return (
    <GlassCard className="overflow-hidden p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-semibold text-[var(--text-heading)] text-lg">
            Interactive fleet view
          </h2>
          <p className="text-[var(--text-muted)] text-xs" id={instructionsId}>
            Drag to rotate, Shift+drag to pan, scroll to zoom. Arrow keys rotate, Shift+arrow keys
            pan, + and - zoom.
          </p>
        </div>
        <button
          aria-label="Reset 3D machine view to defaults"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--accent-blue)]/30 bg-[var(--bg-tertiary)] px-3 py-2 font-medium text-[var(--accent-blue)] text-sm transition-colors duration-150 hover:bg-[var(--accent-blue)]/10 focus-visible:outline-2 focus-visible:outline-[var(--accent-blue)] focus-visible:outline-offset-2"
          data-testid="interactive-3d-reset"
          onClick={handleReset}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Reset view
        </button>
      </div>
      <button
        aria-describedby={instructionsId}
        aria-label="Interactive 3D machine stage"
        aria-roledescription="3D viewer"
        className={cn(
          'relative mt-4 flex h-72 w-full touch-none items-center justify-center overflow-hidden rounded-xl border border-[var(--accent-blue)]/20 bg-[var(--bg-tertiary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
          prefersReducedMotion && 'interactive-3d-stage--reduced-motion'
        )}
        data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
        data-testid="interactive-3d-stage"
        onKeyDown={handleKeyDown}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        ref={stageRef}
        type="button"
      >
        <span
          className="relative flex h-full w-full items-center justify-center"
          data-testid="interactive-3d-transform"
          style={stageStyle}
        >
          <span
            aria-hidden="true"
            className="absolute h-24 w-64 rounded-[50%] bg-[var(--accent-blue)]/10"
            style={SHADOW_LAYER_STYLE}
          />
          <span
            aria-hidden="true"
            className="absolute h-40 w-72 rounded-xl border border-[var(--accent-gold)]/30 bg-[var(--accent-gold)]/5"
            style={PLATE_LAYER_STYLE}
          />
          <span className="relative" style={MACHINE_LAYER_STYLE}>
            <Image
              alt={STAGE_IMAGE_ALT}
              className="h-auto w-72 max-w-[70vw] select-none object-contain"
              draggable={false}
              height={STAGE_IMAGE_HEIGHT}
              src={STAGE_IMAGE_SRC}
              width={STAGE_IMAGE_WIDTH}
            />
          </span>
        </span>
      </button>
    </GlassCard>
  );
}
