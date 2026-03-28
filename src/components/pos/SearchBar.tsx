"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useRef } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  isActive: boolean;
}

export function SearchBar({ value, onChange, onFocus, isActive }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative flex-1">
      <MagnifyingGlass size={16} weight="duotone" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-default-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar producto..."
        value={value}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") { onChange(""); inputRef.current?.blur(); } }}
        className={`w-full h-10 rounded-xl border pl-10 pr-10 text-sm outline-none transition-all
          ${isActive
            ? "border-primary bg-white ring-1 ring-primary/20"
            : "border-default-200 bg-default-50 hover:border-default-300"
          }`}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-xl text-default-400 hover:text-default-600 hover:bg-default-200 transition-colors"
        >
          <X size={14} weight="bold" />
        </button>
      )}
    </div>
  );
}
