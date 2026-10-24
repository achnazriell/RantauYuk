
import {
  getLocalDatabase,
  initServiceTables,
} from './local-database.service';

export interface WorkoutLog {
  id: number;
  title: string;
  duration_minutes: number;
  notes: string | null;
  completed_at: string;
}

export interface CreateWorkoutInput {
  title: string;
  durationMinutes: number;
  notes?: string;
  completedAt?: string;
}

export async function addWorkout(
  input: CreateWorkoutInput,
): Promise<number> {
  const title = input.title.trim();
  const duration = Math.floor(input.durationMinutes);

  if (!title) throw new Error('Nama olahraga wajib diisi.');
  if (!Number.isFinite(duration) || duration < 0) {
    throw new Error('Durasi olahraga tidak valid.');
  }

  await initServiceTables();
  const db = await getLocalDatabase();

  const result = await db.runAsync(
    `INSERT INTO workout_logs
      (title, duration_minutes, notes, completed_at)
     VALUES (?, ?, ?, ?)`,
    title,
    duration,
    input.notes?.trim() || null,
    input.completedAt ?? new Date().toISOString(),
  );

  return result.lastInsertRowId;
}

export async function getWorkoutLogs(
  limit = 100,
): Promise<WorkoutLog[]> {
  await initServiceTables();
  const db = await getLocalDatabase();
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));

  return db.getAllAsync<WorkoutLog>(
    `SELECT id, title, duration_minutes, notes, completed_at
     FROM workout_logs
     ORDER BY completed_at DESC
     LIMIT ?`,
    safeLimit,
  );
}

export async function deleteWorkout(id: number): Promise<void> {
  await initServiceTables();
  const db = await getLocalDatabase();
  await db.runAsync('DELETE FROM workout_logs WHERE id = ?', id);
}

export async function getTotalWorkoutMinutes(): Promise<number> {
  await initServiceTables();
  const db = await getLocalDatabase();

  const row = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(duration_minutes) AS total FROM workout_logs',
  );

  return row?.total ?? 0;
}
