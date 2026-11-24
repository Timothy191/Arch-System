'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../lib/utils';
import {
  buildEarthSurfaceDots,
  clampPitchRad,
  DEFAULT_GLOBE_PINS,
  formatCoordinates,
  type GlobePin,
  INITIAL_ORBIT_PITCH_RAD,
  INITIAL_ORBIT_YAW_RAD,
  isLandCoordinate,
  latLonToUnitVec3,
  normalizeYawRad,
  type OrbitAngles,
  rotateVec3,
  sampleGeodesicArc,
  shortestAngleDelta,
  targetOrbitForLatLon,
} from './globe-math';
import { type ProjectedPinHit, renderGlobe3DFrame } from './globe-renderer';

export {
  buildEarthSurfaceDots,
  formatCoordinates,
  type GlobePin,
  isLandCoordinate,
  latLonToUnitVec3,
  rotateVec3,
  sampleGeodesicArc,
  targetOrbitForLatLon,
};

export interface GlobePinsProps {
  readonly pins?: readonly GlobePin[];
  readonly className?: string;
}

const CANVAS_STAGE_FALLBACK_PX = 290;
const AUTO_ROTATE_RAD_PER_SEC = 0.22;
const DRAG_SENSITIVITY_RAD = 0.0085;
const INERTIA_DAMPING = 0.92;
const VELOCITY_STOP_THRESHOLD = 0.0002;
const TARGET_LERP_FACTOR = 0.14;
const DRAG_CLICK_THRESHOLD_PX = 5;
const MAX_FRAME_DELTA_SEC = 0.05;
const MAX_DPR = 2;

const CONTROL_BUTTON_CLASS =
  'inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/75 px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] shadow-xs transition-colors hover:bg-white hover:text-[var(--text-heading)]';

function findHitPin(
  hits: readonly ProjectedPinHit[],
  pointX: number,
  pointY: number
): GlobePin | null {
  for (let index = hits.length - 1; index >= 0; index -= 1) {
    const hit = hits[index];
    if (!hit) continue;
    const dist = Math.hypot(pointX - hit.tipX, pointY - hit.tipY);
    if (dist <= hit.hitRadiusPx) {
      return hit.pin;
    }
  }
  return null;
}

function getSafeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

