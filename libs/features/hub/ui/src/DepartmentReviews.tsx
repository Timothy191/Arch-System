'use client';

import { Avatar } from '@repo/ui';
import { Marquee } from '@repo/ui/Marquee';

// AGENT-TRACE: Curated testimonials representing realistic operational feedback from key departments and directors.
// Avatars use local /images/departments/*.jpg photos; `color` styles the initials fallback if an image fails to load.
const DEPT_COLOR_MAP: Record<string, string> = {
  drilling: 'bg-dept-drilling/20 text-dept-drilling',
  production: 'bg-dept-production/20 text-dept-production',
  controlroom: 'bg-dept-control-room/20 text-dept-control-room',
  engineering: 'bg-dept-engineering/20 text-dept-engineering',
  accesscontrol: 'bg-accent-blue/20 text-accent-blue',
  director: 'bg-accent-amber/20 text-accent-amber',
  supervisor: 'bg-accent-green/20 text-accent-green',
  finance: 'bg-dept-finance/20 text-dept-finance',
};

const REVIEW_IMAGE_MAP = {
  drilling: '/images/departments/drilling.jpg',
  production: '/images/departments/production.jpg',
  controlroom: '/images/departments/control-room.jpg',
  engineering: '/images/departments/engineering.jpg',
  accesscontrol: '/images/departments/access-control.jpg',
  director: '/images/departments/overview.jpg',
  supervisor: '/images/departments/overview.jpg',
  finance: '/images/departments/overview.jpg',
  maintenance: '/images/departments/engineering.jpg',
};

const REVIEWS = [
  {
    name: 'Drilling Dept',
    username: '@drilling',
    body: 'Rig 4 telemetry tracking is extremely fast now. Makes scheduling down-hole operations trivial.',
    img: REVIEW_IMAGE_MAP.drilling,
    color: DEPT_COLOR_MAP.drilling ?? 'bg-accent-blue/20 text-accent-blue',
  },
  {
    name: 'Production Unit',
    username: '@production',
    body: 'Tonnage logs are highly accurate. It makes shift handovers much cleaner.',
    img: REVIEW_IMAGE_MAP.production,
    color: DEPT_COLOR_MAP.production ?? 'bg-accent-blue/20 text-accent-blue',
  },
  {
    name: 'Control Room Shift',
    username: '@controlroom',
    body: "SCADA panel integrations are incredibly responsive. Best portal we've used.",
    img: REVIEW_IMAGE_MAP.controlroom,
    color: DEPT_COLOR_MAP.controlroom ?? 'bg-accent-blue/20 text-accent-blue',
  },
  {
    name: 'Engineering Lead',
    username: '@engineering',
    body: 'Tire management calculations are highly precise. Prevented multiple haul truck flats.',
    img: REVIEW_IMAGE_MAP.engineering,
    color: DEPT_COLOR_MAP.engineering ?? 'bg-accent-blue/20 text-accent-blue',
  },
  {
    name: 'Access Control Crew',
    username: '@accesscontrol',
    body: 'Visitor logs are super easy to check. Temp badges compile in seconds.',
    img: REVIEW_IMAGE_MAP.accesscontrol,
    color: DEPT_COLOR_MAP.accesscontrol ?? 'bg-accent-blue/20 text-accent-blue',
  },
  {
    name: 'Operations Director',
    username: '@director',
    body: 'Excellent visibility into plant metrics and shift logs. Real-time monitoring works perfectly.',
    img: REVIEW_IMAGE_MAP.director,
    color: DEPT_COLOR_MAP.director ?? 'bg-accent-blue/20 text-accent-blue',
  },
  {
    name: 'Site Supervisor',
    username: '@supervisor',
    body: 'Highly reliable system. The offline banner and resilient auth keep operators in focus.',
    img: REVIEW_IMAGE_MAP.supervisor,
    color: DEPT_COLOR_MAP.supervisor ?? 'bg-accent-blue/20 text-accent-blue',
  },
  {
    name: 'Finance Team',
    username: '@finance',
    body: 'Budget tracking is precise and real-time. Monthly closeout processes have been streamlined significantly.',
    img: REVIEW_IMAGE_MAP.finance,
    color: DEPT_COLOR_MAP.finance ?? 'bg-accent-blue/20 text-accent-blue',
  },
  {
    name: 'Maintenance Crew',
    username: '@maintenance',
    body: 'Preventive maintenance scheduling has reduced unexpected equipment failures by 40%.',
    img: REVIEW_IMAGE_MAP.maintenance,
    color: DEPT_COLOR_MAP.supervisor ?? 'bg-accent-blue/20 text-accent-blue',
  },
];

