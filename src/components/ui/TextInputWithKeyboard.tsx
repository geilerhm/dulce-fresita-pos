"use client";

import { useState, useId } from "react";
import { Backspace, X, ArrowFatUp } from "@phosphor-icons/react";

interface TextInputWithKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  uppercase?: boolean;
  password?: boolean;
  className?: string;
}

const ROW1 = "QWERTYUIOP".split("");
const ROW2 = "ASDFGHJKL".split("");
const ROW3 = "ZXCVBNM".split("");
const NUMBERS = "1234567890".split("");
const SYMBOLS = [".", ",", "@", "!", "?", "/", "(", ")", "_", "+"];

export function TextInputWithKeyboard({ value, onChange, placeholder, label, error, uppercase, password, className }: TextInputWithKeyboardProps) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(false);
  const [showSymbols, setShowSymbols] = useState(false);
  const id = useId();

  const isUpper = uppercase || shift;

  function handleKey(char: string) {
    onChange(value + (isUpper ? char.toUpperCase() : char.toLowerCase()));
    if (shift) setShift(false); // Auto-release shift after one key
  }

  function keyClass(extra = "") {
    return `flex-1 max-w-[50px] h-12 rounded-xl bg-white border border-default-200 text-sm font-bold text-default-800 hover:bg-default-50 active:scale-90 transition-all select-none shadow-sm ${extra}`;
  }

  return (
    <div className={className}>
      {label && <label htmlFor={id} className="text-xs font-bold text-default-500 uppercase tracking-wider block mb-1.5">{label}</label>}
      <input
        id={id}
        type={password ? "password" : "text"}
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
        className={`w-full h-12 px-4 rounded-xl border text-sm outline-none transition-all
          ${error ? "border-red-300 bg-red-50/30 focus:border-red-400 focus:ring-1 focus:ring-red-200" :
            open ? "border-primary bg-white ring-1 ring-primary/20" :
            "border-default-200 bg-default-50 focus:border-primary focus:ring-1 focus:ring-primary/30"}`}
      />
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}

      {open && (
        <>
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-default-200 bg-default-100 px-4 py-2.5 space-y-1.5">
          {/* Numbers + symbols row */}
          <div className="flex gap-1 justify-center">
            {(showSymbols ? SYMBOLS : NUMBERS).map((k) => (
              <button key={k} onClick={() => handleKey(k)} className={keyClass()}>
                {k}
              </button>
            ))}
          </div>

          {/* Row 1 */}
          <div className="flex gap-1 justify-center">
            {ROW1.map((k) => (
              <button key={k} onClick={() => handleKey(k)} className={keyClass()}>
                {isUpper ? k : k.toLowerCase()}
              </button>
            ))}
          </div>

          {/* Row 2 */}
          <div className="flex gap-1 justify-center px-3">
            {ROW2.map((k) => (
              <button key={k} onClick={() => handleKey(k)} className={keyClass()}>
                {isUpper ? k : k.toLowerCase()}
              </button>
            ))}
          </div>

          {/* Row 3: Shift + letters + backspace */}
          <div className="flex gap-1 justify-center">
            <button onClick={() => setShift(!shift)}
              className={`h-12 px-3 rounded-xl text-sm font-bold active:scale-90 transition-all select-none flex items-center justify-center ${shift ? "bg-primary text-white" : "bg-default-200 text-default-600 hover:bg-default-300"}`}>
              <ArrowFatUp size={18} weight={shift ? "fill" : "bold"} />
            </button>
            {ROW3.map((k) => (
              <button key={k} onClick={() => handleKey(k)} className={keyClass()}>
                {isUpper ? k : k.toLowerCase()}
              </button>
            ))}
            <button onClick={() => onChange(value.slice(0, -1))}
              className="h-12 px-3 rounded-xl bg-default-200 text-default-600 hover:bg-default-300 active:scale-90 transition-all select-none flex items-center justify-center">
              <Backspace size={18} weight="bold" />
            </button>
          </div>

          {/* Bottom row: symbols toggle, space, special chars, close */}
          <div className="flex gap-1.5 justify-center">
            <button onClick={() => setShowSymbols(!showSymbols)}
              className={`h-12 px-3 rounded-xl text-[11px] font-bold active:scale-90 transition-all select-none ${showSymbols ? "bg-primary text-white" : "bg-default-200 text-default-600 hover:bg-default-300"}`}>
              {showSymbols ? "ABC" : ".,?!"}
            </button>
            <button onClick={() => handleKey(".")} className="h-12 w-10 rounded-xl bg-white border border-default-200 text-sm font-bold text-default-600 active:scale-90 transition-all select-none shadow-sm">.</button>
            <button onClick={() => handleKey(",")} className="h-12 w-10 rounded-xl bg-white border border-default-200 text-sm font-bold text-default-600 active:scale-90 transition-all select-none shadow-sm">,</button>
            <button onClick={() => handleKey(" ")}
              className="flex-1 max-w-[160px] h-12 rounded-xl bg-white border border-default-200 text-sm font-medium text-default-500 active:scale-95 transition-all select-none shadow-sm">
              espacio
            </button>
            <button onClick={() => onChange("")}
              className="h-12 px-3 rounded-xl bg-default-200 text-[11px] font-bold text-default-600 hover:bg-default-300 active:scale-90 transition-all select-none">
              Borrar
            </button>
            <button onClick={() => setOpen(false)}
              className="h-12 px-4 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-105 active:scale-95 transition-all select-none flex items-center justify-center gap-1.5">
              <X size={14} weight="bold" />
              OK
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
