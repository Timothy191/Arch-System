'use client';

import { motion } from 'framer-motion';

export function RefractionGlow() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-[-60px] -z-10 opacity-40 blur-[60px]"
      animate={{
        background: [
          'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18), transparent 70%)',
          'radial-gradient(circle at 70% 70%, rgba(220,240,255,0.18), transparent 70%)',
          'radial-gradient(circle at 40% 60%, rgba(255,240,240,0.18), transparent 70%)',
          'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18), transparent 70%)',
        ],
      }}
      transition={{
        duration: 10,
        repeat: Number.POSITIVE_INFINITY,
        ease: 'easeInOut',
      }}
      aria-hidden="true"
    />
  );
}
