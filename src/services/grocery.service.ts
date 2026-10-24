
import type { SQLiteDatabase } from "expo-sqlite";
import { addTransaction } from "./finance.service";

export type Grocery = {
  id: number;
  item_name: string;
  estimated_price: number;
  stock_status: "ada" | "habis" | "perlu_dibeli";
  quantity: number;
  unit: string | null;
  is_purchased: number;
  updated_at: string;
};

/**
 * Mengambil seluruh stok makanan dari database.
 */
export async function getGroceries(
  db: SQLiteDatabase,
): Promise<Grocery[]> {
  return db.getAllAsync<Grocery>(
    `
    SELECT
      id,
      item_name,
      estimated_price,
      stock_status,
      quantity,
      unit,
      is_purchased,
      updated_at
    FROM groceries_and_stock
    ORDER BY
      CASE
        WHEN stock_status = 'perlu_dibeli' THEN 0
        WHEN stock_status = 'habis' THEN 1
        ELSE 2
      END,
      item_name ASC
    `,
  );
}

/**
 * Menambahkan bahan makanan baru.
 * Default status: perlu_dibeli.
 */
export async function addGrocery(
  db: SQLiteDatabase,
  input: {
    itemName: string;
    estimatedPrice: number;
    quantity: number;
    unit?: string;
  },
): Promise<void> {
  const itemName = input.itemName.trim();

  if (!itemName) {
    throw new Error("Nama bahan makanan wajib diisi.");
  }

  if (
    !Number.isFinite(input.estimatedPrice) ||
    input.estimatedPrice < 0
  ) {
    throw new Error("Estimasi harga tidak valid.");
  }

  if (
    !Number.isFinite(input.quantity) ||
    input.quantity <= 0
  ) {
    throw new Error("Jumlah bahan harus lebih besar dari nol.");
  }

  const estimatedPrice = Math.round(
    input.estimatedPrice,
  );

  const quantity = input.quantity;
  const unit = input.unit?.trim() || null;

  await db.runAsync(
    `
    INSERT INTO groceries_and_stock (
      item_name,
      estimated_price,
      stock_status,
      quantity,
      unit,
      is_purchased,
      updated_at
    )
    VALUES (?, ?, 'perlu_dibeli', ?, ?, 0, ?)
    `,
    itemName,
    estimatedPrice,
    quantity,
    unit,
    new Date().toISOString(),
  );
}

/**
 * Mengubah status stok: ada, habis, atau perlu_dibeli.
 */
export async function updateGroceryStatus(
  db: SQLiteDatabase,
  id: number,
  status: Grocery["stock_status"],
): Promise<void> {
  const isPurchased = status === "ada" ? 1 : 0;

  await db.runAsync(
    `
    UPDATE groceries_and_stock
    SET
      stock_status = ?,
      is_purchased = ?,
      updated_at = ?
    WHERE id = ?
    `,
    status,
    isPurchased,
    new Date().toISOString(),
    id,
  );
}

/**
 * Menandai bahan sebagai sudah dibeli.
 *
 * 1. Mengubah stok menjadi ada.
 * 2. Mengubah is_purchased menjadi 1.
 * 3. Mencatat pengeluaran jika harga lebih besar dari nol.
 *
 * Semua perubahan dilakukan dalam satu transaksi database.
 */
export async function markGroceryPurchased(
  db: SQLiteDatabase,
  grocery: Grocery,
): Promise<void> {
  if (grocery.is_purchased === 1) {
    return;
  }

  const totalPrice = Math.round(
    grocery.estimated_price * grocery.quantity,
  );

  if (!Number.isFinite(totalPrice) || totalPrice < 0) {
    throw new Error("Total harga belanja tidak valid.");
  }

  await db.withTransactionAsync(async () => {
    // Update bersyarat mencegah pencatatan ganda jika
    // item sudah dibeli oleh aksi lain.
    const result = await db.runAsync(
      `
      UPDATE groceries_and_stock
      SET
        stock_status = 'ada',
        is_purchased = 1,
        updated_at = ?
      WHERE
        id = ?
        AND is_purchased = 0
        AND stock_status = 'perlu_dibeli'
      `,
      new Date().toISOString(),
      grocery.id,
    );

    if (result.changes === 0) {
      return;
    }

    if (totalPrice > 0) {
      await addTransaction(db, {
        type: "expense",
        category: "belanja_bulanan",
        amount: totalPrice,
        isFixedCost: false,
        note: `Belanja: ${grocery.item_name}`,
      });
    }
  });
}

/**
 * Menghapus bahan makanan.
 */
export async function deleteGrocery(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  await db.runAsync(
    `
    DELETE FROM groceries_and_stock
    WHERE id = ?
    `,
    id,
  );
}

/**
 * Mengambil jumlah item berdasarkan status.
 */
export async function getGrocerySummary(
  db: SQLiteDatabase,
) {
  const result = await db.getFirstAsync<{
    total: number | null;
    ada: number | null;
    habis: number | null;
    perlu_dibeli: number | null;
  }>(
    `
    SELECT
      COUNT(*) AS total,

      COALESCE(
        SUM(CASE
          WHEN stock_status = 'ada' THEN 1
          ELSE 0
        END),
        0
      ) AS ada,

      COALESCE(
        SUM(CASE
          WHEN stock_status = 'habis' THEN 1
          ELSE 0
        END),
        0
      ) AS habis,

      COALESCE(
        SUM(CASE
          WHEN stock_status = 'perlu_dibeli' THEN 1
          ELSE 0
        END),
        0
      ) AS perlu_dibeli

    FROM groceries_and_stock
    `,
  );

  return {
    total: result?.total ?? 0,
    ada: result?.ada ?? 0,
    habis: result?.habis ?? 0,
    perlu_dibeli: result?.perlu_dibeli ?? 0,
  };
}

/**
 * Menghitung estimasi total belanja untuk semua item
 * berstatus perlu_dibeli.
 */
export async function getShoppingEstimate(
  db: SQLiteDatabase,
): Promise<number> {
  const result = await db.getFirstAsync<{
    total: number | null;
  }>(
    `
    SELECT
      COALESCE(
        SUM(estimated_price * quantity),
        0
      ) AS total
    FROM groceries_and_stock
    WHERE stock_status = 'perlu_dibeli'
    `,
  );

  return result?.total ?? 0;
}