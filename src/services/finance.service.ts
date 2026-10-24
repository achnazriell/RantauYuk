
import type { SQLiteDatabase } from "expo-sqlite";

export type TransactionType = "income" | "expense";

export type Transaction = {
  id: number;
  type: TransactionType;
  category: string;
  amount: number;
  date: string;
  is_fixed_cost: number;
  note: string | null;
};

export type NewTransaction = {
  type: TransactionType;
  category: string;
  amount: number;
  isFixedCost?: boolean;
  note?: string;
  date?: string;
};

export type FinanceSummary = {
  income: number;
  expense: number;
  balance: number;
  safeDailyLimit: number;
  remainingDays: number;
  budgetUsagePercent: number;
  isOldDateMode: boolean;
};

/**
 * Mengambil tanggal lokal perangkat dalam format YYYY-MM-DD.
 * Tidak bergantung pada konversi UTC dari toISOString().
 */
export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Menghitung jumlah hari pada bulan tertentu.
 * month menggunakan indeks JavaScript: 0 = Januari.
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Menghitung jumlah hari sampai tanggal cair berikutnya.
 * Jika hari ini adalah tanggal cair, anggap tersedia 1 hari
 * untuk anggaran hari ini.
 */
export function getRemainingDaysUntilPayday(
  paydayDate: number,
  now = new Date(),
): number {
  if (
    !Number.isInteger(paydayDate) ||
    paydayDate < 1 ||
    paydayDate > 31
  ) {
    throw new Error("Tanggal cair harus berupa angka 1 sampai 31.");
  }

  const currentDay = now.getDate();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const daysInCurrentMonth = getDaysInMonth(
    currentYear,
    currentMonth,
  );

  const targetDay = Math.min(
    paydayDate,
    daysInCurrentMonth,
  );

  if (currentDay < targetDay) {
    return targetDay - currentDay;
  }

  if (currentDay === targetDay) {
    return 1;
  }

  const daysRemainingThisMonth =
    daysInCurrentMonth - currentDay;

  const nextMonthDate = new Date(
    currentYear,
    currentMonth + 1,
    1,
  );

  const daysInNextMonth = getDaysInMonth(
    nextMonthDate.getFullYear(),
    nextMonthDate.getMonth(),
  );

  const nextTargetDay = Math.min(
    paydayDate,
    daysInNextMonth,
  );

  return daysRemainingThisMonth + nextTargetDay;
}

/**
 * Mengambil seluruh riwayat transaksi.
 */
export async function getTransactions(
  db: SQLiteDatabase,
): Promise<Transaction[]> {
  return db.getAllAsync<Transaction>(
    `
    SELECT
      id,
      type,
      category,
      amount,
      date,
      is_fixed_cost,
      note
    FROM transactions
    ORDER BY date DESC, id DESC
    `,
  );
}

/**
 * Menambahkan pemasukan atau pengeluaran.
 *
 * isFixedCost bersifat opsional.
 * date juga opsional dan default-nya tanggal lokal.
 */
export async function addTransaction(
  db: SQLiteDatabase,
  data: NewTransaction,
): Promise<void> {
  const amount = Math.round(data.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Nominal transaksi harus lebih besar dari nol.");
  }

  if (!data.category.trim()) {
    throw new Error("Kategori transaksi wajib diisi.");
  }

  if (
    data.type !== "income" &&
    data.type !== "expense"
  ) {
    throw new Error("Tipe transaksi tidak valid.");
  }

  const date = data.date ?? localDateString();

  await db.runAsync(
    `
    INSERT INTO transactions (
      type,
      category,
      amount,
      date,
      is_fixed_cost,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    data.type,
    data.category.trim(),
    amount,
    date,
    data.isFixedCost ? 1 : 0,
    data.note?.trim() || null,
  );
}

/**
 * Menghitung ringkasan keuangan.
 *
 * monthlyBudget opsional agar pemanggilan lama dengan dua
 * parameter tetap kompatibel.
 */
export async function getFinanceSummary(
  db: SQLiteDatabase,
  paydayDate: number,
  monthlyBudget = 0,
): Promise<FinanceSummary> {
  const incomeResult = await db.getFirstAsync<{
    total: number;
  }>(
    `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE type = 'income'
    `,
  );

  const expenseResult = await db.getFirstAsync<{
    total: number;
  }>(
    `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE type = 'expense'
    `,
  );

  const income = incomeResult?.total ?? 0;
  const expense = expenseResult?.total ?? 0;

  // Saldo bisa negatif agar kondisi kekurangan uang tidak tersembunyi.
  const balance = income - expense;

  const remainingDays =
    getRemainingDaysUntilPayday(paydayDate);

  const safeDailyLimit =
    balance > 0 && remainingDays > 0
      ? Math.floor(balance / remainingDays)
      : 0;

  const budgetUsagePercent =
    monthlyBudget > 0
      ? Math.round((expense / monthlyBudget) * 100)
      : 0;

  const isOldDateMode =
    monthlyBudget > 0 &&
    balance <= monthlyBudget * 0.2;

  return {
    income,
    expense,
    balance,
    safeDailyLimit,
    remainingDays,
    budgetUsagePercent,
    isOldDateMode,
  };
}

/**
 * Format nominal menjadi Rupiah.
 */
export function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}