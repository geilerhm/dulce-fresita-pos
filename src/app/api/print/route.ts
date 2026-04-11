/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { ThermalPrinter, PrinterTypes, CharacterSet } from "node-thermal-printer";
import { findByIds } from "usb";
import path from "path";
import { access } from "fs/promises";

// Jaltech POS 80mm — detected via `ioreg -p IOUSB`
const VENDOR_ID = 0x0483;
const PRODUCT_ID = 0x5743;

// ──────────────────────────────────────────────────────────────
// GOLDEN RULE
//   Every line emitted to the printer is built as a string of
//   EXACTLY (or less than) LINE_WIDTH chars, using monospace math.
//   We never rely on ESC/POS hardware alignment commands or on
//   library helpers like leftRight()/drawLine()/alignCenter().
//   All layout = string concatenation with padStart/padEnd.
//
//   This Jaltech POS 80mm physically prints 32 chars/line in Font A
//   (measured empirically — not the Epson 48-char default).
// ──────────────────────────────────────────────────────────────
const LINE_WIDTH = 32;
const LABEL_WIDTH = 11;

// ── Types ─────────────────────────────────────────────────────

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface PrintRequest {
  businessName: string;
  saleNumber: number;
  date: string;
  time: string;
  items: ReceiptItem[];
  total: number;
  paymentMethod: "efectivo" | "nequi";
  received?: number;
  change?: number;
  cashierName?: string;
  address?: string;
  phone?: string;
  nit?: string;
  footerMessage?: string;
  openDrawer?: boolean;
  showLogo?: boolean;
  blessingMessage?: string;
}

// Logo location — preprocessed by ImageMagick to 320x148 monochrome dithered PNG
const LOGO_PATH = path.join(process.cwd(), "public", "logo-ticket.png");

// ── Pure string helpers (no side effects, no library calls) ───

/** Colombian number format, no currency prefix. Matches ticket convention. */
function formatAmount(amount: number): string {
  return Math.round(amount).toLocaleString("es-CO");
}

/** Strip emojis — thermal printers can't render them, they come out as junk. */
function stripEmoji(s: string): string {
  return s
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .trim();
}

/** Truncate with ".." — PC858 has no ellipsis glyph. */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  if (max <= 2) return s.slice(0, max);
  return s.slice(0, max - 2) + "..";
}

/** Center a string by padding left with spaces — calculated, not ESC/POS. */
function center(text: string, width: number = LINE_WIDTH): string {
  const t = text.length > width ? text.slice(0, width) : text;
  const left = Math.floor((width - t.length) / 2);
  return " ".repeat(left) + t;
}

/** Right-align text within a fixed-width column. */
function right(text: string, width: number = LINE_WIDTH): string {
  return text.padStart(width);
}

/** Two-column row: left-text + right-text, padded to EXACTLY `width` chars. */
function twoCol(leftStr: string, rightStr: string, width: number = LINE_WIDTH): string {
  const space = width - leftStr.length - rightStr.length;
  if (space < 1) {
    // Overflow: truncate left so price is always visible on the right
    const maxLeft = Math.max(1, width - rightStr.length - 1);
    return leftStr.slice(0, maxLeft) + " " + rightStr;
  }
  return leftStr + " ".repeat(space) + rightStr;
}

/** Label:value row — label padded to fixed column width, then value. */
function labelRow(label: string, value: string, labelWidth: number = LABEL_WIDTH): string {
  return label.padEnd(labelWidth) + value;
}

/** Full-width separator made of a single repeating character. */
function separator(char: string = "-", width: number = LINE_WIDTH): string {
  return char.repeat(width);
}

/** Split multi-part address by comma for multi-line centered rendering. */
function splitAddress(addr: string): string[] {
  return addr.split(",").map((p) => p.trim()).filter(Boolean);
}

// ── USB transport ─────────────────────────────────────────────

