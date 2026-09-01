import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/db';
import { fastingSettings, fastingLogs, profiles, measurements } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import {
  recommendFastingPlan, currentStage, buildMealGuide, buildAdjustmentAdvice,
  type FastingGoal, type Sex, type Experience, type FastingLogRow,
} from '@/lib/fasting';
import { todayStr, addDays } from '@/lib/utils';

function nowIso(): string {
  return new Date().toISOString();
}

type SettingsRow = {
  userId: string;
  enabled: number;
  planHours: number;
  goal: FastingGoal;
  experience: Experience;
  windowEndHour: number;
  startAt: string | null;
  updatedAt: string;
};

const GOALS: FastingGoal[] = ['fat_loss', 'health', 'blood_sugar', 'maintain'];
const EXPERIENCES: Experience[] = ['beginner', 'intermediate', 'advanced'];

async function getSettings(db: ReturnType<typeof getDb>, userId: string): Promise<SettingsRow> {
  const row = await db.select().from(fastingSettings).where(eq(fastingSettings.userId, userId)).get();
  if (row) {
    return {
      ...row,
      goal: (GOALS.includes(row.goal as FastingGoal) ? row.goal : 'fat_loss') as FastingGoal,
      experience: (EXPERIENCES.includes(row.experience as Experience) ? row.experience : 'beginner') as Experience,
    } as SettingsRow;
  }
  return { userId, enabled: 0, planHours: 16, goal: 'fat_loss', experience: 'beginner', windowEndHour: 20, startAt: null, updatedAt: '' };
}

