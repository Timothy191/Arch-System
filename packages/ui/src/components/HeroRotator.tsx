'use client';

import { m } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '../lib/utils';
import { HeroCardContent } from './HeroCardContent';

function ArchEmblemIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="22.75 16.625 166.16 166.19"
      className={cn('fill-current', className)}
      aria-hidden="true"
    >
      <path
        d="m 105.8125,16.625 c -7.39687,18.135158 -11.858304,29.997682 -20.09375,47.59375 5.04936,5.35232 11.247211,11.585364 21.3125,18.625 C 96.210077,78.390904 88.828713,73.920352 83.3125,69.28125 72.7727,91.274163 56.259864,122.60209 22.75,182.8125 49.087628,167.60733 69.504089,158.23318 88.53125,154.65625 87.714216,151.1422 87.2497,147.34107 87.28125,143.375 l 0.03125,-0.84375 c 0.417917,-16.87382 9.195665,-29.84979 19.59375,-28.96875 10.39809,0.88104 18.48041,15.28242 18.0625,32.15625 -0.0786,3.17512 -0.43674,6.22955 -1.0625,9.0625 18.82058,3.68164 39.01873,13.03179 65,28.03125 -5.123,-9.4318 -9.69572,-17.93388 -14.0625,-26.03125 -6.87839,-5.33121 -14.05289,-12.2698 -28.6875,-19.78125 10.05899,2.61375 17.2611,5.62932 22.875,9 C 124.63297,63.338161 121.03766,52.354109 105.8125,16.625 z"
        fillRule="evenodd"
      />
    </svg>
  );
}

export interface Panel {
  id: string;
  name: string;
  title: string;
  description: string;
  category: string;
  image: string;
  stats?: { label: string; value: string };
  status: string;
  icon: React.ReactNode;
  iconBgColor: string;
  primary: { href: string; label: string; icon: React.ReactNode };
  secondary?: { href: string; label: string; icon: React.ReactNode };
  assetOverline?: string;
  assetSubtitle?: string;
}

export interface HeroRotatorProps {
  panels: Panel[];
  incidentCount?: number;
  breakdownCount?: number;
  offlineMachineCount?: number;
}

const CONFIG = {
  autoRotateMs: 6000,
  swipeThreshold: 50,
};

interface HeroSlideProps {
  panel: Panel;
  idx: number;
  activeIndex: number;
  total: number;
  isActive: boolean;
  failedImages: Set<string>;
  onImageError: (src: string) => void;
  onJumpTo: (idx: number) => void;
  incidentCount: number;
  breakdownCount: number;
  offlineMachineCount: number;
}

