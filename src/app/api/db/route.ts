/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import db from "@/lib/db/sqlite";

/* ── Types ────────────────────────────────────────────────── */

interface Filter {
  col: string;
  op: "eq" | "gte" | "lte" | "gt" | "in";
  val: any;
}

interface JoinFilter {
  joinTable: string;
  col: string;
  op: string;
  val: any;
}

interface JoinDef {
  alias: string;
  table: string;
  columns: string[];
  inner: boolean;
}

interface DbRequest {
  action: "select" | "insert" | "update" | "delete" | "upsert" | "rpc";
  table?: string;
  // select
  columns?: string;
  filters?: Filter[];
  joinFilters?: JoinFilter[];
  order?: { col: string; asc: boolean } | null;
  limit?: number | null;
  single?: boolean;
  maybeSingle?: boolean;
  // insert
  data?: any;
  selectCols?: string | null;
  returnSingle?: boolean;
  // upsert
  onConflict?: string | null;
  // rpc
  rpcName?: string;
  rpcParams?: any;
}

const VALID_TABLES = new Set([
  "users", "companies", "categories", "products", "ingredients",
  "recipes", "suppliers", "supplier_prices", "cash_registers",
  "sales", "sale_items", "inventory_movements",
  "orders", "order_items",
]);

function ok(data: any) { return { data, error: null }; }
function err(message: string, code?: string) { return { data: null, error: { message, code } }; }

/* ── JOIN parser ──────────────────────────────────────────── */

function parseSelectStr(selectStr: string): { columns: string[]; joins: JoinDef[] } {
  const joins: JoinDef[] = [];
  const columns: string[] = [];

  const parts: string[] = [];
  let depth = 0, current = "";
  for (const ch of selectStr) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(current.trim()); current = ""; }
    else current += ch;
  }
  if (current.trim()) parts.push(current.trim());

  for (const part of parts) {
    const joinMatch = part.match(/^(\w+):(\w+)\(([^)]+)\)$/) || part.match(/^(\w+)(!inner)\(([^)]+)\)$/);
    if (joinMatch) {
      const isInner = joinMatch[2] === "!inner";
      const alias = joinMatch[1];
      const table = isInner ? joinMatch[1] : joinMatch[2];
      const cols = joinMatch[3].split(",").map((c) => c.trim());
      joins.push({ alias, table, columns: cols, inner: isInner });
    } else {
      columns.push(part.trim());
    }
  }

  return { columns, joins };
}

function inferForeignKey(mainTable: string, joinedTable: string): string {
  const singular = joinedTable.replace(/ies$/, "y").replace(/s$/, "");
  return `${singular}_id`;
}

/* ── SQL helpers ──────────────────────────────────────────── */

/** SQLite can only bind numbers, strings, bigints, buffers, and null. Convert booleans to 0/1. */
function sqlVal(v: any): any {
  if (v === true) return 1;
  if (v === false) return 0;
  return v;
}

function buildWhereClause(filters: Filter[]): { sql: string; params: any[] } {
  if (filters.length === 0) return { sql: "", params: [] };

  const clauses: string[] = [];
  const params: any[] = [];

  for (const f of filters) {
    const col = f.col.replace(/[^a-zA-Z0-9_]/g, ""); // sanitize
    switch (f.op) {
      case "eq":
        clauses.push(`${col} = ?`);
        params.push(sqlVal(f.val));
        break;
      case "gte":
        clauses.push(`${col} >= ?`);
        params.push(sqlVal(f.val));
        break;
      case "lte":
        clauses.push(`${col} <= ?`);
        params.push(sqlVal(f.val));
        break;
      case "gt":
        clauses.push(`${col} > ?`);
        params.push(sqlVal(f.val));
        break;
      case "in":
        if (Array.isArray(f.val) && f.val.length > 0) {
          const placeholders = f.val.map(() => "?").join(", ");
          clauses.push(`${col} IN (${placeholders})`);
          params.push(...f.val.map(sqlVal));
        } else {
          clauses.push("0"); // empty IN = no matches
        }
        break;
    }
  }

  return { sql: " WHERE " + clauses.join(" AND "), params };
}

/** Convert SQLite integer booleans back to JS booleans for known boolean columns */
function convertBooleans(row: any, table: string): any {
  if (!row) return row;
  const boolCols: Record<string, string[]> = {
    products: ["available_in_pos", "active"],
    ingredients: ["active"],
    suppliers: ["active"],
  };
  const cols = boolCols[table];
  if (!cols) return row;
  const out = { ...row };
  for (const c of cols) {
    if (c in out) out[c] = !!out[c];
  }
  return out;
}

