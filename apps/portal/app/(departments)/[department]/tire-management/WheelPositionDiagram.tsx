'use client';

/* cspell:ignore Tyre */

import { cn } from '@repo/ui/lib/utils';
import { resolveVehicleLayout, TIRE_POSITIONS, type VehicleLayoutKey } from './tire-constants';

export interface WheelPositionDiagramProps {
  readonly layout?: VehicleLayoutKey;
  readonly machineType?: string | null;
  readonly value: string;
  readonly onChange: (position: string) => void;
  readonly className?: string;
}

const WHEEL_WIDTH = 40;
const WHEEL_HEIGHT = 48;

const TOP_WHEELS: Readonly<
  Record<(typeof TIRE_POSITIONS)[number], { x: number; y: number; glyph: string }>
> = {
  'Front Left': { x: 36, y: 54, glyph: 'FL' },
  'Front Right': { x: 204, y: 54, glyph: 'FR' },
  'Rear Inner Left': { x: 64, y: 190, glyph: 'IL' },
  'Rear Outer Left': { x: 8, y: 190, glyph: 'OL' },
  'Rear Inner Right': { x: 176, y: 190, glyph: 'IR' },
  'Rear Outer Right': { x: 232, y: 190, glyph: 'OR' },
};

const SIDE_WHEELS: Readonly<Record<VehicleLayoutKey, readonly number[]>> = {
  ADT: [58, 196, 236, 276],
  RDT: [58, 196, 224, 252],
  Grader: [46, 72, 190, 214, 246, 270],
  Compactor: [58, 196, 224, 252],
};

const LAYOUT_COPY: Readonly<Record<VehicleLayoutKey, { title: string; detail: string }>> = {
  ADT: {
    title: 'ADT · Articulated Dump Truck',
    detail: '2 front tyres · 4 rear tyres in dual pairs, spaced apart in side view',
  },
  RDT: {
    title: 'RDT · Rigid Dump Truck',
    detail: '2 front tyres · 4 rear tyres in dual pairs, adjacent in side view',
  },
  Grader: {
    title: 'Grader · Motor Grader',
    detail: '2 front tyres · 4 rear tyres in tandem pairs, all six visible in side view',
  },
  Compactor: {
    title: 'Compactor · Roller Compactor',
    detail: '2 front wheels · 4 rear wheels, tyre elements omitted in both views',
  },
};

