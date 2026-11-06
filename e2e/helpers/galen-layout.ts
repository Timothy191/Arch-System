import { expect, type Locator } from '@playwright/test';

/**
 * Spatial bounding box in CSS pixels (`galenframework/galen` coordinate model).
 */
export interface SpatialRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface GapRangeOptions {
  readonly minGapPx?: number;
  readonly maxGapPx?: number;
}

export interface AlignmentOptions {
  readonly tolerancePx?: number;
  readonly edge?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export interface SpatialEvaluationResult {
  readonly passed: boolean;
  readonly measuredPx: number;
  readonly diagnosticMessage: string;
}

const DEFAULT_MIN_GAP_PX = 0;
const DEFAULT_ALIGNMENT_TOLERANCE_PX = 2;
const CENTER_DIVISOR = 2;

function rightEdge(rect: Readonly<SpatialRect>): number {
  return rect.x + rect.width;
}

function bottomEdge(rect: Readonly<SpatialRect>): number {
  return rect.y + rect.height;
}

function isWithinGapBounds(gapPx: number, options?: Readonly<GapRangeOptions>): boolean {
  const minGapPx = options?.minGapPx ?? DEFAULT_MIN_GAP_PX;
  if (gapPx < minGapPx) {
    return false;
  }
  if (options?.maxGapPx !== undefined && gapPx > options.maxGapPx) {
    return false;
  }
  return true;
}

/**
 * Verifies `subjectRect` is positioned strictly above `referenceRect` (`galen` `above` spec).
 */
export function evaluateAbove(
  subjectRect: Readonly<SpatialRect>,
  referenceOpts: Readonly<{ target: SpatialRect; gap?: GapRangeOptions }>
): SpatialEvaluationResult {
  const gapPx = referenceOpts.target.y - bottomEdge(subjectRect);
  const passed = isWithinGapBounds(gapPx, referenceOpts.gap);
  return {
    passed,
    measuredPx: gapPx,
    diagnosticMessage: passed
      ? `Element is above target by ${gapPx}px`
      : `Expected element to be above target (gap=${gapPx}px, min=${referenceOpts.gap?.minGapPx ?? DEFAULT_MIN_GAP_PX}px, max=${referenceOpts.gap?.maxGapPx ?? '∞'}px)`,
  };
}

/**
 * Verifies `subjectRect` is positioned strictly below `referenceRect` (`galen` `below` spec).
 */
export function evaluateBelow(
  subjectRect: Readonly<SpatialRect>,
  referenceOpts: Readonly<{ target: SpatialRect; gap?: GapRangeOptions }>
): SpatialEvaluationResult {
  const gapPx = subjectRect.y - bottomEdge(referenceOpts.target);
  const passed = isWithinGapBounds(gapPx, referenceOpts.gap);
  return {
    passed,
    measuredPx: gapPx,
    diagnosticMessage: passed
      ? `Element is below target by ${gapPx}px`
      : `Expected element to be below target (gap=${gapPx}px)`,
  };
}

/**
 * Verifies `subjectRect` is positioned strictly left of `referenceRect` (`galen` `left-of` spec).
 */
export function evaluateLeftOf(
  subjectRect: Readonly<SpatialRect>,
  referenceOpts: Readonly<{ target: SpatialRect; gap?: GapRangeOptions }>
): SpatialEvaluationResult {
  const gapPx = referenceOpts.target.x - rightEdge(subjectRect);
  const passed = isWithinGapBounds(gapPx, referenceOpts.gap);
  return {
    passed,
    measuredPx: gapPx,
    diagnosticMessage: passed
      ? `Element is left of target by ${gapPx}px`
      : `Expected element to be left of target (gap=${gapPx}px)`,
  };
}

/**
 * Verifies `subjectRect` is positioned strictly right of `referenceRect` (`galen` `right-of` spec).
 */
export function evaluateRightOf(
  subjectRect: Readonly<SpatialRect>,
  referenceOpts: Readonly<{ target: SpatialRect; gap?: GapRangeOptions }>
): SpatialEvaluationResult {
  const gapPx = subjectRect.x - rightEdge(referenceOpts.target);
  const passed = isWithinGapBounds(gapPx, referenceOpts.gap);
  return {
    passed,
    measuredPx: gapPx,
    diagnosticMessage: passed
      ? `Element is right of target by ${gapPx}px`
      : `Expected element to be right of target (gap=${gapPx}px)`,
  };
}

/**
 * Verifies `subjectRect` is completely contained inside `containerRect` (`galen` `inside` spec).
 */
export function evaluateInside(
  subjectRect: Readonly<SpatialRect>,
  containerRect: Readonly<SpatialRect>
): SpatialEvaluationResult {
  const isLeftInside = subjectRect.x >= containerRect.x;
  const isTopInside = subjectRect.y >= containerRect.y;
  const isRightInside = rightEdge(subjectRect) <= rightEdge(containerRect);
  const isBottomInside = bottomEdge(subjectRect) <= bottomEdge(containerRect);
  const passed = isLeftInside && isTopInside && isRightInside && isBottomInside;

  return {
    passed,
    measuredPx: Math.min(
      subjectRect.x - containerRect.x,
      subjectRect.y - containerRect.y,
      rightEdge(containerRect) - rightEdge(subjectRect),
      bottomEdge(containerRect) - bottomEdge(subjectRect)
    ),
    diagnosticMessage: passed
      ? 'Element is fully inside container bounds'
      : 'Element overflows container bounds',
  };
}

/**
 * Verifies two rects share horizontal alignment (`top`, `bottom`, or vertical `center`).
 */
export function evaluateAlignedHorizontally(
  subjectRect: Readonly<SpatialRect>,
  referenceOpts: Readonly<{ target: SpatialRect; alignment?: AlignmentOptions }>
): SpatialEvaluationResult {
  const tolerancePx = referenceOpts.alignment?.tolerancePx ?? DEFAULT_ALIGNMENT_TOLERANCE_PX;
  const edgeMode = referenceOpts.alignment?.edge ?? 'top';

  const anchorMap: Record<string, number> = {
    top: Math.abs(subjectRect.y - referenceOpts.target.y),
    bottom: Math.abs(bottomEdge(subjectRect) - bottomEdge(referenceOpts.target)),
    center: Math.abs(
      subjectRect.y +
        subjectRect.height / CENTER_DIVISOR -
        (referenceOpts.target.y + referenceOpts.target.height / CENTER_DIVISOR)
    ),
  };

  const deltaPx = anchorMap[edgeMode] ?? anchorMap.top ?? 0;
  const passed = deltaPx <= tolerancePx;

  return {
    passed,
    measuredPx: deltaPx,
    diagnosticMessage: passed
      ? `Horizontally aligned (${edgeMode}) within ${deltaPx}px`
      : `Horizontal alignment drift (${edgeMode}): ${deltaPx}px exceeds tolerance ${tolerancePx}px`,
  };
}

/**
 * Verifies two rects share vertical alignment (`left`, `right`, or horizontal `center`).
 */
export function evaluateAlignedVertically(
  subjectRect: Readonly<SpatialRect>,
  referenceOpts: Readonly<{ target: SpatialRect; alignment?: AlignmentOptions }>
): SpatialEvaluationResult {
  const tolerancePx = referenceOpts.alignment?.tolerancePx ?? DEFAULT_ALIGNMENT_TOLERANCE_PX;
  const edgeMode = referenceOpts.alignment?.edge ?? 'left';

  const anchorMap: Record<string, number> = {
    left: Math.abs(subjectRect.x - referenceOpts.target.x),
    right: Math.abs(rightEdge(subjectRect) - rightEdge(referenceOpts.target)),
    center: Math.abs(
      subjectRect.x +
        subjectRect.width / CENTER_DIVISOR -
        (referenceOpts.target.x + referenceOpts.target.width / CENTER_DIVISOR)
    ),
  };

  const deltaPx = anchorMap[edgeMode] ?? anchorMap.left ?? 0;
  const passed = deltaPx <= tolerancePx;

  return {
    passed,
    measuredPx: deltaPx,
    diagnosticMessage: passed
      ? `Vertically aligned (${edgeMode}) within ${deltaPx}px`
      : `Vertical alignment drift (${edgeMode}): ${deltaPx}px exceeds tolerance ${tolerancePx}px`,
  };
}

/**
 * Verifies two rects do not intersect (`galen` overlap check).
 */
export function evaluateNoOverlap(
  subjectRect: Readonly<SpatialRect>,
  targetRect: Readonly<SpatialRect>
): SpatialEvaluationResult {
  const isSeparatedHorizontally =
    rightEdge(subjectRect) <= targetRect.x || rightEdge(targetRect) <= subjectRect.x;
  const isSeparatedVertically =
    bottomEdge(subjectRect) <= targetRect.y || bottomEdge(targetRect) <= subjectRect.y;
  const passed = isSeparatedHorizontally || isSeparatedVertically;

  return {
    passed,
    measuredPx: passed ? 0 : 1,
    diagnosticMessage: passed
      ? 'Elements do not overlap'
      : 'Bounding boxes collide/overlap on screen',
  };
}

async function resolveBoundingBox(locator: Locator): Promise<SpatialRect> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Galen layout check failed: target locator has no visible boundingBox');
  }
  return box;
}

