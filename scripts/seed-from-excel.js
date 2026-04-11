/**
 * Seed database from Excel file for a specific company
 * Usage: node scripts/seed-from-excel.js <company_id> [excel_path]
 */
const XLSX = require("xlsx");
const path = require("path");
const { randomUUID } = require("crypto");

const COMPANY_ID = process.argv[2];
if (!COMPANY_ID) { console.error("Usage: node scripts/seed-from-excel.js <company_id> [excel_path]"); process.exit(1); }

const EXCEL_PATH = process.argv[3] || path.join(__dirname, "..", "..", "inventario-dulce-fresita", "data", "inventario_con_recetas.xlsx");
const wb = XLSX.readFile(EXCEL_PATH);

// ── Category icon mapping ──
const PRODUCT_CAT_ICONS = {
  "Frutas con crema": "Strawberry",
  "Waffles": "GridFour",
  "Cajitas": "Package",
  "Chocolate": "Cookie",
  "Crepas": "Bread",
  "Churros": "Fire",
  "Frutas & más": "OrangeSlice",
  "Fusiones": "Sparkle",
  "Obleas": "Circle",
  "Especiales": "Crown",
  "Malteadas": "PintGlass",
  "Helados": "IceCream",
  "Jugos": "Drop",
  "Café & Leche": "Coffee",
  "Alguito Salado": "Hamburger",
  "Toppings": "Cake",
  "Salsas": "Jar",
};

const INGREDIENT_CAT_ICONS = {
  "Frutas": "Strawberry",
  "Lácteos": "Drop",
  "Helados": "IceCream",
  "Salsas/Cremas": "Jar",
  "Insumos secos": "Grains",
  "Toppings": "Cake",
  "Bebidas": "Coffee",
  "Snacks": "Popcorn",
  "Empaque": "Package",
};

// ── Product icon mapping ──
function getProductIcon(name, cat) {
  const n = name.toLowerCase();
  if (n.includes("fresa") || n.includes("fresas")) return "Strawberry";
  if (n.includes("banano") || n.includes("banana")) return "Banana";
  if (n.includes("mango") || n.includes("maracumango")) return "Mango";
  if (n.includes("piña")) return "Pineapple";
  if (n.includes("durazno")) return "Peach";
  if (n.includes("waffle") || n.includes("waff")) return "GridFour";
  if (n.includes("panqueque")) return "Bread";
  if (n.includes("crep")) return "Bread";
  if (n.includes("churro")) return "Fire";
  if (n.includes("fondue") || n.includes("chocolate")) return "Cookie";
  if (n.includes("ensalada")) return "BowlFood";
  if (n.includes("parfait") || n.includes("bowl")) return "BowlSteam";
  if (n.includes("fusión")) return "Sparkle";
  if (n.includes("oblea")) return "Circle";
  if (n.includes("copa")) return "Diamond";
  if (n.includes("malteada") || n.includes("malt")) return "PintGlass";
  if (n.includes("cono") || n.includes("vasito") || n.includes("helado")) return "IceCream";
  if (n.includes("jugo")) return "Drop";
  if (n.includes("café") || n.includes("cafe") || n.includes("tint")) return "Coffee";
  if (n.includes("leche")) return "Drop";
  if (n.includes("empanada") || n.includes("palito") || n.includes("chorizo") || n.includes("salado")) return "Hamburger";
  if (n.includes("topping") || n.includes("adición")) return "Cake";
  if (n.includes("salsa")) return "Jar";
  if (n.includes("bola")) return "IceCream";
  if (cat === "Toppings") return "Cake";
  if (cat === "Salsas") return "Jar";
  return "Sparkle";
}

// ── Parse helpers ──
function parseRows(sheetName, startRow = 4) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  return data.slice(startRow).filter(r => r && r[0] && !String(r[0]).startsWith("⚙") && !String(r[0]).startsWith("▸") && !String(r[0]).startsWith("#") && String(r[0]).trim() !== "");
}

function slug(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s/&]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");
}

// ── Build data ──

// 1. Categories
const ingCats = new Set();
const prodCats = new Set();

const ingRows = parseRows("🥝 INGREDIENTES");
ingRows.forEach(r => { if (r[2]) ingCats.add(r[2]); });

