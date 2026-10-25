import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { Driver } from "./db";

// Browser stand-in for the phone's SQLite, only used by the dev server
// (production builds never include it). The whole database is saved to
// localStorage after every change outside a transaction and every commit.

const KEY = "goontally-dev-db";

function load(): Uint8Array | undefined {
  const saved = localStorage.getItem(KEY);
  if (!saved) return undefined;
  return Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
}

export async function openDevDb(): Promise<Driver> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const database = new SQL.Database(load());
  let inTransaction = false;

  const save = () => {
    if (inTransaction) return;
    const bytes = database.export();
    // export() reopens the database, which resets connection settings.
    database.exec("PRAGMA foreign_keys = ON;");
    let text = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
      text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    localStorage.setItem(KEY, btoa(text));
  };

  type Params = initSqlJs.BindParams;

  return {
    all: async <T>(sql: string, params: unknown[] = []) => {
      const stmt = database.prepare(sql, params as Params);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      stmt.free();
      return rows;
    },
    run: async (sql, params = []) => {
      database.run(sql, params as Params);
      const changes = database.getRowsModified();
      const lastId = Number(
        database.exec("SELECT last_insert_rowid()")[0]?.values[0][0] ?? 0,
      );
      save();
      return { changes, lastId };
    },
    exec: async (sql) => {
      database.exec(sql);
      save();
    },
    begin: async () => {
      database.exec("BEGIN");
      inTransaction = true;
    },
    commit: async () => {
      database.exec("COMMIT");
      inTransaction = false;
      save();
    },
    rollback: async () => {
      database.exec("ROLLBACK");
      inTransaction = false;
    },
  };
}
