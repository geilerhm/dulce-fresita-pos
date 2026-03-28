"use client";

import { useEffect, useRef } from "react";

/**
 * Swipe right from the left edge of the screen to go back.
 * Only triggers if the touch starts within 20px of the left edge.
 */
export function useBackGesture(onBack: (() => void) | null) {
  const startX = useRef(0);
  const startY = useRef(0);
  const active = useRef(false);

  useEffect(() => {
    if (!onBack) return;

    function handleStart(e: TouchEvent) {
      const x = e.touches[0].clientX;
      if (x > 25) return; // Only from left edge
      startX.current = x;
      startY.current = e.touches[0].clientY;
      active.current = true;
    }

    function handleMove(e: TouchEvent) {
      if (!active.current) return;
      const deltaY = Math.abs(e.touches[0].clientY - startY.current);
      if (deltaY > 30) { active.current = false; } // Too much vertical = scroll
    }

    function handleEnd(e: TouchEvent) {
      if (!active.current) return;
      active.current = false;
      const deltaX = e.changedTouches[0].clientX - startX.current;
      if (deltaX > 100) { onBack?.(); }
    }

    window.addEventListener("touchstart", handleStart, { passive: true });
    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("touchend", handleEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleStart);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [onBack]);
}
