'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, BookOpen, Check, Info, Pause, Play, Settings, Sparkles, Target, Timer, Trophy } from 'lucide-react';
import { FASTING_STAGES, GOAL_LABELS, EXPERIENCE_LABELS, planLabel } from '@/lib/fasting';
import { todayStr } from '@/lib/utils';
import { Sheet } from './shared-components';
import type { FastingData } from './types';

const FASTING_CHOICES = [12, 14, 16, 18, 20, 23];
const WINDOW_END_CHOICES = [16, 17, 18, 19, 20, 21, 22];
const STAGE_ACCENT: Record<string, string> = {
  green: 'var(--system-green)',
  blue: 'var(--system-blue)',
  orange: 'var(--system-orange)',
  pink: 'var(--system-pink)',
  red: 'var(--system-red)',
};

function fmtHm(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  if (h <= 0) return `${m} 分钟`;
  return `${h} 小时 ${m} 分`;
}

function RingGauge({ progress, size = 232, children }: { progress: number; size?: number; children?: React.ReactNode }) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--system-gray5)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="url(#fastRingGrad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.4s var(--ease-natural)' }}
        />
        <defs>
          <linearGradient id="fastRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22C55E" />
            <stop offset="55%" stopColor="#4ADE80" />
            <stop offset="100%" stopColor="#16A34A" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">{children}</div>
    </div>
  );
}

