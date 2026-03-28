"use client";

import { Backspace, X } from "@phosphor-icons/react";

interface VirtualKeyboardProps {
  onKey: (char: string) => void;
  onDelete: () => void;
  onClear: () => void;
  onClose: () => void;
}

const ROW1 = "QWERTYUIOP".split("");
const ROW2 = "ASDFGHJKL".split("");
const ROW3 = "ZXCVBNM".split("");

export function VirtualKeyboard({
  onKey,
  onDelete,
  onClear,
  onClose,
}: VirtualKeyboardProps) {
  return (
    <div className="border-t border-default-200 bg-default-100 px-4 py-3 space-y-2 shrink-0">
      {/* Row 1 */}
      <div className="flex gap-1 justify-center">
        {ROW1.map((k) => (
          <button
            key={k}
            onClick={() => onKey(k)}
            className="flex-1 max-w-[56px] h-14 rounded-xl bg-white border border-default-200 text-base font-bold text-default-800 hover:bg-default-50 active:scale-90 active:bg-default-200 transition-all select-none shadow-sm"
          >
            {k}
          </button>
        ))}
      </div>

      {/* Row 2 */}
      <div className="flex gap-1 justify-center px-4">
        {ROW2.map((k) => (
          <button
            key={k}
            onClick={() => onKey(k)}
            className="flex-1 max-w-[56px] h-14 rounded-xl bg-white border border-default-200 text-base font-bold text-default-800 hover:bg-default-50 active:scale-90 active:bg-default-200 transition-all select-none shadow-sm"
          >
            {k}
          </button>
        ))}
      </div>

      {/* Row 3 + actions */}
      <div className="flex gap-1 justify-center">
        <button
          onClick={onClear}
          className="h-14 px-4 rounded-xl bg-default-200 text-xs font-bold text-default-600 hover:bg-default-300 active:scale-90 transition-all select-none"
        >
          Borrar
        </button>
        {ROW3.map((k) => (
          <button
            key={k}
            onClick={() => onKey(k)}
            className="flex-1 max-w-[56px] h-14 rounded-xl bg-white border border-default-200 text-base font-bold text-default-800 hover:bg-default-50 active:scale-90 active:bg-default-200 transition-all select-none shadow-sm"
          >
            {k}
          </button>
        ))}
        <button
          onClick={onDelete}
          className="h-14 px-4 rounded-xl bg-default-200 text-default-600 hover:bg-default-300 active:scale-90 transition-all select-none flex items-center justify-center"
        >
          <Backspace size={20} weight="bold" />
        </button>
      </div>

      {/* Space + Close */}
      <div className="flex gap-1.5 justify-center">
        <button
          onClick={() => onKey(" ")}
          className="w-[470px] h-14 rounded-xl bg-white border border-default-200 text-sm font-medium text-default-500 hover:bg-default-50 active:scale-95 active:bg-default-200 transition-all select-none shadow-sm"
        >
          espacio
        </button>
        <button
          onClick={onClose}
          className="h-14 px-6 rounded-xl bg-primary text-white text-base font-bold hover:brightness-105 active:scale-95 transition-all select-none flex items-center justify-center gap-1.5"
        >
          <X size={16} weight="bold" />
          Cerrar
        </button>
      </div>
    </div>
  );
}