/**
 * Playwright fluent spatial assertion wrapper distilled from `galenframework/galen`.
 */
export function expectGalenLayout(subjectLocator: Locator) {
  return {
    async toBeAbove(targetLocator: Locator, gap?: Readonly<GapRangeOptions>): Promise<void> {
      const [subjectRect, targetRect] = await Promise.all([
        resolveBoundingBox(subjectLocator),
        resolveBoundingBox(targetLocator),
      ]);
      const evaluation = evaluateAbove(subjectRect, { target: targetRect, gap });
      expect(evaluation.passed, evaluation.diagnosticMessage).toBe(true);
    },
    async toBeBelow(targetLocator: Locator, gap?: Readonly<GapRangeOptions>): Promise<void> {
      const [subjectRect, targetRect] = await Promise.all([
        resolveBoundingBox(subjectLocator),
        resolveBoundingBox(targetLocator),
      ]);
      const evaluation = evaluateBelow(subjectRect, { target: targetRect, gap });
      expect(evaluation.passed, evaluation.diagnosticMessage).toBe(true);
    },
    async toBeLeftOf(targetLocator: Locator, gap?: Readonly<GapRangeOptions>): Promise<void> {
      const [subjectRect, targetRect] = await Promise.all([
        resolveBoundingBox(subjectLocator),
        resolveBoundingBox(targetLocator),
      ]);
      const evaluation = evaluateLeftOf(subjectRect, { target: targetRect, gap });
      expect(evaluation.passed, evaluation.diagnosticMessage).toBe(true);
    },
    async toBeRightOf(targetLocator: Locator, gap?: Readonly<GapRangeOptions>): Promise<void> {
      const [subjectRect, targetRect] = await Promise.all([
        resolveBoundingBox(subjectLocator),
        resolveBoundingBox(targetLocator),
      ]);
      const evaluation = evaluateRightOf(subjectRect, { target: targetRect, gap });
      expect(evaluation.passed, evaluation.diagnosticMessage).toBe(true);
    },
    async toBeInside(containerLocator: Locator): Promise<void> {
      const [subjectRect, containerRect] = await Promise.all([
        resolveBoundingBox(subjectLocator),
        resolveBoundingBox(containerLocator),
      ]);
      const evaluation = evaluateInside(subjectRect, containerRect);
      expect(evaluation.passed, evaluation.diagnosticMessage).toBe(true);
    },
    async toBeAlignedHorizontallyWith(
      targetLocator: Locator,
      alignment?: Readonly<AlignmentOptions>
    ): Promise<void> {
      const [subjectRect, targetRect] = await Promise.all([
        resolveBoundingBox(subjectLocator),
        resolveBoundingBox(targetLocator),
      ]);
      const evaluation = evaluateAlignedHorizontally(subjectRect, {
        target: targetRect,
        alignment,
      });
      expect(evaluation.passed, evaluation.diagnosticMessage).toBe(true);
    },
    async toBeAlignedVerticallyWith(
      targetLocator: Locator,
      alignment?: Readonly<AlignmentOptions>
    ): Promise<void> {
      const [subjectRect, targetRect] = await Promise.all([
        resolveBoundingBox(subjectLocator),
        resolveBoundingBox(targetLocator),
      ]);
      const evaluation = evaluateAlignedVertically(subjectRect, {
        target: targetRect,
        alignment,
      });
      expect(evaluation.passed, evaluation.diagnosticMessage).toBe(true);
    },
    async toNotOverlapWith(targetLocator: Locator): Promise<void> {
      const [subjectRect, targetRect] = await Promise.all([
        resolveBoundingBox(subjectLocator),
        resolveBoundingBox(targetLocator),
      ]);
      const evaluation = evaluateNoOverlap(subjectRect, targetRect);
      expect(evaluation.passed, evaluation.diagnosticMessage).toBe(true);
    },
  };
}

