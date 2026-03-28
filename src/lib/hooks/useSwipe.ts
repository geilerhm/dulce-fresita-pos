"use client";

import { useRef, useCallback } from "react";

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  onMove?: (deltaX: number) => void;
  onReset?: () => void;
}

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 80, onMove, onReset }: UseSwipeOptions): SwipeHandlers {
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    tracking.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!tracking.current) return;
    const deltaX = e.touches[0].clientX - startX.current;
    const deltaY = e.touches[0].clientY - startY.current;

    // If vertical movement is larger, stop tracking (it's a scroll)
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      tracking.current = false;
      onReset?.();
      return;
    }

    onMove?.(deltaX);
  }, [onMove, onReset]);

  const onTouchEnd = useCallback(() => {
    tracking.current = false;
    onReset?.();
  }, [onReset]);

  // The actual swipe detection happens via onMove + threshold in the component
  // This hook provides the raw tracking. Components use onMove to track position
  // and trigger actions when threshold is crossed.

  return { onTouchStart, onTouchMove, onTouchEnd };
}
