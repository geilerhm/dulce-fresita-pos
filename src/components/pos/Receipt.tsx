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

// Strawberry SVG icon inline (same as fruit-icons.tsx but as raw SVG string)
const STRAWBERRY_SVG = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="m17 7 3.5-3.5"/><path d="M17 2v5h5"/>
  <path d="M2.1 17.1a4 4 0 0 0 4.8 4.8l9-2.1a6.32 6.32 0 0 0 2.9-10.9L15 5.2A6.5 6.5 0 0 0 4.1 8.3Z"/>
  <path d="M8.5 9.5h.01"/><path d="M12.5 8.5h.01"/><path d="M7.5 13.5h.01"/>
  <path d="M11.5 12.5h.01"/><path d="M15.5 11.5h.01"/><path d="M6.5 17.5h.01"/>
  <path d="M10.5 16.5h.01"/><path d="M14.5 15.5h.01"/>
</svg>`;

function buildReceiptHtml(data: ReceiptData, config: ReceiptConfig, blessing?: string): string {
  // Build items — same layout as ESC/POS: name left, subtotal right
  // Multi-quantity: name on line 1, "qty x unit_price    subtotal" on line 2
  const itemsHtml = data.items.map(item => {
    const subtotal = formatCOP(item.subtotal);
    if (item.quantity > 1) {
      return `
        <div class="item-name">${item.name}</div>
        <div class="item-row"><span class="item-qty">${item.quantity} x ${formatCOP(item.unitPrice)}</span><span>${subtotal}</span></div>
      `;
    }
    return `<div class="item-row"><span class="item-single">${item.name}</span><span>${subtotal}</span></div>`;
  }).join("");

  const footerLines = config.footerMessage
    ? config.footerMessage.split("\n").map(l => `<div>${l}</div>`).join("")
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Recibo #${data.saleNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', 'Consolas', monospace;
      font-size: 12px;
      width: 72mm;
      max-width: 72mm;
      padding: 2mm 4mm;
      color: #000;
      line-height: 1.4;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .sep { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    .sep-double { border: none; border-top: 2px solid #000; margin: 6px 0; }

    /* Header */
    .logo { margin: 4px auto 6px; display: block; }
    .biz-name { font-size: 18px; font-weight: bold; letter-spacing: 1px; }
    .biz-info { font-size: 10px; color: #333; margin: 1px 0; }

    /* Meta */
    .meta-row { display: flex; justify-content: space-between; font-size: 11px; padding: 1px 0; }
    .meta-label { }
    .meta-value { font-weight: bold; }

    /* Items */
    .item-row { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; }
    .item-name { font-size: 11px; padding: 2px 0 0; }
    .item-qty { color: #444; }
    .item-single { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px; }

    /* Total */
    .total-box { padding: 4px 0; }
    .total-row { display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; }

    /* Payment */
    .pay-row { display: flex; justify-content: space-between; font-size: 11px; padding: 1px 0; }

    /* Footer */
    .footer { font-size: 10px; color: #555; text-align: center; margin-top: 6px; }
    .blessing { font-size: 11px; font-style: italic; color: #555; text-align: center; margin-top: 8px; }

    @media print {
      body { width: 72mm; max-width: 72mm; }
      @page { size: 80mm auto; margin: 0 4mm; }
    }
  </style>
</head>
<body>

  <!-- ═══ HEADER ═══ -->
  <div class="center" style="margin-bottom:6px;">
    ${config.showLogo ? `<div class="logo">${STRAWBERRY_SVG}</div>` : ""}
    <div class="biz-name">${data.businessName.toUpperCase()}</div>
    ${config.nit ? `<div class="biz-info">NIT: ${config.nit}</div>` : ""}
    ${config.address ? `<div class="biz-info">${config.address}</div>` : ""}
    ${config.phone ? `<div class="biz-info">Tel: ${config.phone}</div>` : ""}
  </div>

  <hr class="sep">

  <!-- ═══ METADATA ═══ -->
  <div class="meta-row"><span>Factura: #${data.saleNumber}</span><span>${data.date}</span></div>
  <div class="meta-row"><span>${data.cashierName ? `Cajero: ${data.cashierName}` : ""}</span><span>${data.time}</span></div>

  <hr class="sep">

  <!-- ═══ ITEMS ═══ -->
  <div style="margin:4px 0;">
    ${itemsHtml}
  </div>

  <!-- ═══ TOTAL ═══ -->
  <hr class="sep-double">
  <div class="total-box">
    <div class="total-row"><span>TOTAL</span><span>${formatCOP(data.total)}</span></div>
  </div>
  <hr class="sep-double">

  <!-- ═══ PAYMENT ═══ -->
  <div class="pay-row"><span>Pago:</span><span class="bold">${data.paymentMethod === "efectivo" ? "Efectivo" : "Nequi"}</span></div>
  ${data.paymentMethod === "efectivo" && data.received ? `
    <div class="pay-row"><span>Recibido:</span><span>${formatCOP(data.received)}</span></div>
    <div class="pay-row"><span class="bold">Cambio:</span><span class="bold">${formatCOP(data.change || 0)}</span></div>
  ` : ""}

  <!-- ═══ FOOTER ═══ -->
  ${footerLines ? `<hr class="sep"><div class="footer">${footerLines}</div>` : ""}

  ${blessing ? `<div class="blessing">&ldquo;${blessing}&rdquo;</div>` : ""}

  <div style="margin-top:20px;">&nbsp;</div>
</body>
</html>`;
}

/** Get saved printer name from localStorage */
function getSavedPrinter(): string | null {
  try { return localStorage.getItem("dulce-fresita-printer"); } catch { return null; }
}

/** Print via Electron silent print (preferred) or iframe fallback */
async function printReceiptBrowser(data: ReceiptData, config: ReceiptConfig, blessing?: string) {
  const html = buildReceiptHtml(data, config, blessing);

  // Try Electron silent print first
  const api = (window as any).electronAPI;
  if (api?.isElectron) {
    const printer = getSavedPrinter();
    if (printer) {
      const result = await api.printSilent(html, printer);
      if (result.success) return;
      console.warn("[print] Silent print failed:", result.error);
    }
  }

  // Fallback: iframe print dialog
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
 * Print receipt on the Jaltech POS 80mm thermal printer via ESC/POS.
 * Falls back to the browser print dialog if the thermal printer fails
 * (not detected, USB error, server endpoint unavailable, etc).
 */
export async function printReceipt(data: ReceiptData) {
  const config = getReceiptConfig();
  const blessing = config.showBlessing
    ? pickRandomBlessing(config.blessingPhrases)
    : undefined;

  // 1. Try Electron silent print (preferred for Windows POS-80)
  const api = (window as any).electronAPI;
  const savedPrinter = getSavedPrinter();
  if (api?.isElectron && savedPrinter) {
    const html = buildReceiptHtml(data, config, blessing);
    const result = await api.printSilent(html, savedPrinter);
    if (result.success) return;
    console.warn("[printReceipt] Silent print failed:", result.error);
  }

  // 2. Try ESC/POS USB thermal printer (Mac Jaltech)
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

  // 3. Fallback: browser print dialog
  await printReceiptBrowser(data, config, blessing);
}

/** Returns HTML string for preview (no auto-print) */
export function getReceiptPreviewHtml(data: ReceiptData, config: ReceiptConfig, blessing?: string): string {
  return buildReceiptHtml(data, config, blessing);
}
