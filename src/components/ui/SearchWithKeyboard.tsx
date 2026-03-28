"use client";

import { useState } from "react";
import { MagnifyingGlass, X, Backspace } from "@phosphor-icons/react";

interface SearchWithKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const ROW1 = "QWERTYUIOP".split("");
const ROW2 = "ASDFGHJKL".split("");
const ROW3 = "ZXCVBNM".split("");

export function SearchWithKeyboard({ value, onChange, placeholder = "Buscar..." }: SearchWithKeyboardProps) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  function handleKey(char: string) {
    onChange(value + char);
  }

  function handleDelete() {
    onChange(value.slice(0, -1));
  }

  function handleClear() {
    onChange("");
  }

  function handleClose() {
    setKeyboardOpen(false);
  }

  return (
    <div className="relative flex-1">
      {/* Search input */}
      <div className="relative">
        <MagnifyingGlass size={16} weight="duotone" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-default-400 pointer-events-none" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onFocus={() => setKeyboardOpen(true)}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") { onChange(""); setKeyboardOpen(false); (e.target as HTMLInputElement).blur(); } }}
          className={`w-full h-11 rounded-xl border pl-10 pr-10 text-sm outline-none transition-all
            ${keyboardOpen ? "border-primary bg-white ring-1 ring-primary/20" : "border-default-200 bg-default-50 hover:border-default-300"}`}
        />
        {value && (
          <button onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-xl text-default-400 hover:text-default-600 hover:bg-default-200 transition-colors">
            <X size={14} weight="bold" />
          </button>
        )}
      </div>

      {/* Virtual keyboard — fixed at bottom of viewport */}
      {keyboardOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-default-200 bg-default-100 px-4 py-3 space-y-2">
          <div className="flex gap-1 justify-center">
            {ROW1.map((k) => (
              <button key={k} onClick={() => handleKey(k)}
                className="flex-1 max-w-[52px] h-12 rounded-xl bg-white border border-default-200 text-sm font-bold text-default-800 hover:bg-default-50 active:scale-90 active:bg-default-200 transition-all select-none shadow-sm">
                {k}
              </button>
            ))}
          </div>
          <div className="flex gap-1 justify-center px-4">
            {ROW2.map((k) => (
              <button key={k} onClick={() => handleKey(k)}
                className="flex-1 max-w-[52px] h-12 rounded-xl bg-white border border-default-200 text-sm font-bold text-default-800 hover:bg-default-50 active:scale-90 active:bg-default-200 transition-all select-none shadow-sm">
                {k}
              </button>
            ))}
          </div>
          <div className="flex gap-1 justify-center">
            <button onClick={handleClear}
              className="h-12 px-4 rounded-xl bg-default-200 text-xs font-bold text-default-600 hover:bg-default-300 active:scale-90 transition-all select-none">
              Borrar
            </button>
            {ROW3.map((k) => (
              <button key={k} onClick={() => handleKey(k)}
                className="flex-1 max-w-[52px] h-12 rounded-xl bg-white border border-default-200 text-sm font-bold text-default-800 hover:bg-default-50 active:scale-90 active:bg-default-200 transition-all select-none shadow-sm">
                {k}
              </button>
            ))}
            <button onClick={handleDelete}
              className="h-12 px-4 rounded-xl bg-default-200 text-default-600 hover:bg-default-300 active:scale-90 transition-all select-none flex items-center justify-center">
              <Backspace size={20} weight="bold" />
            </button>
          </div>
          <div className="flex gap-1.5 justify-center">
            <button onClick={() => handleKey(" ")}
              className="w-[180px] h-12 rounded-xl bg-white border border-default-200 text-sm font-medium text-default-500 hover:bg-default-50 active:scale-95 transition-all select-none shadow-sm">
              espacio
            </button>
            <button onClick={handleClose}
              className="h-12 px-6 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-105 active:scale-95 transition-all select-none flex items-center justify-center gap-1.5">
              <X size={16} weight="bold" />
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
