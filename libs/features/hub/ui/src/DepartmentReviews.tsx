"use client";

import { useState } from "react";
import { Marquee } from "@repo/ui/Marquee";
import { cn } from "@repo/ui/lib/utils";

// AGENT-TRACE: Curated testimonials representing realistic operational feedback from key departments and directors.
// Each review includes a `color` for the initials-based avatar fallback, which renders
// if the external avatar.vercel.sh URL fails (network blocked, service down, etc.).
const DEPT_COLOR_MAP: Record<string, string> = {
  drilling: "bg-dept-drilling/20 text-dept-drilling",
  production: "bg-dept-production/20 text-dept-production",
  controlroom: "bg-dept-control-room/20 text-dept-control-room",
  training: "bg-dept-training/20 text-dept-training",
  satellite: "bg-dept-satellite/20 text-dept-satellite",
  engineering: "bg-dept-engineering/20 text-dept-engineering",
  accesscontrol: "bg-accent-blue/20 text-accent-blue",
  director: "bg-accent-amber/20 text-accent-amber",
  supervisor: "bg-accent-green/20 text-accent-green",
};

const REVIEWS = [
  {
    name: "Drilling Dept",
    username: "@drilling",
    body: "Rig 4 telemetry tracking is extremely fast now. Makes scheduling down-hole operations trivial.",
    img: "https://avatar.vercel.sh/drilling",
    color: DEPT_COLOR_MAP.drilling ?? "bg-accent-blue/20 text-accent-blue",
  },
  {
    name: "Production Unit",
    username: "@production",
    body: "Tonnage logs are highly accurate. It makes shift handovers much cleaner.",
    img: "https://avatar.vercel.sh/production",
    color: DEPT_COLOR_MAP.production ?? "bg-accent-blue/20 text-accent-blue",
  },
  {
    name: "Control Room Shift",
    username: "@controlroom",
    body: "SCADA panel integrations are incredibly responsive. Best portal we've used.",
    img: "https://avatar.vercel.sh/controlroom",
    color: DEPT_COLOR_MAP.controlroom ?? "bg-accent-blue/20 text-accent-blue",
  },
  {
    name: "Training LMS",
    username: "@training",
    body: "Competency training dashboard has reduced certification overhead by 40%.",
    img: "https://avatar.vercel.sh/training",
    color: DEPT_COLOR_MAP.training ?? "bg-accent-blue/20 text-accent-blue",
  },
  {
    name: "Satellite Operations",
    username: "@satellite",
    body: "Hyperspectral imagery rendering is super clean. Soil stability alerts are spot on.",
    img: "https://avatar.vercel.sh/satellite",
    color: DEPT_COLOR_MAP.satellite ?? "bg-accent-blue/20 text-accent-blue",
  },
  {
    name: "Engineering Lead",
    username: "@engineering",
    body: "Tire management calculations are highly precise. Prevented multiple haul truck flats.",
    img: "https://avatar.vercel.sh/engineering",
    color: DEPT_COLOR_MAP.engineering ?? "bg-accent-blue/20 text-accent-blue",
  },
  {
    name: "Access Control Crew",
    username: "@accesscontrol",
    body: "Visitor logs are super easy to check. Temp badges compile in seconds.",
    img: "https://avatar.vercel.sh/accesscontrol",
    color: DEPT_COLOR_MAP.accesscontrol ?? "bg-accent-blue/20 text-accent-blue",
  },
  {
    name: "Operations Director",
    username: "@director",
    body: "Excellent visibility into plant metrics and shift logs. Real-time monitoring works perfectly.",
    img: "https://avatar.vercel.sh/director",
    color: DEPT_COLOR_MAP.director ?? "bg-accent-blue/20 text-accent-blue",
  },
  {
    name: "Site Supervisor",
    username: "@supervisor",
    body: "Highly reliable system. The offline banner and resilient auth keep operators in focus.",
    img: "https://avatar.vercel.sh/supervisor",
    color: DEPT_COLOR_MAP.supervisor ?? "bg-accent-blue/20 text-accent-blue",
  },
];

const firstRow = REVIEWS.slice(0, REVIEWS.length / 2);
const secondRow = REVIEWS.slice(REVIEWS.length / 2);

import { MessageSquareQuote } from "lucide-react";

interface ReviewCardProps {
  img: string;
  name: string;
  username: string;
  body: string;
  color: string;
}

function ReviewCard({ img, name, username, body, color }: ReviewCardProps) {
  const [imgError, setImgError] = useState(false);
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="w-[320px] shrink-0">
      <div className="h-full rounded-2xl bg-white/75 backdrop-blur-xl border border-black/[0.08] shadow-card hover:shadow-card-hover hover:border-arch-accent-blue/30 transition-all duration-300">
        <div className="p-4 sm:p-5 flex flex-col justify-between h-full select-none">
          <div className="flex flex-row items-center gap-3">
            {/* AGENT-TRACE: Local initials fallback replaces broken external avatar URLs */}
            {imgError ? (
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border border-arch-border-subtle shadow-sm shrink-0",
                  color,
                )}
                aria-hidden="true"
              >
                {initials}
              </div>
            ) : (
              <img
                className="rounded-full object-cover bg-arch-surface-tertiary border border-arch-border-subtle shadow-sm shrink-0 w-9 h-9"
                width={36}
                height={36}
                alt={name}
                src={img}
                onError={() => setImgError(true)}
              />
            )}
            <div className="flex flex-col text-left min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-arch-text-primary truncate">
                {name}
              </span>
              <p className="text-[11px] font-medium text-arch-text-tertiary truncate">{username}</p>
            </div>
          </div>
          <blockquote className="mt-3 text-xs text-arch-text-secondary leading-relaxed text-left line-clamp-2 italic">
            &ldquo;{body}&rdquo;
          </blockquote>
        </div>
      </div>
    </div>
  );
}

export function DepartmentReviews() {
  // AGENT-TRACE: Using CSS mask-image gradient to smoothly fade marquee edges over the dynamic background video
  const maskStyle = {
    maskImage: "linear-gradient(to right, transparent, white 10%, white 90%, transparent)",
    WebkitMaskImage: "linear-gradient(to right, transparent, white 10%, white 90%, transparent)",
  };

  return (
    <div
      className="space-y-4 animate-fade-up group/row"
      style={{ animationDelay: "0.05s", animationFillMode: "both" }}
    >
      <div className="flex items-center justify-between pb-3 border-b border-arch-border-subtle">
        <h2 className="text-base sm:text-lg font-semibold tracking-tight text-arch-text-primary flex items-center gap-2.5">
          <span className="p-1 rounded-md bg-arch-surface-secondary text-arch-accent-blue">
            <MessageSquareQuote className="w-4 h-4" />
          </span>
          Operational Feedback & Department Logs
        </h2>
      </div>

      <div
        className="relative flex w-full flex-col items-center justify-center overflow-hidden"
        style={maskStyle}
      >
        <Marquee pauseOnHover className="[--duration:30s] gap-4 sm:gap-6 py-1.5">
          {firstRow.map((review) => (
            <ReviewCard key={review.username} {...review} />
          ))}
        </Marquee>
        <Marquee reverse pauseOnHover className="[--duration:30s] gap-4 sm:gap-6 py-1.5">
          {secondRow.map((review) => (
            <ReviewCard key={review.username} {...review} />
          ))}
        </Marquee>
      </div>
    </div>
  );
}
