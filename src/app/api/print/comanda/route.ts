/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { ThermalPrinter, PrinterTypes, CharacterSet } from "node-thermal-printer";
import { findByIds } from "usb";

// Same Jaltech POS 80mm printer as the receipt route
const VENDOR_ID = 0x0483;
const PRODUCT_ID = 0x5743;
const LINE_WIDTH = 32;

// ── Types ─────────────────────────────────────────────────────

interface KitchenIngredient {
  name: string;
  quantity: number;
  unit: string;
}

interface KitchenProduct {
  name: string;
  quantity: number;
  ingredients: KitchenIngredient[];
}

interface ComandaRequest {
  saleNumber: number;
  time: string;
  products: KitchenProduct[];
}

// ── String helpers (32-char monospace layout) ─────────────────

function center(text: string, width: number = LINE_WIDTH): string {
  const t = text.length > width ? text.slice(0, width) : text;
  const left = Math.floor((width - t.length) / 2);
  return " ".repeat(left) + t;
}

function separator(char: string = "-", width: number = LINE_WIDTH): string {
  return char.repeat(width);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  if (max <= 2) return s.slice(0, max);
  return s.slice(0, max - 2) + "..";
}

function formatQty(qty: number, unit: string): string {
  const display = qty % 1 === 0 ? String(qty) : qty.toFixed(1);
  return `${display}${unit}`;
}

// ── USB transport (same as receipt route) ─────────────────────

async function sendToUsb(buffer: Buffer): Promise<void> {
  const device = findByIds(VENDOR_ID, PRODUCT_ID);
  if (!device) {
    throw new Error("Impresora no detectada");
  }

  device.open();
  try {
    const iface = device.interface(0);
    try { if (iface.isKernelDriverActive()) iface.detachKernelDriver(); } catch {}
    iface.claim();

    const outEndpoint = iface.endpoints.find((e: any) => e.direction === "out");
    if (!outEndpoint) throw new Error("No se encontró endpoint OUT");

    await new Promise<void>((resolve, reject) => {
      (outEndpoint as any).transfer(buffer, (err: Error | undefined) => {
        if (err) reject(err); else resolve();
      });
    });

    await new Promise<void>((resolve) => {
      iface.release(true, () => resolve());
    });
  } finally {
    try { device.close(); } catch {}
  }
}

// ── Route ─────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const data: ComandaRequest = await request.json();

    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: "tcp://localhost:9100",
      characterSet: CharacterSet.PC858_EURO,
      width: LINE_WIDTH,
      removeSpecialCharacters: false,
    });

    // Reset + left align
    printer.append(Buffer.from([0x1B, 0x40, 0x1B, 0x61, 0x00]));

    // ══ HEADER ══
    printer.bold(true);
    printer.setTextDoubleHeight();
    printer.append(Buffer.from([0x1B, 0x61, 0x01])); // center
    printer.println(`COMANDA #${data.saleNumber}`);
    printer.setTextNormal();
    printer.bold(false);
    printer.println(data.time);
    printer.append(Buffer.from([0x1B, 0x61, 0x00])); // left
    printer.println(separator("="));
    printer.newLine();

    // ══ PRODUCTS + INGREDIENTS ══
    for (const product of data.products) {
      // Product name — bold, double height
      const prodLabel = product.quantity > 1
        ? `${product.quantity}x ${product.name}`
        : product.name;

      printer.bold(true);
      printer.setTextDoubleHeight();
      printer.println(truncate(prodLabel, LINE_WIDTH));
      printer.setTextNormal();
      printer.bold(false);

      // Ingredients — Font B for smaller text, indented
      printer.setTypeFontB();
      for (const ing of product.ingredients) {
        const qtyStr = formatQty(ing.quantity, ing.unit);
        // "  · 400g Fresas frescas" — max 42 chars in Font B
        const line = `  ${qtyStr} ${ing.name}`;
        printer.println(truncate(line, 42));
      }
      printer.setTypeFontA();
      printer.newLine();
    }

    // ══ FOOTER ══
    printer.println(separator("="));
    printer.setTypeFontB();
    printer.append(Buffer.from([0x1B, 0x61, 0x01])); // center
    const totalProds = data.products.reduce((s, p) => s + p.quantity, 0);
    const totalIngs = data.products.reduce((s, p) => s + p.ingredients.length, 0);
    printer.println(`${totalProds} productos - ${totalIngs} ingredientes`);
    printer.append(Buffer.from([0x1B, 0x61, 0x00])); // left
    printer.setTypeFontA();

    // Feed + cut
    printer.append(Buffer.from([0x1B, 0x64, 0x04, 0x1D, 0x56, 0x00]));

    const buffer = printer.getBuffer();
    await sendToUsb(buffer);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[/api/print/comanda] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Error desconocido" },
      { status: 500 },
    );
  }
}
