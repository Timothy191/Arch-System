"use client";

import { Marquee } from "@repo/ui/Marquee";
import { GlassCard } from "@repo/ui/GlassCard";
import React from "react";

// AGENT-TRACE: Curated testimonials representing realistic operational feedback from key departments and directors
const REVIEWS = [
  {
    name: "Drilling Dept",
    username: "@drilling",
    body: "Rig 4 telemetry tracking is extremely fast now. Makes scheduling down-hole operations trivial.",
    img: "https://avatar.vercel.sh/drilling",
  },
  {
    name: "Safety Control",
    username: "@safety",
    body: "The real-time incident reports have helped us maintain our LTI-free record. Seamless compliance.",
    img: "https://avatar.vercel.sh/safety",
  },
  {
    name: "Production Unit",
    username: "@production",
    body: "Tonnage logs are highly accurate. It makes shift handovers much cleaner.",
    img: "https://avatar.vercel.sh/production",
  },
  {
    name: "Control Room Shift",
    username: "@controlroom",
    body: "SCADA panel integrations are incredibly responsive. Best portal we've used.",
    img: "https://avatar.vercel.sh/controlroom",
  },
  {
    name: "Training LMS",
    username: "@training",
    body: "Competency training dashboard has reduced certification overhead by 40%.",
    img: "https://avatar.vercel.sh/training",
  },
  {
    name: "Satellite Operations",
    username: "@satellite",
    body: "Hyperspectral imagery rendering is super clean. Soil stability alerts are spot on.",
    img: "https://avatar.vercel.sh/satellite",
  },
  {
    name: "Engineering Lead",
    username: "@engineering",
    body: "Tire management calculations are highly precise. Prevented multiple haul truck flats.",
    img: "https://avatar.vercel.sh/engineering",
  },
  {
    name: "Access Control Crew",
    username: "@accesscontrol",
    body: "Visitor logs are super easy to check. Temp badges compile in seconds.",
    img: "https://avatar.vercel.sh/accesscontrol",
  },
  {
    name: "Operations Director",
    username: "@director",
    body: "Excellent visibility into plant metrics and shift logs. Real-time monitoring works perfectly.",
    img: "https://avatar.vercel.sh/director",
  },
  {
    name: "Site Supervisor",
    username: "@supervisor",
    body: "Highly reliable system. The offline banner and resilient auth keep operators in focus.",
    img: "https://avatar.vercel.sh/supervisor",
  },
];

const firstRow = REVIEWS.slice(0, REVIEWS.length / 2);
const secondRow = REVIEWS.slice(REVIEWS.length / 2);

interface ReviewCardProps {
  img: string;
  name: string;
  username: string;
  body: string;
}

function ReviewCard({ img, name, username, body }: ReviewCardProps) {
  return (
    <div className="w-[300px] shrink-0">
      <GlassCard className="h-full bg-arch-surface-tertiary/40 border border-arch-border-primary hover:border-white/40 transition-all duration-300">
        <div className="p-4 flex flex-col justify-between h-full select-none">
          <div className="flex flex-row items-center gap-3">
            <img
              className="rounded-full w-8 h-8 object-cover bg-arch-surface-tertiary border border-arch-border-primary"
              width="32"
              height="32"
              alt={name}
              src={img}
            />
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium text-arch-text-primary">{name}</span>
              <p className="text-[11px] font-medium text-arch-text-secondary">{username}</p>
            </div>
          </div>
          <blockquote className="mt-2.5 text-xs text-arch-text-secondary leading-relaxed text-left line-clamp-2">
            "{body}"
          </blockquote>
        </div>
      </GlassCard>
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
      <div className="flex items-center justify-between pb-2 border-b border-arch-border-subtle">
        <h2 className="text-[17px] font-medium text-arch-text-primary">
          Operational Feedback & Department Logs
        </h2>
      </div>

      <div
        className="relative flex w-full flex-col items-center justify-center overflow-hidden"
        style={maskStyle}
      >
        <Marquee pauseOnHover className="[--duration:30s] gap-6 py-1">
          {firstRow.map((review) => (
            <ReviewCard key={review.username} {...review} />
          ))}
        </Marquee>
        <Marquee reverse pauseOnHover className="[--duration:30s] gap-6 py-1">
          {secondRow.map((review) => (
            <ReviewCard key={review.username} {...review} />
          ))}
        </Marquee>
      </div>
    </div>
  );
}
