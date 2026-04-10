/**
 * Seed script — populates the local SQLite database with realistic data
 * for a strawberry dessert shop (Dulce Fresita).
 *
 * Usage: node scripts/seed-local.js <company_id>
 */

const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

const COMPANY_ID = process.argv[2];
if (!COMPANY_ID) {
  console.error("Usage: node scripts/seed-local.js <company_id>");
  process.exit(1);
}

const DB_PATH = path.join(__dirname, "..", "data", "dulce-fresita.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ── Helper ──────────────────────────────────────────────────

function insert(table, rows) {
  const tx = db.transaction((items) => {
    for (const item of items) {
      const cols = Object.keys(item);
      const placeholders = cols.map(() => "?").join(", ");
      db.prepare(`INSERT OR IGNORE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`)
        .run(...cols.map((c) => item[c]));
    }
  });
  tx(rows);
  console.log(`  ✓ ${table}: ${rows.length} rows`);
}

// ── Categories ──────────────────────────────────────────────

console.log("\n→ Categorías...");

const catProductFresitas = uuid();
const catProductBebidas = uuid();
const catProductPostres = uuid();
const catProductWaffles = uuid();
const catProductExtras = uuid();

const catIngFrutas = uuid();
const catIngLacteos = uuid();
const catIngSecos = uuid();
const catIngSalsas = uuid();
const catIngEmpaques = uuid();

const productCategories = [
  { id: catProductFresitas, name: "Fresitas", slug: "fresitas", icon: "🍓", sort_order: 0, type: "product", company_id: COMPANY_ID, created_at: now() },
  { id: catProductBebidas, name: "Bebidas", slug: "bebidas", icon: "🥤", sort_order: 1, type: "product", company_id: COMPANY_ID, created_at: now() },
  { id: catProductPostres, name: "Postres", slug: "postres", icon: "🍰", sort_order: 2, type: "product", company_id: COMPANY_ID, created_at: now() },
  { id: catProductWaffles, name: "Waffles y Crepas", slug: "waffles-crepas", icon: "🧇", sort_order: 3, type: "product", company_id: COMPANY_ID, created_at: now() },
  { id: catProductExtras, name: "Extras", slug: "extras-venta", icon: "✨", sort_order: 4, type: "product", company_id: COMPANY_ID, created_at: now() },
];

const ingredientCategories = [
  { id: catIngFrutas, name: "Frutas", slug: "frutas", icon: "🍎", sort_order: 0, type: "ingredient", company_id: COMPANY_ID, created_at: now() },
  { id: catIngLacteos, name: "Lácteos", slug: "lacteos", icon: "🥛", sort_order: 1, type: "ingredient", company_id: COMPANY_ID, created_at: now() },
  { id: catIngSecos, name: "Secos y Harinas", slug: "secos-harinas", icon: "🌾", sort_order: 2, type: "ingredient", company_id: COMPANY_ID, created_at: now() },
  { id: catIngSalsas, name: "Salsas y Toppings", slug: "salsas-toppings", icon: "🍫", sort_order: 3, type: "ingredient", company_id: COMPANY_ID, created_at: now() },
  { id: catIngEmpaques, name: "Empaques", slug: "empaques", icon: "📦", sort_order: 4, type: "ingredient", company_id: COMPANY_ID, created_at: now() },
];

insert("categories", [...productCategories, ...ingredientCategories]);

// ── Ingredients ─────────────────────────────────────────────

console.log("\n→ Ingredientes...");

const ing = {};
function addIng(ref, name, cat, unit, cost, stock, minStock, purchaseUnit) {
  const id = uuid();
  ing[ref] = id;
  return {
    id, ref, name, category_id: cat, unit, purchase_unit: purchaseUnit || unit,
    cost_per_unit: cost, stock_quantity: stock, min_stock: minStock,
    active: 1, created_at: now(), updated_at: now(), company_id: COMPANY_ID,
  };
}

const ingredients = [
  // Frutas
  addIng("FRESA", "Fresas frescas", catIngFrutas, "g", 12, 15000, 3000, "kg"),
  addIng("BANANO", "Banano", catIngFrutas, "und", 500, 80, 20, "und"),
  addIng("MANGO", "Mango", catIngFrutas, "g", 8, 5000, 1000, "kg"),
  addIng("MARACUYA", "Maracuyá (pulpa)", catIngFrutas, "g", 15, 3000, 500, "kg"),
  addIng("ARANDANO", "Arándanos", catIngFrutas, "g", 35, 2000, 500, "g"),
  addIng("MORA", "Mora", catIngFrutas, "g", 10, 4000, 1000, "kg"),
  addIng("DURAZNO", "Durazno en almíbar", catIngFrutas, "g", 14, 3000, 500, "lata"),
  addIng("KIWI", "Kiwi", catIngFrutas, "und", 1500, 30, 10, "und"),

  // Lácteos
  addIng("LECHECOND", "Leche condensada", catIngLacteos, "g", 18, 5000, 1000, "lata"),
  addIng("CREMA", "Crema de leche", catIngLacteos, "ml", 12, 6000, 1500, "L"),
  addIng("QUESOCREMA", "Queso crema", catIngLacteos, "g", 22, 3000, 500, "bloque"),
  addIng("LECHE", "Leche entera", catIngLacteos, "ml", 4, 10000, 3000, "L"),
  addIng("YOGURT", "Yogurt natural", catIngLacteos, "ml", 8, 4000, 1000, "L"),
  addIng("HELADO-V", "Helado vainilla", catIngLacteos, "g", 15, 5000, 1000, "tarro"),
  addIng("HELADO-F", "Helado fresa", catIngLacteos, "g", 16, 4000, 1000, "tarro"),
  addIng("HELADO-CH", "Helado chocolate", catIngLacteos, "g", 16, 4000, 1000, "tarro"),

  // Secos
  addIng("AZUCAR", "Azúcar", catIngSecos, "g", 3, 10000, 2000, "kg"),
  addIng("HARINA", "Harina de trigo", catIngSecos, "g", 3, 8000, 2000, "kg"),
  addIng("HARINA-W", "Mezcla para waffles", catIngSecos, "g", 8, 5000, 1000, "kg"),
  addIng("GALLETA-O", "Galletas Oreo", catIngSecos, "und", 400, 100, 30, "paquete"),
  addIng("GALLETA-M", "Galletas María", catIngSecos, "und", 200, 80, 20, "paquete"),
  addIng("GRANOLA", "Granola", catIngSecos, "g", 18, 3000, 500, "kg"),
  addIng("CONO", "Cono de waffle", catIngSecos, "und", 800, 50, 15, "und"),
  addIng("SPRINKLES", "Sprinkles de colores", catIngSecos, "g", 30, 1500, 300, "frasco"),
  addIng("MASMELO", "Masmelos mini", catIngSecos, "g", 20, 2000, 500, "bolsa"),
  addIng("CEREAL", "Zucaritas", catIngSecos, "g", 22, 1500, 300, "caja"),

  // Salsas
  addIng("CHOCO", "Chocolate derretido", catIngSalsas, "g", 25, 3000, 500, "kg"),
  addIng("AREQUIPE", "Arequipe", catIngSalsas, "g", 20, 4000, 800, "tarro"),
  addIng("NUTELLA", "Nutella", catIngSalsas, "g", 55, 2000, 400, "frasco"),
  addIng("MIEL", "Miel de abejas", catIngSalsas, "ml", 30, 2000, 500, "botella"),
  addIng("SALSA-F", "Salsa de fresa", catIngSalsas, "g", 15, 3000, 600, "botella"),
  addIng("CREMA-CH", "Crema chantilly", catIngSalsas, "g", 18, 4000, 800, "lata"),

  // Empaques
  addIng("VASO-12", "Vaso 12oz", catIngEmpaques, "und", 350, 200, 50, "paquete"),
  addIng("VASO-16", "Vaso 16oz", catIngEmpaques, "und", 450, 150, 40, "paquete"),
  addIng("TAPA", "Tapa domo", catIngEmpaques, "und", 200, 300, 80, "paquete"),
  addIng("CUCHARA", "Cuchara larga", catIngEmpaques, "und", 100, 300, 80, "paquete"),
  addIng("PITILLO", "Pitillo grueso", catIngEmpaques, "und", 80, 300, 80, "paquete"),
  addIng("SERVILLETA", "Servilletas", catIngEmpaques, "und", 15, 1000, 200, "paquete"),
  addIng("BOLSA-P", "Bolsa pequeña", catIngEmpaques, "und", 50, 200, 50, "paquete"),
];

insert("ingredients", ingredients);

// ── Products ────────────────────────────────────────────────

console.log("\n→ Productos...");

const prod = {};
function addProd(ref, name, cat, price, cost, desc, sort) {
  const id = uuid();
  prod[ref] = id;
  return {
    id, ref, name, category_id: cat, price, cost, description: desc,
    image_url: null, icon: null, available_in_pos: 1, active: 1, sort_order: sort,
    created_at: now(), updated_at: now(), company_id: COMPANY_ID,
  };
}

const products = [
  // Fresitas
  addProd("F-CLASICA", "Fresita Clásica", catProductFresitas, 12000, 4500, "Fresas con crema, leche condensada y toppings", 0),
  addProd("F-CHOCO", "Fresita con Chocolate", catProductFresitas, 14000, 5200, "Fresas bañadas en chocolate con crema chantilly", 1),
  addProd("F-PREMIUM", "Fresita Premium", catProductFresitas, 18000, 7000, "Fresas, helado, galleta oreo, nutella y crema", 2),
  addProd("F-AREQUIPE", "Fresita Arequipe", catProductFresitas, 13000, 4800, "Fresas con arequipe, crema y sprinkles", 3),
  addProd("F-TROPICAL", "Fresita Tropical", catProductFresitas, 15000, 5500, "Fresas con mango, maracuyá y granola", 4),
  addProd("F-MINI", "Fresita Mini", catProductFresitas, 8000, 3000, "Porción pequeña con fresas y crema", 5),
  addProd("F-CONO", "Fresita en Cono", catProductFresitas, 10000, 3800, "Cono waffle con fresas, crema y chocolate", 6),
  addProd("F-OREO", "Fresita Oreo", catProductFresitas, 15000, 5800, "Fresas con galleta oreo triturada y crema", 7),
  addProd("F-BANANA", "Banana Split Fresita", catProductFresitas, 16000, 6200, "Banano, fresas, 3 helados y toppings", 8),
  addProd("F-AMOR", "Fresita del Amor", catProductFresitas, 20000, 8000, "Fresita premium para compartir (doble porción)", 9),

  // Bebidas
  addProd("B-MALT-F", "Malteada de Fresa", catProductBebidas, 10000, 3500, "Malteada cremosa de fresa", 0),
  addProd("B-MALT-CH", "Malteada de Chocolate", catProductBebidas, 10000, 3500, "Malteada cremosa de chocolate", 1),
  addProd("B-MALT-V", "Malteada de Vainilla", catProductBebidas, 10000, 3500, "Malteada cremosa de vainilla", 2),
  addProd("B-MALT-O", "Malteada Oreo", catProductBebidas, 12000, 4200, "Malteada con galleta oreo", 3),
  addProd("B-LIMO-F", "Limonada de Fresa", catProductBebidas, 7000, 2000, "Limonada natural con fresas", 4),
  addProd("B-SMOOTHIE", "Smoothie de Frutas", catProductBebidas, 9000, 3000, "Fresa, banano y yogurt", 5),
  addProd("B-FRAPPE", "Frappé de Arequipe", catProductBebidas, 11000, 4000, "Frappé con arequipe y crema", 6),

  // Postres
  addProd("P-CHEESECAKE", "Cheesecake de Fresa", catProductPostres, 9000, 3500, "Porción de cheesecake con salsa de fresa", 0),
  addProd("P-COPA", "Copa de Frutas", catProductPostres, 11000, 4000, "Copa con frutas variadas, yogurt y granola", 1),
  addProd("P-BROWNIE", "Brownie con Helado", catProductPostres, 10000, 3800, "Brownie caliente con helado y salsa", 2),
  addProd("P-TRES-LECHES", "Tres Leches Fresita", catProductPostres, 8000, 3000, "Porción de tres leches con fresas", 3),

  // Waffles y Crepas
  addProd("W-CLASICO", "Waffle Clásico", catProductWaffles, 12000, 4000, "Waffle con helado, fresas y salsa", 0),
  addProd("W-NUTELLA", "Waffle Nutella", catProductWaffles, 14000, 5000, "Waffle con nutella, fresas y crema", 1),
  addProd("W-FULL", "Waffle Full Toppings", catProductWaffles, 16000, 6000, "Waffle con todo: helado, frutas, salsas", 2),
  addProd("C-NUTELLA", "Crepa de Nutella", catProductWaffles, 11000, 3800, "Crepa rellena de nutella con fresas", 3),
  addProd("C-AREQUIPE", "Crepa de Arequipe", catProductWaffles, 10000, 3500, "Crepa rellena de arequipe con banano", 4),
  addProd("C-FRUTAS", "Crepa de Frutas", catProductWaffles, 12000, 4200, "Crepa con frutas variadas y crema", 5),

  // Extras
  addProd("X-CHOCO", "Extra Chocolate", catProductExtras, 2000, 500, null, 0),
  addProd("X-AREQUIPE", "Extra Arequipe", catProductExtras, 2000, 400, null, 1),
  addProd("X-NUTELLA", "Extra Nutella", catProductExtras, 3000, 1100, null, 2),
  addProd("X-CREMA", "Extra Crema Chantilly", catProductExtras, 1500, 300, null, 3),
  addProd("X-OREO", "Topping Oreo", catProductExtras, 2000, 600, null, 4),
  addProd("X-SPRINKLES", "Topping Sprinkles", catProductExtras, 1000, 200, null, 5),
  addProd("X-HELADO", "Bola de Helado Extra", catProductExtras, 3000, 800, null, 6),
  addProd("X-FRUTAS", "Porción Extra Frutas", catProductExtras, 3000, 1000, null, 7),
];

insert("products", products);

// ── Recipes (BOM) ───────────────────────────────────────────

console.log("\n→ Recetas...");

function recipe(prodRef, ingRef, qty, unit) {
  return {
    id: uuid(), product_id: prod[prodRef], ingredient_id: ing[ingRef],
    quantity: qty, unit, created_at: now(), company_id: COMPANY_ID,
  };
}

const recipes = [
  // Fresita Clásica
  recipe("F-CLASICA", "FRESA", 200, "g"),
  recipe("F-CLASICA", "CREMA-CH", 30, "g"),
  recipe("F-CLASICA", "LECHECOND", 25, "g"),
  recipe("F-CLASICA", "SPRINKLES", 5, "g"),
  recipe("F-CLASICA", "VASO-12", 1, "und"),
  recipe("F-CLASICA", "CUCHARA", 1, "und"),

  // Fresita con Chocolate
  recipe("F-CHOCO", "FRESA", 200, "g"),
  recipe("F-CHOCO", "CHOCO", 30, "g"),
  recipe("F-CHOCO", "CREMA-CH", 30, "g"),
  recipe("F-CHOCO", "LECHECOND", 20, "g"),
  recipe("F-CHOCO", "VASO-12", 1, "und"),
  recipe("F-CHOCO", "CUCHARA", 1, "und"),

  // Fresita Premium
  recipe("F-PREMIUM", "FRESA", 250, "g"),
  recipe("F-PREMIUM", "HELADO-V", 80, "g"),
  recipe("F-PREMIUM", "GALLETA-O", 3, "und"),
  recipe("F-PREMIUM", "NUTELLA", 20, "g"),
  recipe("F-PREMIUM", "CREMA-CH", 40, "g"),
  recipe("F-PREMIUM", "LECHECOND", 20, "g"),
  recipe("F-PREMIUM", "VASO-16", 1, "und"),
  recipe("F-PREMIUM", "CUCHARA", 1, "und"),

  // Fresita Arequipe
  recipe("F-AREQUIPE", "FRESA", 200, "g"),
  recipe("F-AREQUIPE", "AREQUIPE", 30, "g"),
  recipe("F-AREQUIPE", "CREMA-CH", 30, "g"),
  recipe("F-AREQUIPE", "SPRINKLES", 5, "g"),
  recipe("F-AREQUIPE", "VASO-12", 1, "und"),
  recipe("F-AREQUIPE", "CUCHARA", 1, "und"),

  // Fresita Tropical
  recipe("F-TROPICAL", "FRESA", 150, "g"),
  recipe("F-TROPICAL", "MANGO", 80, "g"),
  recipe("F-TROPICAL", "MARACUYA", 30, "g"),
  recipe("F-TROPICAL", "GRANOLA", 25, "g"),
  recipe("F-TROPICAL", "CREMA-CH", 25, "g"),
  recipe("F-TROPICAL", "VASO-16", 1, "und"),
  recipe("F-TROPICAL", "CUCHARA", 1, "und"),

  // Fresita Mini
  recipe("F-MINI", "FRESA", 120, "g"),
  recipe("F-MINI", "CREMA-CH", 20, "g"),
  recipe("F-MINI", "LECHECOND", 15, "g"),
  recipe("F-MINI", "VASO-12", 1, "und"),
  recipe("F-MINI", "CUCHARA", 1, "und"),

  // Fresita en Cono
  recipe("F-CONO", "FRESA", 150, "g"),
  recipe("F-CONO", "CREMA-CH", 25, "g"),
  recipe("F-CONO", "CHOCO", 15, "g"),
  recipe("F-CONO", "CONO", 1, "und"),
  recipe("F-CONO", "SERVILLETA", 2, "und"),

  // Fresita Oreo
  recipe("F-OREO", "FRESA", 200, "g"),
  recipe("F-OREO", "GALLETA-O", 4, "und"),
  recipe("F-OREO", "CREMA-CH", 35, "g"),
  recipe("F-OREO", "LECHECOND", 20, "g"),
  recipe("F-OREO", "VASO-16", 1, "und"),
  recipe("F-OREO", "CUCHARA", 1, "und"),

  // Banana Split Fresita
  recipe("F-BANANA", "BANANO", 1, "und"),
  recipe("F-BANANA", "FRESA", 150, "g"),
  recipe("F-BANANA", "HELADO-V", 60, "g"),
  recipe("F-BANANA", "HELADO-F", 60, "g"),
  recipe("F-BANANA", "HELADO-CH", 60, "g"),
  recipe("F-BANANA", "CHOCO", 20, "g"),
  recipe("F-BANANA", "CREMA-CH", 30, "g"),
  recipe("F-BANANA", "VASO-16", 1, "und"),
  recipe("F-BANANA", "CUCHARA", 1, "und"),

  // Fresita del Amor
  recipe("F-AMOR", "FRESA", 400, "g"),
  recipe("F-AMOR", "HELADO-F", 100, "g"),
  recipe("F-AMOR", "CREMA-CH", 50, "g"),
  recipe("F-AMOR", "LECHECOND", 40, "g"),
  recipe("F-AMOR", "CHOCO", 30, "g"),
  recipe("F-AMOR", "GALLETA-O", 4, "und"),
  recipe("F-AMOR", "SPRINKLES", 10, "g"),
  recipe("F-AMOR", "VASO-16", 1, "und"),
  recipe("F-AMOR", "CUCHARA", 2, "und"),

  // Malteada de Fresa
  recipe("B-MALT-F", "LECHE", 200, "ml"),
  recipe("B-MALT-F", "HELADO-F", 100, "g"),
  recipe("B-MALT-F", "FRESA", 80, "g"),
  recipe("B-MALT-F", "CREMA-CH", 20, "g"),
  recipe("B-MALT-F", "VASO-16", 1, "und"),
  recipe("B-MALT-F", "PITILLO", 1, "und"),

  // Malteada de Chocolate
  recipe("B-MALT-CH", "LECHE", 200, "ml"),
  recipe("B-MALT-CH", "HELADO-CH", 100, "g"),
  recipe("B-MALT-CH", "CHOCO", 25, "g"),
  recipe("B-MALT-CH", "CREMA-CH", 20, "g"),
  recipe("B-MALT-CH", "VASO-16", 1, "und"),
  recipe("B-MALT-CH", "PITILLO", 1, "und"),

  // Malteada de Vainilla
  recipe("B-MALT-V", "LECHE", 200, "ml"),
  recipe("B-MALT-V", "HELADO-V", 100, "g"),
  recipe("B-MALT-V", "CREMA-CH", 20, "g"),
  recipe("B-MALT-V", "VASO-16", 1, "und"),
  recipe("B-MALT-V", "PITILLO", 1, "und"),

  // Malteada Oreo
  recipe("B-MALT-O", "LECHE", 200, "ml"),
  recipe("B-MALT-O", "HELADO-V", 100, "g"),
  recipe("B-MALT-O", "GALLETA-O", 4, "und"),
  recipe("B-MALT-O", "CREMA-CH", 25, "g"),
  recipe("B-MALT-O", "VASO-16", 1, "und"),
  recipe("B-MALT-O", "PITILLO", 1, "und"),

  // Limonada de Fresa
  recipe("B-LIMO-F", "FRESA", 100, "g"),
  recipe("B-LIMO-F", "AZUCAR", 30, "g"),
  recipe("B-LIMO-F", "VASO-16", 1, "und"),
  recipe("B-LIMO-F", "PITILLO", 1, "und"),

  // Smoothie de Frutas
  recipe("B-SMOOTHIE", "FRESA", 80, "g"),
  recipe("B-SMOOTHIE", "BANANO", 1, "und"),
  recipe("B-SMOOTHIE", "YOGURT", 150, "ml"),
  recipe("B-SMOOTHIE", "MIEL", 10, "ml"),
  recipe("B-SMOOTHIE", "VASO-16", 1, "und"),
  recipe("B-SMOOTHIE", "PITILLO", 1, "und"),

  // Frappé de Arequipe
  recipe("B-FRAPPE", "LECHE", 200, "ml"),
  recipe("B-FRAPPE", "HELADO-V", 80, "g"),
  recipe("B-FRAPPE", "AREQUIPE", 30, "g"),
  recipe("B-FRAPPE", "CREMA-CH", 25, "g"),
  recipe("B-FRAPPE", "VASO-16", 1, "und"),
  recipe("B-FRAPPE", "PITILLO", 1, "und"),

  // Copa de Frutas
  recipe("P-COPA", "FRESA", 100, "g"),
  recipe("P-COPA", "BANANO", 1, "und"),
  recipe("P-COPA", "MANGO", 60, "g"),
  recipe("P-COPA", "KIWI", 1, "und"),
  recipe("P-COPA", "YOGURT", 100, "ml"),
  recipe("P-COPA", "GRANOLA", 30, "g"),
  recipe("P-COPA", "MIEL", 10, "ml"),
  recipe("P-COPA", "VASO-16", 1, "und"),
  recipe("P-COPA", "CUCHARA", 1, "und"),

  // Waffle Clásico
  recipe("W-CLASICO", "HARINA-W", 120, "g"),
  recipe("W-CLASICO", "FRESA", 100, "g"),
  recipe("W-CLASICO", "HELADO-V", 80, "g"),
  recipe("W-CLASICO", "SALSA-F", 20, "g"),
  recipe("W-CLASICO", "CREMA-CH", 20, "g"),
  recipe("W-CLASICO", "SERVILLETA", 2, "und"),

  // Waffle Nutella
  recipe("W-NUTELLA", "HARINA-W", 120, "g"),
  recipe("W-NUTELLA", "FRESA", 100, "g"),
  recipe("W-NUTELLA", "NUTELLA", 30, "g"),
  recipe("W-NUTELLA", "CREMA-CH", 25, "g"),
  recipe("W-NUTELLA", "SERVILLETA", 2, "und"),

  // Waffle Full
  recipe("W-FULL", "HARINA-W", 120, "g"),
  recipe("W-FULL", "FRESA", 120, "g"),
  recipe("W-FULL", "HELADO-V", 60, "g"),
  recipe("W-FULL", "HELADO-CH", 60, "g"),
  recipe("W-FULL", "NUTELLA", 20, "g"),
  recipe("W-FULL", "CHOCO", 15, "g"),
  recipe("W-FULL", "CREMA-CH", 30, "g"),
  recipe("W-FULL", "GALLETA-O", 2, "und"),
  recipe("W-FULL", "SERVILLETA", 2, "und"),

  // Crepa Nutella
  recipe("C-NUTELLA", "HARINA", 80, "g"),
  recipe("C-NUTELLA", "LECHE", 50, "ml"),
  recipe("C-NUTELLA", "FRESA", 80, "g"),
  recipe("C-NUTELLA", "NUTELLA", 30, "g"),
  recipe("C-NUTELLA", "CREMA-CH", 20, "g"),
  recipe("C-NUTELLA", "SERVILLETA", 2, "und"),

  // Crepa Arequipe
  recipe("C-AREQUIPE", "HARINA", 80, "g"),
  recipe("C-AREQUIPE", "LECHE", 50, "ml"),
  recipe("C-AREQUIPE", "BANANO", 1, "und"),
  recipe("C-AREQUIPE", "AREQUIPE", 30, "g"),
  recipe("C-AREQUIPE", "CREMA-CH", 20, "g"),
  recipe("C-AREQUIPE", "SERVILLETA", 2, "und"),

  // Crepa Frutas
  recipe("C-FRUTAS", "HARINA", 80, "g"),
  recipe("C-FRUTAS", "LECHE", 50, "ml"),
  recipe("C-FRUTAS", "FRESA", 80, "g"),
  recipe("C-FRUTAS", "BANANO", 1, "und"),
  recipe("C-FRUTAS", "MANGO", 50, "g"),
  recipe("C-FRUTAS", "CREMA-CH", 25, "g"),
  recipe("C-FRUTAS", "MIEL", 10, "ml"),
  recipe("C-FRUTAS", "SERVILLETA", 2, "und"),

  // Extras
  recipe("X-CHOCO", "CHOCO", 20, "g"),
  recipe("X-AREQUIPE", "AREQUIPE", 20, "g"),
  recipe("X-NUTELLA", "NUTELLA", 20, "g"),
  recipe("X-CREMA", "CREMA-CH", 20, "g"),
  recipe("X-OREO", "GALLETA-O", 3, "und"),
  recipe("X-SPRINKLES", "SPRINKLES", 8, "g"),
  recipe("X-HELADO", "HELADO-V", 80, "g"),
  recipe("X-FRUTAS", "FRESA", 80, "g"),
  recipe("X-FRUTAS", "BANANO", 1, "und"),
];

insert("recipes", recipes);

// ── Suppliers ───────────────────────────────────────────────

console.log("\n→ Proveedores...");

const sup1 = uuid(), sup2 = uuid(), sup3 = uuid(), sup4 = uuid(), sup5 = uuid();

const suppliers = [
  { id: sup1, name: "Frutas del Campo", phone: "3101234567", active: 1, created_at: now(), company_id: COMPANY_ID },
  { id: sup2, name: "Lácteos La Vaca", phone: "3209876543", active: 1, created_at: now(), company_id: COMPANY_ID },
  { id: sup3, name: "Distribuidora El Dulce", phone: "3156781234", active: 1, created_at: now(), company_id: COMPANY_ID },
  { id: sup4, name: "Empaques y Más", phone: "3184567890", active: 1, created_at: now(), company_id: COMPANY_ID },
  { id: sup5, name: "Helados Premium S.A.", phone: "3172345678", active: 1, created_at: now(), company_id: COMPANY_ID },
];

insert("suppliers", suppliers);

// ── Supplier Prices ─────────────────────────────────────────

console.log("\n→ Precios de proveedores...");

function sp(supplierId, ingRef, price, qty, unit, days) {
  return {
    id: uuid(), supplier_id: supplierId, ingredient_id: ing[ingRef],
    price, presentation_qty: qty, presentation_unit: unit, lead_days: days,
    created_at: now(), company_id: COMPANY_ID,
  };
}

const supplierPrices = [
  // Frutas del Campo
  sp(sup1, "FRESA", 12000, 1000, "kg", 1),
  sp(sup1, "BANANO", 8000, 20, "racimo", 1),
  sp(sup1, "MANGO", 8000, 1000, "kg", 2),
  sp(sup1, "MARACUYA", 15000, 1000, "kg", 2),
  sp(sup1, "MORA", 10000, 1000, "kg", 1),
  sp(sup1, "ARANDANO", 18000, 500, "bandeja", 3),
  sp(sup1, "KIWI", 25000, 20, "caja", 3),

  // Lácteos La Vaca
  sp(sup2, "LECHE", 4200, 1000, "L", 1),
  sp(sup2, "CREMA", 12000, 1000, "L", 1),
  sp(sup2, "QUESOCREMA", 15000, 500, "bloque", 2),
  sp(sup2, "YOGURT", 8500, 1000, "L", 1),
  sp(sup2, "LECHECOND", 8500, 500, "lata", 2),

  // Distribuidora El Dulce
  sp(sup3, "CHOCO", 25000, 1000, "kg", 3),
  sp(sup3, "AREQUIPE", 18000, 1000, "tarro", 2),
  sp(sup3, "NUTELLA", 28000, 500, "frasco", 5),
  sp(sup3, "MIEL", 22000, 750, "botella", 3),
  sp(sup3, "SALSA-F", 12000, 750, "botella", 3),
  sp(sup3, "GALLETA-O", 12000, 36, "paquete", 2),
  sp(sup3, "GALLETA-M", 6000, 36, "paquete", 2),
  sp(sup3, "SPRINKLES", 9000, 300, "frasco", 5),
  sp(sup3, "GRANOLA", 16000, 1000, "kg", 3),
  sp(sup3, "AZUCAR", 3500, 1000, "kg", 2),
  sp(sup3, "MASMELO", 7500, 400, "bolsa", 3),
  sp(sup3, "CEREAL", 12000, 500, "caja", 3),
  sp(sup3, "HARINA", 3200, 1000, "kg", 2),
  sp(sup3, "HARINA-W", 12000, 1000, "kg", 3),
  sp(sup3, "CONO", 15000, 20, "paquete", 5),
  sp(sup3, "CREMA-CH", 14000, 800, "lata", 2),

  // Empaques y Más
  sp(sup4, "VASO-12", 15000, 50, "paquete", 3),
  sp(sup4, "VASO-16", 18000, 50, "paquete", 3),
  sp(sup4, "TAPA", 8000, 50, "paquete", 3),
  sp(sup4, "CUCHARA", 5000, 50, "paquete", 3),
  sp(sup4, "PITILLO", 4000, 50, "paquete", 3),
  sp(sup4, "SERVILLETA", 4500, 300, "paquete", 2),
  sp(sup4, "BOLSA-P", 6000, 100, "paquete", 3),

  // Helados Premium
  sp(sup5, "HELADO-V", 35000, 2500, "tarro", 2),
  sp(sup5, "HELADO-F", 37000, 2500, "tarro", 2),
  sp(sup5, "HELADO-CH", 37000, 2500, "tarro", 2),
];

insert("supplier_prices", supplierPrices);

// ── Done ────────────────────────────────────────────────────

const counts = {
  categories: db.prepare("SELECT COUNT(*) as c FROM categories WHERE company_id = ?").get(COMPANY_ID).c,
  ingredients: db.prepare("SELECT COUNT(*) as c FROM ingredients WHERE company_id = ?").get(COMPANY_ID).c,
  products: db.prepare("SELECT COUNT(*) as c FROM products WHERE company_id = ?").get(COMPANY_ID).c,
  recipes: db.prepare("SELECT COUNT(*) as c FROM recipes WHERE company_id = ?").get(COMPANY_ID).c,
  suppliers: db.prepare("SELECT COUNT(*) as c FROM suppliers WHERE company_id = ?").get(COMPANY_ID).c,
  supplier_prices: db.prepare("SELECT COUNT(*) as c FROM supplier_prices WHERE company_id = ?").get(COMPANY_ID).c,
};

console.log("\n✅ Seed completo:");
console.log(`   ${counts.categories} categorías (${productCategories.length} producto + ${ingredientCategories.length} ingrediente)`);
console.log(`   ${counts.ingredients} ingredientes`);
console.log(`   ${counts.products} productos`);
console.log(`   ${counts.recipes} recetas`);
console.log(`   ${counts.suppliers} proveedores`);
console.log(`   ${counts.supplier_prices} precios de proveedor`);

db.close();
