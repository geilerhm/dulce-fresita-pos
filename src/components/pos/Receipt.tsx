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

function buildReceiptHtml(data: ReceiptData, config: ReceiptConfig, blessing?: string): string {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="text-align:left;padding:2px 0;">
        ${item.quantity > 1 ? `${item.quantity}x ` : ""}${item.name}
      </td>
      <td style="text-align:right;padding:2px 0;white-space:nowrap;">
        ${formatCOP(item.subtotal)}
      </td>
    </tr>
  `).join("");

  const footerLines = config.footerMessage.split("\n").map(l => `<p>${l}</p>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Recibo #${data.saleNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      width: 80mm;
      padding: 4mm;
      color: #000;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .double-divider { border-top: 2px solid #000; margin: 6px 0; }
    .header { font-size: 16px; font-weight: bold; }
    .subheader { font-size: 10px; color: #555; }
    table { width: 100%; border-collapse: collapse; }
    .total-row td { font-size: 16px; font-weight: bold; padding: 4px 0; }
    .info-row { display: flex; justify-content: space-between; font-size: 11px; padding: 1px 0; }
    .footer { font-size: 10px; color: #555; margin-top: 8px; }
    @media print {
      body { width: 80mm; }
      @page { size: 80mm auto; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="center" style="margin-bottom:8px;">
    ${config.showLogo ? '<div style="font-size:24px;margin-bottom:4px;">🍓</div>' : ""}
    <div class="header">${data.businessName}</div>
    ${config.nit ? `<div class="subheader">NIT: ${config.nit}</div>` : ""}
    ${config.address ? `<div class="subheader">${config.address}</div>` : ""}
    ${config.phone ? `<div class="subheader">Tel: ${config.phone}</div>` : ""}
  </div>

  <div class="divider"></div>

  <div class="info-row"><span>Venta #${data.saleNumber}</span><span>${data.date}</span></div>
  <div class="info-row"><span>${data.cashierName || ""}</span><span>${data.time}</span></div>

  <div class="divider"></div>

  <table><tbody>${itemsHtml}</tbody></table>

  <div class="double-divider"></div>

  <table>
    <tr class="total-row">
      <td style="text-align:left;">TOTAL</td>
      <td style="text-align:right;">${formatCOP(data.total)}</td>
    </tr>
  </table>

  <div class="divider"></div>

  <div class="info-row">
    <span>Método:</span>
    <span class="bold">${data.paymentMethod === "efectivo" ? "Efectivo" : "Nequi"}</span>
  </div>
  ${data.paymentMethod === "efectivo" && data.received ? `
    <div class="info-row"><span>Recibido:</span><span>${formatCOP(data.received)}</span></div>
    <div class="info-row"><span class="bold">Cambio:</span><span class="bold">${formatCOP(data.change || 0)}</span></div>
  ` : ""}

  <div class="divider"></div>

  <div class="center footer">${footerLines}</div>

  ${blessing ? `<div class="center" style="margin-top:10px;font-style:italic;font-size:11px;color:#666;">&ldquo;${blessing}&rdquo;</div>` : ""}

  <div style="margin-top:16px;">&nbsp;</div>
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