/* ── Handlers ─────────────────────────────────────────────── */

function handleSelect(req: DbRequest) {
  const table = req.table!;
  const { columns, joins } = parseSelectStr(req.columns ?? "*");
  const filters = req.filters ?? [];
  const joinFilters = req.joinFilters ?? [];

  // Handle !inner joins: pre-filter by joined table
  let innerJoinIds: Set<string> | null = null;
  let innerJoinData: Map<string, any> | null = null;
  let innerFk: string | null = null;

  for (const j of joins) {
    if (!j.inner) continue;

    // Build filters for the joined table
    const jFilters = joinFilters
      .filter((jf) => jf.joinTable === j.alias)
      .map((jf) => ({ col: jf.col, op: jf.op as Filter["op"], val: jf.val }));

    const { sql: jWhere, params: jParams } = buildWhereClause(jFilters);
    const jRows = db.prepare(`SELECT * FROM ${j.table}${jWhere}`).all(...jParams) as any[];

    innerFk = inferForeignKey(table, j.table);
    innerJoinIds = new Set(jRows.map((r) => r.id));
    innerJoinData = new Map(jRows.map((r) => [r.id, r]));
  }

  // Build main query — ensure FK columns needed for JOINs are included
  const selectCols = columns.includes("*") ? ["*"] : columns.map((c) => c.replace(/[^a-zA-Z0-9_]/g, ""));
  for (const j of joins) {
    const fk = inferForeignKey(table, j.table);
    if (!selectCols.includes("*") && !selectCols.includes(fk)) {
      selectCols.push(fk);
    }
  }
  const colsStr = selectCols.join(", ");

  // Add inner join FK filter
  const mainFilters = [...filters];
  if (innerJoinIds && innerFk) {
    const ids = [...innerJoinIds];
    if (ids.length === 0) {
      // No matching rows in joined table — return empty result
      return ok(req.single ? null : []);
    }
    mainFilters.push({ col: innerFk, op: "in", val: ids });
  }

  const { sql: where, params } = buildWhereClause(mainFilters);
  let sql = `SELECT ${colsStr} FROM ${table}${where}`;

  if (req.order) {
    const orderCol = req.order.col.replace(/[^a-zA-Z0-9_]/g, "");
    sql += ` ORDER BY ${orderCol} ${req.order.asc ? "ASC" : "DESC"}`;
  }

  if (req.limit != null) {
    sql += ` LIMIT ${Number(req.limit)}`;
  }

  let rows = db.prepare(sql).all(...params) as any[];

  // Convert booleans
  rows = rows.map((r) => convertBooleans(r, table));

  // Resolve left joins
  for (const j of joins) {
    if (j.inner) {
      // Attach inner join data
      if (innerJoinData && innerFk) {
        rows = rows.map((r) => {
          const joinRow = innerJoinData!.get(r[innerFk!]);
          const picked = joinRow ? Object.fromEntries(j.columns.map((c) => [c, joinRow[c]])) : null;
          return { ...r, [j.alias]: picked };
        });
      }
      continue;
    }

    const fk = inferForeignKey(table, j.table);
    const ids = [...new Set(rows.map((r) => r[fk]).filter(Boolean))];

    if (ids.length === 0) {
      rows = rows.map((r) => ({ ...r, [j.alias]: null }));
      continue;
    }

    const placeholders = ids.map(() => "?").join(", ");
    const joinRows = db.prepare(`SELECT * FROM ${j.table} WHERE id IN (${placeholders})`).all(...ids) as any[];
    const joinMap = new Map(joinRows.map((r) => [r.id, r]));

    rows = rows.map((r) => {
      const joined = r[fk] ? joinMap.get(r[fk]) : null;
      const picked = joined ? Object.fromEntries(j.columns.map((c) => [c, joined[c]])) : null;
      // Convert booleans in joined data too
      return { ...r, [j.alias]: picked ? convertBooleans(picked, j.table) : null };
    });
  }

  // single / maybeSingle
  if (req.single) {
    if (rows.length === 0) return err("Row not found", "PGRST116");
    return ok(rows[0]);
  }
  if (req.maybeSingle) {
    return ok(rows[0] ?? null);
  }

  return ok(rows);
}

