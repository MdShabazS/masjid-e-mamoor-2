import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "jummah-attendance-v1.db";
const DATABASE_KEY_NAME = "jummah.attendance.sqlcipher.key.v1";

export type AttendanceSource = "online" | "offline";
export type LocalAttendanceStatus = "queued" | "applied" | "rejected";

export interface CachedJummahEvent {
  eventId: string;
  scheduledFor: string;
  checkinOpensAt: string;
  checkinClosesAt: string;
  isOpen: boolean;
  myAttendanceRecordedAt: string | null;
}

export interface QueuedJummahAttendance {
  operationId: string;
  ownerApplicationUserId: string;
  eventId: string;
  latitude: number;
  longitude: number;
  source: AttendanceSource;
  attemptCount: number;
}

export interface LocalJummahAttendance {
  operationId: string;
  eventId: string;
  status: LocalAttendanceStatus;
  errorCode: string | null;
  recordedAt: string | null;
  createdAt: string;
}

type LocalEventRow = {
  event_id: string;
  scheduled_for: string;
  checkin_opens_at: string;
  checkin_closes_at: string;
  is_open: number;
  my_attendance_recorded_at: string | null;
};

type LocalAttendanceRow = {
  operation_id: string;
  event_id: string;
  status: LocalAttendanceStatus;
  error_code: string | null;
  recorded_at: string | null;
  created_at: string;
};

type QueuedRow = QueuedJummahAttendance;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isValidSqlCipherKey(value: string) {
  return /^[0-9a-f]{64}$/.test(value);
}