/** Interactive 3D Canvas globe displaying live operational mining sites and telemetry arcs. */
export function GlobePins({ pins = DEFAULT_GLOBE_PINS, className }: GlobePinsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const orbitRef = useRef<OrbitAngles>({
    yawRad: INITIAL_ORBIT_YAW_RAD,
    pitchRad: INITIAL_ORBIT_PITCH_RAD,
  });
  const velocityRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });
  const targetOrbitRef = useRef<OrbitAngles | null>(null);
  const dragStateRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    movedPx: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    movedPx: 0,
  });
  const pinHitsRef = useRef<readonly ProjectedPinHit[]>([]);
  const stageSizeRef = useRef<{ width: number; height: number }>({
    width: CANVAS_STAGE_FALLBACK_PX,
    height: CANVAS_STAGE_FALLBACK_PX,
  });

  const [selectedPinId, setSelectedPinId] = useState<string | null>(
    pins.find((pin) => pin.id === 'dispatch-room')?.id ?? pins[0]?.id ?? null
  );
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [isDraggingUI, setIsDraggingUI] = useState(false);

  const selectedIdRef = useRef<string | null>(selectedPinId);
  const hoveredIdRef = useRef<string | null>(hoveredPinId);
  const autoRotateRef = useRef<boolean>(isAutoRotating);

  selectedIdRef.current = selectedPinId;
  hoveredIdRef.current = hoveredPinId;
  autoRotateRef.current = isAutoRotating;

  const surfaceDots = useMemo(() => buildEarthSurfaceDots(), []);

  const focusPin = useCallback((pin: GlobePin) => {
    setSelectedPinId(pin.id);
    setIsAutoRotating(false);
    targetOrbitRef.current = targetOrbitForLatLon(pin.lat, pin.lon);
    velocityRef.current = { yaw: 0, pitch: 0 };
  }, []);

  const handleResetView = useCallback(() => {
    setSelectedPinId(pins[0]?.id ?? null);
    targetOrbitRef.current = {
      yawRad: INITIAL_ORBIT_YAW_RAD,
      pitchRad: INITIAL_ORBIT_PITCH_RAD,
    };
    velocityRef.current = { yaw: 0, pitch: 0 };
    setIsAutoRotating(true);
  }, [pins]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = getSafeContext(canvas);
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const syncCanvasDimensions = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(CANVAS_STAGE_FALLBACK_PX, Math.round(rect.width || 0));
      const height = Math.max(CANVAS_STAGE_FALLBACK_PX, Math.round(rect.height || 0));
      const dpr =
        typeof window !== 'undefined' ? Math.min(MAX_DPR, window.devicePixelRatio || 1) : 1;

      stageSizeRef.current = { width, height };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    syncCanvasDimensions();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => syncCanvasDimensions());
      resizeObserver.observe(container);
    }

    let animationFrameId = 0;
    let lastTimestampMs = 0;

    const stepFrame = (timestampMs: number) => {
      const deltaSec =
        lastTimestampMs === 0
          ? 0.016
          : Math.min(MAX_FRAME_DELTA_SEC, Math.max(0, (timestampMs - lastTimestampMs) / 1000));
      lastTimestampMs = timestampMs;

      if (!dragStateRef.current.isDragging) {
        if (targetOrbitRef.current) {
          const yawDelta = shortestAngleDelta(
            orbitRef.current.yawRad,
            targetOrbitRef.current.yawRad
          );
          const pitchDelta = targetOrbitRef.current.pitchRad - orbitRef.current.pitchRad;
          orbitRef.current = {
            yawRad: normalizeYawRad(orbitRef.current.yawRad + yawDelta * TARGET_LERP_FACTOR),
            pitchRad: clampPitchRad(orbitRef.current.pitchRad + pitchDelta * TARGET_LERP_FACTOR),
          };
          if (Math.abs(yawDelta) < 0.004 && Math.abs(pitchDelta) < 0.004) {
            orbitRef.current = targetOrbitRef.current;
            targetOrbitRef.current = null;
          }
        } else {
          const hasInertia =
            Math.abs(velocityRef.current.yaw) > VELOCITY_STOP_THRESHOLD ||
            Math.abs(velocityRef.current.pitch) > VELOCITY_STOP_THRESHOLD;

          if (hasInertia) {
            orbitRef.current = {
              yawRad: normalizeYawRad(orbitRef.current.yawRad + velocityRef.current.yaw),
              pitchRad: clampPitchRad(orbitRef.current.pitchRad + velocityRef.current.pitch),
            };
            velocityRef.current = {
              yaw: velocityRef.current.yaw * INERTIA_DAMPING,
              pitch: velocityRef.current.pitch * INERTIA_DAMPING,
            };
          } else if (autoRotateRef.current && !prefersReducedMotion) {
            orbitRef.current = {
              yawRad: normalizeYawRad(orbitRef.current.yawRad + AUTO_ROTATE_RAD_PER_SEC * deltaSec),
              pitchRad: orbitRef.current.pitchRad,
            };
          }
        }
      }

      if (ctx) {
        pinHitsRef.current = renderGlobe3DFrame({
          ctx,
          widthPx: stageSizeRef.current.width,
          heightPx: stageSizeRef.current.height,
          orbit: orbitRef.current,
          elapsedMs: timestampMs,
          pins,
          surfaceDots,
          selectedPinId: selectedIdRef.current,
          hoveredPinId: hoveredIdRef.current,
        });
      }

      if (!prefersReducedMotion && typeof requestAnimationFrame !== 'undefined') {
        animationFrameId = requestAnimationFrame(stepFrame);
      }
    };

    // Render frame 0 synchronously to prevent a blank flash before the first animation tick.
    stepFrame(0);

    return () => {
      if (animationFrameId && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(animationFrameId);
      }
      resizeObserver?.disconnect();
    };
  }, [pins, surfaceDots]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    targetOrbitRef.current = null;
    velocityRef.current = { yaw: 0, pitch: 0 };
    dragStateRef.current = {
      isDragging: true,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      movedPx: 0,
    };
    setIsDraggingUI(true);
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore synthetic test events without active pointer capture.
      }
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    if (!dragStateRef.current.isDragging) {
      const hitPin = findHitPin(pinHitsRef.current, localX, localY);
      setHoveredPinId(hitPin?.id ?? null);
      return;
    }

    const deltaX = event.clientX - dragStateRef.current.lastX;
    const deltaY = event.clientY - dragStateRef.current.lastY;
    dragStateRef.current.lastX = event.clientX;
    dragStateRef.current.lastY = event.clientY;
    dragStateRef.current.movedPx += Math.hypot(deltaX, deltaY);

    const yawStep = -deltaX * DRAG_SENSITIVITY_RAD;
    const pitchStep = deltaY * DRAG_SENSITIVITY_RAD;

    orbitRef.current = {
      yawRad: normalizeYawRad(orbitRef.current.yawRad + yawStep),
      pitchRad: clampPitchRad(orbitRef.current.pitchRad + pitchStep),
    };
    velocityRef.current = { yaw: yawStep, pitch: pitchStep };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStateRef.current.isDragging) return;
    const totalMovedPx = dragStateRef.current.movedPx;
    dragStateRef.current.isDragging = false;
    setIsDraggingUI(false);

    if (totalMovedPx < DRAG_CLICK_THRESHOLD_PX) {
      const rect = event.currentTarget.getBoundingClientRect();
      const hitPin = findHitPin(
        pinHitsRef.current,
        event.clientX - rect.left,
        event.clientY - rect.top
      );
      if (hitPin) {
        focusPin(hitPin);
      }
    }
  };

  const activePin =
    pins.find((pin) => pin.id === (hoveredPinId ?? selectedPinId)) ?? pins[0] ?? null;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-anurati font-bold text-[var(--text-heading)] text-sm tracking-[0.05em]">
            Active Site Pins
          </span>
          <span className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">
            {pins.length} operational sites
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAutoRotating((prev) => !prev)}
            className={CONTROL_BUTTON_CLASS}
            aria-label={isAutoRotating ? 'Pause globe rotation' : 'Resume globe rotation'}
          >
            {isAutoRotating ? (
              <Pause className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Play className="h-3 w-3" aria-hidden="true" />
            )}
            <span>{isAutoRotating ? 'Pause' : 'Orbit'}</span>
          </button>
          <button
            type="button"
            onClick={handleResetView}
            className={CONTROL_BUTTON_CLASS}
            aria-label="Reset 3D globe view"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            <span>Reset</span>
          </button>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/70 px-2.5 py-1 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-accent-green" aria-hidden="true" />
            <span className="text-[11px] text-[var(--text-secondary)]">All sites online</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[minmax(0,300px)_1fr]">
        <div className="flex flex-col items-center">
          <div
            ref={containerRef}
            className="relative flex h-[290px] w-full max-w-[300px] items-center justify-center overflow-hidden rounded-2xl border border-white/55 bg-white/45 shadow-sm"
          >
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Operations globe"
              data-testid="operations-3d-globe"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={() => {
                dragStateRef.current.isDragging = false;
                setIsDraggingUI(false);
                setHoveredPinId(null);
              }}
              className={cn(
                'block h-full w-full touch-none select-none',
                isDraggingUI ? 'cursor-grabbing' : hoveredPinId ? 'cursor-pointer' : 'cursor-grab'
              )}
            />
            {activePin && (
              <div className="pointer-events-none absolute inset-x-3 bottom-2.5 flex items-center justify-between rounded-full border border-white/70 bg-white/85 px-2.5 py-1 text-[10px] shadow-xs">
                <span className="font-semibold text-[var(--text-heading)]">{activePin.label}</span>
                <span className="font-mono text-[var(--text-secondary)] tabular-nums">
                  {formatCoordinates(activePin.lat, activePin.lon)}
                </span>
              </div>
            )}
          </div>
          <span className="mt-1.5 text-[10px] text-[var(--text-tertiary)] tracking-wide">
            Drag to orbit 3D globe · Click pin to focus
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-1">
          {pins.map((pin) => {
            const isSelected = selectedPinId === pin.id;
            const isHovered = hoveredPinId === pin.id;
            return (
              <button
                key={pin.id}
                type="button"
                aria-pressed={isSelected}
                onMouseEnter={() => setHoveredPinId(pin.id)}
                onMouseLeave={() => setHoveredPinId(null)}
                onClick={() => focusPin(pin)}
                className={cn(
                  'flex items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-left transition-all duration-150',
                  isSelected
                    ? 'border-accent-gold/65 bg-white/95 shadow-sm'
                    : isHovered
                      ? 'border-white/80 bg-white/85 shadow-xs'
                      : 'border-white/50 bg-white/60 hover:bg-white/80'
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: pin.color ?? 'var(--accent-gold)' }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[var(--text-heading)] text-xs">
                      {pin.label}
                    </div>
                    {pin.region && (
                      <div className="truncate text-[10px] text-[var(--text-secondary)]">
                        {pin.region}
                      </div>
                    )}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-[var(--text-secondary)] tabular-nums">
                  {formatCoordinates(pin.lat, pin.lon)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
