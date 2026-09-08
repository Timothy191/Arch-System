import type { JSX } from "react";

export type AriaState = "idle" | "thinking" | "speaking" | "happy" | "error";

interface AriaAvatarProps {
  state?: AriaState;
  className?: string;
}

const SKIN = "#f5cfae";
const SKIN_SHADOW = "#e8b78e";
const HAIR = "#2a3550";
const HAIR_DARK = "#1d2740";
const EYE = "#c97b2d";
const BLAZER = "#1f3a93";
const BLAZER_DARK = "#172d74";
const BLOUSE = "#ffffff";
const SKIRT = "#1d3468";
const VEST = "#c6f126";
const VEST_DARK = "#a8d41f";
const REFLECT = "#e6e6e6";
const REFLECT_EDGE = "#b9b9b9";
const BLUSH = "rgba(239, 130, 150, 0.35)";
const HELMET = "#f5f5f5";
const HELMET_ORANGE = "#e8590c";

/**
 * Aria — original character. Code-drawn SVG chibi in business attire with a
 * high-visibility safety reflector vest (two silver bands). Charcoal-navy bob
 * with low ponytail. States: idle / thinking / speaking / happy / error.
 * Happy state adds a white-and-orange hard hat.
 * AGENT-TRACE: ported from the aria-overlay sidecar so the portal can render
 * the character as an overlay on top of the page (see AriaLauncher). The
 * float/blink/think animations live in packages/ui globals.css.
 */
