import { createRequire } from 'node:module';
import * as schema from './schema';

const require = createRequire(import.meta.url);

// Try Cloudflare D1 first, fall back to local SQLite for dev
let dbInstance: any = null;
let dbInitialized = false;

export function getDb() {
  if (dbInstance) return dbInstance;

  // Try Cloudflare D1 (production / Sites platform)
  try {
    const { drizzle } = require('drizzle-orm/d1');
    // Access globalThis for Workers env
    const workerEnv = (globalThis as any).__env__ || (globalThis as any).env;
    if (workerEnv?.DB) {
      dbInstance = drizzle(workerEnv.DB, { schema });
      return dbInstance;
    }
  } catch {
    // D1 not available, fall through to local SQLite
  }

  // Fallback: local SQLite file
  const Database = require('better-sqlite3');
  const { drizzle } = require('drizzle-orm/better-sqlite3');
  const path = require('node:path');
  const fs = require('node:fs');

  const dbDir = path.join(process.cwd(), '.data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'nourish.db');
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  dbInstance = drizzle(sqlite, { schema });

  // Auto-initialize schema if needed
  if (!dbInitialized) {
    initSchema(sqlite);
    dbInitialized = true;
  }

  return dbInstance;
}

function initSchema(sqlite: any) {
  const tableExists = (name: string) => {
    const row = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
    return !!row;
  };

  // Users table
  if (!tableExists('users')) {
    sqlite.exec(`
      CREATE TABLE users (
        id text PRIMARY KEY NOT NULL,
        phone text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        nickname text,
        created_at text NOT NULL,
        updated_at text NOT NULL
      );
    `);
    sqlite.exec(`CREATE UNIQUE INDEX idx_users_phone ON users (phone);`);
  }

  // Sessions table
  if (!tableExists('sessions')) {
    sqlite.exec(`
      CREATE TABLE sessions (
        id text PRIMARY KEY NOT NULL,
        user_id text NOT NULL,
        token text NOT NULL UNIQUE,
        expires_at text NOT NULL,
        created_at text NOT NULL
      );
    `);
    sqlite.exec(`CREATE INDEX idx_sessions_token ON sessions (token);`);
    sqlite.exec(`CREATE INDEX idx_sessions_user ON sessions (user_id);`);
  }

  // Profiles table
  if (!tableExists('profiles')) {
    sqlite.exec(`
      CREATE TABLE profiles (
        user_id text PRIMARY KEY NOT NULL,
        biological_sex text,
        birth_date text,
        height_cm real,
        goal text DEFAULT 'healthy_recomposition' NOT NULL,
        health_screening_json text DEFAULT '{}' NOT NULL,
        updated_at text NOT NULL
      );
    `);
  }

  // Measurements table
  if (!tableExists('measurements')) {
    sqlite.exec(`
      CREATE TABLE measurements (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id text NOT NULL,
        measured_at text NOT NULL,
        source text DEFAULT 'manual' NOT NULL,
        weight_kg real NOT NULL,
        bmi real,
        body_fat_pct real,
        fat_mass_kg real,
        muscle_mass_kg real,
        muscle_pct real,
        skeletal_muscle_kg real,
        fat_free_mass_kg real,
        body_water_pct real,
        body_water_kg real,
        protein_pct real,
        protein_kg real,
        bone_mass_kg real,
        bone_salt_pct real,
        visceral_fat_level real,
        bmr_kcal real,
        waist_hip_ratio real,
        heart_rate_bpm real,
        body_score real,
        body_age real
      );
    `);
    sqlite.exec(`CREATE INDEX idx_measurements_user_date ON measurements (user_id, measured_at);`);
  }

  // Fridge zones
  if (!tableExists('fridge_zones')) {
    sqlite.exec(`
      CREATE TABLE fridge_zones (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id text NOT NULL,
        name text NOT NULL,
        zone_type text NOT NULL,
        capacity_liters real NOT NULL,
        sort_order integer DEFAULT 0 NOT NULL,
        updated_at text NOT NULL
      );
    `);
    sqlite.exec(`CREATE UNIQUE INDEX idx_fridge_zones_user_name ON fridge_zones (user_id, name);`);
  }

  // Inventory
  if (!tableExists('inventory')) {
    sqlite.exec(`
      CREATE TABLE inventory (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id text NOT NULL,
        zone_id integer NOT NULL,
        name text NOT NULL,
        quantity real NOT NULL,
        unit text NOT NULL,
        estimated_liters real,
        purchased_at text,
        expires_at text,
        status text DEFAULT 'available' NOT NULL,
        updated_at text NOT NULL
      );
    `);
    sqlite.exec(`CREATE INDEX idx_inventory_user_status_expiry ON inventory (user_id, status, expires_at);`);
    sqlite.exec(`CREATE INDEX idx_inventory_zone ON inventory (zone_id);`);
  }

  // Plans
  if (!tableExists('plans')) {
    sqlite.exec(`
      CREATE TABLE plans (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id text NOT NULL,
        starts_on text NOT NULL,
        ends_on text NOT NULL,
        plan_json text NOT NULL,
        rationale_json text NOT NULL,
        status text DEFAULT 'active' NOT NULL,
        created_at text NOT NULL
      );
    `);
    sqlite.exec(`CREATE INDEX idx_plans_user_start ON plans (user_id, starts_on);`);
  }

  // Coach messages
  if (!tableExists('coach_messages')) {
    sqlite.exec(`
      CREATE TABLE coach_messages (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id text NOT NULL,
        role text NOT NULL,
        content text NOT NULL,
        response_id text,
        created_at text NOT NULL
      );
    `);
    sqlite.exec(`CREATE INDEX idx_coach_messages_user_date ON coach_messages (user_id, created_at);`);
  }

  // AI settings
  if (!tableExists('ai_settings')) {
    sqlite.exec(`
      CREATE TABLE ai_settings (
        user_id text PRIMARY KEY NOT NULL,
        provider text NOT NULL,
        endpoint text NOT NULL,
        model text NOT NULL,
        encrypted_api_key text NOT NULL,
        iv text NOT NULL,
        updated_at text NOT NULL
      );
    `);
  }
}
