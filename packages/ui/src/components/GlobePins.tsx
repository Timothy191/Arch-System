'use client';

import { Pause, Play, RotateCcw, Satellite } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../lib/utils';
import { GlobeDepartmentMetrics } from './GlobeDepartmentMetrics';
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
import { createWebGLGlobeRenderer, type WebGLGlobeRenderer } from './globe-webgl';
import type { Panel } from './hero-types';

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

type SatelliteImageryLayer = 'viirs' | 'blue-marble';
type SatelliteFeedStatus = 'blue-marble' | 'nasa-viirs' | 'wireframe';

export interface GlobePinsProps {
  readonly pins?: readonly GlobePin[];
  readonly activePanel?: Panel;
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
const BUNDLED_BLUE_MARBLE_SRC = '/images/earth-blue-marble.jpg';

const FALLBACK_OVERVIEW_PANEL: Panel = {
  id: 'overview',
  name: 'overview',
  title: 'System Overview',
  description: 'Global operations command surface',
  category: 'Command',
  image: '/images/departments/overview.webp',
  stats: { label: 'System Health', value: '100% Optimal' },
  trend: [62, 68, 72, 76, 81, 86, 90, 94, 96, 99],
  status: 'active',
  icon: <span aria-hidden="true" />,
  iconBgColor: 'bg-accent-gold/10',
  primary: { href: '/overview', label: 'Overview', icon: <span aria-hidden="true" /> },
  assetOverline: 'CENTRAL COMMAND // SYS-MAIN',
};

const CONTROL_BUTTON_CLASS =
  'inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-xs transition-colors hover:bg-white hover:text-slate-950';

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

function syncCanvasResolution(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  dpr: number
): void {
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

/** Interactive 3D satellite Earth globe paired with live synchronized department telemetry. */
export function GlobePins({ pins = DEFAULT_GLOBE_PINS, activePanel, className }: GlobePinsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const webglRendererRef = useRef<WebGLGlobeRenderer | null>(null);
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
  const stageSizeRef = useRef<{ width: number; height: number; dpr: number }>({
    width: CANVAS_STAGE_FALLBACK_PX,
    height: CANVAS_STAGE_FALLBACK_PX,
    dpr: 1,
  });

  const [selectedPinId, setSelectedPinId] = useState<string | null>(
    pins.find((pin) => pin.id === 'dispatch-room')?.id ?? pins[0]?.id ?? null
  );
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [isDraggingUI, setIsDraggingUI] = useState(false);
  const [imageryLayer, setImageryLayer] = useState<SatelliteImageryLayer>('viirs');
  const [feedStatus, setFeedStatus] = useState<SatelliteFeedStatus>('wireframe');

  const selectedIdRef = useRef<string | null>(selectedPinId);
  const hoveredIdRef = useRef<string | null>(hoveredPinId);
  const autoRotateRef = useRef<boolean>(isAutoRotating);

  selectedIdRef.current = selectedPinId;
  hoveredIdRef.current = hoveredPinId;
  autoRotateRef.current = isAutoRotating;

  const surfaceDots = useMemo(() => buildEarthSurfaceDots(), []);
  const resolvedPanel = activePanel ?? FALLBACK_OVERVIEW_PANEL;

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
    if (typeof window === 'undefined' || typeof Image === 'undefined') return;
    let isCancelled = false;
    let activeObjectUrl: string | null = null;
    const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;

    const uploadImageryUrl = (
      srcUrl: string,
      nextStatus: SatelliteFeedStatus,
      revokeUrlAfterLoad: boolean
    ) => {
      const img = new Image();
      img.onload = () => {
        if (isCancelled) {
          if (revokeUrlAfterLoad && typeof URL?.revokeObjectURL === 'function') {
            URL.revokeObjectURL(srcUrl);
          }
          return;
        }
        webglRendererRef.current?.setTextureImage(img);
        setFeedStatus(nextStatus);
        if (revokeUrlAfterLoad && typeof URL?.revokeObjectURL === 'function') {
          URL.revokeObjectURL(srcUrl);
          if (activeObjectUrl === srcUrl) {
            activeObjectUrl = null;
          }
        }
      };
      img.src = srcUrl;
    };

    uploadImageryUrl(BUNDLED_BLUE_MARBLE_SRC, 'blue-marble', false);

    if (imageryLayer === 'viirs' && typeof fetch === 'function') {
      void fetch('/api/hub/earth-imagery?layer=viirs', { signal: abortController?.signal })
        .then(async (response) => {
          if (!response.ok || isCancelled) return;
          const contentType = response.headers.get('content-type') ?? '';
          if (!contentType.toLowerCase().startsWith('image/')) return;
          const headerSource = response.headers.get('x-earth-imagery-source');
          const blob = await response.blob();
          if (isCancelled || typeof URL?.createObjectURL !== 'function') return;
          const objectUrl = URL.createObjectURL(blob);
          activeObjectUrl = objectUrl;
          uploadImageryUrl(
            objectUrl,
            headerSource === 'nasa-gibs' ? 'nasa-viirs' : 'blue-marble',
            true
          );
        })
        .catch(() => {
          // Keep bundled Blue Marble imagery active if live proxy is unavailable
        });
    }

    return () => {
      isCancelled = true;
      abortController?.abort();
      if (activeObjectUrl && typeof URL?.revokeObjectURL === 'function') {
        URL.revokeObjectURL(activeObjectUrl);
      }
    };
  }, [imageryLayer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const webglCanvas = webglCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = getSafeContext(canvas);
    const webglRenderer = webglCanvas ? createWebGLGlobeRenderer(webglCanvas) : null;
    webglRendererRef.current = webglRenderer;

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

      stageSizeRef.current = { width, height, dpr };
      syncCanvasResolution(canvas, width, height, dpr);
      if (webglCanvas) {
        syncCanvasResolution(webglCanvas, width, height, dpr);
      }
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

      const hasWebGLTexture =
        webglRenderer?.render({
          widthPx: stageSizeRef.current.width,
          heightPx: stageSizeRef.current.height,
          dpr: stageSizeRef.current.dpr,
          orbit: orbitRef.current,
        }) ?? false;

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
          hasWebGLSphere: hasWebGLTexture,
        });
      }

      if (!prefersReducedMotion && typeof requestAnimationFrame !== 'undefined') {
        animationFrameId = requestAnimationFrame(stepFrame);
      }
    };

    stepFrame(0);

    return () => {
      if (animationFrameId && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(animationFrameId);
      }
      resizeObserver?.disconnect();
      webglRenderer?.dispose();
      webglRendererRef.current = null;
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
          <span className="font-anurati font-bold text-slate-950 text-sm tracking-[0.05em]">
            Active Site Pins
          </span>
          <span className="font-semibold text-[11px] text-slate-700 uppercase tracking-wider">
            {pins.length} operational sites
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setImageryLayer((prev) => (prev === 'viirs' ? 'blue-marble' : 'viirs'))}
            className={CONTROL_BUTTON_CLASS}
            aria-label={
              imageryLayer === 'viirs'
                ? 'Switch to NASA Blue Marble layer'
                : 'Switch to NASA Live VIIRS satellite imagery'
            }
          >
            <Satellite className="h-3 w-3 text-accent-gold" aria-hidden="true" />
            <span>{imageryLayer === 'viirs' ? 'Live NASA' : 'Blue Marble'}</span>
          </button>
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
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/30 bg-emerald-950 px-2.5 py-1 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
            <span className="font-bold text-[11px] text-white">All sites online</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,310px)_1fr]">
        <div className="flex flex-col items-center">
          <div
            ref={containerRef}
            className="relative flex h-[290px] w-full max-w-[310px] items-center justify-center overflow-hidden rounded-2xl border border-white/65 bg-white/45 shadow-sm"
          >
            <canvas
              ref={webglCanvasRef}
              className="pointer-events-none absolute inset-0 block h-full w-full"
            />
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
                'relative z-10 block h-full w-full touch-none select-none',
                isDraggingUI ? 'cursor-grabbing' : hoveredPinId ? 'cursor-pointer' : 'cursor-grab'
              )}
            />
            <span className="pointer-events-none absolute top-2.5 left-3 z-20 rounded-full border border-white/75 bg-white/85 px-2 py-0.5 font-bold font-mono text-[9.5px] text-slate-800 shadow-xs">
              {feedStatus === 'nasa-viirs'
                ? 'NASA VIIRS LIVE'
                : feedStatus === 'blue-marble'
                  ? 'NASA BLUE MARBLE'
                  : '3D TELEMETRY'}
            </span>
            {activePin && (
              <div className="pointer-events-none absolute inset-x-3 bottom-2.5 z-20 flex items-center justify-between rounded-full border border-white/75 bg-white/90 px-2.5 py-1 text-[10px] shadow-xs">
                <span className="font-bold text-slate-950">{activePin.label}</span>
                <span className="font-mono font-semibold text-slate-700 tabular-nums">
                  {formatCoordinates(activePin.lat, activePin.lon)}
                </span>
              </div>
            )}
          </div>
          <span className="mt-1.5 font-medium text-[10px] text-slate-700 tracking-wide">
            Drag to orbit 3D globe · Click pin to focus
          </span>

          <div
            className="mt-2 flex w-full max-w-[310px] flex-wrap items-center justify-center gap-1.5"
            aria-label="Quick site pin focus controls"
          >
            {pins.map((pin) => {
              const isSelected = selectedPinId === pin.id;
              return (
                <button
                  key={pin.id}
                  type="button"
                  aria-pressed={isSelected}
                  onMouseEnter={() => setHoveredPinId(pin.id)}
                  onMouseLeave={() => setHoveredPinId(null)}
                  onClick={() => focusPin(pin)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-semibold text-[10px] transition-all',
                    isSelected
                      ? 'border-accent-gold/70 bg-white text-slate-950 shadow-xs'
                      : 'border-white/60 bg-white/65 text-slate-700 hover:bg-white hover:text-slate-950'
                  )}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: pin.color ?? 'var(--accent-gold)' }}
                    aria-hidden="true"
                  />
                  <span>{pin.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <GlobeDepartmentMetrics activePanel={resolvedPanel} />
      </div>
    </div>
  );
}
