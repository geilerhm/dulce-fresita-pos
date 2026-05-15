/**
 * Replays fn_complete_order's deduction loop offline so we can see WHICH
 * recipe row produces a non-finite deduction. Read-only — does not modify
 * the database.
 *
 * Usage:
 *   node scripts/simulate-complete-order.js
 */

const Database = require("better-sqlite3");
const path = require("path");
const os = require("os");

const ALIASES = { gr: "g", lt: "l" };
const TO_BASE = {
  g: { group: "mass", factor: 1 },
  kg: { group: "mass", factor: 1000 },
  ml: { group: "volume", factor: 1 },
  l: { group: "volume", factor: 1000 },
};

function normalize(u) {
  const lower = (u ?? "").trim().toLowerCase();
  return ALIASES[lower] ?? lower;
}
function convertQuantity(qty, fromUnit, toUnit) {
  const from = normalize(fromUnit);
  const to = normalize(toUnit);
  if (from === to) return qty;
  const fInfo = TO_BASE[from];
  const tInfo = TO_BASE[to];
  if (!fInfo || !tInfo) return null;
  if (fInfo.group !== tInfo.group) return null;
  return (qty * fInfo.factor) / tInfo.factor;
}

const DB_PATH = path.join(os.homedir(), ".dulce-fresita", "dulce-fresita.db");
const db = new Database(DB_PATH, { readonly: true });

const orders = db.prepare("SELECT id, order_number FROM orders WHERE status = 'pending'").all();
console.log(`Pending orders: ${orders.length}\n`);

for (const order of orders) {
  console.log(`━━ Order #${order.order_number} ━━`);
  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(order.id);

  for (const it of items) {
    const recipes = db.prepare("SELECT * FROM recipes WHERE product_id = ?").all(it.product_id);
    if (recipes.length === 0) {
      console.log(`  ${it.product_name} (x${it.quantity}) — no recipe`);
      continue;
    }
    for (const r of recipes) {
      const ing = db.prepare("SELECT * FROM ingredients WHERE id = ?").get(r.ingredient_id);
      if (!ing) {
        console.log(`  ❌ ${it.product_name}: recipe row ${r.id} points to MISSING ingredient ${r.ingredient_id}`);
        continue;
      }
      const perUnit = convertQuantity(r.quantity, r.unit, ing.unit);
      const deduction = perUnit === null ? null : perUnit * it.quantity;
      const status = perUnit === null
        ? "skip (incompatible units)"
        : !Number.isFinite(deduction)
          ? `💥 NON-FINITE — perUnit=${perUnit} qty=${it.quantity} ⇒ ${deduction}`
          : "ok";
      if (status !== "ok" && status !== "skip (incompatible units)") {
        console.log(`  ${status}`);
        console.log(`    item: ${it.product_name} qty=${it.quantity} (typeof=${typeof it.quantity})`);
        console.log(`    recipe: ${r.quantity}${r.unit} (qty typeof=${typeof r.quantity})`);
        console.log(`    ingredient: ${ing.name} stock=${ing.stock_quantity}${ing.unit} (typeof=${typeof ing.stock_quantity})`);
      }
    }
  }
  console.log();
}

db.close();