function handleInsert(req: DbRequest) {
  const table = req.table!;
  const isArray = Array.isArray(req.data);
  const inputRows = isArray ? req.data : [req.data];

  const rows = inputRows.map((row: any) => {
    const out = { ...row };
    if (!out.id) out.id = randomUUID();
    // Auto-increment sale_number / order_number
    if (table === "sales" && out.sale_number == null) {
      const result = db.prepare("SELECT MAX(sale_number) as max_num FROM sales").get() as any;
      out.sale_number = (result?.max_num ?? 0) + 1;
    }
    if (table === "orders" && out.order_number == null) {
      const result = db.prepare("SELECT MAX(order_number) as max_num FROM orders").get() as any;
      out.order_number = (result?.max_num ?? 0) + 1;
    }
    return out;
  });

  // Check unique constraints
  if (table === "users") {
    for (const r of rows) {
      const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(r.username);
      if (existing) return err("duplicate key value violates unique constraint", "23505");
    }
  }

  // Build INSERT statement
  const insertMany = db.transaction((items: any[]) => {
    for (const item of items) {
      const cols = Object.keys(item);
      const placeholders = cols.map(() => "?").join(", ");
      const colNames = cols.join(", ");
      db.prepare(`INSERT OR IGNORE INTO ${table} (${colNames}) VALUES (${placeholders})`).run(...cols.map((c) => sqlVal(item[c])));
    }
  });

  insertMany(rows);

  // Return data if selectCols specified
  if (req.selectCols) {
    const resultRows = rows.map((r: any) => {
      const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(r.id) as any;
      return convertBooleans(row, table);
    });

    if (req.selectCols !== "*") {
      const wantedCols = req.selectCols.split(",").map((c: string) => c.trim());
      const picked = resultRows.map((r: any) =>
        Object.fromEntries(wantedCols.map((c: string) => [c, r?.[c]]))
      );
      return ok(req.returnSingle ? picked[0] : picked);
    }
    return ok(req.returnSingle ? resultRows[0] : resultRows);
  }

  return ok(req.returnSingle ? rows[0] : rows);
}

function handleUpdate(req: DbRequest) {
  const table = req.table!;
  const data = req.data;
  const filters = req.filters ?? [];
  const { sql: where, params: whereParams } = buildWhereClause(filters);

  const setCols = Object.keys(data);
  const setClause = setCols.map((c) => `${c} = ?`).join(", ");
  const setParams = setCols.map((c) => sqlVal(data[c]));

  db.prepare(`UPDATE ${table} SET ${setClause}${where}`).run(...setParams, ...whereParams);
  return ok(null);
}

function handleDelete(req: DbRequest) {
  const table = req.table!;
  const filters = req.filters ?? [];
  const { sql: where, params } = buildWhereClause(filters);

  db.prepare(`DELETE FROM ${table}${where}`).run(...params);
  return ok(null);
}

function handleUpsert(req: DbRequest) {
  const table = req.table!;
  const isArray = Array.isArray(req.data);
  const inputRows = isArray ? req.data : [req.data];
  const onConflict = req.onConflict;

  const upsertMany = db.transaction((items: any[]) => {
    for (const item of items) {
      const out = { ...item };
      if (!out.id) out.id = randomUUID();

      const cols = Object.keys(out);
      const colNames = cols.join(", ");
      const placeholders = cols.map(() => "?").join(", ");
      const updateSet = cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ");

      const conflictTarget = onConflict || "id";
      db.prepare(
        `INSERT INTO ${table} (${colNames}) VALUES (${placeholders}) ON CONFLICT(${conflictTarget}) DO UPDATE SET ${updateSet}`
      ).run(...cols.map((c) => sqlVal(out[c])));
    }
  });

  upsertMany(inputRows);
  return ok(null);
}

/* ── RPC handlers ─────────────────────────────────────────── */

function rpcDeductInventory(params: { p_sale_id: string }) {
  const saleItems = db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(params.p_sale_id) as any[];

  const deduct = db.transaction(() => {
    for (const item of saleItems) {
      const recipes = db.prepare("SELECT * FROM recipes WHERE product_id = ?").all(item.product_id) as any[];

      for (const recipe of recipes) {
        const ingredient = db.prepare("SELECT * FROM ingredients WHERE id = ?").get(recipe.ingredient_id) as any;
        if (!ingredient) continue;

        const deduction = recipe.quantity * item.quantity;
        const newStock = Math.max(0, ingredient.stock_quantity - deduction);

        db.prepare("UPDATE ingredients SET stock_quantity = ?, updated_at = ? WHERE id = ?")
          .run(newStock, new Date().toISOString(), recipe.ingredient_id);

        db.prepare(
          "INSERT INTO inventory_movements (id, ingredient_id, type, quantity, reference_id, created_at, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(
          randomUUID(), recipe.ingredient_id, "sale_deduction", -deduction,
          params.p_sale_id, new Date().toISOString(), ingredient.company_id
        );
      }
    }
  });

  deduct();
  return ok(null);
}

