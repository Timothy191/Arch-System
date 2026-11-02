import { ImageResponse } from 'next/og';

/**
 * Route-level Open Graph card for the whole portal.
 *
 * Why this exists despite `robots: { index: false }`: operators share links into
 * WhatsApp / Slack / Teams (`SplitWindowWhatsAppView`), and a missing OG card
 * renders as a bare, unattributed URL. No file is fetched at request time — Next
 * prerenders this at build, so it costs nothing per-hit.
 *
 * Styling is restricted to the flexbox subset Satori supports: no CSS variables,
 * no Tailwind classes, every multi-child container needs an explicit `display`.
 */
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const PANEL_PADDING_PX = 64;
const CANVAS_COLOR = '#f3f4f6';
const PANEL_COLOR = '#ffffff';
const BORDER_COLOR = 'rgba(17, 24, 39, 0.08)';
const INK_COLOR = '#111827';
const MUTED_COLOR = '#4b5563';
const ACCENT_COLOR = '#b45309';

const MODULES = [
  'Control Room',
  'Drilling',
  'Production',
  'Engineering',
  'Access Control',
  'Database',
];

export const alt = 'Arch-Systems — Arch OS industrial operations portal';
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = 'image/png';

export default function OpengraphImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        background: CANVAS_COLOR,
        padding: PANEL_PADDING_PX,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: PANEL_COLOR,
          border: `1px solid ${BORDER_COLOR}`,
          borderRadius: 28,
          padding: PANEL_PADDING_PX,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                width: 44,
                height: 44,
                borderRadius: 12,
                background: ACCENT_COLOR,
              }}
            />
            <div
              style={{
                display: 'flex',
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: 6,
                color: INK_COLOR,
              }}
            >
              ARCH OS
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: MUTED_COLOR }}>
            Industrial Operations
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 56,
            gap: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 66,
              fontWeight: 700,
              lineHeight: 1.1,
              color: INK_COLOR,
            }}
          >
            Arch-Systems
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              lineHeight: 1.35,
              color: MUTED_COLOR,
              maxWidth: 880,
            }}
          >
            Multi-departmental mining operations portal — SCADA telemetry, shift closeout, and fleet
            availability in one audited surface.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            marginTop: 'auto',
            gap: 12,
          }}
        >
          {MODULES.map((module) => (
            <div
              key={module}
              style={{
                display: 'flex',
                padding: '10px 20px',
                borderRadius: 999,
                border: `1px solid ${BORDER_COLOR}`,
                background: CANVAS_COLOR,
                fontSize: 20,
                color: MUTED_COLOR,
              }}
            >
              {module}
            </div>
          ))}
        </div>
      </div>
    </div>,
    { ...size }
  );
}
