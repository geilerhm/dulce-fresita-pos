"use client";

import { createClient } from "@/lib/db/client";
import { getActiveCompanyId } from "@/lib/db/company";

interface SaleItem {
  name: string;
  product_id: string;
  quantity: number;
}

interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

interface KitchenProduct {
  name: string;
  quantity: number;
  ingredients: RecipeIngredient[];
}

export interface KitchenTicketData {
  saleNumber: number;
  time: string;
  products: KitchenProduct[];
}

/** Fetch recipe ingredients for a list of sold items */
export async function buildKitchenTicket(
  saleNumber: number,
  items: SaleItem[],
): Promise<KitchenTicketData> {
  const client = createClient();
  const companyId = getActiveCompanyId();

  const productIds = [...new Set(items.map((i) => i.product_id))];

  const { data: recipes } = await client
    .from("recipes")
    .select("product_id, quantity, unit, ingredient:ingredients(name, unit)")
    .eq("company_id", companyId)
    .in("product_id", productIds);

  const recipeMap = new Map<string, RecipeIngredient[]>();
  for (const r of recipes ?? []) {
    const ing = r.ingredient as { name: string; unit: string } | null;
    if (!ing) continue;
    const list = recipeMap.get(r.product_id) ?? [];
    list.push({ name: ing.name, quantity: r.quantity, unit: r.unit || ing.unit });
    recipeMap.set(r.product_id, list);
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  const products: KitchenProduct[] = items
    .filter((item) => (recipeMap.get(item.product_id)?.length ?? 0) > 0)
    .map((item) => {
      const ings = recipeMap.get(item.product_id) ?? [];
      return {
        name: item.name,
        quantity: item.quantity,
        ingredients: ings.map((ing) => ({
          ...ing,
          quantity: ing.quantity * item.quantity,
        })),
      };
    });

  return {
    saleNumber,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    products,
  };
}

function formatQty(qty: number, unit: string): string {
  const display = qty % 1 === 0 ? String(qty) : qty.toFixed(1);
  return `${display}${unit}`;
}

/** Browser fallback — print via popup */
async function printKitchenBrowser(data: KitchenTicketData) {
  const productsHtml = data.products
    .map(
      (p) => `
      <div style="margin-bottom:12px;">
        <div style="font-size:14px;font-weight:bold;margin-bottom:4px;">
          ${p.quantity > 1 ? `${p.quantity}x ` : ""}${p.name}
        </div>
        ${p.ingredients
          .map(
            (ing) =>
              `<div style="font-size:11px;color:#444;padding-left:12px;">· ${formatQty(ing.quantity, ing.unit)} ${ing.name}</div>`,
          )
          .join("")}
      </div>
    `,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Comanda #${data.saleNumber}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Courier New', monospace; width: 80mm; padding: 4mm; color: #000; }
    .header { text-align:center; font-size:18px; font-weight:bold; padding:8px 0; }
    .meta { text-align:center; font-size:11px; color:#666; margin-bottom:8px; }
    .divider { border-top:2px dashed #000; margin:8px 0; }
    @media print { body { width:80mm; } @page { size:80mm auto; margin:0; } }
  </style>
</head>
<body>
  <div class="header">COMANDA #${data.saleNumber}</div>
  <div class="meta">${data.time}</div>
  <div class="divider"></div>
  ${productsHtml}
  <div class="divider"></div>
  <div style="text-align:center;font-size:10px;color:#999;margin-top:8px;">
    ${data.products.reduce((s, p) => s + p.quantity, 0)} productos - ${data.products.reduce((s, p) => s + p.ingredients.length, 0)} ingredientes
  </div>
  <div style="margin-top:16px;">&nbsp;</div>
</body>
</html>`;

  // Try Electron silent print
  const api = (window as any).electronAPI;
  const printer = (() => { try { return localStorage.getItem("dulce-fresita-printer"); } catch { return null; } })();
  if (api?.isElectron && printer) {
    const result = await api.printSilent(html, printer);
    if (result.success) return;
  }

  // Fallback: iframe
  const oldFrame = document.getElementById("print-frame-kitchen");
  if (oldFrame) oldFrame.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "print-frame-kitchen";
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
 * Print kitchen ticket on thermal printer via /api/print/comanda.
 * Falls back to browser popup if thermal printer fails.
 */
export async function printKitchenTicket(data: KitchenTicketData) {
  try {
    const res = await fetch("/api/print/comanda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const result = await res.json();
      if (result.success) return;
    }

    console.warn("[printKitchenTicket] Thermal failed, falling back to browser");
    printKitchenBrowser(data);
  } catch (err) {
    console.warn("[printKitchenTicket] Network error, falling back to browser:", err);
    printKitchenBrowser(data);
  }
}