export function AriaAvatar({ state = "idle", className }: AriaAvatarProps): JSX.Element {
  const shellClass =
    state === "idle" || state === "happy"
      ? "aria-float"
      : state === "thinking"
        ? "aria-think-bounce"
        : "aria-float-slow";

  const eyes = state === "thinking" ? { cx: "5.5", cy: "3" } : { cx: "1", cy: "4.5" };
  const browTilt = state === "error" ? "rotate(10 44 40)" : "rotate(0 44 40)";

  return (
    <svg
      viewBox="0 0 120 160"
      role="img"
      aria-label="Aria, the operations assistant"
      className={className}
    >
      <g className={shellClass}>
        {/* Soft drop shadow */}
        <ellipse cx="60" cy="154" rx="30" ry="4" fill="rgba(0,0,0,0.10)" />

        {/* Pony tail */}
        <path d="M 78 58 q 14 4 12 18 q -3 10 -12 8 q -8 -6 -4 -14 z" fill={HAIR_DARK} />

        {/* Hair back + bob */}
        <path
          d="M 38 40 Q 33 16 52 12 Q 70 8 80 26 Q 90 40 84 62 Q 81 72 74 74 Q 60 72 44 66 Q 36 58 38 40 Z"
          fill={HAIR}
        />
        {/* Side swept fringe */}
        <path
          d="M 36 34 Q 40 18 58 16 Q 78 15 84 34 Q 78 30 66 30 Q 50 30 44 40 Q 40 36 36 34 Z"
          fill={HAIR_DARK}
        />
        <path d="M 42 34 Q 52 26 66 30 Q 56 40 46 42 Q 43 38 42 34 Z" fill="#3a4866" />

        {/* Face */}
        <ellipse cx="60" cy="46" rx="23" ry="25" fill={SKIN} />
        <path
          d="M 37 44 Q 38 66 60 70 Q 82 66 83 44 Q 84 62 60 72 Q 36 62 37 44 Z"
          fill={SKIN_SHADOW}
          opacity="0.4"
        />

        {/* Blush */}
        <ellipse cx="47" cy="58" rx="4.5" ry="2.5" fill={BLUSH} />
        <ellipse cx="73" cy="58" rx="4.5" ry="2.5" fill={BLUSH} />

        {/* Brows */}
        <g transform={browTilt} opacity={state === "error" ? 1 : undefined}>
          <path
            d="M 42 40 Q 47 37 52 39"
            stroke={HAIR_DARK}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 68 39 Q 73 37 78 40"
            stroke={HAIR_DARK}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </g>

        {/* Eyes */}
        <g className="aria-blink">
          <ellipse cx={48 + Number(eyes.cx)} cy={Number(eyes.cy) + 47} rx="4.2" ry="5" fill={EYE} />
          <ellipse cx={72 + Number(eyes.cx)} cy={Number(eyes.cy) + 47} rx="4.2" ry="5" fill={EYE} />
        </g>
        <circle cx="50" cy="50" r="1.4" fill="#fff" />
        <circle cx="74" cy="50" r="1.4" fill="#fff" />

        {/* Mouth */}
        {state === "speaking" ? (
          <ellipse cx="60" cy="60" rx="5" ry="4" fill={HAIR_DARK} />
        ) : state === "happy" ? (
          <path
            d="M 52 58 Q 60 67 68 58"
            stroke={HAIR_DARK}
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
        ) : state === "error" ? (
          <path
            d="M 56 60 Q 60 58 64 60"
            stroke={HAIR_DARK}
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M 55 59 Q 60 63 65 59"
            stroke={HAIR_DARK}
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* Ear detail */}
        <path
          d="M 37 46 q -2.5 6 0 10"
          stroke={SKIN_SHADOW}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 83 46 q 2.5 6 0 10"
          stroke={SKIN_SHADOW}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Body: blouse + blazer */}
        <path d="M 44 70 Q 40 92 42 104 L 78 104 Q 80 92 76 70 Z" fill={SKIRT} />
        <path d="M 46 68 L 40 92 Q 42 100 52 104 L 56 76 Q 50 70 46 68 Z" fill={BLAZER} />
        <path d="M 74 68 L 80 92 Q 78 100 68 104 L 64 76 Q 70 70 74 68 Z" fill={BLAZER} />
        <path d="M 54 70 L 60 78 L 66 70 Z" fill={BLOUSE} />
        <path d="M 58 72 L 58 82 L 62 82 L 62 72 Z" fill="#dbe4ff" />
        <path d="M 56 68 Q 60 74 64 68" stroke={BLAZER_DARK} strokeWidth="1.6" fill="none" />

        {/* Collar + bow tie accent */}
        <path d="M 60 72 L 54 69 L 56 76 Z" fill={BLOUSE} stroke="#cbd5e1" strokeWidth="0.6" />
        <path d="M 60 72 L 66 69 L 64 76 Z" fill={BLOUSE} stroke="#cbd5e1" strokeWidth="0.6" />

        {/* Skirt */}
        <path d="M 44 104 L 48 132 L 72 132 L 76 104 Z" fill={SKIRT} />

        {/* Arm idle (left, holds tablet) */}
        {state !== "happy" && (
          <>
            <path
              d="M 45 84 Q 34 94 36 106"
              stroke={BLAZER}
              strokeWidth="7"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 51 100 Q 40 104 40 112 L 56 114 Q 58 104 51 100 Z"
              fill={BLOUSE}
              stroke="#cbd5e1"
              strokeWidth="0.8"
            />
            {/* Tablet */}
            <rect
              x="38"
              y="106"
              width="22"
              height="18"
              rx="2"
              fill="#1f2937"
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            <rect x="40" y="108" width="18" height="11" rx="1" fill="#4ade80" opacity="0.85" />
            <rect x="40" y="113" width="18" height="2.5" rx="1" fill="#134e4a" opacity="0.6" />
            <rect x="47.5" y="122.5" width="5" height="1.6" rx="0.8" fill="#9ca3af" />
          </>
        )}

        {/* Arm right idle */}
        {state === "idle" && (
          <path
            d="M 75 84 Q 86 94 84 108"
            stroke={BLAZER}
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* Thinking: hand to chin */}
        {state === "thinking" && (
          <>
            <path
              d="M 76 84 Q 88 90 82 102"
              stroke={BLAZER}
              strokeWidth="7"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="83" cy="103" r="3.4" fill={SKIN} />
          </>
        )}

        {/* Speaking: hand gesturing out */}
        {state === "speaking" && (
          <>
            <path
              d="M 75 84 Q 90 86 96 72"
              stroke={BLAZER}
              strokeWidth="7"
              fill="none"
              strokeLinecap="round"
            />
            <g transform="translate(94 70) rotate(-25)">
              <path
                d="M 0 0 L -3.4 -6 M 0 0 L 0 -7 M 0 0 L 3.4 -6"
                stroke={SKIN}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </g>
          </>
        )}

        {/* Happy: thumbs up with right arm */}
        {state === "happy" && (
          <>
            <path
              d="M 75 84 Q 90 86 84 92"
              stroke={BLAZER}
              strokeWidth="7"
              fill="none"
              strokeLinecap="round"
            />
            <path d="M 86 89 q -1 -6 3 -8 q 5 -2 6 4 q 1 6 -3 7 z" fill={SKIN} />
            <path
              d="M 100 80 l 5 -12 M 98 82 l 4 -10"
              stroke={SKIN}
              strokeWidth="4.4"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Error: bracing both hands together */}
        {state === "error" && (
          <>
            <path
              d="M 45 92 Q 42 104 52 108"
              stroke={BLAZER}
              strokeWidth="7"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 75 92 Q 78 104 68 108"
              stroke={BLAZER}
              strokeWidth="7"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="52" cy="109" r="3.4" fill={SKIN} />
            <circle cx="68" cy="109" r="3.4" fill={SKIN} />
          </>
        )}

        {/* Reflector vest over blazer */}
        <path d="M 50 72 L 46 92 L 52 108 L 52 74 Z" fill={VEST} />
        <path d="M 70 72 L 74 92 L 68 108 L 68 74 Z" fill={VEST} />
        <path d="M 52 74 L 68 74 Q 72 88 68 100 L 52 100 Q 48 88 52 74 Z" fill={VEST} />
        {/* Chest reflective band */}
        <path
          d="M 48 82 L 72 82 L 71 87 L 49 87 Z"
          fill={REFLECT}
          stroke={REFLECT_EDGE}
          strokeWidth="0.4"
        />
        <path d="M 48.5 84 L 71.5 84 L 71 85 L 49 85 Z" fill={VEST_DARK} opacity="0.35" />
        {/* Waist reflective band */}
        <path
          d="M 49 98 L 71 98 L 72 103 L 48 103 Z"
          fill={REFLECT}
          stroke={REFLECT_EDGE}
          strokeWidth="0.4"
        />
        <path
          d="M 49.5 100.5 L 70.5 100.5 L 71 101.5 L 49 101.5 Z"
          fill={VEST_DARK}
          opacity="0.35"
        />
        {/* Vest side buttons */}
        <path d="M 50 92 L 52 108 L 50 106 L 48 92 Z" fill={VEST_DARK} opacity="0.7" />
        <path d="M 68 92 L 70 108 L 72 106 L 70 92 Z" fill={VEST_DARK} opacity="0.7" />
        {/* Vest center zip */}
        <path d="M 60 75 L 60 104" stroke={VEST_DARK} strokeWidth="1.4" />

        {/* ID badge on vest */}
        <g transform="translate(48 76)">
          <rect width="10" height="6" rx="1" fill="#ffffff" stroke="#d1d5db" strokeWidth="0.6" />
          <rect x="2.5" y="1" width="5" height="3" rx="0.5" fill={BLAZER} />
          <rect x="3" y="2.2" width="4" height="1.4" fill="#9fb4ff" />
        </g>

        {/* Hard hat — happy state only */}
        {state === "happy" && (
          <g transform="translate(60 24) rotate(-4)">
            <path d="M -22 6 Q -24 -14 -4 -18 Q 12 -18 20 -10 Q 24 -4 20 6 Z" fill={HELMET} />
            <path d="M 8 -16 L -6 -14 L -4 2 Q 2 -8 8 -16 Z" fill={HELMET_ORANGE} opacity="0.9" />
            <rect x="-24" y="3" width="46" height="3.4" rx="1.7" fill="#e2e2e2" />
            <rect x="-24" y="3" width="46" height="1.6" rx="0.8" fill="#ffffff" opacity="0.6" />
          </g>
        )}
      </g>
    </svg>
  );
}
