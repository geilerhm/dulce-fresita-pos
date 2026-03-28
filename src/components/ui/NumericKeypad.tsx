"use client";

import { formatCOP } from "@/lib/utils/format";
import { Backspace } from "@phosphor-icons/react";
import { playAdd } from "@/lib/utils/sounds";

interface NumericKeypadProps {
  value: number;
  onChange: (value: number) => void;
  maxDigits?: number;
  label?: string;
}

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["00", "0", "DEL"],
];

export function NumericKeypad({ value, onChange, maxDigits = 7, label }: NumericKeypadProps) {
  const digits = value > 0 ? String(value) : "";

  function handleKey(key: string) {
    if (key === "DEL") {
      const newDigits = digits.slice(0, -1);
      onChange(parseInt(newDigits) || 0);
      return;
    }

    const newDigits = digits + key;
    if (newDigits.length > maxDigits) return;

    onChange(parseInt(newDigits) || 0);
    playAdd();
  }

  function handleClear() {
    onChange(0);
  }

  return (
    <div className="space-y-3">
      {/* Display */}
      <button
        onClick={handleClear}
        className="w-full rounded-2xl bg-default-50 border border-default-100 px-5 py-4 text-center transition-colors hover:bg-default-100 group"
      >
        {label && (
          <p className="text-[10px] font-bold text-default-400 uppercase tracking-wider mb-1">{label}</p>
        )}
        <p className={`text-3xl font-extrabold tabular-nums tracking-tight transition-colors ${value > 0 ? "text-default-900" : "text-default-300"}`}>
          {value > 0 ? formatCOP(value) : "$ 0"}
        </p>
        {value > 0 && (
          <p className="text-[10px] text-default-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Toca para borrar
          </p>
        )}
      </button>

      {/* Keypad grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {KEYS.flat().map((key) => (
          <button
            key={key}
            onClick={() => handleKey(key)}
            className={`flex items-center justify-center h-14 rounded-xl text-lg font-bold transition-all active:scale-95 select-none
              ${key === "DEL"
                ? "bg-default-200 text-default-600 hover:bg-default-300"
                : "bg-white border border-default-200 text-default-800 hover:bg-default-50 hover:border-default-300"
              }`}
          >
            {key === "DEL" ? <Backspace size={22} weight="bold" /> : key}
          </button>
        ))}
      </div>
    </div>
  );
}
