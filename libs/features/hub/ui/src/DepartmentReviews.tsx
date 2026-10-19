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

import { MessageSquareQuote } from 'lucide-react';

interface ReviewCardProps {
  img: string;
  name: string;
  username: string;
  body: string;
  color: string;
}

function ReviewTickerItem({ img, name, username, body }: ReviewCardProps) {
  const initials = name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="inline-flex items-center gap-2 shrink-0 whitespace-nowrap px-3 py-1 rounded-full bg-white/80 backdrop-blur-md border border-black/[0.08] ring-1 ring-inset ring-white/80 shadow-xs hover:border-arch-accent-blue/35 transition-colors select-none">
      <Avatar
        size={18}
        src={img}
        letter={initials}
        title={name}
        className="shrink-0 ring-1 ring-white/80"
      />
      <span className="text-[11px] font-semibold text-arch-text-primary">{name}</span>
      <span className="text-[10px] font-mono text-arch-text-tertiary">{username}</span>
      <span className="text-arch-text-tertiary/40" aria-hidden="true">
        ·
      </span>
      <span className="text-[11px] text-arch-text-secondary italic">&ldquo;{body}&rdquo;</span>
    </div>
  );
}

export function DepartmentReviews() {
  // AGENT-TRACE: Single-line animated marquee ticker with smooth horizontal edge fade
  const maskStyle = {
    maskImage: 'linear-gradient(to right, transparent, white 6%, white 94%, transparent)',
    WebkitMaskImage: 'linear-gradient(to right, transparent, white 6%, white 94%, transparent)',
  };

  return (
    <div
      className="flex items-center gap-2.5 w-full min-w-0 overflow-hidden"
      aria-label="Operational Feedback & Department Logs"
    >
      <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-arch-accent-blue/10 border border-arch-accent-blue/20 text-arch-accent-blue text-[10px] font-semibold tracking-tight shrink-0">
        <MessageSquareQuote className="w-3 h-3" aria-hidden="true" />
        Department Logs
      </span>
      <span className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-green/10 border border-accent-green/25 text-accent-green text-[10px] font-mono font-semibold uppercase tracking-wider shrink-0">
        <span
          className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse"
          aria-hidden="true"
        />
        9 Units
      </span>

      <div className="relative flex-1 min-w-0 overflow-hidden" style={maskStyle}>
        <Marquee pauseOnHover className="[--duration:45s] [--gap:0.75rem] py-0.5">
          {REVIEWS.map((review) => (
            <ReviewTickerItem key={review.username} {...review} />
          ))}
        </Marquee>
      </div>
    </div>
  );
}
