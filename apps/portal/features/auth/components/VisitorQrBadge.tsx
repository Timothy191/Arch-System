'use client';

import { QrCode } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const QR_RENDER_SIZE_PX = 152;
const QR_MARGIN_PX = 6;
const QR_DOT_COLOR = 'oklch(0.21 0.006 285.88)';
const QR_CORNER_COLOR = 'oklch(0.55 0.14 66)';
const QR_BG_COLOR = 'oklch(1 0 0)';

interface VisitorQrBadgeProps {
  readonly qrCode: string;
}

export function VisitorQrBadge({ qrCode }: VisitorQrBadgeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasRenderedSvg, setHasRenderedSvg] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const targetNode = containerRef.current;
    if (!targetNode || typeof window === 'undefined') {
      return;
    }

    async function mountStyledQr() {
      try {
        const qrModule = await import('qr-code-styling');
        if (isCancelled || !containerRef.current) {
          return;
        }
        const QRCodeStylingCtor = qrModule.default;
        const qrInstance = new QRCodeStylingCtor({
          type: 'svg',
          width: QR_RENDER_SIZE_PX,
          height: QR_RENDER_SIZE_PX,
          margin: QR_MARGIN_PX,
          data: qrCode,
          dotsOptions: {
            color: QR_DOT_COLOR,
            type: 'rounded',
          },
          cornersSquareOptions: {
            color: QR_CORNER_COLOR,
            type: 'extra-rounded',
          },
          cornersDotOptions: {
            color: QR_CORNER_COLOR,
            type: 'dot',
          },
          backgroundOptions: {
            color: QR_BG_COLOR,
          },
        });
        containerRef.current.replaceChildren();
        qrInstance.append(containerRef.current);
        setHasRenderedSvg(true);
      } catch {
        setHasRenderedSvg(false);
      }
    }

    void mountStyledQr();

    return () => {
      isCancelled = true;
    };
  }, [qrCode]);

  return (
    <div
      data-testid="visitor-qr-badge"
      aria-label={`Visitor QR code ${qrCode}`}
      className="flex items-center justify-center rounded-xl border border-amber-500/25 bg-white p-2.5 shadow-diffusion-sm"
    >
      <div ref={containerRef} className={hasRenderedSvg ? 'block' : 'hidden'} />
      {!hasRenderedSvg && (
        <div className="flex h-[152px] w-[152px] items-center justify-center text-amber-700">
          <QrCode className="h-16 w-16" />
        </div>
      )}
    </div>
  );
}
