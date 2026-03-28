export const PAYMENT_METHODS = [
  { id: "efectivo", label: "Efectivo" },
  { id: "nequi", label: "Nequi" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["id"];

// Category icons — lucide icon names for professional look
export const CATEGORY_ICONS: Record<string, string> = {
  "frutas-con-crema": "🍓",
  "waffles": "🧇",
  "crepas": "🥞",
  "malteadas": "🥤",
  "helados": "🍦",
  "jugos": "🧃",
  "cafe-leche": "☕",
  "obleas": "🫓",
  "churros": "🍩",
  "chocolate": "🍫",
  "cajitas": "📦",
  "fusiones": "✨",
  "especiales": "⭐",
  "frutas-mas": "🥝",
  "toppings": "🍬",
  "salsas": "🍯",
  "alguito-salado": "🧀",
};
