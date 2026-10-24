import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Tabel stok kompatibel dengan struktur lama dan baru.
 * Nama dan harga mempunyai kolom alias untuk kompatibilitas layanan.
 */
function groceriesTableSql(
  tableName = 'groceries_and_stock',
  ifNotExists = true
): string {
  const existence = ifNotExists ? 'IF NOT EXISTS ' : '';

  return `
    CREATE TABLE ${existence}${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      item_name TEXT,
      category TEXT,
      quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'pcs',
      minimum_quantity REAL NOT NULL DEFAULT 0,
      price_per_unit INTEGER NOT NULL DEFAULT 0,
      estimated_price INTEGER NOT NULL DEFAULT 0,
      stock_status TEXT NOT NULL DEFAULT 'ada',
      is_purchased INTEGER NOT NULL DEFAULT 0,
      expiry_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;
}

/**
 * Migrasi tabel stok lama ke struktur kompatibel.
 * Data lama disalin terlebih dahulu sebelum tabel diganti.
 */
async function migrateGroceriesAndStock(
  db: SQLiteDatabase
): Promise<void> {
  const columns = await db.getAllAsync<{
    name: string;
    notnull: number;
  }>('PRAGMA table_info(groceries_and_stock)');

  if (columns.length === 0) {
    await db.execAsync(groceriesTableSql());
  }

  const currentColumns = await db.getAllAsync<{
    name: string;
    notnull: number;
  }>('PRAGMA table_info(groceries_and_stock)');

  const columnNames = new Set(
    currentColumns.map((column) => column.name)
  );

  const requiredColumns = [
    'id',
    'name',
    'item_name',
    'category',
    'quantity',
    'unit',
    'minimum_quantity',
    'price_per_unit',
    'estimated_price',
    'stock_status',
    'is_purchased',
    'expiry_date',
    'notes',
    'created_at',
    'updated_at',
  ];

  const nameIsNotNull = currentColumns.some(
    (column) => column.name === 'name' && column.notnull === 1
  );

  const needsRebuild =
    nameIsNotNull ||
    !requiredColumns.every((column) => columnNames.has(column));

  if (needsRebuild) {
    const source = (
      column: string,
      fallback = 'NULL'
    ): string => {
      return columnNames.has(column)
        ? `"${column}"`
        : fallback;
    };

    const oldName = source('name');
    const oldItemName = source('item_name');
    const oldQuantity = source('quantity', '0');
    const oldEstimatedPrice = source('estimated_price');
    const oldPricePerUnit = source('price_per_unit', '0');

    const normalizedName = `
      COALESCE(
        NULLIF(${oldItemName}, ''),
        NULLIF(${oldName}, ''),
        'Barang'
      )
    `;

    const normalizedPrice = `
      COALESCE(
        NULLIF(${oldEstimatedPrice}, 0),
        ${oldPricePerUnit},
        0
      )
    `;

    const normalizedStatus = `
      COALESCE(
        NULLIF(${source('stock_status')}, ''),
        CASE
          WHEN COALESCE(${oldQuantity}, 0) > 0 THEN 'ada'
          ELSE 'habis'
        END
      )
    `;

    try {
      await db.execAsync('BEGIN IMMEDIATE;');

      await db.execAsync(`
        DROP TABLE IF EXISTS groceries_and_stock_migration;
      `);

      await db.execAsync(
        groceriesTableSql('groceries_and_stock_migration', false)
      );

      await db.execAsync(`
        INSERT INTO groceries_and_stock_migration (
          id,
          name,
          item_name,
          category,
          quantity,
          unit,
          minimum_quantity,
          price_per_unit,
          estimated_price,
          stock_status,
          is_purchased,
          expiry_date,
          notes,
          created_at,
          updated_at
        )
        SELECT
          ${source('id', 'NULL')},
          ${normalizedName},
          ${normalizedName},
          ${source('category')},
          COALESCE(${oldQuantity}, 0),
          COALESCE(${source('unit', "'pcs'")}, 'pcs'),
          COALESCE(${source('minimum_quantity', '0')}, 0),
          ${normalizedPrice},
          ${normalizedPrice},
          ${normalizedStatus},
          COALESCE(${source('is_purchased', '0')}, 0),
          ${source('expiry_date')},
          ${source('notes')},
          COALESCE(
            NULLIF(${source('created_at')}, ''),
            CURRENT_TIMESTAMP
          ),
          COALESCE(
            NULLIF(${source('updated_at')}, ''),
            CURRENT_TIMESTAMP
          )
        FROM groceries_and_stock;
      `);

      await db.execAsync(`
        DROP TABLE groceries_and_stock;

        ALTER TABLE groceries_and_stock_migration
        RENAME TO groceries_and_stock;

        COMMIT;
      `);
    } catch (error) {
      try {
        await db.execAsync('ROLLBACK;');
      } catch {
        // Abaikan jika transaksi sudah dibatalkan.
      }

      throw error;
    }
  }

  // Lengkapi alias nama dan harga pada data yang sudah ada.
  await db.execAsync(`
    UPDATE groceries_and_stock
    SET
      item_name = COALESCE(
        NULLIF(item_name, ''),
        NULLIF(name, ''),
        'Barang'
      ),
      name = COALESCE(
        NULLIF(item_name, ''),
        NULLIF(name, ''),
        'Barang'
      );

    UPDATE groceries_and_stock
    SET
      estimated_price = CASE
        WHEN estimated_price = 0 THEN price_per_unit
        ELSE estimated_price
      END,
      price_per_unit = CASE
        WHEN price_per_unit = 0 THEN estimated_price
        ELSE price_per_unit
      END;
  `);
}

async function setupGroceryTriggers(
  db: SQLiteDatabase
): Promise<void> {
  await db.execAsync(`
    DROP TRIGGER IF EXISTS trg_groceries_sync_name_insert;
    DROP TRIGGER IF EXISTS trg_groceries_sync_name_update;
    DROP TRIGGER IF EXISTS trg_groceries_sync_price_insert;
    DROP TRIGGER IF EXISTS trg_groceries_sync_price_update;

    CREATE TRIGGER trg_groceries_sync_name_insert
    AFTER INSERT ON groceries_and_stock
    WHEN NEW.item_name IS NOT NEW.name
    BEGIN
      UPDATE groceries_and_stock
      SET
        item_name = COALESCE(
          NULLIF(NEW.item_name, ''),
          NULLIF(NEW.name, ''),
          'Barang'
        ),
        name = COALESCE(
          NULLIF(NEW.item_name, ''),
          NULLIF(NEW.name, ''),
          'Barang'
        )
      WHERE id = NEW.id;
    END;

    CREATE TRIGGER trg_groceries_sync_name_update
    AFTER UPDATE OF name, item_name ON groceries_and_stock
    WHEN NEW.item_name IS NOT NEW.name
    BEGIN
      UPDATE groceries_and_stock
      SET
        item_name = CASE
          WHEN NEW.item_name IS NOT OLD.item_name
            THEN COALESCE(NULLIF(NEW.item_name, ''), 'Barang')
          WHEN NEW.name IS NOT OLD.name
            THEN COALESCE(NULLIF(NEW.name, ''), 'Barang')
          ELSE COALESCE(
            NULLIF(NEW.item_name, ''),
            NULLIF(NEW.name, ''),
            'Barang'
          )
        END,
        name = CASE
          WHEN NEW.item_name IS NOT OLD.item_name
            THEN COALESCE(NULLIF(NEW.item_name, ''), 'Barang')
          WHEN NEW.name IS NOT OLD.name
            THEN COALESCE(NULLIF(NEW.name, ''), 'Barang')
          ELSE COALESCE(
            NULLIF(NEW.item_name, ''),
            NULLIF(NEW.name, ''),
            'Barang'
          )
        END
      WHERE id = NEW.id;
    END;

    CREATE TRIGGER trg_groceries_sync_price_insert
    AFTER INSERT ON groceries_and_stock
    WHEN NEW.estimated_price IS NOT NEW.price_per_unit
    BEGIN
      UPDATE groceries_and_stock
      SET
        estimated_price = CASE
          WHEN NEW.estimated_price != 0
            THEN NEW.estimated_price
          ELSE NEW.price_per_unit
        END,
        price_per_unit = CASE
          WHEN NEW.estimated_price != 0
            THEN NEW.estimated_price
          ELSE NEW.price_per_unit
        END
      WHERE id = NEW.id;
    END;

    CREATE TRIGGER trg_groceries_sync_price_update
    AFTER UPDATE OF estimated_price, price_per_unit
    ON groceries_and_stock
    WHEN NEW.estimated_price IS NOT NEW.price_per_unit
    BEGIN
      UPDATE groceries_and_stock
      SET
        estimated_price = CASE
          WHEN NEW.estimated_price IS NOT OLD.estimated_price
            THEN COALESCE(NEW.estimated_price, 0)
          ELSE COALESCE(NEW.price_per_unit, 0)
        END,
        price_per_unit = CASE
          WHEN NEW.estimated_price IS NOT OLD.estimated_price
            THEN COALESCE(NEW.estimated_price, 0)
          ELSE COALESCE(NEW.price_per_unit, 0)
        END
      WHERE id = NEW.id;
    END;
  `);
}

export async function initializeDatabase(
  db: SQLiteDatabase
): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- =========================================
    -- USER PREFERENCES / PROFIL
    -- =========================================
    CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      call_name TEXT,
      occupation_status TEXT NOT NULL,
      income_type TEXT NOT NULL,
      monthly_budget INTEGER NOT NULL DEFAULT 0,
      payday_date INTEGER NOT NULL,
      food_preference TEXT NOT NULL,
      religion_mode TEXT NOT NULL,
      city_location TEXT,
      latitude REAL,
      longitude REAL,
      strict_mode_enabled INTEGER NOT NULL DEFAULT 0
    );

    -- =========================================
    -- KEUANGAN
    -- =========================================
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      type TEXT NOT NULL
        CHECK (type IN ('income', 'expense')),
      category TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK (amount > 0),
      date TEXT NOT NULL,
      is_fixed_cost INTEGER NOT NULL DEFAULT 0,
      note TEXT
    );

    -- =========================================
    -- JADWAL
    -- =========================================
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      recurrence TEXT NOT NULL
        CHECK (recurrence IN ('daily', 'weekly', 'monthly')),
      repeat_value TEXT,
      target_time TEXT,
      is_priority INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedule_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      schedule_id INTEGER NOT NULL,
      completed_date TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (schedule_id)
        REFERENCES schedules(id)
        ON DELETE CASCADE,
      UNIQUE(schedule_id, completed_date)
    );

    -- =========================================
    -- WORKOUT / OLAHRAGA
    -- =========================================
    CREATE TABLE IF NOT EXISTS workout_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      completed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      exercise_type TEXT,
      target_duration_minutes INTEGER NOT NULL DEFAULT 30,
      scheduled_date TEXT,
      is_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- =========================================
    -- HABIT / KEBIASAAN
    -- =========================================
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
      FOREIGN KEY (habit_id)
        REFERENCES habit_items(id)
        ON DELETE CASCADE,
      UNIQUE(habit_id, log_date)
    );

    -- =========================================
    -- PLACES / TEMPAT TERSIMPAN
    -- =========================================
    CREATE TABLE IF NOT EXISTS saved_places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      latitude REAL,
      longitude REAL,
      category TEXT,
      created_at TEXT NOT NULL
    );

    -- =========================================
    -- LOCATION / RIWAYAT LOKASI OPSIONAL
    -- =========================================
    CREATE TABLE IF NOT EXISTS location_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      label TEXT,
      recorded_at TEXT NOT NULL
    );

    -- =========================================
    -- PRAYER / JADWAL SALAT
    -- =========================================
    CREATE TABLE IF NOT EXISTS prayer_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'Indonesia',
      calculation_method INTEGER NOT NULL DEFAULT 20,
      notifications_enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prayer_times (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prayer_date TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'Indonesia',
      timezone TEXT,
      fajr TEXT,
      sunrise TEXT,
      dhuhr TEXT,
      asr TEXT,
      maghrib TEXT,
      isha TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(prayer_date, city, country)
    );

    -- =========================================
    -- NOTIFICATIONS / PENGINGAT
    -- =========================================
    CREATE TABLE IF NOT EXISTS notification_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      notification_id TEXT,
      reminder_type TEXT NOT NULL DEFAULT 'general',
      scheduled_at TEXT,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    -- =========================================
    -- GROCERIES / STOK BARANG
    -- Dibuat di bawah oleh fungsi migrasi.
    -- Mendukung item_name dan name.
    -- =========================================

    -- =========================================
    -- BACKUP / RIWAYAT BACKUP
    -- =========================================
    CREATE TABLE IF NOT EXISTS backup_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_uri TEXT,
      backup_format TEXT NOT NULL DEFAULT 'json',
      file_size_bytes INTEGER,
      created_at TEXT NOT NULL,
      notes TEXT
    );

    -- =========================================
    -- APP BLOCKER / FOCUS MODE
    -- =========================================
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'Sesi fokus',
      duration_minutes INTEGER NOT NULL DEFAULT 25,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'cancelled'))
    );

    CREATE TABLE IF NOT EXISTS blocked_apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_name TEXT NOT NULL UNIQUE,
      app_name TEXT NOT NULL,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    -- =========================================
    -- AI / RIWAYAT CHAT LOKAL
    -- =========================================
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'Percakapan baru',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL
        CHECK (role IN ('system', 'user', 'assistant')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id)
        REFERENCES ai_conversations(id)
        ON DELETE CASCADE
    );

    -- =========================================
    -- APP SETTINGS
    -- =========================================
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- =========================================
    -- INDEXES UMUM
    -- =========================================
    CREATE INDEX IF NOT EXISTS idx_transactions_date
      ON transactions(date);

    CREATE INDEX IF NOT EXISTS idx_transactions_type
      ON transactions(type);

    CREATE INDEX IF NOT EXISTS idx_schedules_category
      ON schedules(category);

    CREATE INDEX IF NOT EXISTS idx_schedule_logs_date
      ON schedule_logs(completed_date);

    CREATE INDEX IF NOT EXISTS idx_workout_logs_completed
      ON workout_logs(completed_at);

    CREATE INDEX IF NOT EXISTS idx_habit_logs_date
      ON habit_logs(log_date);

    CREATE INDEX IF NOT EXISTS idx_saved_places_category
      ON saved_places(category);

    CREATE INDEX IF NOT EXISTS idx_location_logs_recorded
      ON location_logs(recorded_at);

    CREATE INDEX IF NOT EXISTS idx_prayer_times_date
      ON prayer_times(prayer_date);

    CREATE INDEX IF NOT EXISTS idx_notification_reminders_enabled
      ON notification_reminders(is_enabled);

    CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
      ON ai_messages(conversation_id, created_at);
  `);

  // Migrasikan stok setelah tabel-tabel dasar selesai dibuat.
  await migrateGroceriesAndStock(db);

  // Buat ulang indeks dan trigger setelah migrasi tabel stok.
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_groceries_name
      ON groceries_and_stock(name);

    CREATE INDEX IF NOT EXISTS idx_groceries_item_name
      ON groceries_and_stock(item_name);

    CREATE INDEX IF NOT EXISTS idx_groceries_category
      ON groceries_and_stock(category);
  `);

  await setupGroceryTriggers(db);
}