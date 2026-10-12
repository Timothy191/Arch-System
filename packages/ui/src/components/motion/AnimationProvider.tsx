import { domAnimation, LazyMotion } from 'framer-motion';
import React from 'react';

export function AnimationProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
