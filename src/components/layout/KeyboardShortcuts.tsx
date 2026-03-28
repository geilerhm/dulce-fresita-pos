"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Keyboard } from "@phosphor-icons/react";

// Global keyboard shortcuts for the POS app
const SHORTCUTS = [
  { keys: "F1", label: "Vender (POS)", action: "nav:/pos" },
  { keys: "F2", label: "Caja", action: "nav:/caja" },
  { keys: "F3", label: "Resumen", action: "nav:/dashboard" },
  { keys: "F4", label: "Reportes", action: "nav:/reportes" },
  { keys: "F5", label: "Inventario", action: "nav:/inventario" },
  { keys: "F6", label: "Productos", action: "nav:/productos" },
  { keys: "/", label: "Buscar producto (POS)", action: "search" },
  { keys: "F11", label: "Pantalla completa", action: "fullscreen" },
  { keys: "Esc", label: "Cerrar / Cancelar", action: "escape" },
  { keys: "?", label: "Ver atajos", action: "help" },
];

export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Don't intercept when typing in inputs
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // F-keys work everywhere
      if (e.key === "F1") { e.preventDefault(); router.push("/pos"); return; }
      if (e.key === "F2") { e.preventDefault(); router.push("/caja"); return; }
      if (e.key === "F3") { e.preventDefault(); router.push("/dashboard"); return; }
      if (e.key === "F4") { e.preventDefault(); router.push("/reportes"); return; }
      if (e.key === "F5") { e.preventDefault(); router.push("/inventario"); return; }
      if (e.key === "F6") { e.preventDefault(); router.push("/productos"); return; }
      if (e.key === "F7") { e.preventDefault(); router.push("/productos"); return; }

      // These only work when NOT in an input
      if (isInput) return;

      if (e.key === "/" && pathname === "/pos") {
        e.preventDefault();
        document.getElementById("pos-search")?.focus();
        return;
      }

      if (e.key === "?" && !e.shiftKey) {
        setShowHelp((v) => !v);
        return;
      }

      if (e.key === "Escape") {
        setShowHelp(false);
        return;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router, pathname]);

  if (!showHelp) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
      <div className="animate-in zoom-in-95 fade-in duration-200 w-full max-w-md mx-4 rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-6 py-4 border-b border-default-100">
          <Keyboard size={20} weight="duotone" className="text-primary" />
          <h2 className="text-lg font-bold text-default-800">Atajos de teclado</h2>
        </div>

        <div className="px-6 py-4 space-y-1">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between py-2">
              <span className="text-sm text-default-600">{s.label}</span>
              <kbd className="px-2.5 py-1 rounded-lg bg-default-100 border border-default-200 text-xs font-mono font-bold text-default-700">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-default-100 bg-default-50/50">
          <p className="text-xs text-default-400 text-center">
            Presiona <kbd className="px-1.5 py-0.5 rounded bg-default-200 text-[10px] font-mono font-bold">?</kbd> para cerrar
          </p>
        </div>
      </div>
    </div>
  );
}
