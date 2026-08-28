import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const profiles = sqliteTable('profiles', {
  userId: text('user_id').primaryKey(), biologicalSex: text('biological_sex'), birthDate: text('birth_date'), heightCm: real('height_cm'), goal: text('goal').notNull().default('healthy_recomposition'), healthScreeningJson: text('health_screening_json').notNull().default('{}'), updatedAt: text('updated_at').notNull(),
});

export const measurements = sqliteTable('measurements', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('user_id').notNull(), measuredAt: text('measured_at').notNull(), source: text('source').notNull().default('manual'), weightKg: real('weight_kg').notNull(), bmi: real('bmi'), bodyFatPct: real('body_fat_pct'), fatMassKg: real('fat_mass_kg'), muscleMassKg: real('muscle_mass_kg'), musclePct: real('muscle_pct'), skeletalMuscleKg: real('skeletal_muscle_kg'), fatFreeMassKg: real('fat_free_mass_kg'), bodyWaterPct: real('body_water_pct'), bodyWaterKg: real('body_water_kg'), proteinPct: real('protein_pct'), proteinKg: real('protein_kg'), boneMassKg: real('bone_mass_kg'), boneSaltPct: real('bone_salt_pct'), visceralFatLevel: real('visceral_fat_level'), bmrKcal: real('bmr_kcal'), waistHipRatio: real('waist_hip_ratio'), heartRateBpm: real('heart_rate_bpm'), bodyScore: real('body_score'), bodyAge: real('body_age'),
}, (table) => [index('idx_measurements_user_date').on(table.userId, table.measuredAt)]);

export const fridgeZones = sqliteTable('fridge_zones', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('user_id').notNull(), name: text('name').notNull(), zoneType: text('zone_type').notNull(), capacityLiters: real('capacity_liters').notNull(), sortOrder: integer('sort_order').notNull().default(0), updatedAt: text('updated_at').notNull(),
}, (table) => [uniqueIndex('idx_fridge_zones_user_name').on(table.userId, table.name)]);

export const inventory = sqliteTable('inventory', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('user_id').notNull(), zoneId: integer('zone_id').notNull(), name: text('name').notNull(), quantity: real('quantity').notNull(), unit: text('unit').notNull(), estimatedLiters: real('estimated_liters'), purchasedAt: text('purchased_at'), expiresAt: text('expires_at'), status: text('status').notNull().default('available'), updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_inventory_user_status_expiry').on(table.userId, table.status, table.expiresAt), index('idx_inventory_zone').on(table.zoneId)]);

export const plans = sqliteTable('plans', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('user_id').notNull(), startsOn: text('starts_on').notNull(), endsOn: text('ends_on').notNull(), planJson: text('plan_json').notNull(), rationaleJson: text('rationale_json').notNull(), status: text('status').notNull().default('active'), createdAt: text('created_at').notNull(),
}, (table) => [index('idx_plans_user_start').on(table.userId, table.startsOn)]);

export const coachMessages = sqliteTable('coach_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('user_id').notNull(), role: text('role').notNull(), content: text('content').notNull(), responseId: text('response_id'), createdAt: text('created_at').notNull(),
}, (table) => [index('idx_coach_messages_user_date').on(table.userId, table.createdAt)]);
