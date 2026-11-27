/** Chart styling tokens — CSS variables only (light-mode semantic palette). */

export const CHART_COLORS = {
  coal: 'var(--accent-green)',
  waste: 'var(--accent-blue)',
  total: 'var(--accent-indigo)',
  drift: 'var(--accent-amber)',
  fuel: 'var(--accent-amber)',
  hours: 'var(--accent-indigo)',
  efficiency: 'var(--accent-violet)',
  alert: 'var(--accent-red)',
  active: 'var(--accent-green)',
  standby: 'var(--text-muted)',
  muted: 'var(--text-muted)',
  grid: 'var(--border-default)',
  gridSubtle: 'var(--border-subtle)',
} as const;

const SERIES_PALETTE = [
  'var(--accent-blue)',
  'var(--accent-green)',
  'var(--accent-amber)',
  'var(--accent-indigo)',
  'var(--accent-violet)',
  'var(--accent-cyan)',
  'var(--accent-red)',
  'var(--text-muted)',
] as const;

const AXIS_FONT_SIZE = 11;
const TOOLTIP_FONT_SIZE = 12;
const TOOLTIP_RADIUS = 8;

export const CHART_HEIGHT = 260;
export const DONUT_HEIGHT = 220;
export const CHART_MARGIN = { top: 8, right: 12, bottom: 0, left: 0 } as const;
export const AXIS_TICK = { fill: 'var(--text-muted)', fontSize: AXIS_FONT_SIZE } as const;
export const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: TOOLTIP_RADIUS,
  fontSize: TOOLTIP_FONT_SIZE,
  color: 'var(--text-primary)',
  boxShadow: 'var(--shadow-diffusion-sm)',
  padding: '8px 10px',
} as const;
export const TOOLTIP_LABEL_STYLE = {
  color: 'var(--text-secondary)',
  fontSize: TOOLTIP_FONT_SIZE - 1,
  marginBottom: 2,
} as const;
export const TOOLTIP_ITEM_STYLE = { fontSize: TOOLTIP_FONT_SIZE } as const;
export const TOOLTIP_CURSOR_LINE = {
  stroke: 'var(--border-subtle)',
  strokeWidth: 1.5,
} as const;
export const TOOLTIP_CURSOR_BAR = {
  fill: 'var(--border-subtle)',
  fillOpacity: 0.35,
} as const;

export function paletteColor(index: number): string {
  return SERIES_PALETTE[index % SERIES_PALETTE.length] ?? CHART_COLORS.muted;
}
