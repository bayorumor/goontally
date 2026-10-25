import { db } from "./db";

// App settings (lock, automatic backup, updates, the disclaimer), each a
// JSON value under its own key in the settings table.

// The saved value over the defaults, so settings added later read as their
// default until changed.
export async function readSetting<T extends object>(
  key: string,
  defaults: T,
): Promise<T> {
  const row = await db.get<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [key],
  );
  return { ...defaults, ...(row ? JSON.parse(row.value) : {}) };
}

export async function writeSetting(key: string, value: unknown) {
  await db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, JSON.stringify(value)],
  );
}