const prodRows = parseRows("🍓 PRODUCTOS VENTA");
prodRows.forEach(r => { if (r[2]) prodCats.add(r[2]); });

const categories = [];
let sortOrder = 0;
for (const name of prodCats) {
  categories.push({ id: randomUUID(), name, slug: slug(name), type: "product", icon: PRODUCT_CAT_ICONS[name] || "Sparkle", sort_order: sortOrder++, company_id: COMPANY_ID });
}
sortOrder = 0;
for (const name of ingCats) {
  categories.push({ id: randomUUID(), name, slug: slug(name), type: "ingredient", icon: INGREDIENT_CAT_ICONS[name] || "Package", sort_order: sortOrder++, company_id: COMPANY_ID });
}

const catMap = {};
categories.forEach(c => { catMap[c.name] = c.id; });

// 2. Ingredients
const ingredients = ingRows.map(r => ({
  id: randomUUID(),
  ref: r[0],
  name: r[1],
  category_id: catMap[r[2]] || null,
  unit: r[4] || "und",
  purchase_unit: r[5] || r[4] || "und",
  cost_per_unit: r[6] || 0,
  stock_quantity: 0,
  min_stock: r[7] || 0,
  active: 1,
  company_id: COMPANY_ID,
}));

const ingRefMap = {};
ingredients.forEach(i => { ingRefMap[i.ref] = i.id; });

// 3. Products
const products = prodRows.map(r => ({
  id: randomUUID(),
  ref: r[0],
  name: r[1],
  category_id: catMap[r[2]] || null,
  price: r[4] || 0,
  cost: 0,
  description: "",
  icon: getProductIcon(r[1], r[2]),
  available_in_pos: 1,
  active: 1,
  sort_order: 0,
  company_id: COMPANY_ID,
}));

const prodRefMap = {};
products.forEach(p => { prodRefMap[p.ref] = p.id; });

// 4. Recipes
const recipeRows = parseRows("🔧 RECETAS BOM");
const recipes = [];
for (const r of recipeRows) {
  const prodId = prodRefMap[r[0]] || ingRefMap[r[0]]; // Some BOMs are for sub-products (ingredients)
  const ingId = ingRefMap[r[2]];
  if (!prodId || !ingId) continue;
  // Only add if product exists (skip sub-product BOMs that are ingredient-to-ingredient)
  if (!prodRefMap[r[0]]) continue;
  recipes.push({
    id: randomUUID(),
    product_id: prodId,
    ingredient_id: ingId,
    quantity: r[4] || 0,
    unit: r[5] || "und",
    company_id: COMPANY_ID,
  });
}

// 5. Suppliers
const supplierRows = parseRows("🛒 PROVEEDORES");
const supplierNames = new Set();
supplierRows.forEach(r => { if (r[2]) supplierNames.add(String(r[2]).trim()); });

const suppliers = [];
const supplierMap = {};
for (const name of supplierNames) {
  const id = randomUUID();
  const phone = supplierRows.find(r => String(r[2]).trim() === name)?.[3] || "";
  suppliers.push({ id, name, phone: String(phone).trim(), active: 1, company_id: COMPANY_ID });
  supplierMap[name] = id;
}

// 6. Supplier prices
const supplierPrices = [];
for (const r of supplierRows) {
  const ingId = ingRefMap[r[0]];
  const supplierId = supplierMap[String(r[2]).trim()];
  if (!ingId || !supplierId) continue;

  // Parse presentation quantity from messy data
  let presQty = 1;
  let presUnit = "und";
  const rawQty = String(r[5] || "");
  const rawUnit = String(r[6] || "");

  // Try to extract number from presUnit like "11 kg", "1 kg", "4kg"
  const numMatch = rawUnit.match(/([\d.,]+)\s*(\w+)/);
  if (numMatch) {
    presQty = parseFloat(numMatch[1].replace(",", ".")) || 1;
    presUnit = numMatch[2] || "und";
  }

  supplierPrices.push({
    id: randomUUID(),
    supplier_id: supplierId,
    ingredient_id: ingId,
    price: r[4] || 0,
    presentation_qty: presQty,
    presentation_unit: presUnit,
    lead_days: 1,
    company_id: COMPANY_ID,
  });
}

// ── Output JSON for API insertion ──
const result = { categories, ingredients, products, recipes, suppliers, supplierPrices };
console.log(JSON.stringify(result));
