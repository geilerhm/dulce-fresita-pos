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

function buildReceiptHtml(data: ReceiptData, config: ReceiptConfig): string {
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

  <div style="margin-top:16px;">&nbsp;</div>
</body>
</html>`;
}

/** Print via browser dialog (fallback). */
function printReceiptBrowser(data: ReceiptData, config: ReceiptConfig) {
  const html = buildReceiptHtml(data, config);
  const win = window.open("", "_blank", "width=350,height=600");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.print(); setTimeout(() => win.close(), 1000); };
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

    // Non-OK response or success=false → fall back to browser
    const errorPayload = await res.json().catch(() => ({}));
    console.warn("[printReceipt] Thermal printer failed, falling back to browser:", errorPayload);
    printReceiptBrowser(data, config);
  } catch (err) {
    console.warn("[printReceipt] Network error, falling back to browser:", err);
    printReceiptBrowser(data, config);
  }
}

/** Returns HTML string for preview (no auto-print) */
export function getReceiptPreviewHtml(data: ReceiptData, config: ReceiptConfig): string {
  return buildReceiptHtml(data, config);
}
