
import {
  getLocalDatabase,
  initServiceTables,
} from './local-database.service';

export interface Habit {
  id: number;
  title: string;
  description: string | null;
  active: number;
  created_at: string;
}

export interface HabitLog {
  id: number;
  habit_id: number;
  log_date: string;
  completed: number;
}

function dateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function addHabit(
  title: string,
  description = '',
): Promise<number> {
  if (!title.trim()) throw new Error('Nama kebiasaan wajib diisi.');

  await initServiceTables();
  const db = await getLocalDatabase();

  const result = await db.runAsync(
    `INSERT INTO habit_items (title, description, created_at)
     VALUES (?, ?, ?)`,
    title.trim(),
    description.trim() || null,
    new Date().toISOString(),
  );

  return result.lastInsertRowId;
}

export async function getHabits(
  includeInactive = false,
): Promise<Habit[]> {
  await initServiceTables();
  const db = await getLocalDatabase();

  return db.getAllAsync<Habit>(
    `SELECT id, title, description, active, created_at
     FROM habit_items
     ${includeInactive ? '' : 'WHERE active = 1'}
     ORDER BY id DESC`,
  );
}

export async function setHabitActive(
  id: number,
  active: boolean,
): Promise<void> {
  await initServiceTables();
  const db = await getLocalDatabase();

  await db.runAsync(
    'UPDATE habit_items SET active = ? WHERE id = ?',
    active ? 1 : 0,
    id,
  );
}

export async function deleteHabit(id: number): Promise<void> {
  await initServiceTables();
  const db = await getLocalDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM habit_logs WHERE habit_id = ?', id);
    await db.runAsync('DELETE FROM habit_items WHERE id = ?', id);
  });
}

export async function markHabitCompleted(
  habitId: number,
  date = new Date(),
  completed = true,
): Promise<void> {
  await initServiceTables();
  const db = await getLocalDatabase();

  await db.runAsync(
    `INSERT INTO habit_logs (habit_id, log_date, completed)
     VALUES (?, ?, ?)
     ON CONFLICT(habit_id, log_date) DO UPDATE SET
       completed = excluded.completed`,
    habitId,
    dateKey(date),
    completed ? 1 : 0,
  );
}

export async function getHabitLogs(
  date = new Date(),
): Promise<HabitLog[]> {
  await initServiceTables();
  const db = await getLocalDatabase();

  return db.getAllAsync<HabitLog>(
    `SELECT id, habit_id, log_date, completed
     FROM habit_logs
     WHERE log_date = ?
     ORDER BY habit_id`,
    dateKey(date),
  );
}

export async function getHabitStreak(
  habitId: number,
): Promise<number> {
  await initServiceTables();
  const db = await getLocalDatabase();

  const rows = await db.getAllAsync<{ log_date: string }>(
    `SELECT log_date FROM habit_logs
     WHERE habit_id = ? AND completed = 1
     ORDER BY log_date DESC`,
    habitId,
  );

  const completedDates = new Set(rows.map((row) => row.log_date));
  const cursor = new Date();
  let streak = 0;

  if (!completedDates.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (completedDates.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
