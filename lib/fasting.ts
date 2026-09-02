// 轻断食推荐引擎（纯函数，无副作用，供 API 与前端共用）

export type FastingGoal = 'fat_loss' | 'health' | 'blood_sugar' | 'maintain';
export type Sex = 'male' | 'female';
export type Experience = 'beginner' | 'intermediate' | 'advanced';

export const GOAL_LABELS: Record<FastingGoal, string> = {
  fat_loss: '减脂塑形',
  health: '健康管理',
  blood_sugar: '血糖管理',
  maintain: '维持体重',
};

export const GOAL_ICONS: Record<FastingGoal, string> = {
  fat_loss: '🔥',
  health: '🌿',
  blood_sugar: '🩸',
  maintain: '⚖️',
};

export const EXPERIENCE_LABELS: Record<Experience, string> = {
  beginner: '新手',
  intermediate: '进阶',
  advanced: '高阶',
};

// 可选的断食窗口（禁食小时数）
export const FASTING_OPTIONS = [12, 14, 16, 18, 20, 23] as const;

export function planLabel(hours: number): string {
  if (hours <= 0) return '—';
  if (hours >= 23) return '23:1 (每天一餐)';
  return `${hours}:${24 - hours}`;
}

export type ScreeningKeys = 'pregnancy' | 'breastfeeding' | 'hypoglycemia' | 'eating_disorder' | 'diabetes' | 'medication';

export const SCREENING_ITEMS: { key: ScreeningKeys; label: string; severe: boolean }[] = [
  { key: 'pregnancy', label: '孕期', severe: true },
  { key: 'breastfeeding', label: '哺乳期', severe: true },
  { key: 'eating_disorder', label: '进食障碍史', severe: true },
  { key: 'hypoglycemia', label: '低血糖 / 易头晕', severe: true },
  { key: 'diabetes', label: '糖尿病（含用药）', severe: true },
  { key: 'medication', label: '长期服药', severe: false },
];

export type FastingProfileInput = {
  sex?: Sex | null;
  birthDate?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  goal: FastingGoal;
  experience?: Experience | null;
  screening?: Partial<Record<ScreeningKeys, boolean>>;
};

export type Recommendation = {
  ready: boolean;            // 是否有足够数据给出推荐
  contraindicated: boolean;  // 是否属于禁忌人群
  planHours: number;
  level: Experience;
  reason: string;
  warnings: string[];
  bmi: number | null;
  age: number | null;
};

