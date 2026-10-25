import { Capacitor } from "@capacitor/core";

// The app's SQLite database. On the phone it's a real SQLite file in the
// app's private storage (via @capacitor-community/sqlite); in the browser
// during `npm run dev -w mobile` it's sql.js kept in localStorage, so the
// screens can be worked on without a phone.
//
// Tables follow prisma/schema.prisma minus User: one person uses the phone.
// Times are ISO strings (they sort correctly as text), arrays are JSON.

export type Row = Record<string, unknown>;

export interface Tx {
  all<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = Row>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(
    sql: string,
    params?: unknown[],
  ): Promise<{ changes: number; lastId: number }>;
}

interface Driver extends Omit<Tx, "get"> {
  exec(sql: string): Promise<void>;
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

const DB_NAME = "goontally";

// Each entry upgrades the schema by one version; PRAGMA user_version says
// how many have run. Never edit a released step: add a new one.
const MIGRATIONS = [
  `
  CREATE TABLE persons (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL COLLATE NOCASE UNIQUE,
    photo     TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE groups (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL COLLATE NOCASE UNIQUE,
    photo     TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE memberships (
    personId INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    groupId  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    joinedAt TEXT NOT NULL,
    PRIMARY KEY (personId, groupId)
  );
  CREATE INDEX memberships_group ON memberships(groupId);
  CREATE TABLE entries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    loggedAt   TEXT NOT NULL,
    mediumTags TEXT NOT NULL DEFAULT '[]',
    notes      TEXT,
    createdAt  TEXT NOT NULL,
    updatedAt  TEXT NOT NULL
  );
  CREATE INDEX entries_logged ON entries(loggedAt);
  CREATE TABLE entryPersons (
    entryId  INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    personId INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    PRIMARY KEY (entryId, personId)
  );
  CREATE INDEX entryPersons_person ON entryPersons(personId);
  CREATE TABLE entryThoughts (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    entryId   INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    tag       TEXT NOT NULL,
    personIds TEXT NOT NULL DEFAULT '[]'
  );
  CREATE INDEX entryThoughts_entry ON entryThoughts(entryId);
  CREATE TABLE customOptions (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    category  TEXT NOT NULL,
    label     TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    UNIQUE (category, label)
  );
  `,
  // 2: app settings (automatic backup), as JSON values.
  `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // 3: options can be hidden, built-in ones included (see prisma/schema.prisma).
  `
  ALTER TABLE customOptions ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
  `,
];

let driver: Driver | null = null;
// Every call waits its turn, so a transaction never interleaves with
// another query (the native plugin has one connection).
let queue: Promise<unknown> = Promise.resolve();

function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work);
  queue = next.catch(() => {});
  return next;
}

const d = () => {
  if (!driver) throw new Error("The database isn't open yet");
  return driver;
};

const direct: Tx = {
  all: (sql, params) => d().all(sql, params),
  get: async (sql, params) => (await d().all(sql, params))[0] as never,
  run: (sql, params) => d().run(sql, params),
};

export const db = {
  all: <T = Row>(sql: string, params?: unknown[]) =>
    exclusive(() => direct.all<T>(sql, params)),
  get: <T = Row>(sql: string, params?: unknown[]) =>
    exclusive(() => direct.get<T>(sql, params)),
  run: (sql: string, params?: unknown[]) =>
    exclusive(() => direct.run(sql, params)),

  // Runs `work` in one transaction: all of it is saved, or none of it.
  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return exclusive(async () => {
      await d().begin();
      try {
        const result = await work(direct);
        await d().commit();
        return result;
      } catch (err) {
        await d().rollback();
        throw err;
      }
    });
  },
};

export async function openDb() {
  driver = Capacitor.isNativePlatform()
    ? await openNative()
    : import.meta.env.DEV
      ? await (await import("./devDb")).openDevDb()
      : null;
  if (!driver) throw new Error("No database on this platform");

  await driver.exec("PRAGMA foreign_keys = ON;");
  const [{ user_version: version }] = await driver.all<{
    user_version: number;
  }>("PRAGMA user_version");
  for (let v = version; v < MIGRATIONS.length; v++) {
    await driver.begin();
    try {
      await driver.exec(MIGRATIONS[v]);
      await driver.exec(`PRAGMA user_version = ${v + 1};`);
      await driver.commit();
    } catch (err) {
      await driver.rollback();
      throw err;
    }
  }
}

async function openNative(): Promise<Driver> {
  const { CapacitorSQLite, SQLiteConnection } =
    await import("@capacitor-community/sqlite");
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  // After a reload the native side may still hold the connection.
  const known = (await sqlite.isConnection(DB_NAME, false)).result;
  const conn = known
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
  if (!(await conn.isDBOpen()).result) await conn.open();

  // `false`: the plugin would otherwise wrap every statement in its own
  // transaction, which clashes with the ones started here.
  return {
    all: async <T>(sql: string, params: unknown[] = []) =>
      ((await conn.query(sql, params)).values ?? []) as T[],
    run: async (sql, params = []) => {
      const { changes } = await conn.run(sql, params, false);
      return { changes: changes?.changes ?? 0, lastId: changes?.lastId ?? 0 };
    },
    exec: async (sql) => void (await conn.execute(sql, false)),
    begin: async () => void (await conn.beginTransaction()),
    commit: async () => void (await conn.commitTransaction()),
    rollback: async () => void (await conn.rollbackTransaction()),
  };
}

export type { Driver };
