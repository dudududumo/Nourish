import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/db';
import { measurements, profiles } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

// 中文指标名 → measurements 表字段（每一项都可单独传入，缺失/留空则跳过）
const FIELD_MAP: Record<string, string> = {
  体重: 'weightKg',
  BMI: 'bmi',
  体脂率: 'bodyFatPct',
  脂肪量: 'fatMassKg',
  肌肉量: 'muscleMassKg',
  肌肉率: 'musclePct',
  骨骼肌: 'skeletalMuscleKg',
  去脂体重: 'fatFreeMassKg',
  体水分: 'bodyWaterPct',
  蛋白质率: 'proteinPct',
  骨量: 'boneMassKg',
  骨盐率: 'boneSaltPct',
  内脏脂肪: 'visceralFatLevel',
  基础代谢: 'bmrKcal',
  腰臀比: 'waistHipRatio',
  心率: 'heartRateBpm',
  身体得分: 'bodyScore',
  身体年龄: 'bodyAge',
};

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const db = getDb();
  const row = await db.select()
    .from(measurements)
    .where(eq(measurements.userId, user.id))
    .orderBy(desc(measurements.measuredAt))
    .limit(1)
    .get();

  if (!row) return Response.json({ metrics: null, measuredAt: null, source: null });

  const metrics: Record<string, string> = {};
  for (const [name, col] of Object.entries(FIELD_MAP)) {
    const v = (row as unknown as Record<string, unknown>)[col];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      metrics[name] = String(v);
    }
  }

  return Response.json({ metrics, measuredAt: row.measuredAt, source: row.source });
}

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const db = getDb();
  const body = await request.json().catch(() => ({})) as { metrics?: Record<string, string | number> };
  const raw = body.metrics && typeof body.metrics === 'object' ? body.metrics : {};

  const savedCols: string[] = [];
  const insertRow: Record<string, string | number> = {
    userId: user.id,
    measuredAt: new Date().toISOString(),
    source: 'manual',
  };

  for (const [name, col] of Object.entries(FIELD_MAP)) {
    const v = raw[name];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s === '') continue;
    const n = Number(s);
    if (!isFinite(n)) continue;
    insertRow[col] = n;
    savedCols.push(name);
  }

  if (savedCols.length === 0) {
    return Response.json({ error: '没有可保存的有效数据。' }, { status: 400 });
  }

  // 体重必填（measurements.weightKg 非空）：手动填写 > 最近一次测量 > 档案
  if (insertRow.weightKg == null) {
    const last = await db.select({ weightKg: measurements.weightKg })
      .from(measurements)
      .where(eq(measurements.userId, user.id))
      .orderBy(desc(measurements.measuredAt))
      .limit(1)
      .get();
    if (last?.weightKg != null) insertRow.weightKg = last.weightKg;
  }
  if (insertRow.weightKg == null) {
    const prof = await db.select({ weightKg: profiles.weightKg })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .get();
    if (prof?.weightKg != null) insertRow.weightKg = prof.weightKg;
  }
  if (insertRow.weightKg == null) {
    return Response.json({ error: '请先填写「体重」，其余指标可单独留空。' }, { status: 400 });
  }

  await db.insert(measurements).values(insertRow as typeof measurements.$inferInsert);

  return Response.json({
    ok: true,
    saved: savedCols,
    message: `已保存 ${savedCols.length} 项身体指标 ✨`,
  });
}