export function calcAge(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function calcBmi(weightKg?: number | null, heightCm?: number | null): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function recommendFastingPlan(p: FastingProfileInput): Recommendation {
  const age = calcAge(p.birthDate);
  const bmi = calcBmi(p.weightKg, p.heightCm);
  const scr = p.screening || {};
  const warnings: string[] = [];

  const hardStop = !!(scr.pregnancy || scr.breastfeeding || scr.eating_disorder || scr.hypoglycemia || scr.diabetes || scr.medication)
    || (age !== null && (age < 18 || age > 65));

  if (!p.heightCm || !p.weightKg) {
    return {
      ready: false, contraindicated: hardStop, planHours: 0,
      level: 'beginner', reason: '先填写身高和体重，小养才能算出适合你的窗口。', warnings, bmi, age,
    };
  }

  if (hardStop) {
    warnings.push('当前健康筛查结果不适合由应用自动推荐断食方案，请保持规律饮食并咨询专业医生或注册营养师。');
    return {
      ready: true, contraindicated: true, planHours: 0,
      level: 'beginner', reason: '当前情况不适合断食，建议保持三餐规律。', warnings, bmi, age,
    };
  }

  // 基础窗口由目标 + BMI 决定
  let hours = 16;
  const reasons: string[] = [];

  if (p.goal === 'blood_sugar') {
    hours = 12;
    reasons.push('控糖优先，从温和的 12:12 起步，平稳血糖曲线');
  } else if (p.goal === 'maintain') {
    hours = 14;
    reasons.push('维持体重 14:10 已足够，兼顾代谢与生活节奏');
  } else if (p.goal === 'health') {
    hours = 16;
    reasons.push('以规律作息和可持续执行为目标，采用常见的 16:8 窗口作为参考');
  } else {
    // fat_loss
    if (bmi !== null) {
      if (bmi >= 28) { hours = 14; reasons.push('BMI 偏高，先从 14:10 温和起步，避免过激反弹'); }
      else if (bmi >= 24) { hours = 16; reasons.push('BMI 偏高，采用相对温和的窗口并关注长期可持续性'); }
      else if (bmi >= 18.5) { hours = 16; reasons.push('体重处于常见范围，优先保证规律饮食与蛋白质摄入'); }
      else { reasons.push('体重偏低，不建议长时间禁食'); warnings.push('BMI 低于 18.5，减脂前请先保证营养摄入与体重稳定。'); hours = 12; }
    } else {
      reasons.push('以 16:8 作为通用减脂窗口');
    }
  }

  // 经验等级约束
  const exp: Experience = p.experience ?? 'beginner';
  const rangeByExp: Record<Experience, [number, number]> = {
    beginner: [12, 14],
    intermediate: [14, 18],
    advanced: [16, 23],
  };
  const [lo, hi] = rangeByExp[exp];
  hours = clamp(hours, lo, hi);

  // 女性激素提示
  if (p.sex === 'female' && hours >= 18) {
    warnings.push('长时间禁食可能影响部分女性的激素与经期节律，建议不超过 18 小时，经期前后适当缩短。');
  }

  const level: Experience = hours <= 14 ? 'beginner' : hours <= 18 ? 'intermediate' : 'advanced';

  return {
    ready: true, contraindicated: false, planHours: hours, level,
    reason: reasons.join('；'),
    warnings, bmi, age,
  };
}

// ===== 科学阶段时间线 =====
export type FastingStage = {
  key: string;
  fromH: number;
  toH: number;
  title: string;
  desc: string;
  accent: string; // 前端用于着色的关键词
};

export const FASTING_STAGES: FastingStage[] = [
  { key: 'fed', fromH: 0, toH: 4, title: '进食消化期', desc: '刚吃完，血糖上升，身体优先用葡萄糖供能。', accent: 'green' },
  { key: 'glycogen', fromH: 4, toH: 12, title: '糖原消耗期', desc: '肝糖原逐渐耗尽，血糖回落，身体开始切换燃料。', accent: 'blue' },
  { key: 'ketosis', fromH: 12, toH: 18, title: '燃脂生酮期', desc: '脂肪分解加速、生成酮体，进入较稳定的燃脂阶段。', accent: 'orange' },
  { key: 'autophagy', fromH: 18, toH: 24, title: '延长禁食期', desc: '人体反应因人而异，不以固定小时数承诺特定细胞效应。', accent: 'pink' },
  { key: 'deep', fromH: 24, toH: 999, title: '长时间禁食', desc: '风险与不确定性增加，不建议在缺少专业指导时尝试。', accent: 'red' },
];

export function currentStage(elapsedMinutes: number): { stage: FastingStage; progressInStage: number } {
  const h = elapsedMinutes / 60;
  for (const s of FASTING_STAGES) {
    if (h < s.toH) {
      const span = s.toH - s.fromH;
      const progressInStage = span > 0 ? clamp((h - s.fromH) / span, 0, 1) : 0;
      return { stage: s, progressInStage };
    }
  }
  const last = FASTING_STAGES[FASTING_STAGES.length - 1];
  return { stage: last, progressInStage: 1 };
}

// ===== 进食窗口 + 餐次规划（营养师标准：按窗口宽度推荐餐次，标准饭点锚定） =====
export type MealGuideMeal = {
  key: 'first' | 'second' | 'third';
  name: string;       // 早餐 / 午餐 / 晚餐（或正餐）
  time: string;       // HH:MM
  suggestion: string;
};

// 标准饭点：早 8:00 / 午 12:00 / 晚 18:00
const MEAL_ANCHORS: Record<MealGuideMeal['key'], number> = { first: 480, second: 720, third: 1080 };

export function buildMealGuide(planHours: number, windowEndHour: number): {
  windowStart: string;
  windowEnd: string;
  eatHours: number;
  mealCount: 1 | 2 | 3;
  meals: MealGuideMeal[];
  note: string;
} {
  const eatHours = 24 - planHours;
  // 以线性分钟表示窗口 [L, R]，长度恒为 eatHours（可跨午夜、可为负值）
  const R = windowEndHour * 60;
  const L = R - eatHours * 60;
  const fmt = (m: number) => {
    const mm = ((m % 1440) + 1440) % 1440;
    return `${Math.floor(mm / 60)}:${String(Math.round(mm % 60)).padStart(2, '0')}`;
  };
  const snap5 = (m: number) => Math.round(m / 5) * 5;

  // 把标准饭点锚定进窗口：饭点在窗内则取原时刻，否则贴靠最近的窗口边界
  const place = (anchor: number) => {
    for (const c of [anchor, anchor + 1440, anchor - 1440]) {
      if (c >= L && c <= R) return c;
    }
    return anchor > R ? R : L;
  };

  // 营养师标准：按进食窗口宽度推荐餐次
  let mealCount: 1 | 2 | 3;
  if (eatHours >= 9) mealCount = 3;
  else if (eatHours >= 5) mealCount = 2;
  else mealCount = 1;

  const POSITION_SUGGEST = {
    head: '开餐宜温和：优质蛋白 + 慢碳水 + 蔬菜，避免空腹高糖',
    mid: '维持血糖平稳：蛋白 + 蔬菜 + 适量主食',
    tail: '收尾餐控精制碳水，留足睡前消化时间',
  };

  const meals: MealGuideMeal[] = [];

  if (mealCount === 3) {
    let breakfast = place(MEAL_ANCHORS.first);
    let dinner = place(MEAL_ANCHORS.third);
    let lunchMin = 0;
    if (dinner - breakfast < 360) {
      // 窗口容纳不下带间隔的三餐（多出现在跨午夜等极端窗口），退化为均匀铺开
      breakfast = L;
      dinner = R;
      lunchMin = Math.round((L + R) / 2);
    } else {
      const lo = breakfast + 180; // 与首餐至少间隔 3 小时
      const hi = dinner - 180;   // 与尾餐至少间隔 3 小时
      const lunchAnchor = place(MEAL_ANCHORS.second);
      lunchMin = lunchAnchor >= lo && lunchAnchor <= hi ? lunchAnchor : clamp(lunchAnchor, lo, hi);
    }
    meals.push(
      { key: 'first', name: '早餐', time: fmt(snap5(breakfast)), suggestion: POSITION_SUGGEST.head },
      { key: 'second', name: '午餐', time: fmt(snap5(lunchMin)), suggestion: POSITION_SUGGEST.mid },
      { key: 'third', name: '晚餐', time: fmt(snap5(dinner)), suggestion: POSITION_SUGGEST.tail },
    );
  } else if (mealCount === 2) {
    let lunch = place(MEAL_ANCHORS.second);
    let dinner = place(MEAL_ANCHORS.third);
    if (dinner <= lunch) { lunch = L; dinner = R; }
    meals.push(
      { key: 'second', name: '午餐', time: fmt(snap5(lunch)), suggestion: POSITION_SUGGEST.head },
      { key: 'third', name: '晚餐', time: fmt(snap5(dinner)), suggestion: POSITION_SUGGEST.tail },
    );
  } else {
    const t = place(MEAL_ANCHORS.third);
    meals.push({ key: 'third', name: '正餐', time: fmt(snap5(t)), suggestion: POSITION_SUGGEST.tail });
  }

  let note = '';
  if (mealCount === 3) note = '窗口较宽，可安排三餐，已按早 / 午 / 晚标准饭点分布，更贴合日常作息。';
  else if (mealCount === 2) note = '窗口中等，两餐制更从容；一顿午餐一顿晚餐，蛋白与蔬菜要补足。';
  else note = '接近每天一餐（OMAD），务必提高营养密度，补足蛋白与微量元素。';

  return { windowStart: fmt(L), windowEnd: fmt(R), eatHours, mealCount, meals, note };
}

// ===== 灵活调整建议（基于近期打卡） =====
export type FastingLogRow = {
  date: string;
  fastHours: number;
  planHours: number | null;
  energy: number | null;
  hunger: number | null;
};

export type AdjustmentAdvice = {
  kind: 'upgrade' | 'keep' | 'downgrade' | 'rest' | 'none';
  title: string;
  content: string;
  nextHours?: number;
};

export function buildAdjustmentAdvice(planHours: number, recentLogs: FastingLogRow[]): AdjustmentAdvice {
  const completed = recentLogs.filter((l) => l.fastHours > 0 && (l.planHours === null || l.fastHours >= (l.planHours || 0) * 0.9));
  const withFeel = recentLogs.filter((l) => l.energy !== null || l.hunger !== null);

  if (completed.length === 0) {
    return { kind: 'none', title: '开始你的第一次断食', content: '连续打卡几天后，小养会根据你的完成度和身体感受，给出升级或调整建议。' };
  }

  const avgEnergy = withFeel.length ? withFeel.reduce((s, l) => s + (l.energy ?? 3), 0) / withFeel.length : 3;
  const avgHunger = withFeel.length ? withFeel.reduce((s, l) => s + (l.hunger ?? 3), 0) / withFeel.length : 3;

  // 升级：近3次都能轻松完成
  const last3 = recentLogs.slice(0, 3).filter((l) => l.fastHours >= (l.planHours || 24) * 0.9);
  if (last3.length >= 3 && avgEnergy >= 4 && avgHunger <= 2 && planHours < 20) {
    const next = Math.min(23, planHours + 2);
    return {
      kind: 'upgrade', title: '状态稳定，可以进阶了', nextHours: next,
      content: `你最近 ${last3.length} 次都轻松达标、精力充沛、饥饿感低，可以尝试把窗口从 ${planLabel(planHours)} 延长到 ${planLabel(next)}。`,
    };
  }

  // 降级：明显吃力
  if (avgHunger >= 4 || avgEnergy <= 2) {
    const next = Math.max(12, planHours - 2);
    return {
      kind: 'downgrade', title: '有点吃力，先缓一缓', nextHours: next,
      content: `近期饥饿感较强或精力偏低，建议退回 ${planLabel(next)} 适应，或安排一天休息。断食是长期习惯，不急于一时。`,
    };
  }

  return { kind: 'keep', title: '节奏不错，保持下去', content: `当前 ${planLabel(planHours)} 的节奏很适合你，继续保持，重点保证进食窗口内的营养。` };
}
