"use client";

interface IconProps {
  size?: number;
  className?: string;
}

export function Strawberry({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m17 7 3.5-3.5"/>
      <path d="M17 2v5h5"/>
      <path d="M2.1 17.1a4 4 0 0 0 4.8 4.8l9-2.1a6.32 6.32 0 0 0 2.9-10.9L15 5.2A6.5 6.5 0 0 0 4.1 8.3Z"/>
      <path d="M8.5 9.5h.01"/><path d="M12.5 8.5h.01"/><path d="M7.5 13.5h.01"/>
      <path d="M11.5 12.5h.01"/><path d="M15.5 11.5h.01"/><path d="M6.5 17.5h.01"/>
      <path d="M10.5 16.5h.01"/><path d="M14.5 15.5h.01"/>
    </svg>
  );
}

export function Banana({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" className={className}>
      <path d="M56 48c8 32 24 80 48 120s52 52 96 52" fill="currentColor" opacity="0.2"/>
      <path d="M56 48c8 32 24 80 48 120s52 52 96 52" stroke="currentColor" strokeWidth="14" strokeLinecap="round" fill="none"/>
      <path d="M56 48c-8 24-4 64 16 100s48 64 88 72c16 4 28 0 40 0" stroke="currentColor" strokeWidth="14" strokeLinecap="round" fill="none"/>
      <path d="M52 44c-4-8 0-16 8-16" stroke="currentColor" strokeWidth="14" strokeLinecap="round"/>
    </svg>
  );
}

export function Pineapple({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" className={className}>
      <ellipse cx="128" cy="156" rx="56" ry="72" fill="currentColor" opacity="0.2"/>
      <ellipse cx="128" cy="156" rx="56" ry="72" stroke="currentColor" strokeWidth="14" fill="none"/>
      <line x1="128" y1="84" x2="128" y2="228" stroke="currentColor" strokeWidth="6" opacity="0.3"/>
      <line x1="72" y1="120" x2="184" y2="192" stroke="currentColor" strokeWidth="6" opacity="0.3"/>
      <line x1="184" y1="120" x2="72" y2="192" stroke="currentColor" strokeWidth="6" opacity="0.3"/>
      <path d="M128 84c-12-20-4-44 4-52M116 84c-20-12-16-40-8-48M140 84c20-12 16-40 8-48" stroke="currentColor" strokeWidth="12" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

export function Peach({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" className={className}>
      <path d="M128 224c-48 0-80-36-80-80 0-48 32-88 80-88s80 40 80 88c0 44-32 80-80 80z" fill="currentColor" opacity="0.2"/>
      <path d="M128 224c-48 0-80-36-80-80 0-48 32-88 80-88s80 40 80 88c0 44-32 80-80 80z" stroke="currentColor" strokeWidth="14" fill="none"/>
      <path d="M128 56c0-20 16-32 28-36" stroke="currentColor" strokeWidth="14" strokeLinecap="round"/>
      <path d="M128 64c0 24 0 52 0 80" stroke="currentColor" strokeWidth="6" opacity="0.2"/>
    </svg>
  );
}

export function KiwiFruit({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" className={className}>
      <ellipse cx="128" cy="128" rx="80" ry="64" fill="currentColor" opacity="0.2"/>
      <ellipse cx="128" cy="128" rx="80" ry="64" stroke="currentColor" strokeWidth="14" fill="none"/>
      <circle cx="128" cy="128" r="28" stroke="currentColor" strokeWidth="8" opacity="0.4" fill="none"/>
      <circle cx="128" cy="128" r="10" fill="currentColor" opacity="0.4"/>
    </svg>
  );
}

export function Watermelon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" className={className}>
      <path d="M40 168 A100 100 0 0 1 216 168 L128 224Z" fill="currentColor" opacity="0.2"/>
      <path d="M40 168 A100 100 0 0 1 216 168" stroke="currentColor" strokeWidth="14" strokeLinecap="round" fill="none"/>
      <line x1="128" y1="224" x2="40" y2="168" stroke="currentColor" strokeWidth="14" strokeLinecap="round"/>
      <line x1="128" y1="224" x2="216" y2="168" stroke="currentColor" strokeWidth="14" strokeLinecap="round"/>
      <circle cx="100" cy="168" r="8" fill="currentColor"/><circle cx="128" cy="184" r="8" fill="currentColor"/>
      <circle cx="156" cy="168" r="8" fill="currentColor"/>
    </svg>
  );
}

export function Grape({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" className={className}>
      <circle cx="104" cy="108" r="24" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="10"/>
      <circle cx="152" cy="108" r="24" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="10"/>
      <circle cx="80" cy="152" r="24" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="10"/>
      <circle cx="128" cy="152" r="24" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="10"/>
      <circle cx="176" cy="152" r="24" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="10"/>
      <circle cx="104" cy="196" r="24" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="10"/>
      <circle cx="152" cy="196" r="24" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="10"/>
      <path d="M128 80V44M128 44c16-8 28 0 28 0" stroke="currentColor" strokeWidth="12" strokeLinecap="round"/>
    </svg>
  );
}

export function Mango({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" className={className}>
      <path d="M128 44c-52 0-88 40-88 88s28 88 88 88 88-40 88-88-36-88-88-88z" fill="currentColor" opacity="0.2"/>
      <path d="M128 44c-52 0-88 40-88 88s28 88 88 88 88-40 88-88-36-88-88-88z" stroke="currentColor" strokeWidth="14" fill="none"/>
      <path d="M128 44c4-16 20-24 32-20" stroke="currentColor" strokeWidth="14" strokeLinecap="round"/>
    </svg>
  );
}

export function Coconut({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" className={className}>
      <circle cx="128" cy="136" r="76" fill="currentColor" opacity="0.2"/>
      <circle cx="128" cy="136" r="76" stroke="currentColor" strokeWidth="14" fill="none"/>
      <circle cx="108" cy="116" r="10" fill="currentColor" opacity="0.5"/>
      <circle cx="148" cy="116" r="10" fill="currentColor" opacity="0.5"/>
      <circle cx="128" cy="152" r="10" fill="currentColor" opacity="0.5"/>
    </svg>
  );
}

export function Lemon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" className={className}>
      <ellipse cx="128" cy="128" rx="88" ry="56" transform="rotate(-30 128 128)" fill="currentColor" opacity="0.2"/>
      <ellipse cx="128" cy="128" rx="88" ry="56" transform="rotate(-30 128 128)" stroke="currentColor" strokeWidth="14" fill="none"/>
      <path d="M192 68c8-8 16-8 24 0" stroke="currentColor" strokeWidth="12" strokeLinecap="round"/>
    </svg>
  );
}

export const FRUIT_ICONS: Record<string, React.ComponentType<IconProps>> = {
  Strawberry, Banana, Pineapple, Peach, KiwiFruit, Watermelon, Grape, Mango, Coconut, Lemon,
};
