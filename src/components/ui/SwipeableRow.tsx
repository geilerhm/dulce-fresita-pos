"use client";

import { useRef, useState, useCallback, type ReactNode } from "react";
import { Trash } from "@phosphor-icons/react";

interface SwipeableRowProps {
  children: ReactNode;
  onDelete: () => void;
  className?: string;
}

const THRESHOLD = 80;
const MAX_SWIPE = 100;

export function SwipeableRow({ children, onDelete, className }: SwipeableRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);
  const swiping = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    tracking.current = true;
    swiping.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!tracking.current) return;

    const deltaX = e.touches[0].clientX - startX.current;
    const deltaY = e.touches[0].clientY - startY.current;

    // First movement: decide if horizontal or vertical
    if (!swiping.current && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
      // Vertical — let it scroll
      tracking.current = false;
      return;
    }

    if (Math.abs(deltaX) > 8) {
      swiping.current = true;
    }

    if (!swiping.current) return;

    // Only allow swipe left (negative)
    if (revealed) {
      // Already revealed: allow swiping back right
      const newOffset = Math.min(0, Math.max(-MAX_SWIPE, deltaX - THRESHOLD));
      setOffsetX(newOffset);
    } else {
      const newOffset = Math.min(0, Math.max(-MAX_SWIPE, deltaX));
      setOffsetX(newOffset);
    }
  }, [revealed]);

  const handleTouchEnd = useCallback(() => {
    tracking.current = false;

    if (Math.abs(offsetX) > THRESHOLD) {
      // Reveal delete button
      setOffsetX(-THRESHOLD);
      setRevealed(true);
    } else {
      // Snap back
      setOffsetX(0);
      setRevealed(false);
    }
  }, [offsetX]);

  function handleDelete() {
    setOffsetX(-300); // Animate out
    setTimeout(() => {
      onDelete();
      setOffsetX(0);
      setRevealed(false);
    }, 200);
  }

  function handleTap() {
    if (revealed) {
      setOffsetX(0);
      setRevealed(false);
    }
  }

  return (
    <div className={`relative overflow-hidden ${className || ""}`}>
      {/* Delete action behind */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-red-500 text-white"
        style={{ width: THRESHOLD }}>
        <button onClick={handleDelete} className="flex flex-col items-center gap-0.5 w-full h-full justify-center active:bg-red-600 transition-colors">
          <Trash size={20} weight="bold" />
          <span className="text-[10px] font-bold">Eliminar</span>
        </button>
      </div>

      {/* Swipeable content */}
      <div
        className="relative bg-white transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${offsetX}px)`, transitionDuration: tracking.current && swiping.current ? "0ms" : "150ms" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleTap}
      >
        {children}
      </div>
    </div>
  );
}
