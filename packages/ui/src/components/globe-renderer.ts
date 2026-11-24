import {
  GLOBE_SPHERE_FILL_RATIO,
  type GlobePin,
  type GlobeViewport,
  getSurfaceTangents,
  latLonToUnitVec3,
  type OrbitAngles,
  projectVec3ToScreen,
  rotateVec3,
  type SurfaceDot,
  sampleGeodesicArc,
  type Vec3,
} from './globe-math';

export interface ProjectedPinHit {
  readonly pin: GlobePin;
  readonly tipX: number;
  readonly tipY: number;
  readonly baseX: number;
  readonly baseY: number;
  readonly depthZ: number;
  readonly hitRadiusPx: number;
}

export interface RenderGlobeFrameOptions {
  readonly ctx: CanvasRenderingContext2D;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly orbit: OrbitAngles;
  readonly elapsedMs: number;
  readonly pins: readonly GlobePin[];
  readonly surfaceDots: readonly SurfaceDot[];
  readonly selectedPinId: string | null;
  readonly hoveredPinId: string | null;
  readonly hasWebGLSphere?: boolean;
}

interface GlobeRenderContext {
  readonly viewport: GlobeViewport;
  readonly orbit: OrbitAngles;
  readonly elapsedMs: number;
  readonly pins: readonly GlobePin[];
  readonly surfaceDots: readonly SurfaceDot[];
  readonly selectedPinId: string | null;
  readonly hoveredPinId: string | null;
}

const SPHERE_FILL_RATIO = GLOBE_SPHERE_FILL_RATIO;
const ORBITAL_RING_RADIUS_MULT = 1.24;
const ORBITAL_RING_TILT_X_RAD = -0.44;
const ORBITAL_RING_TILT_Z_RAD = 0.24;
const ORBITAL_RING_SEGMENTS = 96;
const GRATICULE_STEP_DEG = 10;
const GRATICULE_LATITUDES_DEG: readonly number[] = [-60, -30, 0, 30, 60];
const GRATICULE_LONGITUDES_DEG: readonly number[] = [
  -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180,
];
const ARC_SEGMENTS = 32;
const ARC_PEAK_ALTITUDE = 0.16;
const ARC_CYCLE_MS = 2800;
const PULSE_CYCLE_MS = 2200;
const PIN_STEM_RADIUS = 1.12;
const PIN_VISIBILITY_THRESHOLD_Z = -0.14;
const BEACON_RADIUS_OFFSET = 0.065;
const LABEL_VISIBILITY_THRESHOLD_Z = 0.22;
const HIT_RADIUS_BASE_PX = 20;

// Upper-left studio key light normalized vector
const KEY_LIGHT_INV_NORM = 1 / Math.hypot(-0.46, 0.56, 0.69);
const KEY_LIGHT_DIR: Vec3 = {
  x: -0.46 * KEY_LIGHT_INV_NORM,
  y: 0.56 * KEY_LIGHT_INV_NORM,
  z: 0.69 * KEY_LIGHT_INV_NORM,
};

const GOLD_RING_RGBA = 'rgba(212, 175, 55, 0.55)';
const GOLD_RING_BACK_RGBA = 'rgba(212, 175, 55, 0.2)';
const DEFAULT_PIN_COLOR = 'rgb(212, 175, 55)';
const LABEL_FONT = '600 10px ui-sans-serif, system-ui, -apple-system, sans-serif';

function transformOrbitalRingPoint(angleRad: number): Vec3 {
  const rawX = ORBITAL_RING_RADIUS_MULT * Math.cos(angleRad);
  const rawZ = ORBITAL_RING_RADIUS_MULT * Math.sin(angleRad);

  const cosZ = Math.cos(ORBITAL_RING_TILT_Z_RAD);
  const sinZ = Math.sin(ORBITAL_RING_TILT_Z_RAD);
  const tiltedX = rawX * cosZ;
  const tiltedY = rawX * sinZ;

  const cosX = Math.cos(ORBITAL_RING_TILT_X_RAD);
  const sinX = Math.sin(ORBITAL_RING_TILT_X_RAD);
  return {
    x: tiltedX,
    y: tiltedY * cosX - rawZ * sinX,
    z: tiltedY * sinX + rawZ * cosX,
  };
}

