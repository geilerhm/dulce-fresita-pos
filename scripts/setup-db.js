/**
 * Dulce Fresita — Setup database + seed data from Excel
 */
const { Client } = require("pg");

const DB_URL = "postgresql://postgres:Strong_DB_Password_2026!@db.uzzgswzicyrqgsnbfzop.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("✓ Conectado a Supabase PostgreSQL");

  // ── CREATE TABLES ──────────────────────────────────────────
  console.log("\n→ Creando tablas...");

  await client.query(`
    -- Categories
    CREATE TABLE IF NOT EXISTS categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL UNIQUE,
      slug text NOT NULL UNIQUE,
      icon text,
      sort_order int DEFAULT 0,
      type text NOT NULL CHECK (type IN ('product', 'ingredient')),
      created_at timestamptz DEFAULT now()
    );

    -- Products
    CREATE TABLE IF NOT EXISTS products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ref text NOT NULL,
      name text NOT NULL,
      category_id uuid REFERENCES categories(id),
      price int NOT NULL DEFAULT 0,
      cost int DEFAULT 0,
      description text,
      image_url text,
      available_in_pos boolean DEFAULT true,
      active boolean DEFAULT true,
      sort_order int DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      company_id text
    );

    -- Ingredients
    CREATE TABLE IF NOT EXISTS ingredients (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ref text NOT NULL,
      name text NOT NULL,
      category_id uuid REFERENCES categories(id),
      unit text NOT NULL DEFAULT 'und',
      purchase_unit text,
      cost_per_unit int DEFAULT 0,
      stock_quantity decimal(12,3) DEFAULT 0,
      min_stock decimal(12,3) DEFAULT 0,
      active boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    -- Recipes (BOM)
    CREATE TABLE IF NOT EXISTS recipes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      ingredient_id uuid NOT NULL REFERENCES ingredients(id),
      quantity decimal(10,4) NOT NULL,
      unit text NOT NULL DEFAULT 'und',
      created_at timestamptz DEFAULT now(),
      company_id text
    );

    -- Suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      phone text,
      active boolean DEFAULT true,
      created_at timestamptz DEFAULT now()
    );

    -- Supplier prices
    CREATE TABLE IF NOT EXISTS supplier_prices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      supplier_id uuid NOT NULL REFERENCES suppliers(id),
      ingredient_id uuid NOT NULL REFERENCES ingredients(id),
      price int NOT NULL,
      presentation_qty decimal(10,3) DEFAULT 1,
      presentation_unit text DEFAULT 'und',
      lead_days int DEFAULT 1,
      created_at timestamptz DEFAULT now(),
      company_id text
    );

    -- Cash registers
    CREATE TABLE IF NOT EXISTS cash_registers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      opened_at timestamptz NOT NULL DEFAULT now(),
      closed_at timestamptz,
      opened_by uuid,
      closed_by uuid,
      initial_cash int NOT NULL DEFAULT 0,
      final_cash_expected int,
      final_cash_actual int,
      notes text,
      status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      created_at timestamptz DEFAULT now()
    );

    -- Sales
    CREATE TABLE IF NOT EXISTS sales (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      register_id uuid REFERENCES cash_registers(id),
      sale_number serial,
      total int NOT NULL,
      payment_method text NOT NULL CHECK (payment_method IN ('efectivo', 'nequi')),
      status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided')),
      voided_reason text,
      sold_by uuid,
      created_at timestamptz DEFAULT now()
    );

    -- Sale items
    CREATE TABLE IF NOT EXISTS sale_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id uuid NOT NULL REFERENCES products(id),
      product_name text NOT NULL,
      quantity int NOT NULL DEFAULT 1,
      unit_price int NOT NULL,
      subtotal int NOT NULL,
      created_at timestamptz DEFAULT now()
    );

    -- Inventory movements
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ingredient_id uuid NOT NULL REFERENCES ingredients(id),
      type text NOT NULL CHECK (type IN ('purchase', 'sale_deduction', 'adjustment', 'waste')),
      quantity decimal(12,3) NOT NULL,
      reference_id uuid,
      notes text,
      created_by uuid,
      created_at timestamptz DEFAULT now()
    );
  `);
  console.log("✓ Tablas creadas");

  // ── INDEXES ────────────────────────────────────────────────
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id) WHERE active = true;
    CREATE INDEX IF NOT EXISTS idx_products_pos ON products(available_in_pos) WHERE active = true;
    CREATE INDEX IF NOT EXISTS idx_ingredients_stock ON ingredients(stock_quantity) WHERE active = true;
    CREATE INDEX IF NOT EXISTS idx_recipes_product ON recipes(product_id);
    CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_ingredient ON inventory_movements(ingredient_id);
  `);
  console.log("✓ Indices creados");

  // ── RLS ────────────────────────────────────────────────────
  const tables = ['categories', 'products', 'ingredients', 'recipes', 'suppliers',
    'supplier_prices', 'cash_registers', 'sales', 'sale_items', 'inventory_movements'];

  for (const t of tables) {
    await client.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DROP POLICY IF EXISTS "Allow all for anon" ON ${t};
      CREATE POLICY "Allow all for anon" ON ${t} FOR ALL USING (true) WITH CHECK (true);
    `);
  }
  console.log("✓ RLS configurado (acceso abierto)");

  await client.end();
  console.log("\n✅ Base de datos lista");
}

run().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
