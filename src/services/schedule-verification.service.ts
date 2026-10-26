import type { SQLiteDatabase } from 'expo-sqlite';
import { setScheduleCompleted } from './schedule.service';

export type ScheduleVerificationType = 'camera_photo' | 'motion_detection' | 'manual';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export type ScheduleVerification = {
  id: number;
  schedule_id: number;
  verification_date: string;
  verification_type: ScheduleVerificationType;
  evidence_uri: string | null;
  verification_status: VerificationStatus;
  notes: string | null;
  created_at: string;
  verified_at: string | null;
};

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function ensureVerificationSchema(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schedule_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      verification_date TEXT NOT NULL,
      verification_type TEXT NOT NULL
        CHECK (verification_type IN ('camera_photo', 'motion_detection', 'manual')),
      evidence_uri TEXT,
      verification_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'verified', 'rejected')),
      notes TEXT,
      created_at TEXT NOT NULL,
      verified_at TEXT,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_schedule_verifications_lookup
      ON schedule_verifications(schedule_id, verification_date, verification_status);
  `);
}

/**
 * Mencatat bahwa pengguna mengirim foto langsung dari kamera.
 * Ini membuktikan foto diambil/dikirim, bukan validitas isi foto.
 */
export async function submitCameraEvidence(
  db: SQLiteDatabase,
  scheduleId: number,
  evidenceUri: string,
  notes?: string,
  date = new Date(),
) {
  if (!Number.isInteger(scheduleId) || scheduleId <= 0) {
    throw new Error('ID jadwal tidak valid.');
  }
  if (!evidenceUri || !evidenceUri.startsWith('file://')) {
    throw new Error('Bukti harus berasal dari foto kamera lokal.');
  }

  await ensureVerificationSchema(db);
  const day = localDateString(date);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO schedule_verifications
      (schedule_id, verification_date, verification_type, evidence_uri,
       verification_status, notes, created_at, verified_at)
     VALUES (?, ?, 'camera_photo', ?, 'verified', ?, ?, ?)`,
    scheduleId, day, evidenceUri, notes?.trim() || null, now, now,
  );

  // Hanya dipanggil setelah pengguna mengambil foto langsung dari kamera.
  await setScheduleCompleted(db, scheduleId, true, date);
}

export async function getVerificationForToday(
  db: SQLiteDatabase,
  scheduleId: number,
  date = new Date(),
): Promise<ScheduleVerification | null> {
  await ensureVerificationSchema(db);
  return (await db.getFirstAsync<ScheduleVerification>(
    `SELECT * FROM schedule_verifications
     WHERE schedule_id = ? AND verification_date = ?
     ORDER BY id DESC LIMIT 1`,
    scheduleId, localDateString(date),
  )) ?? null;
}

export async function listBlockedApps(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS blocked_apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_name TEXT NOT NULL UNIQUE,
      app_name TEXT NOT NULL,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
  `);
  return db.getAllAsync<{
    id: number; package_name: string; app_name: string;
    is_enabled: number; created_at: string;
  }>('SELECT * FROM blocked_apps ORDER BY app_name COLLATE NOCASE');
}

export async function addBlockedApp(
  db: SQLiteDatabase,
  packageName: string,
  appName: string,
) {
  const pkg = packageName.trim();
  const name = appName.trim();
  if (!/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)+$/.test(pkg)) {
    throw new Error('Package name tidak valid. Contoh: com.example.app');
  }
  if (!name) throw new Error('Nama aplikasi wajib diisi.');
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO blocked_apps (package_name, app_name, is_enabled, created_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(package_name) DO UPDATE SET app_name = excluded.app_name, is_enabled = 1`,
    pkg, name, now,
  );
}

export async function setBlockedAppEnabled(
  db: SQLiteDatabase,
  packageName: string,
  enabled: boolean,
) {
  await db.runAsync(
    'UPDATE blocked_apps SET is_enabled = ? WHERE package_name = ?',
    enabled ? 1 : 0, packageName,
  );
}

export async function removeBlockedApp(db: SQLiteDatabase, packageName: string) {
  await db.runAsync('DELETE FROM blocked_apps WHERE package_name = ?', packageName);
}