function drawAmbientContactShadow(ctx: CanvasRenderingContext2D, frame: GlobeRenderContext): void {
  const { centerX, centerY, radiusPx } = frame.viewport;
  const shadowCenterY = centerY + radiusPx * 1.13;
  const shadowRadiusX = radiusPx * 0.9;
  const shadowRadiusY = radiusPx * 0.16;

  ctx.save();
  ctx.translate(centerX, shadowCenterY);
  ctx.scale(1, shadowRadiusY / shadowRadiusX);
  const shadowGradient = ctx.createRadialGradient(0, 0, shadowRadiusX * 0.08, 0, 0, shadowRadiusX);
  shadowGradient.addColorStop(0, 'rgba(15, 23, 42, 0.22)');
  shadowGradient.addColorStop(0.55, 'rgba(30, 41, 59, 0.09)');
  shadowGradient.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = shadowGradient;
  ctx.beginPath();
  ctx.arc(0, 0, shadowRadiusX, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAtmosphericHalo(ctx: CanvasRenderingContext2D, frame: GlobeRenderContext): void {
  const { centerX, centerY, radiusPx } = frame.viewport;
  const haloGradient = ctx.createRadialGradient(
    centerX - radiusPx * 0.12,
    centerY - radiusPx * 0.12,
    radiusPx * 0.88,
    centerX,
    centerY,
    radiusPx * 1.24
  );
  haloGradient.addColorStop(0, 'rgba(14, 165, 233, 0.06)');
  haloGradient.addColorStop(0.55, 'rgba(212, 175, 55, 0.1)');
  haloGradient.addColorStop(1, 'rgba(243, 244, 246, 0)');

  ctx.fillStyle = haloGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radiusPx * 1.24, 0, Math.PI * 2);
  ctx.fill();
}

function drawOrbitalRingPass(
  ctx: CanvasRenderingContext2D,
  options: { readonly frame: GlobeRenderContext; readonly layer: 'back' | 'front' }
): void {
  const { frame, layer } = options;
  ctx.save();
  ctx.lineWidth = layer === 'front' ? 1.5 : 1;
  ctx.strokeStyle = layer === 'front' ? GOLD_RING_RGBA : GOLD_RING_BACK_RGBA;
  ctx.setLineDash([4, 4]);

  let isDrawing = false;
  ctx.beginPath();
  for (let step = 0; step <= ORBITAL_RING_SEGMENTS; step += 1) {
    const angleRad = (step / ORBITAL_RING_SEGMENTS) * Math.PI * 2;
    const ringPoint = transformOrbitalRingPoint(angleRad);
    const shouldDraw = layer === 'front' ? ringPoint.z >= 0 : ringPoint.z < 0;
    const projected = projectVec3ToScreen(ringPoint, frame.viewport);

    if (shouldDraw && !isDrawing) {
      ctx.moveTo(projected.screenX, projected.screenY);
      isDrawing = true;
    } else if (shouldDraw && isDrawing) {
      ctx.lineTo(projected.screenX, projected.screenY);
    } else {
      isDrawing = false;
    }
  }
  ctx.stroke();

  if (layer === 'front') {
    const satelliteAngle = (frame.elapsedMs * 0.00055) % (Math.PI * 2);
    const satPoint = transformOrbitalRingPoint(satelliteAngle);
    if (satPoint.z >= 0) {
      const satProjected = projectVec3ToScreen(satPoint, frame.viewport);
      ctx.setLineDash([]);
      ctx.fillStyle = DEFAULT_PIN_COLOR;
      ctx.beginPath();
      ctx.arc(satProjected.screenX, satProjected.screenY, 3 * satProjected.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSphereBody(ctx: CanvasRenderingContext2D, frame: GlobeRenderContext): void {
  const { centerX, centerY, radiusPx } = frame.viewport;

  // Off-center studio shading gives unmistakable spherical volume
  const bodyGradient = ctx.createRadialGradient(
    centerX - radiusPx * 0.34,
    centerY - radiusPx * 0.36,
    radiusPx * 0.08,
    centerX + radiusPx * 0.14,
    centerY + radiusPx * 0.16,
    radiusPx * 1.18
  );
  bodyGradient.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
  bodyGradient.addColorStop(0.32, 'rgba(241, 245, 249, 0.95)');
  bodyGradient.addColorStop(0.68, 'rgba(219, 228, 240, 0.93)');
  bodyGradient.addColorStop(0.9, 'rgba(176, 192, 214, 0.92)');
  bodyGradient.addColorStop(1, 'rgba(139, 157, 184, 0.94)');

  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radiusPx, 0, Math.PI * 2);
  ctx.fill();

  // Subtle glass rim bounce on lower-right limb
  const rimBounceGradient = ctx.createRadialGradient(
    centerX + radiusPx * 0.45,
    centerY + radiusPx * 0.45,
    radiusPx * 0.55,
    centerX,
    centerY,
    radiusPx
  );
  rimBounceGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  rimBounceGradient.addColorStop(0.84, 'rgba(255, 255, 255, 0.04)');
  rimBounceGradient.addColorStop(1, 'rgba(255, 255, 255, 0.45)');
  ctx.fillStyle = rimBounceGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radiusPx, 0, Math.PI * 2);
  ctx.fill();

  // Sharp glass silhouette border
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radiusPx - 0.5, 0, Math.PI * 2);
  ctx.stroke();
}

function drawGraticuleCurve(
  ctx: CanvasRenderingContext2D,
  options: {
    readonly frame: GlobeRenderContext;
    readonly points: readonly Vec3[];
    readonly isEquator: boolean;
    readonly isSubtleOverlay: boolean;
  }
): void {
  const { frame, points, isEquator, isSubtleOverlay } = options;
  ctx.lineWidth = isEquator ? 1.15 : 0.7;
  if (isSubtleOverlay) {
    ctx.strokeStyle = isEquator ? 'rgba(212, 175, 55, 0.36)' : 'rgba(255, 255, 255, 0.14)';
  } else {
    ctx.strokeStyle = isEquator ? 'rgba(212, 175, 55, 0.34)' : 'rgba(100, 116, 139, 0.19)';
  }

  let hasOpenSegment = false;
  ctx.beginPath();
  for (const unitPoint of points) {
    const rotated = rotateVec3(unitPoint, frame.orbit);
    if (rotated.z <= -0.04) {
      hasOpenSegment = false;
      continue;
    }
    const projected = projectVec3ToScreen(rotated, frame.viewport);
    if (!hasOpenSegment) {
      ctx.moveTo(projected.screenX, projected.screenY);
      hasOpenSegment = true;
    } else {
      ctx.lineTo(projected.screenX, projected.screenY);
    }
  }
  ctx.stroke();
}

function drawGraticule3D(
  ctx: CanvasRenderingContext2D,
  options: { readonly frame: GlobeRenderContext; readonly isSubtleOverlay: boolean }
): void {
  const { frame, isSubtleOverlay } = options;
  ctx.save();
  ctx.beginPath();
  ctx.arc(frame.viewport.centerX, frame.viewport.centerY, frame.viewport.radiusPx, 0, Math.PI * 2);
  ctx.clip();

  for (const latDeg of GRATICULE_LATITUDES_DEG) {
    const ringPoints: Vec3[] = [];
    for (let lonDeg = -180; lonDeg <= 180; lonDeg += GRATICULE_STEP_DEG) {
      ringPoints.push(latLonToUnitVec3(latDeg, lonDeg));
    }
    drawGraticuleCurve(ctx, {
      frame,
      points: ringPoints,
      isEquator: latDeg === 0,
      isSubtleOverlay,
    });
  }

  for (const lonDeg of GRATICULE_LONGITUDES_DEG) {
    const meridianPoints: Vec3[] = [];
    for (let latDeg = -85; latDeg <= 85; latDeg += GRATICULE_STEP_DEG) {
      meridianPoints.push(latLonToUnitVec3(latDeg, lonDeg));
    }
    drawGraticuleCurve(ctx, {
      frame,
      points: meridianPoints,
      isEquator: false,
      isSubtleOverlay,
    });
  }

  ctx.restore();
}

function drawContinentDots3D(ctx: CanvasRenderingContext2D, frame: GlobeRenderContext): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(frame.viewport.centerX, frame.viewport.centerY, frame.viewport.radiusPx, 0, Math.PI * 2);
  ctx.clip();

  // Pass 1: Subtle far-side landmass depth silhouettes (translucent crystal globe feel)
  ctx.fillStyle = 'rgba(100, 116, 139, 0.1)';
  for (const dot of frame.surfaceDots) {
    const rotated = rotateVec3(dot.unitVec, frame.orbit);
    if (rotated.z >= 0) continue;
    const projected = projectVec3ToScreen(rotated, frame.viewport);
    ctx.beginPath();
    ctx.arc(projected.screenX, projected.screenY, 1.05 * projected.scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pass 2: Front-hemisphere Lambert-shaded 3D land dots
  for (const dot of frame.surfaceDots) {
    const rotated = rotateVec3(dot.unitVec, frame.orbit);
    if (rotated.z < 0) continue;
    const projected = projectVec3ToScreen(rotated, frame.viewport);
    const lambertTerm = Math.max(
      0,
      rotated.x * KEY_LIGHT_DIR.x + rotated.y * KEY_LIGHT_DIR.y + rotated.z * KEY_LIGHT_DIR.z
    );
    const alpha = Math.min(0.84, 0.24 + lambertTerm * 0.52 + rotated.z * 0.16);
    const dotRadius = (1.3 + lambertTerm * 0.55) * projected.scale;

    ctx.fillStyle = `rgba(30, 58, 95, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(projected.screenX, projected.screenY, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawGeodesicArcs3D(ctx: CanvasRenderingContext2D, frame: GlobeRenderContext): void {
  if (frame.pins.length < 2) return;
  const hubPin = frame.pins.find((candidate) => candidate.id === 'dispatch-room') ?? frame.pins[0];
  if (!hubPin) return;

  const hubUnitVec = latLonToUnitVec3(hubPin.lat, hubPin.lon);
  const pulseProgress = (frame.elapsedMs % ARC_CYCLE_MS) / ARC_CYCLE_MS;

  for (const targetPin of frame.pins) {
    if (targetPin.id === hubPin.id) continue;
    const targetUnitVec = latLonToUnitVec3(targetPin.lat, targetPin.lon);
    const arcPoints = sampleGeodesicArc({
      startVec: hubUnitVec,
      endVec: targetUnitVec,
      segmentCount: ARC_SEGMENTS,
      peakAltitude: ARC_PEAK_ALTITUDE,
    });

    const isHighlighted =
      targetPin.id === frame.hoveredPinId ||
      targetPin.id === frame.selectedPinId ||
      hubPin.id === frame.selectedPinId;

    ctx.lineWidth = isHighlighted ? 1.85 : 1.15;
    ctx.strokeStyle = isHighlighted ? 'rgba(212, 175, 55, 0.78)' : 'rgba(59, 130, 246, 0.34)';

    let isSegmentOpen = false;
    ctx.beginPath();
    for (const point of arcPoints) {
      const rotated = rotateVec3(point, frame.orbit);
      if (rotated.z < -0.1) {
        isSegmentOpen = false;
        continue;
      }
      const projected = projectVec3ToScreen(rotated, frame.viewport);
      if (!isSegmentOpen) {
        ctx.moveTo(projected.screenX, projected.screenY);
        isSegmentOpen = true;
      } else {
        ctx.lineTo(projected.screenX, projected.screenY);
      }
    }
    ctx.stroke();

    // Animated telemetry pulse packet riding along the 3D arc
    const pulseIndex = Math.min(arcPoints.length - 1, Math.floor(pulseProgress * ARC_SEGMENTS));
    const pulseVec = arcPoints[pulseIndex];
    if (!pulseVec) continue;
    const rotatedPulse = rotateVec3(pulseVec, frame.orbit);
    if (rotatedPulse.z > 0) {
      const projectedPulse = projectVec3ToScreen(rotatedPulse, frame.viewport);
      ctx.fillStyle = targetPin.color ?? DEFAULT_PIN_COLOR;
      ctx.beginPath();
      ctx.arc(
        projectedPulse.screenX,
        projectedPulse.screenY,
        2.6 * projectedPulse.scale,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }
}

function drawForeshortenedBeacon(
  ctx: CanvasRenderingContext2D,
  options: {
    readonly frame: GlobeRenderContext;
    readonly pin: GlobePin;
    readonly unitBase: Vec3;
    readonly phaseOffset: number;
  }
): void {
  const { frame, pin, unitBase, phaseOffset } = options;
  const pulseWave = ((frame.elapsedMs + phaseOffset) % PULSE_CYCLE_MS) / PULSE_CYCLE_MS;
  const ringRadius = BEACON_RADIUS_OFFSET * (0.45 + pulseWave * 0.9);
  const { eastVec, northVec } = getSurfaceTangents(pin.lat, pin.lon);
  const segments = 20;

  ctx.save();
  ctx.lineWidth = 1.25;
  ctx.globalAlpha = Math.max(0, 1 - pulseWave) * 0.72;
  ctx.strokeStyle = pin.color ?? DEFAULT_PIN_COLOR;
  ctx.beginPath();
  for (let step = 0; step <= segments; step += 1) {
    const theta = (step / segments) * Math.PI * 2;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const ringVec: Vec3 = {
      x: unitBase.x + (eastVec.x * cosTheta + northVec.x * sinTheta) * ringRadius,
      y: unitBase.y + (eastVec.y * cosTheta + northVec.y * sinTheta) * ringRadius,
      z: unitBase.z + (eastVec.z * cosTheta + northVec.z * sinTheta) * ringRadius,
    };
    const rotated = rotateVec3(ringVec, frame.orbit);
    const projected = projectVec3ToScreen(rotated, frame.viewport);
    if (step === 0) {
      ctx.moveTo(projected.screenX, projected.screenY);
    } else {
      ctx.lineTo(projected.screenX, projected.screenY);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function drawPinCalloutChip(
  ctx: CanvasRenderingContext2D,
  options: {
    readonly tipX: number;
    readonly tipY: number;
    readonly label: string;
    readonly pinColor: string;
    readonly isEmphasized: boolean;
  }
): void {
  const { tipX, tipY, label, pinColor, isEmphasized } = options;
  ctx.save();
  ctx.font = LABEL_FONT;
  const textWidth = ctx.measureText(label).width;
  const boxWidth = textWidth + 14;
  const boxHeight = 18;
  const boxX = tipX - boxWidth / 2;
  const boxY = tipY - 27;

  ctx.fillStyle = isEmphasized ? 'rgba(255, 255, 255, 0.96)' : 'rgba(255, 255, 255, 0.86)';
  ctx.strokeStyle = isEmphasized ? pinColor : 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = isEmphasized ? 1.4 : 1;

  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgb(15, 23, 42)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, tipX, boxY + boxHeight / 2 + 0.5);
  ctx.restore();
}

function drawElevatedPins3D(
  ctx: CanvasRenderingContext2D,
  frame: GlobeRenderContext
): readonly ProjectedPinHit[] {
  const projectedCandidates = frame.pins
    .map((pin, index) => {
      const unitBase = latLonToUnitVec3(pin.lat, pin.lon);
      const unitTip: Vec3 = {
        x: unitBase.x * PIN_STEM_RADIUS,
        y: unitBase.y * PIN_STEM_RADIUS,
        z: unitBase.z * PIN_STEM_RADIUS,
      };
      const rotatedBase = rotateVec3(unitBase, frame.orbit);
      const rotatedTip = rotateVec3(unitTip, frame.orbit);
      return { pin, index, unitBase, rotatedBase, rotatedTip };
    })
    .filter((entry) => entry.rotatedBase.z > PIN_VISIBILITY_THRESHOLD_Z)
    .sort((left, right) => left.rotatedBase.z - right.rotatedBase.z);

  const hits: ProjectedPinHit[] = [];

  for (const entry of projectedCandidates) {
    const { pin, index, unitBase, rotatedBase, rotatedTip } = entry;
    const baseScreen = projectVec3ToScreen(rotatedBase, frame.viewport);
    const tipScreen = projectVec3ToScreen(rotatedTip, frame.viewport);
    const pinColor = pin.color ?? DEFAULT_PIN_COLOR;
    const isEmphasized = pin.id === frame.hoveredPinId || pin.id === frame.selectedPinId;
    const depthAlpha = Math.max(0.25, Math.min(1, (rotatedBase.z + 0.18) * 1.4));

    ctx.save();
    ctx.globalAlpha = depthAlpha;

    drawForeshortenedBeacon(ctx, {
      frame,
      pin,
      unitBase,
      phaseOffset: index * 420,
    });

    // 3D normal altitude stem
    ctx.lineWidth = isEmphasized ? 2.4 : 1.7;
    ctx.strokeStyle = pinColor;
    ctx.beginPath();
    ctx.moveTo(baseScreen.screenX, baseScreen.screenY);
    ctx.lineTo(tipScreen.screenX, tipScreen.screenY);
    ctx.stroke();

    // Base anchor dot on globe surface
    ctx.fillStyle = pinColor;
    ctx.beginPath();
    ctx.arc(baseScreen.screenX, baseScreen.screenY, 2.2 * baseScreen.scale, 0, Math.PI * 2);
    ctx.fill();

    // 3D lit pin head sphere
    const beadRadius = (isEmphasized ? 6.4 : 4.8) * tipScreen.scale;
    ctx.fillStyle = pinColor;
    ctx.beginPath();
    ctx.arc(tipScreen.screenX, tipScreen.screenY, beadRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.beginPath();
    ctx.arc(
      tipScreen.screenX - beadRadius * 0.28,
      tipScreen.screenY - beadRadius * 0.28,
      beadRadius * 0.34,
      0,
      Math.PI * 2
    );
    ctx.fill();

    if (isEmphasized || rotatedBase.z > LABEL_VISIBILITY_THRESHOLD_Z) {
      drawPinCalloutChip(ctx, {
        tipX: tipScreen.screenX,
        tipY: tipScreen.screenY,
        label: pin.label,
        pinColor,
        isEmphasized,
      });
    }

    ctx.restore();

    hits.push({
      pin,
      tipX: tipScreen.screenX,
      tipY: tipScreen.screenY,
      baseX: baseScreen.screenX,
      baseY: baseScreen.screenY,
      depthZ: rotatedBase.z,
      hitRadiusPx: Math.max(HIT_RADIUS_BASE_PX, beadRadius * 3),
    });
  }

  return hits;
}

/** Render a complete 3D perspective Canvas globe frame and return front-facing hit targets. */
export function renderGlobe3DFrame(options: RenderGlobeFrameOptions): readonly ProjectedPinHit[] {
  const { ctx, widthPx, heightPx } = options;
  const minDim = Math.min(widthPx, heightPx);
  const frame: GlobeRenderContext = {
    viewport: {
      centerX: widthPx / 2,
      centerY: heightPx / 2,
      radiusPx: Math.max(40, minDim * SPHERE_FILL_RATIO),
    },
    orbit: options.orbit,
    elapsedMs: options.elapsedMs,
    pins: options.pins,
    surfaceDots: options.surfaceDots,
    selectedPinId: options.selectedPinId,
    hoveredPinId: options.hoveredPinId,
  };

  ctx.clearRect(0, 0, widthPx, heightPx);
  drawAmbientContactShadow(ctx, frame);
  drawAtmosphericHalo(ctx, frame);
  drawOrbitalRingPass(ctx, { frame, layer: 'back' });
  if (options.hasWebGLSphere) {
    drawGraticule3D(ctx, { frame, isSubtleOverlay: true });
  } else {
    drawSphereBody(ctx, frame);
    drawGraticule3D(ctx, { frame, isSubtleOverlay: false });
    drawContinentDots3D(ctx, frame);
  }
  drawGeodesicArcs3D(ctx, frame);
  const pinHits = drawElevatedPins3D(ctx, frame);
  drawOrbitalRingPass(ctx, { frame, layer: 'front' });
  return pinHits;
}