export type MiningViewportProfileId =
  | 'field-mobile'
  | 'pit-tablet-portrait'
  | 'pit-tablet-landscape'
  | 'control-room-wall';

export interface ResponsivelyViewportProfile {
  readonly profileId: MiningViewportProfileId;
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

const VIEWPORT_MOBILE_W = 390;
const VIEWPORT_MOBILE_H = 844;
const VIEWPORT_TABLET_PORTRAIT_W = 768;
const VIEWPORT_TABLET_PORTRAIT_H = 1024;
const VIEWPORT_TABLET_LANDSCAPE_W = 1024;
const VIEWPORT_TABLET_LANDSCAPE_H = 768;
const VIEWPORT_WALL_W = 1920;
const VIEWPORT_WALL_H = 1080;

/**
 * Canonical industrial multi-viewport matrix distilled from `responsively-org/responsively-app`.
 */
export const RESPONSIVELY_MINING_VIEWPORTS: readonly ResponsivelyViewportProfile[] = [
  {
    profileId: 'field-mobile',
    label: 'Field Operator Handset (390×844)',
    width: VIEWPORT_MOBILE_W,
    height: VIEWPORT_MOBILE_H,
  },
  {
    profileId: 'pit-tablet-portrait',
    label: 'Pit Rugged Tablet Portrait (768×1024)',
    width: VIEWPORT_TABLET_PORTRAIT_W,
    height: VIEWPORT_TABLET_PORTRAIT_H,
  },
  {
    profileId: 'pit-tablet-landscape',
    label: 'Pit Rugged Tablet Landscape (1024×768)',
    width: VIEWPORT_TABLET_LANDSCAPE_W,
    height: VIEWPORT_TABLET_LANDSCAPE_H,
  },
  {
    profileId: 'control-room-wall',
    label: 'Control Room SCADA Wall (1920×1080)',
    width: VIEWPORT_WALL_W,
    height: VIEWPORT_WALL_H,
  },
];
