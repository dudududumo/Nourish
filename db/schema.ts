import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  phone: text('phone').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nickname: text('nickname'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [uniqueIndex('idx_users_phone').on(table.phone)]);

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_sessions_token').on(table.token), index('idx_sessions_user').on(table.userId)]);

export const profiles = sqliteTable('profiles', {
  userId: text('user_id').primaryKey(), biologicalSex: text('biological_sex'), birthDate: text('birth_date'), heightCm: real('height_cm'), weightKg: real('weight_kg'), goal: text('goal').notNull().default('healthy_recomposition'), healthScreeningJson: text('health_screening_json').notNull().default('{}'), updatedAt: text('updated_at').notNull(),
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

export const aiSettings = sqliteTable('ai_settings', {
  userId: text('user_id').primaryKey(),
  provider: text('provider').notNull(),
  endpoint: text('endpoint').notNull(),
  model: text('model').notNull(),
  encryptedApiKey: text('encrypted_api_key').notNull(),
  iv: text('iv').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/* ===== Weekly Meal Plan (structured) ===== */

export const weeklyPlans = sqliteTable('weekly_plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  weekStart: text('week_start').notNull(), // YYYY-MM-DD (Monday)
  weekEnd: text('week_end').notNull(),     // YYYY-MM-DD (Sunday)
  status: text('status').notNull().default('active'), // active | archived
  goal: text('goal'),
  targetCalories: real('target_calories'),
  targetProtein: real('target_protein'),
  rationale: text('rationale'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('idx_weekly_plans_user_week').on(table.userId, table.weekStart),
]);

export const dailyMeals = sqliteTable('daily_meals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  planId: integer('plan_id').notNull(),
  userId: text('user_id').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  dayOfWeek: integer('day_of_week').notNull(), // 0=Mon ... 6=Sun
  mealType: text('meal_type').notNull(), // breakfast | lunch | dinner | snack
  dishName: text('dish_name').notNull(),
  calories: real('calories').notNull().default(0),
  protein: real('protein').notNull().default(0),
  ingredientsJson: text('ingredients_json').notNull().default('[]'), // [{name, amount, fromFridge}]
  stepsJson: text('steps_json').notNull().default('[]'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_daily_meals_plan_date').on(table.planId, table.date),
  index('idx_daily_meals_user_date').on(table.userId, table.date),
]);

export const shoppingItems = sqliteTable('shopping_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  planId: integer('plan_id').notNull(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  amount: text('amount').notNull(),
  reason: text('reason'),
  purchased: integer('purchased').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_shopping_items_plan').on(table.planId),
]);

export const aiInsights = sqliteTable('ai_insights', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  type: text('type').notNull(), // observation | suggestion | warning
  category: text('category'), // body | nutrition | fridge | habit
  title: text('title').notNull(),
  content: text('content').notNull(),
  priority: integer('priority').notNull().default(0), // higher = more important
  relatedPlanId: integer('related_plan_id'),
  readAt: text('read_at'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_insights_user_created').on(table.userId, table.createdAt),
  index('idx_insights_user_unread').on(table.userId, table.readAt),
]);

/* ===== Intermittent Fasting ===== */

export const fastingSettings = sqliteTable('fasting_settings', {
  userId: text('user_id').primaryKey(),
  enabled: integer('enabled').notNull().default(0),
  planHours: integer('plan_hours').notNull().default(16),
  goal: text('goal').notNull().default('fat_loss'), // fat_loss | health | blood_sugar | maintain
  experience: text('experience').notNull().default('beginner'), // beginner | intermediate | advanced
  windowEndHour: integer('window_end_hour').notNull().default(20), // 进食窗口结束的小时(0-23)
  startAt: text('start_at'),
  updatedAt: text('updated_at').notNull(),
});

export const fastingLogs = sqliteTable('fasting_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  fastHours: real('fast_hours').notNull().default(0),
  planHours: integer('plan_hours'),
  energy: integer('energy'), // 精力 1-5
  hunger: integer('hunger'), // 饥饿 1-5
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_fasting_logs_user_date').on(table.userId, table.date),
]);