async function calcStreak(db: ReturnType<typeof getDb>, userId: string): Promise<number> {
  const rows = await db.select({ date: fastingLogs.date })
    .from(fastingLogs)
    .where(eq(fastingLogs.userId, userId))
    .all();
  const days = new Set(rows.map((r) => r.date));
  const t = todayStr();
  let cursor = days.has(t) ? t : addDays(t, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

async function buildFullPayload(db: ReturnType<typeof getDb>, userId: string) {
  const settings = await getSettings(db, userId);
  const profile = await db.select().from(profiles).where(eq(profiles.userId, userId)).get();
  const screening = (() => { try { return JSON.parse(profile?.healthScreeningJson || '{}'); } catch { return {}; } })();

  // 身体数据优先取自「身体」页最新测量（measurements），兜底到 profile
  const latestMeasurement = await db.select()
    .from(measurements)
    .where(eq(measurements.userId, userId))
    .orderBy(desc(measurements.measuredAt))
    .limit(1)
    .get();
  const effWeightKg = (latestMeasurement?.weightKg as number | null | undefined) ?? (profile?.weightKg as number | null) ?? null;
  const bodySource: 'measurement' | 'profile' | null =
    latestMeasurement?.weightKg != null ? 'measurement' : profile?.weightKg != null ? 'profile' : null;

  const today = todayStr();
  const todayLog = await db.select()
    .from(fastingLogs)
    .where(and(eq(fastingLogs.userId, userId), eq(fastingLogs.date, today)))
    .orderBy(desc(fastingLogs.createdAt))
    .limit(1)
    .get();

  const recentLogs = await db.select()
    .from(fastingLogs)
    .where(eq(fastingLogs.userId, userId))
    .orderBy(desc(fastingLogs.date), desc(fastingLogs.createdAt))
    .limit(14)
    .all();

  const streak = await calcStreak(db, userId);

  // 计时状态
  const now = Date.now();
  const planHours = settings.planHours || 16;
  const targetMs = planHours * 3600 * 1000;
  let active = false;
  let elapsedMs = 0;
  let startAt: string | null = settings.startAt;
  if (settings.startAt) {
    const s = new Date(settings.startAt).getTime();
    if (!isNaN(s)) { elapsedMs = Math.max(0, now - s); active = true; }
    else startAt = null;
  }
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const remainingMinutes = Math.max(0, Math.ceil((targetMs - elapsedMs) / 60000));
  const progress = targetMs > 0 ? Math.min(1, elapsedMs / targetMs) : 0;
  const canComplete = active && elapsedMs >= targetMs;
  const stage = currentStage(elapsedMinutes);
  const mealGuide = buildMealGuide(planHours, settings.windowEndHour);

  const rec = recommendFastingPlan({
    sex: (profile?.biologicalSex as Sex | null) ?? null,
    birthDate: profile?.birthDate ?? null,
    heightCm: (profile?.heightCm as number | null) ?? null,
    weightKg: effWeightKg,
    goal: settings.goal,
    experience: settings.experience,
    screening,
  });

  const advice = buildAdjustmentAdvice(planHours, recentLogs as FastingLogRow[]);

  return {
    planHours,
    goal: settings.goal,
    experience: settings.experience,
    windowEndHour: settings.windowEndHour,
    active,
    startAt,
    elapsedMinutes,
    remainingMinutes,
    progress,
    canComplete,
    todayCompleted: !!todayLog,
    todayFastHours: todayLog?.fastHours ?? 0,
    todayFeel: { energy: todayLog?.energy ?? null, hunger: todayLog?.hunger ?? null },
    streak,
    stage: { key: stage.stage.key, title: stage.stage.title, desc: stage.stage.desc, accent: stage.stage.accent, progress: stage.progressInStage },
    mealGuide,
    profile: {
      hasProfile: !!profile,
      sex: profile?.biologicalSex ?? null,
      birthDate: profile?.birthDate ?? null,
      heightCm: profile?.heightCm ?? null,
      weightKg: effWeightKg,
      bodySource,
      latestBody: latestMeasurement
        ? { weightKg: latestMeasurement.weightKg, bodyFatPct: latestMeasurement.bodyFatPct, measuredAt: latestMeasurement.measuredAt }
        : null,
      screening,
    },
    recommendation: rec,
    advice,
    weekLogs: recentLogs.slice(0, 7).reverse().map((l) => ({
      date: l.date,
      fastHours: l.fastHours,
      planHours: l.planHours,
      energy: l.energy,
      hunger: l.hunger,
    })),
  };
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const db = getDb();
  return Response.json(await buildFullPayload(db, user.id));
}

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const db = getDb();
  const body = await request.json().catch(() => ({})) as Record<string, any>;
  const action = String(body.action ?? '');
  const settings = await getSettings(db, user.id);
  const today = todayStr();

  if (action === 'save-profile') {
    const sex = body.sex === 'male' || body.sex === 'female' ? body.sex : null;
    const birthDate = body.birthDate ? String(body.birthDate) : null;
    const heightCm = Number(body.heightCm);
    const weightKg = Number(body.weightKg);
    const goal = GOALS.includes(body.goal) ? body.goal : settings.goal;
    const experience = EXPERIENCES.includes(body.experience) ? body.experience : settings.experience;
    const screening: Record<string, boolean> = {};
    if (body.screening && typeof body.screening === 'object') {
      for (const k of Object.keys(body.screening)) screening[k] = !!body.screening[k];
    }

    // upsert profiles
    const profileValues = {
      biologicalSex: sex,
      birthDate,
      heightCm: isFinite(heightCm) && heightCm > 0 ? heightCm : null,
      weightKg: isFinite(weightKg) && weightKg > 0 ? weightKg : null,
      healthScreeningJson: JSON.stringify(screening),
      updatedAt: nowIso(),
    };
    await db.insert(profiles)
      .values({ userId: user.id, ...profileValues })
      .onConflictDoUpdate({ target: profiles.userId, set: profileValues });

    // update fasting settings (goal + experience)
    const setFields = { goal, experience, updatedAt: nowIso() };
    if (settings.updatedAt) {
      await db.update(fastingSettings).set(setFields).where(eq(fastingSettings.userId, user.id));
    } else {
      await db.insert(fastingSettings).values({
        userId: user.id, enabled: 0, planHours: 16, goal, experience, windowEndHour: 20, startAt: null, updatedAt: nowIso(),
      });
    }
    return Response.json(await buildFullPayload(db, user.id));
  }

  if (action === 'set-plan') {
    const planHours = Math.min(23, Math.max(12, Math.round(Number(body.planHours) || 16)));
    const goal = GOALS.includes(body.goal) ? body.goal : settings.goal;
    const windowEndHour = Math.min(23, Math.max(6, Math.round(Number(body.windowEndHour) || settings.windowEndHour)));
    const setFields = { planHours, goal, windowEndHour, updatedAt: nowIso() };
    if (settings.updatedAt) {
      await db.update(fastingSettings).set(setFields).where(eq(fastingSettings.userId, user.id));
    } else {
      await db.insert(fastingSettings).values({
        userId: user.id, enabled: 0, planHours, goal, experience: settings.experience, windowEndHour, startAt: null, updatedAt: nowIso(),
      });
    }
  } else if (action === 'start') {
    const startAt = nowIso();
    if (settings.updatedAt) {
      await db.update(fastingSettings).set({ enabled: 1, startAt, updatedAt: nowIso() }).where(eq(fastingSettings.userId, user.id));
    } else {
      await db.insert(fastingSettings).values({
        userId: user.id, enabled: 1, planHours: settings.planHours, goal: settings.goal, experience: settings.experience, windowEndHour: settings.windowEndHour, startAt, updatedAt: nowIso(),
      });
    }
  } else if (action === 'stop') {
    if (settings.updatedAt) {
      await db.update(fastingSettings).set({ startAt: null, enabled: 0, updatedAt: nowIso() }).where(eq(fastingSettings.userId, user.id));
    }
  } else if (action === 'complete') {
    if (settings.startAt) {
      const startMs = new Date(settings.startAt).getTime();
      const fastHours = isNaN(startMs) ? 0 : Math.max(0, (Date.now() - startMs) / 3600000);
      const energy = Math.min(5, Math.max(1, Math.round(Number(body.energy) || 3)));
      const hunger = Math.min(5, Math.max(1, Math.round(Number(body.hunger) || 3)));
      const already = await db.select().from(fastingLogs).where(and(eq(fastingLogs.userId, user.id), eq(fastingLogs.date, today))).limit(1).get();
      if (already) {
        await db.update(fastingLogs).set({ fastHours, planHours: settings.planHours, energy, hunger }).where(eq(fastingLogs.id, already.id));
      } else {
        await db.insert(fastingLogs).values({
          userId: user.id, date: today, fastHours, planHours: settings.planHours, energy, hunger, createdAt: nowIso(),
        });
      }
      await db.update(fastingSettings).set({ startAt: null, enabled: 0, updatedAt: nowIso() }).where(eq(fastingSettings.userId, user.id));
    }
  }

  return Response.json(await buildFullPayload(db, user.id));
}