
import * as SQLite from 'expo-sqlite';

let dbPromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;
let initPromise: Promise<void> | null = null;

export function getLocalDatabase() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('rantau-yuk.db');
  }
  return dbPromise;
}

export async function initServiceTables(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const db = await getLocalDatabase();

      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS workout_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          completed_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS habit_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS habit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          habit_id INTEGER NOT NULL,
          log_date TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 1,
          UNIQUE(habit_id, log_date)
        );

        CREATE TABLE IF NOT EXISTS saved_places (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          address TEXT,
          latitude REAL,
          longitude REAL,
          category TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}

export async function getSetting(
  key: string,
): Promise<string | null> {
  await initServiceTables();
  const db = await getLocalDatabase();

  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    key,
  );

  return row?.value ?? null;
}

export async function setSetting(
  key: string,
  value: string,
): Promise<void> {
  await initServiceTables();
  const db = await getLocalDatabase();

  await db.runAsync(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    key,
    value,
    new Date().toISOString(),
  );
}
