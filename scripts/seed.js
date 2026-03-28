/**
 * Dulce Fresita — Seed data from Excel with company_id
 */
const { Client } = require("pg");
const XLSX = require("xlsx");
const path = require("path");

const DB_URL = "postgresql://postgres:Strong_DB_Password_2026!@db.uzzgswzicyrqgsnbfzop.supabase.co:5432/postgres";
const EXCEL = path.join(__dirname, "../../inventario-dulce-fresita/data/inventario_con_recetas.xlsx");
const COMPANY_ID = "test-dulcefresita";

function slugify(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function run() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("✓ Conectado — company_id:", COMPANY_ID);

  const wb = XLSX.readFile(EXCEL);

  const categoryCache = {};

  async function getOrCreateCategory(name, type) {
    const slug = slugify(name);
    const key = `${slug}-${type}`;
    if (categoryCache[key]) return categoryCache[key];

    const existing = await client.query(
      "SELECT id FROM categories WHERE slug = $1 AND type = $2 AND company_id = $3 LIMIT 1",
      [slug, type, COMPANY_ID]
    );
    if (existing.rows.length > 0) {
      categoryCache[key] = existing.rows[0].id;
      return existing.rows[0].id;
    }

    const sortOrder = Object.keys(categoryCache).length;
    let finalSlug = slug;
    let finalName = name;
    const dupCheck = await client.query("SELECT id FROM categories WHERE slug = $1 AND company_id = $2", [slug, COMPANY_ID]);
    if (dupCheck.rows.length > 0) {
      finalSlug = `${slug}-${type}`;
      finalName = `${name} (${type === 'ingredient' ? 'Insumos' : 'Venta'})`;
    }
    const res = await client.query(
      "INSERT INTO categories (name, slug, sort_order, type, company_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [finalName, finalSlug, sortOrder, type, COMPANY_ID]
    );
    categoryCache[key] = res.rows[0].id;
    return res.rows[0].id;
  }

  // ── 1. INGREDIENTES ──
  console.log("\n→ Importando ingredientes...");
  const wsIng = wb.Sheets["🥝 INGREDIENTES"];
  const ingRows = XLSX.utils.sheet_to_json(wsIng, { header: 1, range: 4 });
  let ingCreated = 0;

  for (const row of ingRows) {
    const ref = row[0]?.toString().trim();
    if (!ref) continue;
    const name = (row[1] || ref).toString().trim();
    const cat = (row[2] || "General").toString().trim();
    const unit = (row[4] || "und").toString().trim();
    const purchaseUnit = (row[5] || unit).toString().trim();
    const cost = row[6] && !isNaN(row[6]) ? Math.round(Number(row[6])) : 0;

    const catId = await getOrCreateCategory(cat, "ingredient");
    await client.query(
      "INSERT INTO ingredients (ref, name, category_id, unit, purchase_unit, cost_per_unit, stock_quantity, min_stock, company_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [ref, name, catId, unit, purchaseUnit, cost, 0, 0, COMPANY_ID]
    );
    ingCreated++;
  }
  console.log("  ✓ Ingredientes: " + ingCreated);

  // ── 2. PRODUCTOS ──
  console.log("\n→ Importando productos...");
  const wsProd = wb.Sheets["🍓 PRODUCTOS VENTA"];
  const prodRows = XLSX.utils.sheet_to_json(wsProd, { header: 1, range: 4 });
  let prodCreated = 0;

  for (let i = 0; i < prodRows.length; i++) {
    const row = prodRows[i];
    const ref = row[0]?.toString().trim();
    if (!ref) continue;
    const name = (row[1] || ref).toString().trim();
    const cat = (row[3] || row[2] || "General").toString().trim();
    const price = row[4] && !isNaN(row[4]) ? Math.round(Number(row[4])) : 0;
    const desc = (row[10] || "").toString().trim();
    const active = (row[12] || "SI").toString().toUpperCase() === "SI";
    if (!price) continue;

    const catId = await getOrCreateCategory(cat, "product");
    await client.query(
      "INSERT INTO products (ref, name, category_id, price, description, active, sort_order, icon, company_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [ref, name, catId, price, desc || null, active, i, "ForkKnife", COMPANY_ID]
    );
    prodCreated++;
  }
  console.log("  ✓ Productos: " + prodCreated);

  // ── 3. RECETAS ──
  console.log("\n→ Importando recetas...");
  const wsBom = wb.Sheets["🔧 RECETAS BOM"];
  const bomRows = XLSX.utils.sheet_to_json(wsBom, { header: 1, range: 4 });

  const prodMap = {};
  const prodRes = await client.query("SELECT id, ref FROM products WHERE company_id = $1", [COMPANY_ID]);
  for (const r of prodRes.rows) prodMap[r.ref] = r.id;

  const ingMap = {};
  const ingRes = await client.query("SELECT id, ref FROM ingredients WHERE company_id = $1", [COMPANY_ID]);
  for (const r of ingRes.rows) ingMap[r.ref] = r.id;

  let recCreated = 0;
  for (const row of bomRows) {
    const prodRef = row[0]?.toString().trim();
    const ingRef = row[2]?.toString().trim();
    const qty = row[4];
    if (!prodRef || !ingRef || !qty || isNaN(qty)) continue;
    const prodId = prodMap[prodRef];
    const ingId = ingMap[ingRef];
    if (!prodId || !ingId) continue;
    const unit = (row[5] || "und").toString().trim();

    try {
      await client.query(
        "INSERT INTO recipes (product_id, ingredient_id, quantity, unit, company_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (product_id, ingredient_id) DO NOTHING",
        [prodId, ingId, Number(qty), unit, COMPANY_ID]
      );
      recCreated++;
    } catch {}
  }
  console.log("  ✓ Recetas: " + recCreated + " líneas");

  // ── 4. PROVEEDORES ──
  console.log("\n→ Importando proveedores...");
  const wsProv = wb.Sheets["🛒 PROVEEDORES"];
  const provRows = XLSX.utils.sheet_to_json(wsProv, { header: 1, range: 4 });

  const supplierCache = {};
  let supCreated = 0;

  for (const row of provRows) {
    const ingRef = row[0]?.toString().trim();
    const supName = row[2]?.toString().trim();
    const price = row[4];
    if (!ingRef || !supName || !price || isNaN(price)) continue;
    const ingId = ingMap[ingRef];
    if (!ingId) continue;

    const supKey = supName.toLowerCase();
    if (!supplierCache[supKey]) {
      const existing = await client.query("SELECT id FROM suppliers WHERE lower(name) = $1 AND company_id = $2", [supKey, COMPANY_ID]);
      if (existing.rows.length > 0) {
        supplierCache[supKey] = existing.rows[0].id;
      } else {
        const phone = row[3] ? row[3].toString().trim() : null;
        const res = await client.query(
          "INSERT INTO suppliers (name, phone, company_id) VALUES ($1, $2, $3) RETURNING id",
          [supName, phone, COMPANY_ID]
        );
        supplierCache[supKey] = res.rows[0].id;
      }
    }

    try {
      await client.query(
        "INSERT INTO supplier_prices (supplier_id, ingredient_id, price, lead_days, company_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (supplier_id, ingredient_id) DO NOTHING",
        [supplierCache[supKey], ingId, Math.round(Number(price)), 1, COMPANY_ID]
      );
      supCreated++;
    } catch {}
  }
  console.log("  ✓ Proveedores: " + Object.keys(supplierCache).length + ", precios: " + supCreated);

  // ── 5. STOCK SIMULADO ──
  console.log("\n→ Simulando stock...");
  await client.query("UPDATE ingredients SET stock_quantity = floor(random() * 20 + 1)::int, min_stock = floor(random() * 5 + 1)::int WHERE company_id = $1", [COMPANY_ID]);
  // Set a few as low stock
  await client.query("UPDATE ingredients SET stock_quantity = 0.5 WHERE ref IN ('ING-NUTELLA','ING-FERRERO','ING-ARANDANO') AND company_id = $1", [COMPANY_ID]);
  console.log("  ✓ Stock simulado");

  // ── 6. MERGE CATEGORIES ──
  console.log("\n→ Reorganizando categorías...");
  const merges = [
    { name: 'Frutas', slug: 'frutas-venta', sort: 0, old: ['frutas-con-crema', 'frutas-mas'] },
    { name: 'Bebidas', slug: 'bebidas-venta', sort: 1, old: ['jugos', 'cafe-leche'] },
    { name: 'Waffles', slug: 'waffles-venta', sort: 2, old: ['waffles', 'cajitas'] },
    { name: 'Crepas', slug: 'crepas-venta', sort: 3, old: ['crepas'] },
    { name: 'Malteadas', slug: 'malteadas-venta', sort: 4, old: ['malteadas'] },
    { name: 'Obleas', slug: 'obleas-venta', sort: 5, old: ['obleas'] },
    { name: 'Especiales', slug: 'especiales-venta', sort: 6, old: ['chocolate', 'fusiones', 'churros', 'especiales'] },
    { name: 'Salado', slug: 'salado-venta', sort: 7, old: ['alguito-salado'] },
    { name: 'Extras', slug: 'extras-venta', sort: 8, old: ['salsas'] },
  ];

  for (const m of merges) {
    const res = await client.query(
      "INSERT INTO categories (name, slug, sort_order, type, company_id) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [m.name, m.slug, m.sort, 'product', COMPANY_ID]
    );
    const newId = res.rows[0].id;
    for (const oldSlug of m.old) {
      await client.query(
        "UPDATE products SET category_id = $1 WHERE category_id IN (SELECT id FROM categories WHERE slug = $2 AND company_id = $3)",
        [newId, oldSlug, COMPANY_ID]
      );
    }
  }

  // Move orphan toppings/helados to Extras
  const extrasId = (await client.query("SELECT id FROM categories WHERE slug = 'extras-venta' AND company_id = $1", [COMPANY_ID])).rows[0]?.id;
  if (extrasId) {
    for (const slug of ['toppings', 'helados']) {
      await client.query(
        "UPDATE products SET category_id = $1 WHERE category_id IN (SELECT id FROM categories WHERE slug = $2 AND type = 'ingredient' AND company_id = $3)",
        [extrasId, slug, COMPANY_ID]
      );
    }
  }

  // Delete empty old product categories
  await client.query("DELETE FROM categories WHERE type = 'product' AND slug NOT LIKE '%-venta' AND company_id = $1 AND NOT EXISTS (SELECT 1 FROM products WHERE category_id = categories.id)", [COMPANY_ID]);

  console.log("  ✓ Categorías reorganizadas");

  // ── SUMMARY ──
  const counts = {};
  for (const t of ["categories", "products", "ingredients", "recipes", "suppliers", "supplier_prices"]) {
    const r = await client.query("SELECT count(*) FROM " + t + " WHERE company_id = $1", [COMPANY_ID]);
    counts[t] = r.rows[0].count;
  }
  console.log("\n═══════════════════════════════════════");
  console.log("  ✅ Seed completo para " + COMPANY_ID);
  console.log("═══════════════════════════════════════");
  for (const [t, cnt] of Object.entries(counts)) console.log("  " + t + ": " + cnt);

  await client.end();
}

run().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