async function sendToUsb(buffer: Buffer): Promise<void> {
  const device = findByIds(VENDOR_ID, PRODUCT_ID);
  if (!device) {
    throw new Error(
      `Impresora no detectada (vendor=0x${VENDOR_ID.toString(16)}, product=0x${PRODUCT_ID.toString(16)}). Verifica que esté conectada y encendida.`
    );
  }

  device.open();

  try {
    const iface = device.interface(0);

    try {
      if (iface.isKernelDriverActive()) iface.detachKernelDriver();
    } catch {
      // Not supported on all platforms — ignore
    }

    iface.claim();

    const outEndpoint = iface.endpoints.find((e: any) => e.direction === "out");
    if (!outEndpoint) {
      throw new Error("No se encontró endpoint OUT en la impresora");
    }

    await new Promise<void>((resolve, reject) => {
      (outEndpoint as any).transfer(buffer, (err: Error | undefined) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise<void>((resolve) => {
      iface.release(true, () => resolve());
    });
  } finally {
    try {
      device.close();
    } catch {
      // ignore
    }
  }
}

// ── Route ─────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const data: PrintRequest = await request.json();

    // The library is used ONLY as a byte-pipe + ESC/POS formatting
    // (bold, double-height). All layout is built by the helpers above.
    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: "tcp://localhost:9100", // unused — we emit manually
      characterSet: CharacterSet.PC858_EURO,
      width: LINE_WIDTH, // safety net for any stray helper call
      removeSpecialCharacters: false,
    });

    // Reset printer (ESC @) + force left alignment (ESC a 0).
    // All centering is done in software via padding.
    printer.append(Buffer.from([0x1B, 0x40, 0x1B, 0x61, 0x00]));

    // ════════════════ HEADER ════════════════
    // Logo (centered via hardware — raster images can't be padded) + phone.
    // Business name / NIT / address intentionally omitted — the logo already
    // carries the brand identity.
    let logoPrinted = false;
    if (data.showLogo !== false) {
      try {
        await access(LOGO_PATH);
        printer.append(Buffer.from([0x1B, 0x61, 0x01])); // ESC a 1 — center
        await printer.printImage(LOGO_PATH);
        printer.append(Buffer.from([0x1B, 0x61, 0x00])); // ESC a 0 — back to left
        logoPrinted = true;
      } catch {
        // Logo file missing — fall back to business name text below
      }
    }

    // Fallback: if logo didn't print, show the business name as a heading
    if (!logoPrinted) {
      printer.bold(true);
      printer.setTextDoubleHeight();
      printer.println(center(data.businessName.toUpperCase()));
      printer.setTextNormal();
      printer.bold(false);
    }

    if (data.phone) {
      printer.println(center(`Tel: ${data.phone}`));
    }

    printer.newLine();
    printer.println(separator("-"));

    // ════════════════ METADATA ════════════════
    printer.println(labelRow("Factura:", `#${data.saleNumber}`));
    printer.println(labelRow("Fecha:", `${data.date} ${data.time}`));
    if (data.cashierName) {
      printer.println(labelRow("Cajero:", data.cashierName));
    }

    printer.println(separator("-"));
    printer.newLine();

    // ════════════════ ITEMS ════════════════
    // qty === 1  →  "Name                            subtotal"   (1 line)
    // qty  >  1  →  "Name"                                       (line 1)
    //               "{qty} x {unit}               subtotal"      (line 2)
    for (const item of data.items) {
      const subtotalStr = formatAmount(item.subtotal);

      if (item.quantity > 1) {
        printer.println(truncate(item.name, LINE_WIDTH));
        const qtyLine = `${item.quantity} x ${formatAmount(item.unitPrice)}`;
        printer.println(twoCol(qtyLine, subtotalStr));
      } else {
        const availForName = LINE_WIDTH - subtotalStr.length - 1;
        const displayName = truncate(item.name, Math.max(8, availForName));
        printer.println(twoCol(displayName, subtotalStr));
      }
    }

    printer.newLine();

    // ════════════════ TOTAL (boxed with ══) ════════════════
    printer.println(separator("="));
    printer.bold(true);
    printer.setTextDoubleHeight();
    printer.println(twoCol("TOTAL", formatAmount(data.total)));
    printer.setTextNormal();
    printer.bold(false);
    printer.println(separator("="));

    printer.newLine();

    // ════════════════ PAYMENT ════════════════
    const methodLabel = data.paymentMethod === "efectivo" ? "Efectivo" : "Nequi";
    printer.println(labelRow("Pago:", methodLabel));
    if (data.paymentMethod === "efectivo" && typeof data.received === "number") {
      printer.println(labelRow("Recibido:", formatAmount(data.received)));
      printer.println(labelRow("Cambio:", formatAmount(data.change ?? 0)));
    }

    printer.newLine();

    // ════════════════ FOOTER ════════════════
    if (data.footerMessage) {
      printer.println(separator("-"));
      for (const rawLine of data.footerMessage.split("\n")) {
        const clean = stripEmoji(rawLine);
        if (clean) printer.println(center(clean));
      }
    }

    // ════════════════ BLESSING (Font B + italic attempt) ════════════════
    // Random motivational phrase, picked by the client per print.
    // Font B is narrower (~42 chars on an 80mm printer where Font A is 32).
    // ESC 4 / ESC 5 toggle italic mode — supported by some ESC/POS printers,
    // silently ignored by others. If italic isn't rendered, the Font B size
    // still differentiates the blessing visually.
    if (data.blessingMessage) {
      const clean = stripEmoji(data.blessingMessage);
      if (clean) {
        printer.setTypeFontB();
        printer.append(Buffer.from([0x1B, 0x34])); // ESC 4 — italic on
        printer.println(center(clean, 42));
        printer.append(Buffer.from([0x1B, 0x35])); // ESC 5 — italic off
        printer.setTypeFontA();
      }
    }

    // ════════════════ CUT ════════════════
    if (data.openDrawer) {
      printer.openCashDrawer();
    }

    // Feed + full cut. The Jaltech cutter gap is ~6-9mm, so 4 lines (~12mm)
    // ensures the last printed text is safely past the blade with a small
    // visible margin. Reducing below 3 lines crops the last content line.
    //   ESC d 4  (0x1B 0x64 0x04) — feed 4 lines
    //   GS  V 0  (0x1D 0x56 0x00) — full cut
    printer.append(Buffer.from([0x1B, 0x64, 0x04, 0x1D, 0x56, 0x00]));

    const buffer = printer.getBuffer();
    await sendToUsb(buffer);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[/api/print] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}

/** Quick health check: is the printer detected on USB? */
export async function GET() {
  try {
    const device = findByIds(VENDOR_ID, PRODUCT_ID);
    return NextResponse.json({
      connected: !!device,
      vendorId: `0x${VENDOR_ID.toString(16).padStart(4, "0")}`,
      productId: `0x${PRODUCT_ID.toString(16).padStart(4, "0")}`,
      lineWidth: LINE_WIDTH,
    });
  } catch (err: any) {
    return NextResponse.json(
      { connected: false, error: err?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}
