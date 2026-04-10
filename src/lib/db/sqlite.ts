import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.DULCE_DB_PATH || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "dulce-fresita.db");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Performance settings
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    type TEXT NOT NULL CHECK (type IN ('product', 'ingredient')),
    company_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    ref TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    category_id TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    cost INTEGER DEFAULT 0,
    description TEXT,
    image_url TEXT,
    icon TEXT,
    available_in_pos INTEGER DEFAULT 1,
    active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now')),
    company_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ingredients (
    id TEXT PRIMARY KEY,
    ref TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    category_id TEXT,
    unit TEXT NOT NULL DEFAULT 'und',
    purchase_unit TEXT,
    cost_per_unit INTEGER DEFAULT 0,
    stock_quantity REAL DEFAULT 0,
    min_stock REAL DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now')),
    company_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    ingredient_id TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'und',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now')),
    company_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now')),
    company_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS supplier_prices (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL,
    ingredient_id TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    presentation_qty REAL DEFAULT 1,
    presentation_unit TEXT DEFAULT 'und',
    lead_days INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now')),
    company_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cash_registers (
    id TEXT PRIMARY KEY,
    opened_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now')),
    closed_at TEXT,
    opened_by TEXT,
    closed_by TEXT,
    initial_cash INTEGER NOT NULL DEFAULT 0,
    final_cash_expected INTEGER,
    final_cash_actual INTEGER,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now')),
    company_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    sale_number INTEGER,
    register_id TEXT,
    total INTEGER NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('efectivo', 'nequi')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided')),
    voided_reason TEXT,
    sold_by TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now')),
    company_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now')),
    company_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS inventory_movements (
    id TEXT PRIMARY KEY,
    ingredient_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('purchase', 'sale_deduction', 'adjustment', 'waste')),
    quantity REAL NOT NULL,
    reference_id TEXT,
    notes TEXT,
    created_by TEXT,
    supplier_id TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now')),
    company_id TEXT NOT NULL
  );
`);

// Schema migrations for existing databases
try { db.exec("ALTER TABLE inventory_movements ADD COLUMN supplier_id TEXT"); } catch { /* column already exists */ }

// Fix datetime format: SQLite datetime('now') uses space separator, JS uses T
// Normalize all existing created_at/opened_at/closed_at to ISO format with T
const dateTables = [
  { table: "companies", cols: ["created_at"] },
  { table: "categories", cols: ["created_at"] },
  { table: "products", cols: ["created_at", "updated_at"] },
  { table: "ingredients", cols: ["created_at", "updated_at"] },
  { table: "recipes", cols: ["created_at"] },
  { table: "suppliers", cols: ["created_at"] },
  { table: "supplier_prices", cols: ["created_at"] },
  { table: "cash_registers", cols: ["created_at", "opened_at", "closed_at"] },
  { table: "sales", cols: ["created_at"] },
  { table: "sale_items", cols: ["created_at"] },
  { table: "inventory_movements", cols: ["created_at"] },
];
for (const { table, cols } of dateTables) {
  for (const col of cols) {
    db.exec(`UPDATE ${table} SET ${col} = REPLACE(${col}, ' ', 'T') WHERE ${col} LIKE '____-__-__ %'`);
  }
}

export default db;
