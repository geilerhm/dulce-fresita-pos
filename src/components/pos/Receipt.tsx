"use client";

import { formatCOP } from "@/lib/utils/format";
import { getReceiptConfig, type ReceiptConfig } from "@/lib/utils/receipt-config";
import { pickRandomBlessing } from "@/lib/utils/blessing-phrases";

export interface ReceiptData {
  businessName: string;
  saleNumber: number;
  date: string;
  time: string;
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
  total: number;
  paymentMethod: "efectivo" | "nequi";
  received?: number;
  change?: number;
  cashierName?: string;
}

/**
 * Fetch the brand logo as a base64 data URL.
 *
 * Required because Electron's silent print loads HTML via a
 * `data:text/html;...` URL — relative URLs like `/logo-ticket.png` can't
 * be resolved from inside that context. Inlining as base64 is the only
 * way to get the image into the printed HTML.
 */
async function fetchLogoDataUrl(): Promise<string> {
  try {
    const res = await fetch("/logo-ticket.png", { cache: "force-cache" });
    if (!res.ok) return "";
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return s.replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Build the receipt HTML — designed to mirror the ESC/POS thermal layout
 * as closely as possible so the Windows-printed receipt LOOKS like the
 * Mac-printed one. Key choices:
 *
 * - Real brand logo (base64) instead of generic strawberry SVG
 * - Monospace font, larger size (14px) for crisp thermal rendering
 * - `image-rendering: pixelated` so the 1-bit dithered logo stays sharp
 *   at the printer's native resolution instead of being blurred by the
 *   driver's bicubic resample
 * - `-webkit-print-color-adjust: exact` to force black ink (no greys)
 * - HR borders (not CSS shadows or backgrounds) — render cleanly
 * - 80mm @page size matches POS-80 driver expectation
 */
function buildReceiptHtml(
  data: ReceiptData,
  config: ReceiptConfig,
  blessing?: string,
  logoDataUrl?: string,
): string {
  const itemsHtml = data.items
    .map((item) => {
      const subtotal = formatCOP(item.subtotal);
      const name = escapeHtml(item.name);
      if (item.quantity > 1) {
        // Multi-quantity: name on its own line, qty x unit / subtotal below
        return `
          <div class="item-name">${name}</div>
          <div class="row item-qty"><span>${item.quantity} x ${formatCOP(item.unitPrice)}</span><span>${subtotal}</span></div>
        `;
      }
      return `<div class="row"><span>${name}</span><span>${subtotal}</span></div>`;
    })
    .join("");

  const footerLines = config.footerMessage
    ? config.footerMessage.split("\n").map((l) => `<div>${escapeHtml(l)}</div>`).join("")
    : "";

  const showLogoImg = !!logoDataUrl && config.showLogo;
  const showBizName = !showLogoImg; // fallback when no logo

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Recibo #${data.saleNumber}</title>
  <style>
    /* Crisp thermal-friendly rendering — kill all anti-aliasing/smoothing */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: 'Consolas', 'Courier New', 'Lucida Console', monospace;
      font-size: 10px;
      line-height: 1.25;
      color: #000;
      background: #fff;
      -webkit-font-smoothing: none;
      font-smooth: never;
      text-rendering: optimizeSpeed;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      /* Left-anchored, NOT centered. Body sits at x=0 of the 80mm page
         and is itself 72mm wide with tiny 2mm internal padding. This
         forces content to start near the left edge of the paper —
         matching how thermal POS receipts traditionally print and how
         the Mac ESC/POS direct path behaves. The 8mm of unused space
         on the right is fine; better than offset-to-middle clipping. */
      width: 72mm;
      max-width: 72mm;
      padding: 0 2mm;
      margin: 0;
    }
    img {
      image-rendering: pixelated;
      image-rendering: -moz-crisp-edges;
      image-rendering: crisp-edges;
    }

    .center { text-align: center; }
    .bold { font-weight: bold; }

    /* Separators: dashed/double border lines, render crisply */
    hr.sep { border: none; border-top: 1px dashed #000; margin: 3px 0; }
    hr.sep-double { border: none; border-top: 2px solid #000; margin: 3px 0; }

    /* Header */
    .logo { display: block; margin: 1px auto 2px; max-width: 36mm; height: auto; }
    .biz-name { font-size: 12px; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 1px; }
    .biz-info { font-size: 9px; margin: 1px 0; }

    /* Two-column rows (label + value) */
    .row { display: flex; justify-content: space-between; align-items: baseline; padding: 1px 0; gap: 4px; }
    .row > span:last-child { white-space: nowrap; }

    /* Metadata */
    .meta { padding: 1px 0; font-size: 10px; }
    .meta div { padding: 1px 0; }

    /* Items */
    .item-name { padding: 2px 0 0; font-weight: 500; }
    .item-qty { font-size: 9px; padding-left: 6px; }
    .item-qty > span:first-child { color: #333; }

    /* Total — bigger, bold */
    .total { font-size: 13px; font-weight: bold; padding: 2px 0; }

    /* Footer */
    .footer { font-size: 9px; text-align: center; padding: 2px 0 0; }
    .footer div { padding: 1px 0; }
    .blessing { font-size: 9px; font-style: italic; text-align: center; padding: 3px 4px 0; }

    /* @page tells the print engine "this is an 80mm-wide continuous-feed
       page" so the driver doesn't fall back to Letter defaults (which
       caused a ~25mm left offset on Windows POS-80 drivers). */
    @page { size: 80mm auto; margin: 0; }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="center">
    ${showLogoImg ? `<img class="logo" src="${logoDataUrl}" alt="Logo">` : ""}
    ${showBizName ? `<div class="biz-name">${escapeHtml(data.businessName.toUpperCase())}</div>` : ""}
    ${config.phone ? `<div class="biz-info">Tel: ${escapeHtml(config.phone)}</div>` : ""}
  </div>

  <hr class="sep">

  <!-- METADATA -->
  <div class="meta">
    <div>Factura: #${data.saleNumber}</div>
    <div>Fecha:   ${escapeHtml(data.date)} ${escapeHtml(data.time)}</div>
    ${data.cashierName ? `<div>Cajero:  ${escapeHtml(data.cashierName)}</div>` : ""}
  </div>

  <hr class="sep">

  <!-- ITEMS -->
  <div style="padding: 4px 0;">
    ${itemsHtml}
  </div>

  <!-- TOTAL (boxed with double lines) -->
  <hr class="sep-double">
  <div class="row total"><span>TOTAL</span><span>${formatCOP(data.total)}</span></div>
  <hr class="sep-double">

  <!-- PAYMENT -->
  <div style="padding: 4px 0;">
    <div class="row"><span>Pago:</span><span class="bold">${data.paymentMethod === "efectivo" ? "Efectivo" : "Nequi"}</span></div>
    ${data.paymentMethod === "efectivo" && data.received ? `
      <div class="row"><span>Recibido:</span><span>${formatCOP(data.received)}</span></div>
      <div class="row"><span class="bold">Cambio:</span><span class="bold">${formatCOP(data.change || 0)}</span></div>
    ` : ""}
  </div>

  <!-- FOOTER -->
  ${footerLines ? `<hr class="sep"><div class="footer">${footerLines}</div>` : ""}

  ${blessing ? `<div class="blessing">"${escapeHtml(blessing)}"</div>` : ""}

  <!-- Bottom margin so the cutter doesn't trim the blessing -->
  <div style="height: 18mm;">&nbsp;</div>
</body>
</html>`;
}

/** Get saved printer name from localStorage */
function getSavedPrinter(): string | null {
  try { return localStorage.getItem("dulce-fresita-printer"); } catch { return null; }
}

/** Print HTML via hidden iframe (browser fallback when nothing else works). */
async function printViaIframe(html: string) {
  const oldFrame = document.getElementById("print-frame");
  if (oldFrame) oldFrame.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "print-frame";
  iframe.style.cssText = "position:fixed;top:-10000px;left:-10000px;width:350px;height:600px;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 2000);
  };
}

/**
 * Print receipt via the best available transport:
 *   1. Electron silent print (Windows POS-80 via Windows driver)
 *   2. ESC/POS USB thermal (Mac Jaltech direct)
 *   3. Browser print dialog
 *
 * The HTML version is built with the actual brand logo embedded as
 * base64 so it looks identical regardless of which path is taken.
 */
export async function printReceipt(data: ReceiptData) {
  const config = getReceiptConfig();
  const blessing = config.showBlessing
    ? pickRandomBlessing(config.blessingPhrases)
    : undefined;

  // Pre-fetch the brand logo as base64. Required for Electron silent print
  // (data: URLs can't resolve relative resources) and harmless otherwise.
  const logoDataUrl = config.showLogo ? await fetchLogoDataUrl() : "";

  // 1. Try Electron silent print (Windows POS-80 via Windows driver)
  const api = (window as any).electronAPI;
  const savedPrinter = getSavedPrinter();
  if (api?.isElectron && savedPrinter) {
    const html = buildReceiptHtml(data, config, blessing, logoDataUrl);
    const result = await api.printSilent(html, savedPrinter);
    if (result.success) return;
    console.warn("[printReceipt] Silent print failed:", result.error);
  }

  // 2. Try ESC/POS USB thermal (Mac Jaltech direct via /api/print)
  try {
    const res = await fetch("/api/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        address: config.address,
        phone: config.phone,
        nit: config.nit,
        footerMessage: config.footerMessage,
        showLogo: config.showLogo,
        blessingMessage: blessing,
      }),
    });

    if (res.ok) {
      const result = await res.json();
      if (result.success) return;
    }
  } catch {}

  // 3. Fallback: browser print dialog (uses same HTML as Electron path)
  const html = buildReceiptHtml(data, config, blessing, logoDataUrl);
  await printViaIframe(html);
}

/** Returns HTML string for preview (no auto-print) */
export function getReceiptPreviewHtml(data: ReceiptData, config: ReceiptConfig, blessing?: string): string {
  return buildReceiptHtml(data, config, blessing);
}
