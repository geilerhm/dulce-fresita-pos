/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Query builder that serializes operations and POSTs to /api/db.
 * The API route executes them against SQLite on disk.
 *
 * Client-side API is identical to before:
 *   .from(table).select(cols).eq(col,val).order(col).limit(n).single()
 *   .from(table).insert(data).select(cols).single()
 *   .from(table).update(data).eq(col,val)
 *   .from(table).delete().eq(col,val)
 *   .from(table).upsert(data, {onConflict})
 */

type Row = Record<string, any>;
type Result<T = any> = { data: T; error: null } | { data: null; error: { message: string; code?: string } };

async function dbFetch(body: any): Promise<Result> {
  try {
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  } catch (e: any) {
    return { data: null, error: { message: e.message } };
  }
}

/* ── SelectBuilder ────────────────────────────────────────── */

class SelectBuilder implements PromiseLike<Result> {
  private _tableName: string;
  private _selectStr: string;
  private _filters: { col: string; op: string; val: any }[] = [];
  private _joinFilters: { joinTable: string; col: string; op: string; val: any }[] = [];
  private _orderCol: string | null = null;
  private _orderAsc = true;
  private _limitN: number | null = null;
  private _single = false;
  private _maybeSingle = false;

  constructor(tableName: string, selectStr: string) {
    this._tableName = tableName;
    this._selectStr = selectStr;
  }

  eq(col: string, val: any): this {
    if (col.includes(".")) {
      const [jt, jc] = col.split(".");
      this._joinFilters.push({ joinTable: jt, col: jc, op: "eq", val });
    } else {
      this._filters.push({ col, op: "eq", val });
    }
    return this;
  }

  gte(col: string, val: any): this {
    if (col.includes(".")) {
      const [jt, jc] = col.split(".");
      this._joinFilters.push({ joinTable: jt, col: jc, op: "gte", val });
    } else {
      this._filters.push({ col, op: "gte", val });
    }
    return this;
  }

  lte(col: string, val: any): this {
    if (col.includes(".")) {
      const [jt, jc] = col.split(".");
      this._joinFilters.push({ joinTable: jt, col: jc, op: "lte", val });
    } else {
      this._filters.push({ col, op: "lte", val });
    }
    return this;
  }

  gt(col: string, val: any): this {
    this._filters.push({ col, op: "gt", val });
    return this;
  }

  in(col: string, vals: any[]): this {
    this._filters.push({ col, op: "in", val: vals });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this._orderCol = col;
    this._orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(n: number): this {
    this._limitN = n;
    return this;
  }

  single(): PromiseLike<Result> {
    this._single = true;
    return this;
  }

  maybeSingle(): PromiseLike<Result> {
    this._maybeSingle = true;
    return this;
  }

  private execute(): Promise<Result> {
    return dbFetch({
      action: "select",
      table: this._tableName,
      columns: this._selectStr,
      filters: this._filters,
      joinFilters: this._joinFilters,
      order: this._orderCol ? { col: this._orderCol, asc: this._orderAsc } : null,
      limit: this._limitN,
      single: this._single,
      maybeSingle: this._maybeSingle,
    });
  }

  then<R1 = Result, R2 = never>(
    onFulfilled?: ((v: Result) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((e: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.execute().then(onFulfilled, onRejected);
  }
}

/* ── InsertBuilder ────────────────────────────────────────── */

class InsertBuilder implements PromiseLike<Result> {
  private _tableName: string;
  private _data: Row | Row[];
  private _selectCols: string | null = null;
  private _single = false;

  constructor(tableName: string, data: Row | Row[]) {
    this._tableName = tableName;
    this._data = data;
  }

  select(cols?: string): this {
    this._selectCols = cols ?? "*";
    return this;
  }

  single(): PromiseLike<Result> {
    this._single = true;
    return this;
  }

  private execute(): Promise<Result> {
    return dbFetch({
      action: "insert",
      table: this._tableName,
      data: this._data,
      selectCols: this._selectCols,
      returnSingle: this._single,
    });
  }

  then<R1 = Result, R2 = never>(
    onFulfilled?: ((v: Result) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((e: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.execute().then(onFulfilled, onRejected);
  }
}

/* ── UpdateBuilder ────────────────────────────────────────── */

class UpdateBuilder implements PromiseLike<Result> {
  private _tableName: string;
  private _data: Row;
  private _filters: { col: string; op: string; val: any }[] = [];

  constructor(tableName: string, data: Row) {
    this._tableName = tableName;
    this._data = data;
  }

  eq(col: string, val: any): this {
    this._filters.push({ col, op: "eq", val });
    return this;
  }

  in(col: string, vals: any[]): this {
    this._filters.push({ col, op: "in", val: vals });
    return this;
  }

  private execute(): Promise<Result> {
    return dbFetch({
      action: "update",
      table: this._tableName,
      data: this._data,
      filters: this._filters,
    });
  }

  then<R1 = Result, R2 = never>(
    onFulfilled?: ((v: Result) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((e: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.execute().then(onFulfilled, onRejected);
  }
}

/* ── DeleteBuilder ────────────────────────────────────────── */

class DeleteBuilder implements PromiseLike<Result> {
  private _tableName: string;
  private _filters: { col: string; op: string; val: any }[] = [];

  constructor(tableName: string) {
    this._tableName = tableName;
  }

  eq(col: string, val: any): this {
    this._filters.push({ col, op: "eq", val });
    return this;
  }

  in(col: string, vals: any[]): this {
    this._filters.push({ col, op: "in", val: vals });
    return this;
  }

  private execute(): Promise<Result> {
    return dbFetch({
      action: "delete",
      table: this._tableName,
      filters: this._filters,
    });
  }

  then<R1 = Result, R2 = never>(
    onFulfilled?: ((v: Result) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((e: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.execute().then(onFulfilled, onRejected);
  }
}

/* ── UpsertBuilder ────────────────────────────────────────── */

class UpsertBuilder implements PromiseLike<Result> {
  private _tableName: string;
  private _data: Row | Row[];
  private _onConflict: string | null;

  constructor(tableName: string, data: Row | Row[], opts?: { onConflict?: string }) {
    this._tableName = tableName;
    this._data = data;
    this._onConflict = opts?.onConflict ?? null;
  }

  private execute(): Promise<Result> {
    return dbFetch({
      action: "upsert",
      table: this._tableName,
      data: this._data,
      onConflict: this._onConflict,
    });
  }

  then<R1 = Result, R2 = never>(
    onFulfilled?: ((v: Result) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((e: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.execute().then(onFulfilled, onRejected);
  }
}

/* ── FromBuilder ──────────────────────────────────────────── */

export class FromBuilder {
  private _tableName: string;

  constructor(tableName: string) {
    this._tableName = tableName;
  }

  select(cols?: string): SelectBuilder {
    return new SelectBuilder(this._tableName, cols ?? "*");
  }

  insert(data: Row | Row[]): InsertBuilder {
    return new InsertBuilder(this._tableName, data);
  }

  update(data: Row): UpdateBuilder {
    return new UpdateBuilder(this._tableName, data);
  }

  delete(): DeleteBuilder {
    return new DeleteBuilder(this._tableName);
  }

  upsert(data: Row | Row[], opts?: { onConflict?: string }): UpsertBuilder {
    return new UpsertBuilder(this._tableName, data, opts);
  }
}