export function WheelPositionDiagram({
  layout,
  machineType,
  value,
  onChange,
  className,
}: WheelPositionDiagramProps) {
  const resolvedLayout = layout || resolveVehicleLayout({ machine_type: machineType });
  const highlightFront = value.startsWith('Front');
  const highlightRear = value.startsWith('Rear');
  const sideWheels = SIDE_WHEELS[resolvedLayout] ?? SIDE_WHEELS.RDT;
  const copy = LAYOUT_COPY[resolvedLayout] ?? LAYOUT_COPY.RDT;
  const isCompactor = resolvedLayout === 'Compactor';

  const handleKeyDown = (event: React.KeyboardEvent<SVGGElement>, position: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onChange(position);
    }
  };

  return (
    <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', className)}>
      <figure
        className={cn(
          'gold-steel-border gold-steel-border-slim rounded-xl border border-[var(--border-default)] bg-white p-3',
          className
        )}
      >
        <figcaption className="mb-2 font-semibold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">
          Plan view · select a wheel
        </figcaption>
        <svg
          viewBox="0 0 280 300"
          role="group"
          aria-label="Vehicle wheel position plan view"
          className="mx-auto h-64 w-auto"
        >
          <text
            x="140"
            y="24"
            textAnchor="middle"
            className="fill-[var(--text-muted)] font-semibold text-[11px]"
          >
            FRONT
          </text>
          <rect
            x="48"
            y="78"
            width="184"
            height="12"
            rx="3"
            className="fill-[var(--text-muted)]/40"
          />
          <rect
            x="20"
            y="214"
            width="240"
            height="12"
            rx="3"
            className="fill-[var(--text-muted)]/40"
          />
          <rect
            x="132"
            y="84"
            width="16"
            height="136"
            rx="6"
            className="fill-[var(--text-muted)]/25"
          />
          {TIRE_POSITIONS.map((position) => {
            const wheel = TOP_WHEELS[position];
            const isSelected = value === position;
            // Compactor renders plain wheel outlines with no tyre tread detailing
            return (
              <g
                key={position}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Select ${position} wheel position`}
                onClick={() => onChange(position)}
                onKeyDown={(event) => handleKeyDown(event, position)}
                className="cursor-pointer focus-visible:outline-none"
              >
                <rect
                  x={wheel.x}
                  y={wheel.y}
                  width={WHEEL_WIDTH}
                  height={WHEEL_HEIGHT}
                  rx="7"
                  className={cn(
                    'stroke-2 transition-colors',
                    isCompactor
                      ? isSelected
                        ? 'fill-[var(--accent-gold)] stroke-[var(--accent-gold-hover)]'
                        : 'fill-white stroke-[var(--accent-gold)]/60 hover:fill-[var(--bg-secondary)]'
                      : isSelected
                        ? 'fill-red-600 stroke-red-700'
                        : 'fill-[var(--text-heading)] stroke-[var(--text-secondary)] hover:fill-[var(--text-secondary)]'
                  )}
                />
                <text
                  x={wheel.x + WHEEL_WIDTH / 2}
                  y={wheel.y + WHEEL_HEIGHT / 2 + 4}
                  textAnchor="middle"
                  className={cn(
                    'pointer-events-none font-semibold text-[11px]',
                    isCompactor ? 'fill-[var(--text-heading)]' : 'fill-white'
                  )}
                >
                  {wheel.glyph}
                </text>
              </g>
            );
          })}
          <text
            x="140"
            y="286"
            textAnchor="middle"
            className="fill-[var(--text-muted)] font-semibold text-[11px]"
          >
            REAR
          </text>
        </svg>
      </figure>

      <figure
        className={cn(
          'gold-steel-border gold-steel-border-slim rounded-xl border border-[var(--border-default)] bg-white p-3',
          className
        )}
      >
        <figcaption className="mb-2 font-semibold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">
          Side view · {resolvedLayout}
        </figcaption>
        <svg
          viewBox="0 0 320 120"
          role="img"
          aria-label={`${copy.title} side view suspension and wheel layout`}
          className="mx-auto h-40 w-full"
        >
          <rect
            x="18"
            y="62"
            width="284"
            height="12"
            rx="3"
            className="fill-[var(--text-muted)]/40"
          />
          {sideWheels.map((cx, index) => {
            const isFrontAxle = resolvedLayout === 'Grader' ? index < 2 : index === 0;
            const isHighlighted = isFrontAxle ? highlightFront : highlightRear;
            return (
              <g key={`${resolvedLayout}-side-${cx}`}>
                <circle
                  cx={cx}
                  cy="86"
                  r="16"
                  className={cn(
                    'stroke-2 transition-colors',
                    isCompactor
                      ? isHighlighted
                        ? 'fill-[var(--accent-gold)] stroke-[var(--accent-gold-hover)]'
                        : 'fill-white stroke-[var(--accent-gold)]/60'
                      : isHighlighted
                        ? 'fill-red-600 stroke-red-700'
                        : 'fill-[var(--text-heading)] stroke-[var(--text-secondary)]'
                  )}
                />
                <circle cx={cx} cy="86" r="6" className="fill-[var(--bg-secondary)]" />
              </g>
            );
          })}
          <text x="18" y="114" className="fill-[var(--text-muted)] text-[10px]">
            Suspension bars span front and rear axle groups
          </text>
        </svg>
        <p className="mt-2 text-[11px] text-[var(--text-muted)] leading-relaxed">{copy.detail}</p>
      </figure>
    </div>
  );
}
