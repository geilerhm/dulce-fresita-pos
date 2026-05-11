/**
 * Diagnóstico de toppings: revisa los productos en la categoría con slug
 * "toppings" y reporta dos clases de problema:
 *   1. Visibilidad en el POS:  active=1 AND available_in_pos=1
 *      (si fallan, el modal del POS nunca los muestra al cajero)
 *   2. Receta configurada:     hay al menos 1 fila en `recipes`
 *      (si falta, fn_deduct_inventory los ignora al confirmar la venta)
 *
 * Uso:
 *   node scripts/check-topping-recipes.js [company_id] [--db <path>]
 *
 * Si no pasas company_id, recorre todas las empresas.
 * Ruta de DB por orden de prioridad:
 *   1. --db <path>
 *   2. $DULCE_DB_PATH/dulce-fresita.db
 *   3. $HOME/.dulce-fresita/dulce-fresita.db   (default de dev)
 *   4. ./data/dulce-fresita.db                 (legacy del repo)
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const os = require("os");

// ── Args ────────────────────────────────────────────────────
const args = process.argv.slice(2);
let dbPathArg = null;
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--db") {
    dbPathArg = args[++i];
  } else {
    positional.push(args[i]);
  }
}
const companyIdFilter = positional[0] || null;

// ── Resolve DB path ─────────────────────────────────────────
function resolveDbPath() {
  if (dbPathArg) return dbPathArg;
  if (process.env.DULCE_DB_PATH) {
    return path.join(process.env.DULCE_DB_PATH, "dulce-fresita.db");
  }
  const candidates = [
    path.join(os.homedir(), ".dulce-fresita", "dulce-fresita.db"),
    path.join(__dirname, "..", "data", "dulce-fresita.db"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

const DB_PATH = resolveDbPath();
if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ No encontré la BD en: ${DB_PATH}`);
  console.error(`   Pasa --db <ruta> o ajusta DULCE_DB_PATH.`);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });
console.log(`📂 BD: ${DB_PATH}\n`);

// ── Helpers ─────────────────────────────────────────────────
const companies = companyIdFilter
  ? db.prepare("SELECT id, name FROM companies WHERE id = ?").all(companyIdFilter)
  : db.prepare("SELECT id, name FROM companies ORDER BY created_at").all();

if (companies.length === 0) {
  console.error(companyIdFilter
    ? `❌ No existe empresa con id ${companyIdFilter}`
    : `❌ La BD no tiene empresas. ¿Está vacía?`);
  process.exit(1);
}

let totalMissing = 0;
let totalOk = 0;

for (const company of companies) {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🏢 ${company.name}`);
  console.log(`   ${company.id}\n`);

  const toppingCat = db.prepare(
    "SELECT id, name, slug FROM categories WHERE slug = 'toppings' AND company_id = ?",
  ).get(company.id);

  if (!toppingCat) {
    console.log(`   ⚠️  Esta empresa no tiene categoría con slug "toppings".`);
    console.log(`      Si tienes otra categoría para toppings, su slug debe ser literalmente "toppings"`);
    console.log(`      (en /categorias). Si no, el POS no abre el modal de toppings.\n`);
    continue;
  }

  const toppings = db.prepare(
    `SELECT id, name, price, active, available_in_pos
       FROM products
      WHERE category_id = ?
        AND company_id = ?
      ORDER BY sort_order, name`,
  ).all(toppingCat.id, company.id);

  if (toppings.length === 0) {
    console.log(`   (no hay productos en la categoría "toppings")\n`);
    continue;
  }

  // Bucket each topping by problem class.
  const hiddenFromPos = []; // active=0 OR available_in_pos=0
  const noRecipe = [];      // visible in POS but no recipe
  const allOk = [];         // visible AND has recipe

  for (const t of toppings) {
    const visible = t.active === 1 && t.available_in_pos === 1;
    const recipes = db.prepare(
      `SELECT r.quantity, r.unit, i.name AS ingredient_name, i.unit AS ingredient_unit, i.stock_quantity
         FROM recipes r
         JOIN ingredients i ON i.id = r.ingredient_id
        WHERE r.product_id = ?
          AND r.company_id = ?`,
    ).all(t.id, company.id);

    if (!visible) {
      hiddenFromPos.push({ topping: t, recipes });
    } else if (recipes.length === 0) {
      noRecipe.push(t);
    } else {
      allOk.push({ topping: t, recipes });
    }
  }

  totalMissing += noRecipe.length;
  totalOk += allOk.length;

  if (hiddenFromPos.length > 0) {
    console.log(`   🚫 NO aparecen en el modal del POS (${hiddenFromPos.length}):`);
    for (const { topping } of hiddenFromPos) {
      const flags = [];
      if (topping.active !== 1) flags.push("inactivo");
      if (topping.available_in_pos !== 1) flags.push("oculto en POS");
      console.log(`      · ${topping.name}  [${flags.join(", ")}]`);
    }
    console.log(`      → en /productos activa y/o marca "disponible en POS".\n`);
  }

  if (noRecipe.length > 0) {
    console.log(`   ❌ Visibles pero SIN receta — no descuentan inventario (${noRecipe.length}):`);
    for (const t of noRecipe) {
      console.log(`      · ${t.name}`);
    }
    console.log(`      → en /recetas agrega un ingrediente a cada uno.\n`);
  }

  if (allOk.length > 0) {
    console.log(`   ✅ Visibles y con receta (${allOk.length}):`);
    for (const { topping, recipes } of allOk) {
      console.log(`      · ${topping.name}`);
      for (const r of recipes) {
        console.log(`          → ${r.quantity}${r.unit} de ${r.ingredient_name}  (stock: ${r.stock_quantity}${r.ingredient_unit})`);
      }
    }
    console.log();
  }
}

console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Resumen total: ${totalOk} listos · ${totalMissing} sin receta (visibles)`);

db.close();
