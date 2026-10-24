import type { SQLiteDatabase } from 'expo-sqlite';

export type Recurrence = 'daily' | 'weekly' | 'monthly';

export type Schedule = {
  id: number;
  title: string;
  category: string;
  recurrence: Recurrence;
  repeat_value: string | null;
  target_time: string | null;
  is_priority: number;
  created_at: string;
};

export type ScheduleWithStatus = Schedule & {
  is_completed: number;
};

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getDayOfWeek(date = new Date()) {
  // 0 = Minggu, 1 = Senin, ... 6 = Sabtu
  return date.getDay();
}

export async function getSchedulesForToday(
  db: SQLiteDatabase,
  date = new Date()
): Promise<ScheduleWithStatus[]> {
  const today = getLocalDateString(date);
  const dayOfWeek = getDayOfWeek(date);
  const dayOfMonth = date.getDate();

  const schedules = await db.getAllAsync<Schedule>(
    `
    SELECT *
    FROM schedules
    WHERE
      recurrence = 'daily'
      OR (
        recurrence = 'weekly'
        AND CAST(repeat_value AS INTEGER) = ?
      )
      OR (
        recurrence = 'monthly'
        AND CAST(repeat_value AS INTEGER) = ?
      )
    ORDER BY
      CASE WHEN target_time IS NULL THEN 1 ELSE 0 END,
      target_time ASC,
      id ASC
    `,
    dayOfWeek,
    dayOfMonth
  );

  if (schedules.length === 0) {
    return [];
  }

  const ids = schedules.map((schedule) => schedule.id);

  const placeholders = ids.map(() => '?').join(', ');

  const logs = await db.getAllAsync<{
    schedule_id: number;
    is_completed: number;
  }>(
    `
    SELECT schedule_id, is_completed
    FROM schedule_logs
    WHERE completed_date = ?
      AND schedule_id IN (${placeholders})
    `,
    today,
    ...ids
  );

  const completedMap = new Map<number, number>();

  for (const log of logs) {
    completedMap.set(log.schedule_id, log.is_completed);
  }

  return schedules.map((schedule) => ({
    ...schedule,
    is_completed: completedMap.get(schedule.id) ?? 0,
  }));
}

export async function createSchedule(
  db: SQLiteDatabase,
  data: {
    title: string;
    category: string;
    recurrence: Recurrence;
    repeatValue?: string | null;
    targetTime?: string | null;
    isPriority?: boolean;
  }
) {
  const createdAt = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO schedules (
      title,
      category,
      recurrence,
      repeat_value,
      target_time,
      is_priority,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    data.title.trim(),
    data.category,
    data.recurrence,
    data.repeatValue ?? null,
    data.targetTime ?? null,
    data.isPriority ? 1 : 0,
    createdAt
  );
}

export async function setScheduleCompleted(
  db: SQLiteDatabase,
  scheduleId: number,
  completed: boolean,
  date = new Date()
) {
  const today = getLocalDateString(date);

  if (completed) {
    await db.runAsync(
      `
      INSERT INTO schedule_logs (
        schedule_id,
        completed_date,
        is_completed
      )
      VALUES (?, ?, 1)
      ON CONFLICT(schedule_id, completed_date)
      DO UPDATE SET is_completed = 1
      `,
      scheduleId,
      today
    );

    return;
  }

  await db.runAsync(
    `
    DELETE FROM schedule_logs
    WHERE schedule_id = ?
      AND completed_date = ?
    `,
    scheduleId,
    today
  );
}

export async function deleteSchedule(
  db: SQLiteDatabase,
  scheduleId: number
) {
  await db.runAsync(
    `
    DELETE FROM schedules
    WHERE id = ?
    `,
    scheduleId
  );
}