/**
 * Convert a quantity between compatible units (mass or volume).
 * Returns null when units are incompatible (e.g. kg → ml, or kg → caja).
 *
 * Discrete units (und, caja, bolsa, tarro, paquete) only "convert" to
 * themselves — anything else returns null so callers can decide whether
 * to skip the operation or surface an error, instead of silently treating
 * mismatched units as identical (which is what caused stock_quantity to
 * collapse to 0 when a recipe in grams was subtracted from a kg stock).
 */

const ALIASES: Record<string, string> = {
  gr: "g",
  lt: "l",
};

function normalize(u: string | null | undefined): string {
  const lower = (u ?? "").trim().toLowerCase();
  return ALIASES[lower] ?? lower;
}

const TO_BASE: Record<string, { group: "mass" | "volume"; factor: number }> = {
  g: { group: "mass", factor: 1 },
  kg: { group: "mass", factor: 1000 },
  ml: { group: "volume", factor: 1 },
  l: { group: "volume", factor: 1000 },
};

export function convertQuantity(
  qty: number,
  fromUnit: string | null | undefined,
  toUnit: string | null | undefined,
): number | null {
  const from = normalize(fromUnit);
  const to = normalize(toUnit);

  if (from === to) return qty;

  const fInfo = TO_BASE[from];
  const tInfo = TO_BASE[to];
  if (!fInfo || !tInfo) return null;
  if (fInfo.group !== tInfo.group) return null;

  return (qty * fInfo.factor) / tInfo.factor;
}
