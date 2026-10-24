import * as SQLite from 'expo-sqlite';

export const DATABASE_NAME = 'rantau_yuk.db';

export async function getDatabase() {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  return db;
}