async function openEncryptedDatabase() {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  let key = await SecureStore.getItemAsync(DATABASE_KEY_NAME);
  if (!key) {
    key = toHex(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(DATABASE_KEY_NAME, key);
  }
  if (!isValidSqlCipherKey(key)) {
    throw new Error("attendance_local_encryption_key_invalid");
  }

  await database.execAsync(
    `PRAGMA key = "x'${key}'"; PRAGMA cipher_memory_security = ON; PRAGMA foreign_keys = ON;`,
  );
  await database.getFirstAsync<{ count: number }>(
    "SELECT count(*) AS count FROM sqlite_master",
  );
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS attendance_event_cache (
      owner_application_user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      scheduled_for TEXT NOT NULL,
      checkin_opens_at TEXT NOT NULL,
      checkin_closes_at TEXT NOT NULL,
      is_open INTEGER NOT NULL,
      my_attendance_recorded_at TEXT,
      PRIMARY KEY (owner_application_user_id, event_id)
    );
    CREATE TABLE IF NOT EXISTS attendance_operation_queue (
      operation_id TEXT PRIMARY KEY NOT NULL,
      owner_application_user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      source TEXT NOT NULL CHECK (source IN ('online', 'offline')),
      status TEXT NOT NULL CHECK (status IN ('queued', 'applied', 'rejected')),
      attempt_count INTEGER NOT NULL DEFAULT 0,
      error_code TEXT,
      attendance_record_id TEXT,
      recorded_at TEXT,
      created_at TEXT NOT NULL,
      last_attempt_at TEXT
    );
    CREATE INDEX IF NOT EXISTS attendance_operation_owner_status_idx
      ON attendance_operation_queue(owner_application_user_id, status, created_at);
  `);
  return database;
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = openEncryptedDatabase().catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

function mapEvent(row: LocalEventRow): CachedJummahEvent {
  return {
    eventId: row.event_id,
    scheduledFor: row.scheduled_for,
    checkinOpensAt: row.checkin_opens_at,
    checkinClosesAt: row.checkin_closes_at,
    isOpen: row.is_open === 1,
    myAttendanceRecordedAt: row.my_attendance_recorded_at,
  };
}

export async function cacheJummahEvents(
  ownerApplicationUserId: string,
  events: CachedJummahEvent[],
) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const event of events) {
      await db.runAsync(
        `INSERT INTO attendance_event_cache (
          owner_application_user_id, event_id, scheduled_for,
          checkin_opens_at, checkin_closes_at, is_open,
          my_attendance_recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (owner_application_user_id, event_id) DO UPDATE SET
          scheduled_for = excluded.scheduled_for,
          checkin_opens_at = excluded.checkin_opens_at,
          checkin_closes_at = excluded.checkin_closes_at,
          is_open = excluded.is_open,
          my_attendance_recorded_at = excluded.my_attendance_recorded_at`,
        ownerApplicationUserId,
        event.eventId,
        event.scheduledFor,
        event.checkinOpensAt,
        event.checkinClosesAt,
        event.isOpen ? 1 : 0,
        event.myAttendanceRecordedAt,
      );
    }
  });
}

export async function getCachedJummahEvents(
  ownerApplicationUserId: string,
  before?: { scheduledFor: string; eventId: string },
) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LocalEventRow>(
    `SELECT event_id, scheduled_for, checkin_opens_at, checkin_closes_at,
      is_open, my_attendance_recorded_at
    FROM attendance_event_cache
    WHERE owner_application_user_id = ?
      AND (? IS NULL OR scheduled_for < ? OR (scheduled_for = ? AND event_id < ?))
    ORDER BY scheduled_for DESC, event_id DESC
    LIMIT 50`,
    ownerApplicationUserId,
    before?.scheduledFor ?? null,
    before?.scheduledFor ?? null,
    before?.scheduledFor ?? null,
    before?.eventId ?? null,
  );
  return rows.map(mapEvent);
}

export async function enqueueJummahAttendance(input: QueuedJummahAttendance) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO attendance_operation_queue (
      operation_id, owner_application_user_id, event_id, latitude, longitude,
      source, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)
    ON CONFLICT (operation_id) DO NOTHING`,
    input.operationId,
    input.ownerApplicationUserId,
    input.eventId,
    input.latitude,
    input.longitude,
    input.source,
    new Date().toISOString(),
  );
}

export async function getQueuedJummahAttendance(ownerApplicationUserId: string) {
  const db = await getDatabase();
  return db.getAllAsync<QueuedRow>(
    `SELECT operation_id AS operationId,
      owner_application_user_id AS ownerApplicationUserId,
      event_id AS eventId, latitude, longitude, source,
      attempt_count AS attemptCount
    FROM attendance_operation_queue
    WHERE owner_application_user_id = ? AND status = 'queued'
    ORDER BY created_at, operation_id
    LIMIT 100`,
    ownerApplicationUserId,
  );
}

export async function markJummahAttendanceAttempt(operationId: string) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE attendance_operation_queue
      SET attempt_count = attempt_count + 1, last_attempt_at = ?
      WHERE operation_id = ? AND status = 'queued'`,
    new Date().toISOString(),
    operationId,
  );
}

export async function markJummahAttendanceApplied(
  operationId: string,
  attendanceRecordId: string,
  recordedAt: string,
) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE attendance_operation_queue SET
      status = 'applied', latitude = NULL, longitude = NULL,
      error_code = NULL, attendance_record_id = ?, recorded_at = ?
      WHERE operation_id = ? AND status = 'queued'`,
    attendanceRecordId,
    recordedAt,
    operationId,
  );
}

export async function markJummahAttendanceRejected(
  operationId: string,
  errorCode: string,
) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE attendance_operation_queue SET
      status = 'rejected', latitude = NULL, longitude = NULL, error_code = ?
      WHERE operation_id = ? AND status = 'queued'`,
    errorCode,
    operationId,
  );
}

export async function listLocalJummahAttendance(ownerApplicationUserId: string) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LocalAttendanceRow>(
    `SELECT operation_id, event_id, status, error_code, recorded_at, created_at
      FROM attendance_operation_queue
      WHERE owner_application_user_id = ?
      ORDER BY created_at DESC
      LIMIT 100`,
    ownerApplicationUserId,
  );
  return rows.map((row) => ({
    operationId: row.operation_id,
    eventId: row.event_id,
    status: row.status,
    errorCode: row.error_code,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  } satisfies LocalJummahAttendance));
}
