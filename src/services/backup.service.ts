import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  getLocalDatabase,
  initServiceTables,
} from './local-database.service';

const BACKUP_VERSION = 1;

interface BackupData {
  app: string;
  version: number;
  exportedAt: string;
  data: {
    workout_logs: Array<Record<string, unknown>>;
    habit_items: Array<Record<string, unknown>>;
    habit_logs: Array<Record<string, unknown>>;
    saved_places: Array<Record<string, unknown>>;
    app_settings: Array<Record<string, unknown>>;
  };
}

async function resolveDatabase(
  db?: SQLiteDatabase,
): Promise<SQLiteDatabase> {
  if (db) {
    return db;
  }

  await initServiceTables();
  return getLocalDatabase();
}

async function buildBackup(db: SQLiteDatabase): Promise<string> {
  const backup: BackupData = {
    app: 'Rantau Yuk',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      workout_logs: await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM workout_logs',
      ),
      habit_items: await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM habit_items',
      ),
      habit_logs: await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM habit_logs',
      ),
      saved_places: await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM saved_places',
      ),
      app_settings: await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM app_settings',
      ),
    },
  };

  return JSON.stringify(backup, null, 2);
}

export async function createBackup(
  db?: SQLiteDatabase,
): Promise<string> {
  const database = await resolveDatabase(db);
  return buildBackup(database);
}

export async function exportBackup(
  db?: SQLiteDatabase,
): Promise<string> {
  const content = await createBackup(db);
  const baseDir = FileSystem.documentDirectory;

  if (!baseDir) {
    throw new Error('Folder penyimpanan aplikasi tidak tersedia.');
  }

  const uri =
    `${baseDir}rantau-yuk-backup-${Date.now()}.json`;

  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();

  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'Ekspor backup Rantau Yuk',
      UTI: 'public.json',
    });
  }

  return uri;
}

export async function exportBackupFile(
  db?: SQLiteDatabase,
): Promise<string> {
  return exportBackup(db);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isOptionalNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

export async function importBackup(
  jsonString: string,
  suppliedDb?: SQLiteDatabase,
): Promise<void> {
  let backup: unknown;

  try {
    backup = JSON.parse(jsonString);
  } catch {
    throw new Error('File backup bukan JSON yang valid.');
  }

  if (
    !isRecord(backup) ||
    backup.app !== 'Rantau Yuk' ||
    backup.version !== BACKUP_VERSION ||
    !isRecord(backup.data)
  ) {
    throw new Error(
      'Format backup tidak dikenali atau versinya tidak didukung.',
    );
  }

  const data = backup.data;
  const tableNames = [
    'workout_logs',
    'habit_items',
    'habit_logs',
    'saved_places',
    'app_settings',
  ] as const;

  for (const table of tableNames) {
    if (
      !Array.isArray(data[table]) ||
      !(data[table] as unknown[]).every(isRecord)
    ) {
      throw new Error(`Data backup ${table} tidak valid.`);
    }
  }

  const db = await resolveDatabase(suppliedDb);

  await db.withTransactionAsync(async () => {
    // Pulihkan habit terlebih dahulu agar relasi habit_logs tetap valid.
    for (const row of data.habit_items as Record<string, unknown>[]) {
      if (
        typeof row.title !== 'string' ||
        typeof row.created_at !== 'string'
      ) {
        continue;
      }

      if (typeof row.id === 'number') {
        await db.runAsync(
          `INSERT INTO habit_items
            (id, title, description, active, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             description = excluded.description,
             active = excluded.active`,
          row.id,
          row.title,
          typeof row.description === 'string' ? row.description : null,
          row.active === 0 ? 0 : 1,
          row.created_at,
        );
      } else {
        await db.runAsync(
          `INSERT INTO habit_items
            (title, description, active, created_at)
           VALUES (?, ?, ?, ?)`,
          row.title,
          typeof row.description === 'string' ? row.description : null,
          row.active === 0 ? 0 : 1,
          row.created_at,
        );
      }
    }

    for (const row of data.workout_logs as Record<string, unknown>[]) {
      if (
        typeof row.title !== 'string' ||
        typeof row.duration_minutes !== 'number' ||
        typeof row.completed_at !== 'string'
      ) {
        continue;
      }

      if (typeof row.id === 'number') {
        await db.runAsync(
          `INSERT OR IGNORE INTO workout_logs
            (id, title, duration_minutes, notes, completed_at)
           VALUES (?, ?, ?, ?, ?)`,
          row.id,
          row.title,
          row.duration_minutes,
          typeof row.notes === 'string' ? row.notes : null,
          row.completed_at,
        );
      } else {
        await db.runAsync(
          `INSERT INTO workout_logs
            (title, duration_minutes, notes, completed_at)
           VALUES (?, ?, ?, ?)`,
          row.title,
          row.duration_minutes,
          typeof row.notes === 'string' ? row.notes : null,
          row.completed_at,
        );
      }
    }

    for (const row of data.habit_logs as Record<string, unknown>[]) {
      if (
        typeof row.habit_id !== 'number' ||
        typeof row.log_date !== 'string'
      ) {
        continue;
      }

      const habit = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM habit_items WHERE id = ?',
        row.habit_id,
      );

      if (!habit) {
        continue;
      }

      await db.runAsync(
        `INSERT INTO habit_logs (habit_id, log_date, completed)
         VALUES (?, ?, ?)
         ON CONFLICT(habit_id, log_date) DO UPDATE SET
           completed = excluded.completed`,
        row.habit_id,
        row.log_date,
        row.completed === 0 ? 0 : 1,
      );
    }

    for (const row of data.saved_places as Record<string, unknown>[]) {
      if (typeof row.name !== 'string') {
        continue;
      }

      const latitude = isOptionalNumber(row.latitude)
        ? row.latitude
        : null;
      const longitude = isOptionalNumber(row.longitude)
        ? row.longitude
        : null;

      const address =
        typeof row.address === 'string' ? row.address : null;
      const category =
        typeof row.category === 'string' ? row.category : null;
      const createdAt =
        typeof row.created_at === 'string'
          ? row.created_at
          : new Date().toISOString();

      if (typeof row.id === 'number') {
        await db.runAsync(
          `INSERT OR IGNORE INTO saved_places
            (id, name, address, latitude, longitude, category, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          row.id,
          row.name,
          address,
          latitude,
          longitude,
          category,
          createdAt,
        );
      } else {
        await db.runAsync(
          `INSERT INTO saved_places
            (name, address, latitude, longitude, category, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          row.name,
          address,
          latitude,
          longitude,
          category,
          createdAt,
        );
      }
    }

    for (const row of data.app_settings as Record<string, unknown>[]) {
      if (
        typeof row.key !== 'string' ||
        typeof row.value !== 'string'
      ) {
        continue;
      }

      await db.runAsync(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`,
        row.key,
        row.value,
        typeof row.updated_at === 'string'
          ? row.updated_at
          : new Date().toISOString(),
      );
    }
  });
}