function HeroSlide({
  panel,
  idx,
  activeIndex,
  total,
  isActive,
  failedImages,
  onImageError,
  onJumpTo,
  incidentCount,
  breakdownCount,
  offlineMachineCount,
}: HeroSlideProps) {
  // Calculate relative position (-1 is left, 1 is right, 0 is center)
  let diff = idx - activeIndex;
  if (diff > total / 2) diff -= total;
  if (diff < -total / 2) diff += total;

  const isCenter = isActive || diff === 0;
  const isLeft1 =
    diff === -1 || (diff < 0 && diff !== -1 && idx === 0 && activeIndex === total - 1);
  const isLeft2 =
    diff === -2 ||
    (diff < -1 && diff !== -2 && idx === 0 && activeIndex === total - 1) ||
    (diff === -(total - 1) && activeIndex === 1);
  const isRight1 = diff === 1 || (diff > 0 && diff !== 1 && idx === total - 1 && activeIndex === 0);
  const isRight2 =
    diff === 2 ||
    (diff > 1 && diff !== 2 && idx === total - 1 && activeIndex === 0) ||
    (diff === total - 1 && activeIndex === total - 2);

  let transform = 'translate3d(0, 0, -250px) scale(0.7)';
  let opacity = 0;
  let zIndex = 0;
  let filter = 'blur(4px)';
  let pointerEvents: 'auto' | 'none' = 'none';
  let maskStyle: React.CSSProperties = {};
  let cursorClass = '';

  if (isCenter) {
    transform = 'translate3d(0%, 0, 0) rotateY(0deg) scale(1)';
    opacity = 1;
    zIndex = 30;
    filter = 'blur(0px)';
    pointerEvents = 'auto';
  } else if (isLeft1 || isRight1) {
    // Immediate left/right preview slides
    const isLeft = isLeft1;
    transform = isLeft
      ? 'translate3d(-58%, 0, -140px) rotateY(26deg) scale(0.86)'
      : 'translate3d(58%, 0, -140px) rotateY(-26deg) scale(0.86)';
    opacity = 0.78;
    zIndex = 20;
    filter = 'blur(0px)';
    pointerEvents = 'auto';
    cursorClass = 'cursor-pointer hover:opacity-95';
    maskStyle = {
      maskImage: isLeft
        ? 'linear-gradient(to right, rgba(0,0,0,0.25) 0%, black 22%)'
        : 'linear-gradient(to left, rgba(0,0,0,0.25) 0%, black 22%)',
      WebkitMaskImage: isLeft
        ? 'linear-gradient(to right, rgba(0,0,0,0.25) 0%, black 22%)'
        : 'linear-gradient(to left, rgba(0,0,0,0.25) 0%, black 22%)',
    };
  } else if (isLeft2 || isRight2) {
    // Secondary left/right preview slides
    const isLeft = isLeft2;
    transform = isLeft
      ? 'translate3d(-85%, 0, -200px) rotateY(18deg) scale(0.75)'
      : 'translate3d(85%, 0, -200px) rotateY(-18deg) scale(0.75)';
    opacity = 0.45;
    zIndex = 10;
    filter = 'blur(1.5px)';
    pointerEvents = 'auto';
    cursorClass = 'cursor-pointer hover:opacity-75';
    maskStyle = {
      maskImage: isLeft
        ? 'linear-gradient(to right, rgba(0,0,0,0.15) 0%, black 25%)'
        : 'linear-gradient(to left, rgba(0,0,0,0.15) 0%, black 25%)',
      WebkitMaskImage: isLeft
        ? 'linear-gradient(to right, rgba(0,0,0,0.15) 0%, black 25%)'
        : 'linear-gradient(to left, rgba(0,0,0,0.15) 0%, black 25%)',
    };
  } else {
    // Far slides - keep hidden
    transform =
      diff < 0
        ? 'translate3d(-100%, 0, -250px) rotateY(35deg) scale(0.7)'
        : 'translate3d(100%, 0, -250px) rotateY(-35deg) scale(0.7)';
    opacity = 0;
    zIndex = 0;
    filter = 'blur(4px)';
    pointerEvents = 'none';
  }

  const handleClick = () => {
    if (!isCenter && (isLeft1 || isLeft2 || isRight1 || isRight2)) {
      onJumpTo(idx);
    }
  };

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${idx + 1} of ${total}: ${panel.title}`}
      aria-hidden={!isCenter}
      onClick={handleClick}
      className={cn(
        'absolute inset-x-0 mx-auto w-[84%] sm:w-[78%] lg:w-[68%] max-w-[760px] h-full will-change-[transform,opacity] transform-gpu',
        cursorClass
      )}
      style={{
        transform,
        opacity,
        zIndex,
        filter,
        pointerEvents,
        transformStyle: 'preserve-3d',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transition:
          'transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.55s cubic-bezier(0.16, 1, 0.3, 1), filter 0.55s cubic-bezier(0.16, 1, 0.3, 1)',
        ...maskStyle,
      }}
    >
      <div
        className={cn(
          'relative h-full w-full rounded-2xl overflow-hidden select-none',
          'liquid-glass-light border border-white/20 shadow-window',
          'transition-[box-shadow,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
          isCenter ? 'hover:-translate-y-1' : 'pointer-events-none'
        )}
      >
        <HeroCardContent
          panel={panel}
          idx={idx}
          isActive={isCenter}
          failedImages={failedImages}
          onImageError={onImageError}
          incidentCount={incidentCount}
          breakdownCount={breakdownCount}
          offlineMachineCount={offlineMachineCount}
        />
      </div>
    </div>
  );
}

export function HeroRotator({
  panels,
  incidentCount = 0,
  breakdownCount = 0,
  offlineMachineCount = 0,
}: HeroRotatorProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [failedImages, setFailedImages] = useState(new Set<string>());
  const touchStartX = useRef<number | null>(null);

  const total = panels.length;

  const nextSlide = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const jumpToSlide = useCallback((targetIdx: number) => {
    setActiveIndex(targetIdx);
  }, []);

  const handleImageError = useCallback((src: string) => {
    setFailedImages((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }, []);

  useEffect(() => {
    if (total <= 1 || isHovering || isManuallyPaused) return;
    const id = setInterval(nextSlide, CONFIG.autoRotateMs);
    return () => clearInterval(id);
  }, [total, isHovering, isManuallyPaused, nextSlide]);

  useEffect(() => {
    const activePanel = panels[activeIndex];
    if (!activePanel || typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('arch:active-module-change', {
        detail: {
          name: activePanel.name,
          title: activePanel.title,
          category: activePanel.category,
        },
      })
    );
  }, [activeIndex, panels]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (total <= 1) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        setIsManuallyPaused((p) => !p);
      }
    },
    [total, nextSlide, prevSlide]
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches?.[0]) {
      touchStartX.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const clientX = e.changedTouches?.[0]?.clientX;
    if (typeof clientX === 'number') {
      const diff = clientX - touchStartX.current;
      if (diff < -CONFIG.swipeThreshold) {
        nextSlide();
      } else if (diff > CONFIG.swipeThreshold) {
        prevSlide();
      }
    }
    touchStartX.current = null;
  };

  return (
    <div
      className="relative w-full select-none py-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/40 rounded-2xl max-w-6xl mx-auto"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onKeyDown={handleKeyDown}
      role="region"
      aria-roledescription="carousel"
      aria-label="Department Hero Highlights"
    >
      <div
        className="relative w-full overflow-visible"
        style={{
          perspective: '1400px',
          WebkitPerspective: '1400px',
          transformStyle: 'preserve-3d',
        }}
      >
        <m.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_e, { offset, velocity }) => {
            const swipe = offset.x;
            if (swipe < -CONFIG.swipeThreshold || velocity.x < -500) {
              nextSlide();
            } else if (swipe > CONFIG.swipeThreshold || velocity.x > 500) {
              prevSlide();
            }
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative w-full cursor-grab active:cursor-grabbing overflow-visible touch-pan-y"
          style={{ height: 460, transformStyle: 'preserve-3d' }}
        >
          {panels.map((panel, idx) => (
            <HeroSlide
              key={panel.id}
              panel={panel}
              idx={idx}
              activeIndex={activeIndex}
              total={total}
              isActive={idx === activeIndex}
              failedImages={failedImages}
              onImageError={handleImageError}
              onJumpTo={jumpToSlide}
              incidentCount={incidentCount}
              breakdownCount={breakdownCount}
              offlineMachineCount={offlineMachineCount}
            />
          ))}
        </m.div>

        {total > 1 && (
          <div className="pointer-events-none absolute inset-y-0 inset-x-0 mx-auto w-[84%] sm:w-[78%] lg:w-[68%] max-w-[760px] z-40">
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous highlight"
              className="pointer-events-auto absolute -left-11 sm:-left-14 top-1/2 -translate-y-1/2 p-2.5 rounded-full liquid-glass-light border border-white/30 shadow-window hover:bg-white/40 text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-all active:scale-95"
            >
              <ArchEmblemIcon className="w-3.5 h-3.5 -rotate-90 transition-transform" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next highlight"
              className="pointer-events-auto absolute -right-11 sm:-right-14 top-1/2 -translate-y-1/2 p-2.5 rounded-full liquid-glass-light border border-white/30 shadow-window hover:bg-white/40 text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-all active:scale-95"
            >
              <ArchEmblemIcon className="w-3.5 h-3.5 rotate-90 transition-transform" />
            </button>
          </div>
        )}
      </div>

      {total > 1 && (
        <div className="mt-5 flex items-center justify-center px-1">
          <div className="flex items-center gap-2">
            {panels.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => jumpToSlide(idx)}
                aria-label={`Jump to ${p.title}`}
                className={cn(
                  'transition-all duration-300 flex items-center justify-center p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)] active:scale-95',
                  idx === activeIndex
                    ? 'text-[var(--accent-blue)] scale-110'
                    : 'text-black/25 hover:text-black/50 hover:scale-105'
                )}
              >
                <ArchEmblemIcon
                  className={cn(
                    'transition-all duration-300',
                    idx === activeIndex ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
