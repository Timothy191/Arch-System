"use client";

import { motion } from "framer-motion";

export function RefractionGlow() {
  return (
    <motion.div
      className="absolute inset-[-60px] -z-10 blur-[60px] opacity-40 pointer-events-none"
      animate={{
        background: [
          "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18), transparent 70%)",
          "radial-gradient(circle at 70% 70%, rgba(220,240,255,0.18), transparent 70%)",
          "radial-gradient(circle at 40% 60%, rgba(255,240,240,0.18), transparent 70%)",
          "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18), transparent 70%)",
        ],
      }}
      transition={{
        duration: 10,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
      aria-hidden="true"
    />
  );
}
