import type { SQLiteDatabase } from 'expo-sqlite';

import {
  getLocalDatabase,
  initServiceTables,
  getSetting,
  setSetting,
} from './local-database.service';

export interface FocusSettings {
  enabled: boolean;
  durationMinutes: number;
  startedAt: string | null;
}

export interface FocusSessionStatus {
  active: boolean;
  remainingSeconds: number;
}

export interface SickModeSettings {
  enabled: boolean;
  reason: string;
  activatedAt: string | null;
}

const SETTINGS_KEY = 'app_blocker_focus';
const SICK_MODE_KEY = 'app_sick_mode';

const DEFAULT_SETTINGS: FocusSettings = {
  enabled: false,
  durationMinutes: 25,
  startedAt: null,
};

const DEFAULT_SICK_MODE: SickModeSettings = {
  enabled: false,
  reason: '',
  activatedAt: null,
};

/**
 * Jika database utama diberikan, gunakan database tersebut.
 * Jika tidak, gunakan database lokal service yang sudah ada.
 */
async function resolveDatabase(
  db?: SQLiteDatabase,
): Promise<SQLiteDatabase> {
  if (db) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    return db;
  }

  await initServiceTables();
  return getLocalDatabase();
}

async function readValue(
  key: string,
  db?: SQLiteDatabase,
): Promise<string | null> {
  if (!db) {
    return getSetting(key);
  }

  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    key,
  );

  return row?.value ?? null;
}

async function writeValue(
  key: string,
  value: string,
  db?: SQLiteDatabase,
): Promise<void> {
  if (!db) {
    await setSetting(key, value);
    return;
  }

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

function parseFocusSettings(value: string | null): FocusSettings {
  if (!value) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { ...DEFAULT_SETTINGS };
    }

    const data = parsed as Partial<FocusSettings>;

    return {
      enabled: data.enabled === true,
      durationMinutes:
        typeof data.durationMinutes === 'number' &&
        Number.isFinite(data.durationMinutes) &&
        data.durationMinutes >= 1
          ? Math.min(240, Math.floor(data.durationMinutes))
          : DEFAULT_SETTINGS.durationMinutes,
      startedAt:
        typeof data.startedAt === 'string'
          ? data.startedAt
          : null,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function readFocusSettings(
  db?: SQLiteDatabase,
): Promise<FocusSettings> {
  const value = await readValue(SETTINGS_KEY, db);
  return parseFocusSettings(value);
}

export async function getFocusSettings(
  db?: SQLiteDatabase,
): Promise<FocusSettings> {
  return readFocusSettings(db);
}

export async function startFocusSession(
  durationMinutes = 25,
  db?: SQLiteDatabase,
): Promise<FocusSettings> {
  if (
    !Number.isFinite(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 240
  ) {
    throw new Error(
      'Durasi fokus harus antara 1 sampai 240 menit.',
    );
  }

  const settings: FocusSettings = {
    enabled: true,
    durationMinutes: Math.floor(durationMinutes),
    startedAt: new Date().toISOString(),
  };

  await writeValue(
    SETTINGS_KEY,
    JSON.stringify(settings),
    db,
  );

  return settings;
}

export async function stopFocusSession(
  db?: SQLiteDatabase,
): Promise<FocusSettings> {
  const settings: FocusSettings = {
    enabled: false,
    durationMinutes: DEFAULT_SETTINGS.durationMinutes,
    startedAt: null,
  };

  await writeValue(
    SETTINGS_KEY,
    JSON.stringify(settings),
    db,
  );

  return settings;
}

export async function getFocusSessionStatus(
  db?: SQLiteDatabase,
): Promise<FocusSessionStatus> {
  const settings = await readFocusSettings(db);

  if (!settings.enabled || !settings.startedAt) {
    return {
      active: false,
      remainingSeconds: 0,
    };
  }

  const start = new Date(settings.startedAt).getTime();

  if (!Number.isFinite(start)) {
    await stopFocusSession(db);

    return {
      active: false,
      remainingSeconds: 0,
    };
  }

  const end =
    start + settings.durationMinutes * 60_000;

  const remainingSeconds = Math.max(
    0,
    Math.ceil((end - Date.now()) / 1000),
  );

  if (remainingSeconds === 0) {
    await stopFocusSession(db);

    return {
      active: false,
      remainingSeconds: 0,
    };
  }

  return {
    active: true,
    remainingSeconds,
  };
}

/**
 * Mode Sakit
 *
 * Menyimpan status dan alasan Mode Sakit ke app_settings.
 * Fungsi ini tidak memblokir aplikasi Android lain.
 */
export async function setSickMode(
  db: SQLiteDatabase,
  enabled: boolean,
  reason = 'Lainnya',
): Promise<SickModeSettings> {
  if (typeof enabled !== 'boolean') {
    throw new Error('Status Mode Sakit tidak valid.');
  }

  const settings: SickModeSettings = enabled
    ? {
        enabled: true,
        reason: reason.trim() || 'Lainnya',
        activatedAt: new Date().toISOString(),
      }
    : {
        ...DEFAULT_SICK_MODE,
      };

  await writeValue(
    SICK_MODE_KEY,
    JSON.stringify(settings),
    db,
  );

  return settings;
}

export async function getSickMode(
  db?: SQLiteDatabase,
): Promise<SickModeSettings> {
  const value = await readValue(SICK_MODE_KEY, db);

  if (!value) {
    return { ...DEFAULT_SICK_MODE };
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { ...DEFAULT_SICK_MODE };
    }

    const data = parsed as Partial<SickModeSettings>;

    return {
      enabled: data.enabled === true,
      reason:
        typeof data.reason === 'string'
          ? data.reason
          : '',
      activatedAt:
        typeof data.activatedAt === 'string'
          ? data.activatedAt
          : null,
    };
  } catch {
    return { ...DEFAULT_SICK_MODE };
  }
}