function rpcReverseInventory(params: { p_sale_id: string }) {
  const movements = db.prepare(
    "SELECT * FROM inventory_movements WHERE reference_id = ? AND type = 'sale_deduction'"
  ).all(params.p_sale_id) as any[];

  const reverse = db.transaction(() => {
    for (const movement of movements) {
      const ingredient = db.prepare("SELECT * FROM ingredients WHERE id = ?").get(movement.ingredient_id) as any;
      if (!ingredient) continue;

      const restored = ingredient.stock_quantity - movement.quantity; // quantity is negative
      db.prepare("UPDATE ingredients SET stock_quantity = ?, updated_at = ? WHERE id = ?")
        .run(restored, new Date().toISOString(), movement.ingredient_id);
    }

    // Delete the movements
    const ids = movements.map((m: any) => m.id);
    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(", ");
      db.prepare(`DELETE FROM inventory_movements WHERE id IN (${placeholders})`).run(...ids);
    }
  });

  reverse();
  return ok(null);
}

function rpcCompleteOrder(params: { p_order_id: string }) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(params.p_order_id) as any;
  if (!order) return err("Pedido no encontrado");
  if (order.status === "delivered") return err("Pedido ya fue entregado");

  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(params.p_order_id) as any[];

  const complete = db.transaction(() => {
    // Find open register
    const register = db.prepare("SELECT id FROM cash_registers WHERE company_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1")
      .get(order.company_id) as any;

    // Create sale
    const saleId = randomUUID();
    const maxNum = db.prepare("SELECT MAX(sale_number) as m FROM sales").get() as any;
    const saleNumber = (maxNum?.m ?? 0) + 1;

    db.prepare(
      "INSERT INTO sales (id, sale_number, register_id, total, payment_method, status, created_at, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(saleId, saleNumber, register?.id ?? null, order.total, order.payment_method, "completed", new Date().toISOString(), order.company_id);

    // Create sale items
    for (const item of items) {
      db.prepare(
        "INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, subtotal, created_at, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(randomUUID(), saleId, item.product_id, item.product_name, item.quantity, item.unit_price, item.subtotal, new Date().toISOString(), order.company_id);
    }

    // Deduct inventory
    const saleItems = db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(saleId) as any[];
    for (const si of saleItems) {
      const recipes = db.prepare("SELECT * FROM recipes WHERE product_id = ?").all(si.product_id) as any[];
      for (const recipe of recipes) {
        const ingredient = db.prepare("SELECT * FROM ingredients WHERE id = ?").get(recipe.ingredient_id) as any;
        if (!ingredient) continue;
        const deduction = recipe.quantity * si.quantity;
        db.prepare("UPDATE ingredients SET stock_quantity = ?, updated_at = ? WHERE id = ?")
          .run(Math.max(0, ingredient.stock_quantity - deduction), new Date().toISOString(), recipe.ingredient_id);
        db.prepare(
          "INSERT INTO inventory_movements (id, ingredient_id, type, quantity, reference_id, created_at, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(randomUUID(), recipe.ingredient_id, "sale_deduction", -deduction, saleId, new Date().toISOString(), ingredient.company_id);
      }
    }

    // Mark order as delivered
    db.prepare("UPDATE orders SET status = 'delivered' WHERE id = ?").run(params.p_order_id);

    return { saleId, saleNumber };
  });

  const result = complete();
  return ok(result);
}

function handleRpc(req: DbRequest) {
  switch (req.rpcName) {
    case "fn_deduct_inventory":
      return rpcDeductInventory(req.rpcParams);
    case "fn_reverse_inventory":
      return rpcReverseInventory(req.rpcParams);
    case "fn_complete_order":
      return rpcCompleteOrder(req.rpcParams);
    default:
      return err(`Unknown RPC: ${req.rpcName}`);
  }
}

/* ── Route handler ────────────────────────────────────────── */

export async function POST(request: Request) {
  try {
    const req: DbRequest = await request.json();

    // Validate table name
    if (req.table && !VALID_TABLES.has(req.table)) {
      return NextResponse.json(err(`Invalid table: ${req.table}`), { status: 400 });
    }

    let result;
    switch (req.action) {
      case "select":
        result = handleSelect(req);
        break;
      case "insert":
        result = handleInsert(req);
        break;
      case "update":
        result = handleUpdate(req);
        break;
      case "delete":
        result = handleDelete(req);
        break;
      case "upsert":
        result = handleUpsert(req);
        break;
      case "rpc":
        result = handleRpc(req);
        break;
      default:
        result = err(`Unknown action: ${req.action}`);
    }

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("[DB API Error]", e);
    return NextResponse.json(err(e.message), { status: 500 });
  }
}
