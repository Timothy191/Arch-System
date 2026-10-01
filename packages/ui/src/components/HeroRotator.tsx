'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { cn } from '../lib/utils';
import { HeroCardContent } from './HeroCardContent';

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

  let slideClass = '';
  if (isActive) {
    slideClass = 'opacity-100 z-10 translate-x-0 scale-100';
  } else if (diff === 1 || (diff < 0 && diff !== -1 && idx === 0 && activeIndex === total - 1)) {
    slideClass = 'opacity-0 -z-10 translate-x-[20%] scale-95 pointer-events-none';
  } else if (diff === -1 || (diff > 0 && diff !== 1 && idx === total - 1 && activeIndex === 0)) {
    slideClass = 'opacity-0 -z-10 -translate-x-[20%] scale-95 pointer-events-none';
  } else {
    slideClass = 'opacity-0 -z-20 scale-90 pointer-events-none';
  }

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${idx + 1} of ${total}: ${panel.title}`}
      inert={!isActive ? true : undefined}
      aria-hidden={!isActive}
      className={cn(
        'absolute inset-0 w-full h-full will-change-transform transform-gpu',
        'transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
        slideClass
      )}
    >
      <div
        className={cn(
          'relative h-full w-full rounded-2xl overflow-hidden select-none',
          'bg-white/90 backdrop-blur-3xl liquid-glass-light border border-black/[0.06] shadow-window',
          'transition-[shadow,transform] duration-500 ease-out',
          isActive && 'hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)] hover:-translate-y-1'
        )}
      >
        <HeroCardContent
          panel={panel}
          idx={idx}
          isActive={isActive}
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (total <= 1) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      }
    },
    [total, nextSlide, prevSlide]
  );

  return (
    <div
      className="relative w-full select-none py-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/40 rounded-2xl max-w-4xl mx-auto"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onKeyDown={handleKeyDown}
      aria-roledescription="carousel"
      aria-label="Department Hero Highlights"
    >
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(e, { offset, velocity }) => {
          const swipe = offset.x;
          if (swipe < -CONFIG.swipeThreshold || velocity.x < -500) {
            nextSlide();
          } else if (swipe > CONFIG.swipeThreshold || velocity.x > 500) {
            prevSlide();
          }
        }}
        className="relative w-full cursor-grab active:cursor-grabbing overflow-visible"
        style={{ height: 440, touchAction: 'pan-y' }}
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
      </motion.div>

      {total > 1 && (
        <div className="mt-5 flex items-center justify-between px-1">
          <div className="flex items-center gap-1 liquid-glass-light border border-black/10 shadow-window p-1 rounded-full">
            <button
              onClick={prevSlide}
              aria-label="Previous highlight"
              className="p-1.5 rounded-full hover:bg-black/[0.05] text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-all active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextSlide}
              aria-label="Next highlight"
              className="p-1.5 rounded-full hover:bg-black/[0.05] text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-all active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="w-px h-3.5 bg-black/10 mx-0.5" />
            <button
              onClick={() => setIsManuallyPaused((p) => !p)}
              aria-label={isManuallyPaused ? 'Resume auto rotation' : 'Pause auto rotation'}
              className="p-1.5 rounded-full hover:bg-black/[0.05] text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-all active:scale-95"
            >
              {isManuallyPaused ? (
                <Play className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Pause className="w-3.5 h-3.5 fill-current" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {panels.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => jumpToSlide(idx)}
                aria-label={`Jump to ${p.title}`}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  idx === activeIndex
                    ? 'w-6 bg-[var(--accent-blue)]'
                    : 'w-1.5 bg-black/20 hover:bg-black/40'
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
