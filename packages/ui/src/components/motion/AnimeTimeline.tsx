"use client";

import React, { useRef, useImperativeHandle, forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@repo/ui/lib/utils";

export interface AnimeTimelineHandle {
  play: () => void;
  pause: () => void;
  restart: () => void;
  reverse: () => void;
}

interface AnimeTimelineProps {
  children: React.ReactNode;
  className?: string;
  childClassName?: string;
  autoPlay?: boolean;
  onComplete?: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

export const AnimeTimeline = forwardRef<AnimeTimelineHandle, AnimeTimelineProps>(
  ({ children, className, childClassName, autoPlay = true, onComplete }, ref) => {
    const isPlayingRef = useRef(autoPlay);

    useImperativeHandle(ref, () => ({
      play: () => {
        isPlayingRef.current = true;
      },
      pause: () => {
        isPlayingRef.current = false;
      },
      restart: () => {
        isPlayingRef.current = true;
      },
      reverse: () => {
        isPlayingRef.current = false;
      },
    }));

    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={autoPlay ? "visible" : "hidden"}
        onAnimationComplete={onComplete}
        className={cn(className)}
      >
        {Array.isArray(children)
          ? children.map((child, i) => (
              <motion.div key={i} variants={itemVariants} className={childClassName}>
                {child}
              </motion.div>
            ))
          : children}
      </motion.div>
    );
  },
);

AnimeTimeline.displayName = "AnimeTimeline";