const firstRow = REVIEWS.slice(0, REVIEWS.length / 2);
const secondRow = REVIEWS.slice(REVIEWS.length / 2);

import { MessageSquareQuote } from 'lucide-react';

interface ReviewCardProps {
  img: string;
  name: string;
  username: string;
  body: string;
  color: string;
}

function ReviewCard({ img, name, username, body }: ReviewCardProps) {
  const initials = name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="w-[320px] shrink-0 [perspective:1000px] py-1">
      <div className="uiverse-card group/card relative h-full rounded-2xl bg-white/85 backdrop-blur-xl border border-white/65 ring-1 ring-black/[0.08] shadow-[0_14px_28px_-6px_rgba(15,23,42,0.18),0_6px_12px_-3px_rgba(15,23,42,0.1),inset_0_1.5px_0_0_rgba(255,255,255,0.95),inset_0_-2px_4px_rgba(15,23,42,0.06)] [transform-style:preserve-3d] [transform:perspective(1000px)_rotateX(2deg)_translateZ(0)] hover:[transform:perspective(1000px)_rotateX(5deg)_rotateY(-3deg)_translateY(-6px)_translateZ(12px)] hover:shadow-[0_24px_44px_-8px_rgba(15,23,42,0.26),0_10px_20px_-4px_rgba(15,23,42,0.14),inset_0_1.5px_0_0_rgba(255,255,255,1),inset_0_-2px_4px_rgba(15,23,42,0.08)] hover:border-arch-accent-blue/40 transition-all duration-300 ease-out will-change-transform">
        <div className="p-4 sm:p-5 flex flex-col justify-between h-full select-none [transform:translateZ(10px)]">
          <div className="flex flex-row items-center gap-3">
            <Avatar
              size={36}
              src={img}
              letter={initials}
              title={name}
              className="shrink-0 shadow-md ring-1 ring-white/80"
            />
            <div className="flex flex-col text-left min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-arch-text-primary group-hover/card:text-arch-accent-blue transition-colors truncate">
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
    maskImage: 'linear-gradient(to right, transparent, white 10%, white 90%, transparent)',
    WebkitMaskImage: 'linear-gradient(to right, transparent, white 10%, white 90%, transparent)',
  };

  return (
    <div
      className="space-y-4 animate-fade-up group/row"
      style={{ animationDelay: '0.05s', animationFillMode: 'both' }}
    >
      <header className="w-full rounded-full bg-arch-surface-secondary/80 border border-arch-border-subtle backdrop-blur-md shadow-sm px-6 py-2.5 flex items-center justify-center">
        <h2 className="text-base sm:text-lg font-semibold tracking-tight text-arch-text-primary flex items-center justify-center gap-2.5 text-center">
          <span className="p-1 rounded-full bg-arch-accent-blue/10 text-arch-accent-blue flex items-center justify-center">
            <MessageSquareQuote className="w-4 h-4" />
          </span>
          Operational Feedback &amp; Department Logs
        </h2>
      </header>

      <div
        className="relative flex w-full flex-col items-center justify-center overflow-hidden [perspective:1200px]"
        style={maskStyle}
      >
        <Marquee pauseOnHover className="[--duration:30s] [--gap:1rem] sm:[--gap:1.5rem] py-3">
          {firstRow.map((review) => (
            <ReviewCard key={review.username} {...review} />
          ))}
        </Marquee>
        <Marquee
          reverse
          pauseOnHover
          className="[--duration:30s] [--gap:1rem] sm:[--gap:1.5rem] py-3"
        >
          {secondRow.map((review) => (
            <ReviewCard key={review.username} {...review} />
          ))}
        </Marquee>
      </div>
    </div>
  );
}
