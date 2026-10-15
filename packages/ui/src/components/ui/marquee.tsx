'use client';

import { cn } from '@repo/ui/lib/utils';
import { type ComponentPropsWithoutRef, useEffect, useRef, useState } from 'react';

interface MarqueeProps extends ComponentPropsWithoutRef<'div'> {
  /**
   * Optional CSS class name to apply custom styles
   */
  className?: string;
  /**
   * Whether to reverse the animation direction
   * @default false
   */
  reverse?: boolean;
  /**
   * Whether to pause the animation on hover
   * @default false
   */
  pauseOnHover?: boolean;
  /**
   * Content to be displayed in the marquee
   */
  children: React.ReactNode;
  /**
   * Whether to animate vertically instead of horizontally
   * @default false
   */
  vertical?: boolean;
  /**
   * Number of times to repeat the content
   * @default 3 (increased for fullness)
   */
  repeat?: number;
  /**
   * CSS variable for animation duration in seconds
   */
  duration?: string;
  /**
   * Whether to enable 3D transform effect (parallax on hover)
   * @default false
   */
  enable3D?: boolean;
}

export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  duration,
  enable3D = false,
  ...props
}: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  // AGENT-TRACE: pause the marquee animation while off-screen. The hub page
  // mounts several marquees; a continuous transform animation on an off-screen
  // layer still costs compositor time. rootMargin starts/stops it slightly
  // before the viewport edge so it never visibly pops.
  useEffect(() => {
    const target = containerRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setIsVisible(entry.isIntersecting);
        }
      },
      {
        rootMargin: '200px',
      }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      {...props}
      ref={containerRef}
      className={cn(
        'group relative flex w-full overflow-hidden p-2 [--duration:40s] [--gap:1rem]',
        {
          'flex-row': !vertical,
          'flex-col': vertical,
        },
        duration,
        className,
        'gap-[var(--gap)]'
      )}
    >
      {Array(repeat)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            className={cn('flex shrink-0 justify-around gap-[var(--gap)]', {
              'animate-marquee flex-row': !vertical,
              'animate-marquee-vertical flex-col': vertical,
              'animate-marquee-pause group-hover:[animation-play-state:paused]': pauseOnHover,
              'animate-marquee-reverse [animation-direction:reverse]': reverse,
              // 3D hover effect: panel lifts on hover
              ...(enable3D && {
                'hover:translate-y-1 hover:shadow-md': !isVisible,
                'group-hover:translate-y-0 group-hover:shadow-none': pauseOnHover,
              }),
            })}
            // Inline style wins over the group-hover class, so off-screen
            // always pauses regardless of hover state, and reverse direction
            // is never overridden by the animation shorthand.
            style={
              reverse || !isVisible
                ? {
                    ...(reverse ? { animationDirection: 'reverse' } : undefined),
                    ...(!isVisible ? { animationPlayState: 'paused' } : undefined),
                  }
                : undefined
            }
          >
            {children}
          </div>
        ))}
    </div>
  );
}
