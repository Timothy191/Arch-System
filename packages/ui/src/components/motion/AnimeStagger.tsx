"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@repo/ui/lib/utils";

interface AnimeStaggerProps {
  children: React.ReactNode;
  className?: string;
  childClassName?: string;
  staggerDelay?: number;
  delayChildren?: number;
  duration?: number;
  ease?: string;
  axis?: "x" | "y";
  distance?: number;
}

export function AnimeStagger({
  children,
  className,
  childClassName,
  staggerDelay = 60,
  delayChildren = 0,
  duration = 600,
  axis = "y",
  distance = 24,
}: AnimeStaggerProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay / 1000,
        delayChildren: delayChildren / 1000,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      x: axis === "x" ? distance : 0,
      y: axis === "y" ? distance : 0,
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: duration / 1000,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
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
}

