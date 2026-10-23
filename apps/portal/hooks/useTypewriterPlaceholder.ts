import { useEffect, useState } from 'react';

interface TypewriterOptions {
  typeMs?: number;
  deleteMs?: number;
  holdMs?: number;
  restartMs?: number;
  startDelayMs?: number;
}

/**
 * Types `text` into view, holds it, deletes it, then loops. Returns the full
 * text when paused or when the user prefers reduced motion.
 */
export function useTypewriterPlaceholder(
  text: string,
  paused = false,
  {
    typeMs = 55,
    deleteMs = 28,
    holdMs = 1800,
    restartMs = 500,
    startDelayMs = 400,
  }: TypewriterOptions = {}
): string {
  const [display, setDisplay] = useState(text);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) {
      setDisplay(text);
      return;
    }

    let index = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    setDisplay('');

    const step = () => {
      if (!deleting) {
        index += 1;
        setDisplay(text.slice(0, index));
        if (index >= text.length) {
          deleting = true;
          timer = setTimeout(step, holdMs);
          return;
        }
        timer = setTimeout(step, typeMs);
        return;
      }

      index -= 1;
      setDisplay(text.slice(0, index));
      if (index <= 0) {
        deleting = false;
        timer = setTimeout(step, restartMs);
        return;
      }
      timer = setTimeout(step, deleteMs);
    };

    timer = setTimeout(step, startDelayMs);
    return () => clearTimeout(timer);
  }, [text, paused, reducedMotion, typeMs, deleteMs, holdMs, restartMs, startDelayMs]);

  return display;
}
