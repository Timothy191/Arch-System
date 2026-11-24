'use client';

import { useEffect, useState } from 'react';

interface GlobePin {
  id: string;
  label: string;
  lat: number;
  lon: number;
  color?: string;
}

const DEFAULT_PINS: GlobePin[] = [
  { id: 'pit-viper-351', label: 'Pit Viper 351', lat: -22.9, lon: 14.2, color: '#d4af37' },
  { id: 'dispatch-room', label: 'Dispatch Room', lat: -33.9, lon: 18.4, color: '#007aff' },
  { id: 'wash-plant-01', label: 'Wash Plant 01', lat: -31.9, lon: 115.8, color: '#10b981' },
  { id: 'fleet-av-01', label: 'Fleet AV 01', lat: -37.8, lon: 175.2, color: '#34d399' },
  { id: 'db-core', label: 'DB Core', lat: 40.7, lon: -74.0, color: '#3b82f6' },
];

// Orthographic projection: sphere radius R, lat/lon -> screen x/y
function project(latDeg: number, lonDeg: number, centerLonDeg: number, R: number) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = ((lonDeg - centerLonDeg) * Math.PI) / 180;
  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const cosLon = Math.cos(lon);
  const sinLon = Math.sin(lon);

  const x = R * cosLat * sinLon;
  const y = R * sinLat;

  // backface culling: point is on far side if cosLat * cos(lon) < 0
  const visible = cosLat * cosLon > 0;
  return { x, y, visible, depth: cosLat * cosLon };
}

export function GlobePins({
  pins = DEFAULT_PINS,
  className,
}: {
  pins?: GlobePin[];
  className?: string;
}) {
  const [rot, setRot] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  // Slow auto-rotation of center longitude
  useEffect(() => {
    const id = setInterval(() => setRot((r) => (r + 1) % 360), 120);
    return () => clearInterval(id);
  }, []);

  const centerLon = rot;

  const svgWidth = 400;
  const svgHeight = 220;
  const R = 95; // globe radius in px
  const cx = svgWidth / 2;
  const cy = svgHeight / 2;

  const projected = pins.map((pin) => {
    const p = project(pin.lat, pin.lon, centerLon, R);
    const screenX = cx + p.x;
    const screenY = cy + p.y;
    return {
      ...pin,
      x: p.x,
      y: p.y,
      visible: p.visible,
      depth: p.depth,
      screenX,
      screenY,
    };
  });

  // Sort pins by depth so far pins render behind near pins
  const ordered = [...projected].sort((a, b) => b.depth - a.depth);

  // Graticule lines (meridians & parallels) for globe look
  const meridians = [-120, -60, 0, 60, 120].map((lon) => {
    const pts: number[] = [];
    for (let lat = -80; lat <= 80; lat += 5) {
      const p = project(lat, lon, centerLon, R * 0.98);
      if (p.visible) pts.push(cx + p.x, cy + p.y);
    }
    return pts.join(',');
  });

  const parallels = [-60, -30, 0, 30, 60].map((lat) => {
    const pts: number[] = [];
    for (let lon = -170; lon <= 170; lon += 5) {
      const p = project(lat, lon, centerLon, R * 0.98);
      if (p.visible) pts.push(cx + p.x, cy + p.y);
    }
    return pts.join(',');
  });

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-anurati font-bold text-[var(--text-heading)] text-sm tracking-[0.05em]">
            Active Site Pins
          </span>
          <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
            5 operational sites
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent-green" aria-hidden="true" />
          <span className="text-[11px] text-[var(--text-secondary)]">All sites online</span>
        </div>
      </div>
      <div className="relative mt-3 h-[220px] w-full overflow-hidden rounded-full border border-white/30 bg-[var(--bg-secondary)] shadow-lg">
        <svg
          width={svgWidth}
          height={svgHeight}
          className="block"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          aria-label="Operations globe"
          role="img"
        >
          <defs>
            <radialGradient id="globeGrad" cx="35%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="40%" stopColor="#e5e7eb" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#9ca3af" stopOpacity="0.1" />
            </radialGradient>
          </defs>

          {/* Globe disk */}
          <circle
            cx={cx}
            cy={cy}
            r={R}
            fill="url(#globeGrad)"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1.5"
          />

          {/* Graticule */}
          {meridians.map((pts, i) => (
            <polyline
              key={`mer-${i}`}
              points={pts}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="0.5"
            />
          ))}
          {parallels.map((pts, i) => (
            <polyline
              key={`par-${i}`}
              points={pts}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="0.5"
            />
          ))}

          {/* Pins — far-to-near */}
          {ordered.map((pin) => {
            if (!pin.visible) return null;
            const isHovered = hovered === pin.id;
            const scale = isHovered ? 1.35 : 1;
            return (
              <g
                key={pin.id}
                onMouseEnter={() => setHovered(pin.id)}
                onMouseLeave={() => setHovered(null)}
                cursor="pointer"
                transform={`translate(${pin.screenX} ${pin.screenY}) scale(${scale})`}
              >
                <circle r={6} fill={pin.color ?? '#d4af37'} opacity={0.9} />
                <circle r={2.5} fill="#ffffff" />
                <text
                  x={0}
                  y={-10}
                  textAnchor="middle"
                  fontSize={9}
                  fontFamily="var(--font-sans), sans-serif"
                  fontWeight="600"
                  fill={pin.color ?? '#d4af37'}
                  opacity={isHovered ? 1 : 0.6}
                  pointerEvents="none"
                >
                  {pin.label}
                </text>
              </g>
            );
          })}

          {/* Rim glow */}
          <circle
            cx={cx}
            cy={cy}
            r={R}
            fill="none"
            stroke="rgba(212,175,55,0.35)"
            strokeWidth="2"
          />
        </svg>
      </div>
    </div>
  );
}