function FeelPicker({ label, emoji, value, onChange }: { label: string; emoji: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-[var(--label)] mb-2">{emoji} {label}</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 py-2 rounded-xl text-[15px] font-medium press-effect ${value === n ? 'bg-[var(--system-orange)] text-white' : 'bg-[var(--system-gray5)] text-[var(--secondary-label)]'}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function FastingOnboarding({ profile, goal, experience, onSubmit }: {
  profile: FastingData['profile'];
  goal: FastingData['goal'];
  experience: FastingData['experience'];
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [sex, setSex] = useState<'male' | 'female' | ''>(profile.sex ?? '');
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? '');
  const [heightCm, setHeightCm] = useState(profile.heightCm ? String(profile.heightCm) : '');
  const [weightKg, setWeightKg] = useState(profile.weightKg ? String(profile.weightKg) : '');
  const [g, setG] = useState<FastingData['goal']>(goal);
  const [exp, setExp] = useState<FastingData['experience']>(experience);
  const [screen, setScreen] = useState<Record<string, boolean>>(profile.screening ?? {});

  const goals: [FastingData['goal'], string, string][] = [
    ['fat_loss', '减脂塑形', '🔥'],
    ['health', '健康管理', '🌿'],
    ['blood_sugar', '血糖管理', '🩸'],
    ['maintain', '维持体重', '⚖️'],
  ];
  const exps: [FastingData['experience'], string][] = [
    ['beginner', '新手（第一次尝试）'],
    ['intermediate', '有经验（偶尔断食）'],
    ['advanced', '老手（长期规律断食）'],
  ];
  const screens: [string, string, boolean][] = [
    ['pregnancy', '孕期', true],
    ['breastfeeding', '哺乳期', true],
    ['eating_disorder', '进食障碍史', true],
    ['hypoglycemia', '低血糖 / 易头晕', true],
    ['diabetes', '糖尿病（含用药）', true],
    ['medication', '长期服药', false],
  ];

  return (
    <div className="px-4 pb-6 space-y-5">
      <p className="text-[13px] text-[var(--secondary-label)] leading-[19px]">
        小养会根据你的身高、体重、目标和断食经验提供参考建议，并随身体变化灵活调整。账户数据会安全保存在云端。
      </p>

      <div>
        <p className="text-[13px] font-medium text-[var(--label)] mb-2">性别</p>
        <div className="flex gap-2">
          {(['male', 'female'] as const).map((s) => (
            <button key={s} onClick={() => setSex(s)}
              className={`flex-1 py-2.5 rounded-xl text-[14px] font-medium press-effect border ${sex === s ? 'border-[var(--system-green)] bg-[var(--system-green)]/10 text-[var(--system-green)]' : 'border-[var(--separator)] text-[var(--secondary-label)]'}`}>
              {s === 'male' ? '男' : '女'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[13px] font-medium text-[var(--label)] mb-2">出生日期</p>
        <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
          className="ios-input w-full" max={todayStr()} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[13px] font-medium text-[var(--label)] mb-2">身高（cm）</p>
          <input type="number" inputMode="decimal" value={heightCm} onChange={(e) => setHeightCm(e.target.value)}
            placeholder="165" className="ios-input w-full" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-[var(--label)] mb-2">体重（kg）</p>
          <input type="number" inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)}
            placeholder="53" className="ios-input w-full" />
          <p className="text-[11px] text-[var(--tertiary-label)] mt-1 leading-[15px]">优先从「身体」页最新测量自动同步，此处留空也可。</p>
        </div>
      </div>

      <div>
        <p className="text-[13px] font-medium text-[var(--label)] mb-2">你的目标</p>
        <div className="grid grid-cols-2 gap-2">
          {goals.map(([key, label, icon]) => (
            <button key={key} onClick={() => setG(key)}
              className={`flex items-center gap-2 py-2.5 px-3 rounded-xl text-[14px] font-medium press-effect border ${g === key ? 'border-[var(--system-green)] bg-[var(--system-green)]/10 text-[var(--system-green)]' : 'border-[var(--separator)] text-[var(--secondary-label)]'}`}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[13px] font-medium text-[var(--label)] mb-2">断食经验</p>
        <div className="space-y-2">
          {exps.map(([key, label]) => (
            <button key={key} onClick={() => setExp(key)}
              className={`w-full text-left py-2.5 px-3 rounded-xl text-[14px] font-medium press-effect border ${exp === key ? 'border-[var(--system-green)] bg-[var(--system-green)]/10 text-[var(--system-green)]' : 'border-[var(--separator)] text-[var(--secondary-label)]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[13px] font-medium text-[var(--label)] mb-1">健康筛查 <span className="text-[11px] text-[var(--tertiary-label)]">（存在以下情况将自动调整或禁用断食）</span></p>
        <div className="space-y-2 mt-2">
          {screens.map(([key, label]) => (
            <button key={key} onClick={() => setScreen((p) => ({ ...p, [key]: !p[key] }))}
              className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl text-[14px] press-effect border ${screen[key] ? 'border-[var(--system-red)] bg-[var(--system-red)]/8' : 'border-[var(--separator)]'}`}>
              <span className={screen[key] ? 'text-[var(--system-red)] font-medium' : 'text-[var(--secondary-label)]'}>{label}</span>
              <span className={`size-6 rounded-full flex items-center justify-center ${screen[key] ? 'bg-[var(--system-red)] text-white' : 'bg-[var(--system-gray5)] text-transparent'}`}>
                <Check className="size-4" />
              </span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onSubmit({
          sex: sex || null,
          birthDate: birthDate || null,
          heightCm: Number(heightCm),
          weightKg: Number(weightKg),
          goal: g,
          experience: exp,
          screening: screen,
        })}
        className="w-full ios-button bg-[var(--system-green)] text-white"
      >
        <Sparkles className="size-4" /> 保存并生成推荐
      </button>
    </div>
  );
}

export function FastingView({
  fasting, loading, onAction, onGoToday,
}: {
  fasting: FastingData | null;
  loading: boolean;
  onAction: (action: 'start' | 'complete' | 'stop' | 'set-plan' | 'save-profile', payload?: Record<string, unknown>) => void;
  onGoToday: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [profileOpen, setProfileOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [eduOpen, setEduOpen] = useState(false);
  const [energy, setEnergy] = useState(3);
  const [hunger, setHunger] = useState(3);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading && !fasting) {
    return (
      <div className="max-w-2xl mx-auto px-4 pb-6">
        <div className="pt-2 pb-4"><h1 className="text-large-title">轻断食</h1></div>
        <div className="rounded-2xl bg-[var(--secondary-grouped-background)] p-6 animate-pulse">
          <div className="h-52 rounded-2xl bg-[var(--system-gray5)]" />
          <div className="mt-4 h-4 w-40 rounded bg-[var(--system-gray5)]" />
          <div className="mt-2 h-4 w-64 rounded bg-[var(--system-gray5)]" />
        </div>
      </div>
    );
  }
  if (!fasting) return null;

  const startMs = fasting.startAt ? new Date(fasting.startAt).getTime() : 0;
  const elapsedMs = fasting.active ? Math.max(0, now - startMs) : 0;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const targetMs = fasting.planHours * 3600 * 1000;
  const remainingMinutes = Math.max(0, Math.ceil((targetMs - elapsedMs) / 60000));
  const progress = fasting.active ? Math.min(1, elapsedMs / targetMs) : (fasting.todayCompleted ? 1 : 0);
  const reachedGoal = fasting.active && elapsedMs >= targetMs;
  const stage = FASTING_STAGES[Math.max(0, FASTING_STAGES.findIndex((s) => elapsedMinutes / 60 < s.toH))];
  const accent = STAGE_ACCENT[stage.accent] || 'var(--system-orange)';

  const needProfile = !fasting.profile.hasProfile || fasting.profile.heightCm == null || fasting.profile.weightKg == null;

  return (
    <div className="max-w-2xl mx-auto px-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between pt-2 pb-4">
        <h1 className="text-large-title">轻断食</h1>
        <div className="flex gap-2">
          <button onClick={() => setEduOpen(true)} className="size-10 rounded-full bg-[var(--system-blue)]/10 text-[var(--system-blue)] flex items-center justify-center press-effect">
            <BookOpen className="size-5" />
          </button>
          <button onClick={() => setProfileOpen(true)} className="size-10 rounded-full bg-[var(--system-green)]/10 text-[var(--system-green)] flex items-center justify-center press-effect">
            <Settings className="size-5" />
          </button>
        </div>
      </div>

      {/* 禁忌/安全提示 */}
      {fasting.recommendation.contraindicated && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-[var(--system-red)]/8 border border-[var(--system-red)]/20 p-4">
          <AlertCircle className="size-5 text-[var(--system-red)] shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-[var(--system-red)]">当前情况不建议断食</p>
            <p className="text-[12px] text-[var(--secondary-label)] leading-[18px] mt-0.5">{fasting.recommendation.reason}</p>
          </div>
        </div>
      )}

      {/* 首次设置引导 */}
      {needProfile && !fasting.recommendation.contraindicated && (
        <button onClick={() => setProfileOpen(true)} className="mb-4 w-full flex items-center gap-3 rounded-2xl bg-gradient-to-br from-[#22C55E] via-[#4ADE80] to-[#16A34A] p-4 text-white press-effect text-left">
          <Target className="size-6 shrink-0" />
          <div className="flex-1">
            <p className="text-[15px] font-semibold">先完成个性化设置</p>
            <p className="text-[12px] text-white/80 leading-[17px] mt-0.5">补充身高与目标等基础信息，小养才能推荐适合你的断食窗口。</p>
          </div>
          <ArrowRight className="size-5 shrink-0" />
        </button>
      )}

      {/* 小养推荐方案 */}
      {fasting.recommendation.ready && !fasting.recommendation.contraindicated && !needProfile && (
        <div className="mb-4 rounded-2xl bg-[var(--secondary-grouped-background)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="size-4 text-[var(--system-green)] shrink-0" />
            <p className="text-[13px] font-semibold text-[var(--label)]">小养推荐 · {planLabel(fasting.recommendation.planHours)} 方案</p>
            <span className="ml-auto px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--system-green)]/10 text-[var(--system-green)]">
              {EXPERIENCE_LABELS[fasting.recommendation.level] || '新手'}
            </span>
          </div>
          <p className="text-[12px] text-[var(--secondary-label)] leading-[18px]">{fasting.recommendation.reason}</p>
          {fasting.recommendation.warnings.length > 0 && (
            <div className="mt-2 space-y-1">
              {fasting.recommendation.warnings.map((w, i) => (
                <p key={i} className="text-[11px] text-[var(--system-orange)] leading-[15px] flex gap-1">
                  <AlertCircle className="size-3.5 shrink-0 mt-0.5" />{w}
                </p>
              ))}
            </div>
          )}
          {fasting.planHours !== fasting.recommendation.planHours ? (
            <button
              onClick={() => onAction('set-plan', { planHours: fasting.recommendation.planHours, goal: fasting.goal, windowEndHour: fasting.windowEndHour })}
              className="mt-2 w-full ios-button bg-[var(--system-green)] text-white"
            >
              <Sparkles className="size-4" /> 采纳推荐方案
            </button>
          ) : (
            <p className="mt-2 text-center text-[12px] font-medium text-[var(--system-green)]">✓ 当前即为推荐方案</p>
          )}
        </div>
      )}

      {/* 计时环 */}
      <div className="mb-4 rounded-2xl bg-[var(--secondary-grouped-background)] p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[15px] font-semibold text-[var(--label)]">{planLabel(fasting.planHours)} 方案</p>
            <p className="text-[12px] text-[var(--secondary-label)] mt-0.5">
              {GOAL_LABELS[fasting.goal] || '减脂塑形'}{fasting.streak > 0 ? ` · 🔥 连续 ${fasting.streak} 天` : ''}
            </p>
          </div>
          {fasting.active && (
            <span className="px-2.5 py-1 rounded-full text-[12px] font-semibold" style={{ backgroundColor: 'color-mix(in srgb, var(--system-orange) 14%, transparent)', color: 'var(--system-orange)' }}>
              {reachedGoal ? '已达目标' : '进行中'}
            </span>
          )}
        </div>

        <RingGauge progress={progress}>
          {fasting.active ? (
            <>
              <p className="text-[11px] text-[var(--secondary-label)]">{reachedGoal ? '目标达成' : '已禁食'}</p>
              <p className="text-[30px] font-bold text-[var(--label)] mt-0.5 tracking-tight">{fmtHm(elapsedMinutes)}</p>
              <p className="text-[12px] mt-1" style={{ color: accent }}>{stage.title}</p>
              <p className="text-[11px] text-[var(--secondary-label)] mt-0.5">{reachedGoal ? '可以结束打卡啦' : `还差 ${fmtHm(remainingMinutes)} 达到 ${fasting.planHours} 小时`}</p>
            </>
          ) : fasting.todayCompleted ? (
            <>
              <Check className="size-6 text-[var(--system-green)]" />
              <p className="text-[28px] font-bold text-[var(--label)] mt-1 tracking-tight">{fmtHm(Math.round(fasting.todayFastHours * 60))}</p>
              <p className="text-[12px] text-[var(--secondary-label)] mt-0.5">今日已完成</p>
            </>
          ) : (
            <>
              <Timer className="size-6" style={{ color: accent }} />
              <p className="text-[26px] font-bold text-[var(--label)] mt-1 tracking-tight">禁食 {fasting.planHours}h</p>
              <p className="text-[12px] text-[var(--secondary-label)] mt-1">进食窗口 {fasting.mealGuide.windowStart}–{fasting.mealGuide.windowEnd}</p>
            </>
          )}
        </RingGauge>

        {fasting.active ? (
          <div className="mt-3 flex gap-2">
            <button onClick={() => setCompleteOpen(true)} className="ios-button flex-1 bg-[var(--system-orange)] text-white">
              <Check className="size-4" /> 结束打卡
            </button>
            <button onClick={() => onAction('stop')} className="ios-button flex-1 bg-[var(--system-gray5)] text-[var(--label)]">
              <Pause className="size-4" /> 放弃本次
            </button>
          </div>
        ) : (
          <>
            {fasting.todayCompleted && (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[var(--system-green)]/10 p-2.5">
                <Trophy className="size-4 text-[var(--system-green)]" />
                <p className="text-[13px] text-[var(--label)]">今日已打卡 {fmtHm(Math.round(fasting.todayFastHours * 60))}，可随时开始下一轮</p>
              </div>
            )}
            <button onClick={() => onAction('start')} disabled={fasting.recommendation.contraindicated} className="mt-3 w-full ios-button bg-[var(--system-orange)] text-white disabled:opacity-40">
              <Play className="size-4" /> 开始轻断食
            </button>
          </>
        )}
      </div>

      {/* 科学阶段时间线（进行中） */}
      {fasting.active && (
        <div className="mb-4 rounded-2xl bg-[var(--secondary-grouped-background)] p-5">
          <p className="text-[13px] font-semibold text-[var(--label)] mb-3">身体正在经历</p>
          <div className="flex gap-1.5 mb-3">
            {FASTING_STAGES.map((s) => {
              const activeStage = s.key === stage.key;
              const passed = elapsedMinutes / 60 >= s.toH;
              return (
                <div key={s.key} className="flex-1">
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: activeStage ? (STAGE_ACCENT[s.accent] || 'var(--system-orange)') : passed ? 'var(--system-green)' : 'var(--system-gray5)' }} />
                  <p className="text-[9px] text-[var(--tertiary-label)] mt-1 leading-[12px] text-center">{s.title.slice(0, 4)}</p>
                </div>
              );
            })}
          </div>
          <p className="text-[13px] font-semibold" style={{ color: accent }}>{stage.title}</p>
          <p className="text-[12px] text-[var(--secondary-label)] leading-[18px] mt-1">{stage.desc}</p>
        </div>
      )}

      {/* 灵活调整建议 */}
      {fasting.advice.kind !== 'none' && (
        <div className="mb-4 rounded-2xl bg-[var(--system-blue)]/6 border border-[var(--system-blue)]/15 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--system-blue)] shrink-0" />
            <p className="text-[13px] font-semibold text-[var(--label)]">{fasting.advice.title}</p>
          </div>
          <p className="text-[12px] text-[var(--secondary-label)] leading-[18px] mt-1">{fasting.advice.content}</p>
          {fasting.advice.nextHours && (
            <button onClick={() => onAction('set-plan', { planHours: fasting.advice.nextHours, goal: fasting.goal, windowEndHour: fasting.windowEndHour })}
              className="mt-2 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[var(--system-blue)] text-white press-effect">
              采纳：改为 {planLabel(fasting.advice.nextHours)}
            </button>
          )}
        </div>
      )}

      {/* 进食窗口 + 三餐联动 */}
      <div className="mb-4 rounded-2xl bg-[var(--secondary-grouped-background)] p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-semibold text-[var(--label)]">进食窗口 · 餐次规划</p>
          <button onClick={onGoToday} className="text-[12px] font-semibold text-[var(--system-green)] press-effect">查看今日餐单 <ArrowRight className="size-3 inline" /></button>
        </div>
        <div className="flex items-center justify-center gap-3 py-2 mb-3">
          <div className="text-center">
            <p className="text-[11px] text-[var(--secondary-label)]">开始</p>
            <p className="text-[22px] font-bold text-[var(--label)]">{fasting.mealGuide.windowStart}</p>
          </div>
          <div className="h-px flex-1 bg-[var(--separator)] relative">
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 size-2 rounded-full bg-[var(--system-green)]" />
          </div>
          <div className="text-center">
            <p className="text-[11px] text-[var(--secondary-label)]">结束</p>
            <p className="text-[22px] font-bold text-[var(--label)]">{fasting.mealGuide.windowEnd}</p>
          </div>
        </div>
        <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: `repeat(${fasting.mealGuide.mealCount}, minmax(0, 1fr))` }}>
          {fasting.mealGuide.meals.map((m) => (
            <div key={m.key} className="rounded-xl bg-[var(--system-green)]/10 p-2.5 text-center">
              <p className="text-[13px] font-semibold text-[var(--system-green)]">{m.name}</p>
              <p className="text-[20px] font-bold text-[var(--label)] mt-0.5 tracking-tight">{m.time}</p>
              <p className="text-[11px] text-[var(--secondary-label)] leading-[15px] mt-1">{m.suggestion}</p>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-[var(--secondary-label)] leading-[18px]">{fasting.mealGuide.note}</p>
      </div>

      {/* 方案设置 */}
      <div className="mb-4 rounded-2xl bg-[var(--secondary-grouped-background)] p-5">
        <p className="text-[13px] font-semibold text-[var(--label)] mb-2">断食模式</p>
        <div className="flex flex-wrap gap-2">
          {FASTING_CHOICES.map((h) => (
            <button key={h} onClick={() => onAction('set-plan', { planHours: h, goal: fasting.goal, windowEndHour: fasting.windowEndHour })}
              className={`px-3.5 py-2 rounded-xl text-[13px] font-medium press-effect border ${fasting.planHours === h ? 'border-[var(--system-orange)] bg-[var(--system-orange)]/12 text-[var(--system-orange)]' : 'border-[var(--separator)] text-[var(--secondary-label)]'}`}>
              {planLabel(h)}
            </button>
          ))}
        </div>

        <p className="text-[13px] font-semibold text-[var(--label)] mt-4 mb-2">进食结束时间</p>
        <div className="flex flex-wrap gap-2">
          {WINDOW_END_CHOICES.map((h) => (
            <button key={h} onClick={() => onAction('set-plan', { planHours: fasting.planHours, goal: fasting.goal, windowEndHour: h })}
              className={`px-3.5 py-2 rounded-xl text-[13px] font-medium press-effect border ${fasting.windowEndHour === h ? 'border-[var(--system-orange)] bg-[var(--system-orange)]/12 text-[var(--system-orange)]' : 'border-[var(--separator)] text-[var(--secondary-label)]'}`}>
              {h}:00
            </button>
          ))}
        </div>
      </div>

      {/* 周记录 */}
      <div className="mb-4 rounded-2xl bg-[var(--secondary-grouped-background)] p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-semibold text-[var(--label)]">最近 7 天</p>
          <span className="text-[11px] text-[var(--secondary-label)]">达标标记为绿</span>
        </div>
        {fasting.weekLogs.length === 0 ? (
          <p className="text-[13px] text-[var(--secondary-label)]">还没有打卡记录，开始第一次断食吧。</p>
        ) : (
          <div className="flex gap-2 justify-between">
            {fasting.weekLogs.map((l) => {
              const ok = l.fastHours > 0 && (l.planHours == null || l.fastHours >= l.planHours * 0.9);
              const day = l.date.slice(5).replace('-', '/');
              const pct = l.planHours ? Math.min(1, l.fastHours / l.planHours) : 0;
              return (
                <div key={l.date} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full h-12 rounded-lg bg-[var(--system-gray5)] relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 rounded-lg" style={{ height: `${Math.max(8, pct * 100)}%`, backgroundColor: ok ? 'var(--system-green)' : 'var(--system-orange)' }} />
                  </div>
                  <p className={`text-[10px] ${ok ? 'text-[var(--system-green)] font-semibold' : 'text-[var(--tertiary-label)]'}`}>{day}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 安全提示 */}
      <div className="flex gap-3 p-4 bg-[var(--secondary-grouped-background)] rounded-2xl text-[12px] leading-[18px] text-[var(--secondary-label)]">
        <Info className="size-5 shrink-0 text-[var(--system-blue)] mt-0.5" />
        <p>断食期间多喝水、补充电解质；如出现头晕、心悸、明显乏力，请立即结束并进食。有低血糖、孕期、哺乳、进食障碍或用药情况请先咨询医生。</p>
      </div>

      {/* 完成打卡 Sheet */}
      <Sheet open={completeOpen} onClose={() => setCompleteOpen(false)} title="结束并打卡">
        <div className="px-4 pb-6 space-y-5">
          <p className="text-[13px] text-[var(--secondary-label)]">记录本次断食的身体感受，小养会据此调整后续方案。</p>
          <FeelPicker label="精力状态" emoji="⚡" value={energy} onChange={setEnergy} />
          <FeelPicker label="饥饿程度" emoji="🍽️" value={hunger} onChange={setHunger} />
          <button onClick={() => { onAction('complete', { energy, hunger }); setCompleteOpen(false); }} className="w-full ios-button bg-[var(--system-orange)] text-white">
            <Check className="size-4" /> 完成打卡
          </button>
        </div>
      </Sheet>

      {/* 设置向导 Sheet */}
      <Sheet open={profileOpen} onClose={() => setProfileOpen(false)} title="个性化设置">
        <FastingOnboarding
          profile={fasting.profile}
          goal={fasting.goal}
          experience={fasting.experience}
          onSubmit={(payload) => { onAction('save-profile', payload); setProfileOpen(false); }}
        />
      </Sheet>

      {/* 科普 Sheet */}
      <Sheet open={eduOpen} onClose={() => setEduOpen(false)} title="认识轻断食">
        <div className="px-4 pb-6 space-y-5">
          <div className="rounded-2xl bg-[var(--secondary-grouped-background)] p-4">
            <p className="text-[14px] font-semibold text-[var(--label)]">时间限制进食（本应用）</p>
            <p className="text-[13px] text-[var(--secondary-label)] leading-[19px] mt-1">把一天的进食压缩在固定窗口内，如 16:8 表示禁食 16 小时、8 小时内进食。个体反应差异较大，它不是治疗方案，也不以固定小时数承诺特定代谢或细胞效应。</p>
          </div>
          <div className="rounded-2xl bg-[var(--secondary-grouped-background)] p-4">
            <p className="text-[14px] font-semibold text-[var(--label)]">5:2 方案</p>
            <p className="text-[13px] text-[var(--secondary-label)] leading-[19px] mt-1">一周 5 天正常饮食，2 天（不连续）把热量压到约 500–600 千卡。适合想控制总量但不喜欢每天限时的人。属于「热量限制」型断食，本应用暂不做打卡。</p>
          </div>
          <div className="rounded-2xl bg-[var(--secondary-grouped-background)] p-4">
            <p className="text-[14px] font-semibold text-[var(--label)]">隔日断食（ADF）</p>
            <p className="text-[13px] text-[var(--secondary-label)] leading-[19px] mt-1">一天正常吃、隔天禁食或极低热量，交替进行。减重效果显著但强度较高，新手不建议直接尝试，也属于「热量限制」型。</p>
          </div>
          <div className="rounded-2xl bg-[var(--system-orange)]/10 p-4">
            <p className="text-[13px] text-[var(--label)] leading-[19px]"><Info className="size-4 inline text-[var(--system-orange)] mb-0.5" /> 断食的本质是「吃得更少」或「让身体有时间修复」，不是节食挨饿。进食窗口内的营养质量比断食时长更重要。</p>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
