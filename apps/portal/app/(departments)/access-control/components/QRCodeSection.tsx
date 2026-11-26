'use client';

import { QrCode } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface QRCodeSectionProps {
  readonly data: string;
  readonly size?: number;
}

const DEFAULT_QR_SIZE = 160;
const QR_MARGIN_PX = 4;
const QR_DOT_COLOR = 'oklch(0.21 0.006 285.88)';
const QR_CORNER_COLOR = 'oklch(0.49 0.19 262)';
const QR_CORNER_DOT_COLOR = 'oklch(0.39 0.17 262)';
const QR_BG_COLOR = 'oklch(1 0 0)';

export function QRCodeSection({ data, size = DEFAULT_QR_SIZE }: QRCodeSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasRenderedSvg, setHasRenderedSvg] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const node = ref.current;
    if (!node || typeof window === 'undefined') return;

    async function renderSvgQr() {
      try {
        const qrModule = await import('qr-code-styling');
        if (isCancelled || !ref.current) return;
        const QRCodeStyling = qrModule.default;
        const qr = new QRCodeStyling({
          type: 'svg',
          width: size,
          height: size,
          margin: QR_MARGIN_PX,
          data,
          dotsOptions: {
            color: QR_DOT_COLOR,
            type: 'rounded',
          },
          cornersSquareOptions: {
            color: QR_CORNER_COLOR,
            type: 'extra-rounded',
          },
          cornersDotOptions: {
            color: QR_CORNER_DOT_COLOR,
            type: 'dot',
          },
          backgroundOptions: {
            color: QR_BG_COLOR,
          },
        });
        ref.current.replaceChildren();
        qr.append(ref.current);
        setHasRenderedSvg(true);
      } catch {
        setHasRenderedSvg(false);
      }
    }

    void renderSvgQr();
    return () => {
      isCancelled = true;
    };
  }, [data, size]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-xl border border-[var(--border-default)] bg-white p-2">
        <div ref={ref} className={hasRenderedSvg ? 'block' : 'hidden'} />
        {!hasRenderedSvg && (
          <div
            style={{ width: size, height: size }}
            className="flex items-center justify-center text-[var(--accent-blue)]"
          >
            <QrCode className="h-14 w-14" />
          </div>
        )}
      </div>
      <p className="select-all font-mono text-[var(--text-muted)] text-xs">{data}</p>
    </div>
  );
}
