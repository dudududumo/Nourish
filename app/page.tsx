'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home, CalendarRange, Refrigerator, Activity, ChevronRight,
  Sparkles, TrendingDown, Dumbbell, Archive,
  Flame, Info, Settings, Send, Plus, X,
  LogOut, User, Loader2, AlertCircle, Check,
  Bell, ChevronDown, ShoppingCart, Zap, Bot, Upload, ImageIcon, Minus,
  Timer, BookOpen, Pause, Play, ArrowRight, Trophy, Target, Moon,
} from 'lucide-react';
import { FASTING_STAGES, GOAL_LABELS, EXPERIENCE_LABELS, planLabel } from '@/lib/fasting';
import { todayStr } from '@/lib/utils';

type Tab = 'today' | 'plan' | 'coach' | 'fridge' | 'body' | 'fasting';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
};
type Zone = { id: string; name: string; type: '冷藏' | '冷冻'; capacity: number; used: number; icon: string };

type DishIngredient = { name: string; amount: string; fromFridge?: boolean };
type Dish = { id?: number; name: string; ingredients: DishIngredient[]; calories: number; protein: number; steps?: string[]; mealType?: string; sortOrder?: number };
type MealGroup = { breakfast?: Dish[]; lunch?: Dish[]; dinner?: Dish[]; snack?: Dish[] };
type ShoppingItem = { id?: number; name: string; amount: string; reason?: string; purchased?: boolean };
type Insight = { id: number; type: 'observation' | 'suggestion' | 'warning'; category?: string; title: string; content: string; priority: number; readAt?: string | null };
type WeeklyPlan = { id: number; weekStart: string; weekEnd: string; goal?: string; targetCalories?: number; targetProtein?: number; rationale?: string };

type TodayData = {
  plan: WeeklyPlan | null;
  today: { date: string; calories: number; protein: number; meals: MealGroup };
  insights: Insight[];
  hasPlan: boolean;
};

type AdjustPreviewDish = { name: string; calories?: number; protein?: number };
type AdjustPreview = {
  reason?: string;
  calories?: number;
  protein?: number;
  meals?: Record<string, AdjustPreviewDish[]>;
};

type FastingData = {
  planHours: number;
  goal: 'fat_loss' | 'health' | 'blood_sugar' | 'maintain';
  experience: 'beginner' | 'intermediate' | 'advanced';
  windowEndHour: number;
  active: boolean;
  startAt: string | null;
  elapsedMinutes: number;
  remainingMinutes: number;
  progress: number;
  canComplete: boolean;
  todayCompleted: boolean;
  todayFastHours: number;
  todayFeel: { energy: number | null; hunger: number | null };
  streak: number;
  stage: { key: string; title: string; desc: string; accent: string; progress: number };
  mealGuide: {
    windowStart: string;
    windowEnd: string;
    eatHours: number;
    mealCount: 1 | 2 | 3;
    meals: { key: 'first' | 'second' | 'third'; name: string; time: string; suggestion: string }[];
    note: string;
  };
  profile: {
    hasProfile: boolean;
    sex: 'male' | 'female' | null;
    birthDate: string | null;
    heightCm: number | null;
    weightKg: number | null;
    bodySource: 'measurement' | 'profile' | null;
    latestBody: { weightKg: number | null; bodyFatPct: number | null; measuredAt: string } | null;
    screening: Record<string, boolean>;
  };
  recommendation: {
    ready: boolean;
    contraindicated: boolean;
    planHours: number;
    level: 'beginner' | 'intermediate' | 'advanced';
    reason: string;
    warnings: string[];
    bmi: number | null;
    age: number | null;
  };
  advice: { kind: 'upgrade' | 'keep' | 'downgrade' | 'rest' | 'none'; title: string; content: string; nextHours?: number };
  weekLogs: { date: string; fastHours: number; planHours: number | null; energy: number | null; hunger: number | null }[];
};

const metrics = [
  ['体重', '', 'kg'], ['BMI', '', ''],
  ['体脂率', '', '%'], ['脂肪量', '', 'kg'],
  ['肌肉量', '', 'kg'], ['肌肉率', '', '%'],
  ['骨骼肌', '', 'kg'], ['去脂体重', '', 'kg'],
  ['体水分', '', '%'], ['蛋白质率', '', '%'],
  ['骨量', '', 'kg'], ['骨盐率', '', '%'],
  ['内脏脂肪', '', '级'], ['基础代谢', '', 'kcal'],
  ['腰臀比', '', ''], ['心率', '', '次/分'],
  ['身体得分', '', '分'], ['身体年龄', '', '岁'],
] as const;

// ===== 各指标的科学分级区间（常规健康参考，不构成医疗建议） =====
const ZC = {
  low: '#3B82F6',    // 偏低 / 不足 → 蓝（信息提示）
  norm: '#22C55E',   // 正常 / 良好 → 健康绿
  high: '#F59E0B',   // 偏高 / 轻度超标 → 橙（提醒）
  danger: '#EF4444', // 健康风险 → 红（危险）
};

type ZoneDef = { label: string; min: number; max: number; color: string };
type MetricStandard = {
  zones?: ZoneDef[];   // 未区分性别时的默认区间
  male?: ZoneDef[];
  female?: ZoneDef[];
  guide: string;
};

const STANDARDS: Record<string, MetricStandard> = {
  BMI: {
    zones: [
      { label: '偏瘦', min: 14, max: 18.5, color: ZC.low },
      { label: '正常', min: 18.5, max: 24, color: ZC.norm },
      { label: '超重', min: 24, max: 28, color: ZC.high },
      { label: '肥胖', min: 28, max: 34, color: ZC.danger },
    ],
    guide: 'BMI = 体重(kg) ÷ 身高(m)²。中国成人标准：18.5–23.9 正常、24–27.9 超重、≥28 肥胖；低于 18.5 偏瘦。',
  },
  体脂率: {
    zones: [
      { label: '偏低', min: 10, max: 18, color: ZC.low },
      { label: '标准', min: 18, max: 28, color: ZC.norm },
      { label: '偏高', min: 28, max: 35, color: ZC.high },
      { label: '肥胖', min: 35, max: 50, color: ZC.danger },
    ],
    male: [
      { label: '偏低', min: 4, max: 10, color: ZC.low },
      { label: '标准', min: 10, max: 20, color: ZC.norm },
      { label: '偏高', min: 20, max: 25, color: ZC.high },
      { label: '肥胖', min: 25, max: 40, color: ZC.danger },
    ],
    guide: '体脂率是比体重更关键的健康指标。成年男性标准约 10–20%、女性约 18–28%；男 >25%、女 >35% 通常视为肥胖。',
  },
  内脏脂肪: {
    zones: [
      { label: '正常', min: 1, max: 10, color: ZC.norm },
      { label: '偏高', min: 10, max: 14, color: ZC.high },
      { label: '较高', min: 14, max: 20, color: ZC.danger },
    ],
    guide: '内脏脂肪等级 1–9 为正常，10–14 偏高，≥15 视为较高；内脏脂肪过高与心血管、代谢疾病风险相关。',
  },
  肌肉率: {
    zones: [
      { label: '偏低', min: 20, max: 30, color: ZC.low },
      { label: '标准', min: 30, max: 40, color: ZC.norm },
      { label: '良好', min: 40, max: 50, color: ZC.norm },
    ],
    guide: '肌肉率健康成年人约为体重的 30–40%（女性偏低、男性偏高），肌肉量高通常代谢更好，长期久坐易下降。',
  },
  体水分: {
    zones: [
      { label: '偏低', min: 40, max: 50, color: ZC.low },
      { label: '标准', min: 50, max: 60, color: ZC.norm },
      { label: '偏高', min: 60, max: 80, color: ZC.high },
    ],
    male: [
      { label: '偏低', min: 40, max: 55, color: ZC.low },
      { label: '标准', min: 55, max: 65, color: ZC.norm },
      { label: '偏高', min: 65, max: 80, color: ZC.high },
    ],
    guide: '身体水分率男性约 55–65%、女性约 50–60%。饮水不足或肌肉量偏低时数值下降。',
  },
  蛋白质率: {
    zones: [
      { label: '偏低', min: 10, max: 14, color: ZC.low },
      { label: '标准', min: 14, max: 17, color: ZC.norm },
      { label: '偏高', min: 17, max: 25, color: ZC.high },
    ],
    guide: '蛋白质率正常参考约 14–17%，偏低常见于蛋白质摄入不足或肌肉流失。',
  },
  基础代谢: {
    zones: [
      { label: '偏低', min: 900, max: 1100, color: ZC.low },
      { label: '标准', min: 1100, max: 1400, color: ZC.norm },
      { label: '偏高', min: 1400, max: 1800, color: ZC.high },
    ],
    male: [
      { label: '偏低', min: 1200, max: 1400, color: ZC.low },
      { label: '标准', min: 1400, max: 1700, color: ZC.norm },
      { label: '偏高', min: 1700, max: 2200, color: ZC.high },
    ],
    guide: '基础代谢指维持生命体征每日消耗的热量。女性约 1100–1400 kcal、男性 1400–1700 kcal，因人而异。',
  },
  腰臀比: {
    zones: [
      { label: '正常', min: 0.7, max: 0.85, color: ZC.norm },
      { label: '偏高', min: 0.85, max: 1.2, color: ZC.danger },
    ],
    male: [
      { label: '正常', min: 0.7, max: 0.9, color: ZC.norm },
      { label: '偏高', min: 0.9, max: 1.2, color: ZC.danger },
    ],
    guide: '腰臀比 = 腰围 ÷ 臀围。男性 >0.90、女性 >0.85 提示向心性肥胖风险增加。',
  },
  心率: {
    zones: [
      { label: '偏缓', min: 40, max: 60, color: ZC.low },
      { label: '正常', min: 60, max: 100, color: ZC.norm },
      { label: '偏快', min: 100, max: 160, color: ZC.danger },
    ],
    guide: '成人静息心率正常约 60–100 次/分。>100(静息) 为心动过速，长期偏高建议复查。',
  },
  身体得分: {
    zones: [
      { label: '偏低', min: 40, max: 70, color: ZC.high },
      { label: '良好', min: 70, max: 100, color: ZC.norm },
    ],
    guide: '身体得分是综合健康评分，越高代表整体越健康，70 分以上为良好。',
  },
  骨量: {
    zones: [
      { label: '偏低', min: 1.5, max: 2, color: ZC.low },
      { label: '标准', min: 2, max: 3, color: ZC.norm },
      { label: '充足', min: 3, max: 4, color: ZC.norm },
    ],
    male: [
      { label: '偏低', min: 2, max: 3, color: ZC.low },
      { label: '标准', min: 3, max: 4, color: ZC.norm },
      { label: '充足', min: 4, max: 5, color: ZC.norm },
    ],
    guide: '骨量正常参考约男性 3–4kg、女性 2–3kg，受年龄、激素、运动影响。',
  },
  骨盐率: {
    zones: [
      { label: '偏低', min: 2.5, max: 3, color: ZC.low },
      { label: '标准', min: 3, max: 5, color: ZC.norm },
      { label: '偏高', min: 5, max: 6, color: ZC.high },
    ],
    guide: '骨盐量占体重百分比，正常约 3–5%，反映骨骼无机盐含量。',
  },
  体重: { guide: '体重本身无绝对标准，需结合身高(BMI)与身体成分判断。女性标准体重≈(身高cm−100)×0.9kg。' },
  脂肪量: { guide: '脂肪量是否正常取决于体脂率，而不只是绝对重量。' },
  肌肉量: { guide: '骨骼肌+平滑肌等总和，正常约占体重 30–40%，肌肉量高通常代谢更好。' },
  骨骼肌: { guide: '骨骼肌是维持姿势与运动的主要肌肉，女性约占体重 25–30%、男性 35–40%。' },
  去脂体重: { guide: '体重减去脂肪后的重量，由肌肉、骨骼、水分等组成，越高反映瘦体重越多。' },
  '身体年龄': { guide: '设备根据身体成分估算的生理年龄，低于实际年龄通常代表代谢状态更好。' },
};

function resolveZones(std: MetricStandard | undefined, sex: string | null | undefined): ZoneDef[] | null {
  if (!std) return null;
  const zones = (sex === 'female' ? std.female : sex === 'male' ? std.male : null) ?? std.zones;
  return zones && zones.length ? zones : null;
}

function locateZone(std: MetricStandard | undefined, sex: string | null | undefined, num: number | null): { zone: ZoneDef | null; pos: number } {
  const zones = resolveZones(std, sex);
  if (!zones || num == null || !isFinite(num)) return { zone: null, pos: 0 };
  const domain = [zones[0].min, zones[zones.length - 1].max];
  const idx = zones.findIndex((z) => num >= z.min && num < z.max);
  const zone = idx === -1 ? (num < domain[0] ? zones[0] : zones[zones.length - 1]) : zones[idx];
  const pos = Math.min(100, Math.max(0, ((num - domain[0]) / (domain[1] - domain[0])) * 100));
  return { zone, pos };
}

// 根据所在区间生成动态备注（等级 + 建议），替代原本写死的 mock 文案
function zoneNote(zone: ZoneDef | null): string {
  if (!zone) return '';
  const advice = zone.color === ZC.danger ? '建议关注调整'
    : zone.color === ZC.high ? '建议留意'
      : zone.color === ZC.low ? '注意加强'
        : '保持良好';
  return `${zone.label} · ${advice}`;
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const initialZones: Zone[] = [
  { id: 'fridge', name: '冷藏', type: '冷藏', capacity: 50, used: 0, icon: '🧊' },
  { id: 'freezer', name: '冷冻', type: '冷冻', capacity: 45, used: 0, icon: '❄️' },
];

const initialFoods: { name: string; zone: string; amount: string; days: number; icon: string; shelf: number }[] = [];

type AuthUser = { id: string; phone: string; nickname: string | null };

function formatTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

const welcomeMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '你好呀～我是你的专属营养师小养 🌿\n\n有什么我可以帮你的？比如：\n• "我想把目标改成增肌"\n• "我不吃香菜，帮我调整一下"\n• "今天中午吃什么比较好？"\n\n我会根据你的身体数据和冰箱库存来给你建议～',
  time: '',
};

export default function HomePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('today');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [foods, setFoods] = useState(initialFoods);
  const [fridgeSettings, setFridgeSettings] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [aiEndpoint, setAiEndpoint] = useState('https://ark.cn-beijing.volces.com/api/v3/chat/completions');
  const [aiModel, setAiModel] = useState('deepseek-v4-flash-ga-260731');
  const [aiKey, setAiKey] = useState('');
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [zones, setZones] = useState(initialZones);
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [todayLoading, setTodayLoading] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [planError, setPlanError] = useState('');
  const [selectedDay, setSelectedDay] = useState(0); // 窗口 index 0 = 今天
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [shoppingLoading, setShoppingLoading] = useState(false);
  const [bodyAnalyzing, setBodyAnalyzing] = useState(false);
  const [fridgeAnalyzing, setFridgeAnalyzing] = useState(false);
  const loadingRef = useRef<Set<string>>(new Set());
  const [adjust, setAdjust] = useState<{ id: number; title: string; content: string } | null>(null);
  const [adjustTarget, setAdjustTarget] = useState('今天');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustStep, setAdjustStep] = useState<'form' | 'preview'>('form');
  const [adjustPreview, setAdjustPreview] = useState<AdjustPreview | null>(null);
  const [fridgeResult, setFridgeResult] = useState<{ success: boolean; count?: number; message?: string; insights?: Insight[] } | null>(null);
  const [bodyResult, setBodyResult] = useState<{ success: boolean; count?: number; message?: string; insights?: Insight[] } | null>(null);
  const [qtyItem, setQtyItem] = useState<{ name: string; amount: string } | null>(null);
  const [qtyAmount, setQtyAmount] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [savedInsights, setSavedInsights] = useState<Insight[] | null>(null);
  const [bodyHistory, setBodyHistory] = useState<Insight[] | null>(null);
  const [fridgeHistory, setFridgeHistory] = useState<Insight[] | null>(null);
  const [bodyLatest, setBodyLatest] = useState<Record<string, string> | null>(null);

  const bodyUnits: Record<string, string> = {};
  for (const [k, , u] of metrics) bodyUnits[k] = u;

  // 分析/计划/对话共用：只返回「最新真实身体数据」，缺失不补示例值，避免 AI 拿假数据误判
  function buildMeasurements(): Record<string, string> {
    const out: Record<string, string> = {};
    if (bodyLatest) {
      for (const [k, v] of Object.entries(bodyLatest)) {
        out[k] = `${v}${bodyUnits[k] ?? ''}`;
      }
    }
    return out;
  }

  async function loadBodyLatest() {
    try {
      const res = await fetch('/api/body');
      if (res.ok) {
        const data = await res.json() as { metrics: Record<string, string> | null };
        setBodyLatest(data.metrics ?? null);
      }
    } catch { /* 忽略加载失败 */ }
  }

  useEffect(() => {
    if (!user) return;
    loadBodyLatest();
  }, [user]);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [fabPos, setFabPos] = useState<{ left: number; top: number } | null>(null);
  const fabDragRef = useRef<{ pointerId: number; startX: number; startY: number; baseLeft: number; baseTop: number; moved: boolean } | null>(null);
  const fabMovedRef = useRef(false);

  const FAB_SIZE = 48;
  const FAB_EDGE = 16;
  function fabBase(): { left: number; top: number } {
    if (fabPos) return fabPos;
    return { left: window.innerWidth - FAB_EDGE - FAB_SIZE, top: 84 };
  }
  function onFabPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    const base = fabBase();
    fabDragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, baseLeft: base.left, baseTop: base.top, moved: false };
    fabMovedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onFabPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = fabDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    d.moved = true;
    fabMovedRef.current = true;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const left = Math.min(Math.max(FAB_EDGE, d.baseLeft + dx), w - FAB_EDGE - FAB_SIZE);
    const top = Math.min(Math.max(84, d.baseTop + dy), h - 49 - 8 - FAB_SIZE);
    setFabPos({ left, top });
  }
  function onFabPointerUp() {
    const d = fabDragRef.current;
    fabDragRef.current = null;
    if (!d?.moved) return;
    setFabPos((prev) => {
      const w = window.innerWidth;
      const p = prev ?? { left: w - FAB_EDGE - FAB_SIZE, top: 84 };
      const snapLeft = p.left + FAB_SIZE / 2 < w / 2;
      return { left: snapLeft ? FAB_EDGE : w - FAB_EDGE - FAB_SIZE, top: p.top };
    });
  }
  const [qtyZone, setQtyZone] = useState('冷藏');
  const [pendingAdjustment, setPendingAdjustment] = useState<{ instruction: string; aiPlan?: string } | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [fasting, setFasting] = useState<FastingData | null>(null);
  const [fastingLoading, setFastingLoading] = useState(false);

  // Check auth status
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        } else {
          router.push('/login');
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setAuthLoading(false));
  }, [router]);

  // Load today's data
  useEffect(() => {
    if (!user) return;
    setTodayLoading(true);
    fetch('/api/plan/today')
      .then((r) => r.json())
      .then((data) => setTodayData(data))
      .finally(() => setTodayLoading(false));
  }, [user]);

  async function generateWeeklyPlan() {
    if (generatingPlan) return;
    setGeneratingPlan(true); setPlanError('');
    setWeeklyData(null); // Reset to trigger reload
    try {
      const response = await fetch('/api/plan/weekly', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          measurements: buildMeasurements(),
          zones,
          foods,
          goal: '健康减脂并提升肌肉量',
          constraints: '宿舍环境、小锅、简单易做、好吃不水煮',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setPlanError(data.error ?? '生成失败，请稍后再试。');
      } else {
        console.log('[周计划] 生成成功：', data);
        // Reload today data
        const todayRes = await fetch('/api/plan/today');
        const todayData2 = await todayRes.json();
        setTodayData(todayData2);
        // Reload week data if on plan tab
        if (tab === 'plan') {
          void loadWeekData();
        }
        // Reload shopping list
        void loadShoppingList();
      }
    } catch {
      setPlanError('网络连接失败，请稍后再试。');
    } finally {
      setGeneratingPlan(false);
    }
  }

  async function markInsightRead(id: number) {
    await fetch('/api/insights/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (todayData) {
      setTodayData({
        ...todayData,
        insights: todayData.insights.filter((i) => i.id !== id),
      });
    }
    // 跨页同步：就地分析卡片(冰箱/身体)也一样隐藏
    if (fridgeResult?.insights) {
      setFridgeResult({ ...fridgeResult, insights: fridgeResult.insights.filter((i) => i.id !== id) });
    }
    if (bodyResult?.insights) {
      setBodyResult({ ...bodyResult, insights: bodyResult.insights.filter((i) => i.id !== id) });
    }
    if (savedInsights) {
      setSavedInsights(savedInsights.filter((i) => i.id !== id));
    }
    if (bodyHistory) setBodyHistory(bodyHistory.filter((i) => i.id !== id));
    if (fridgeHistory) setFridgeHistory(fridgeHistory.filter((i) => i.id !== id));
  }

  function handleInsightAction(id: number, action: 'accept' | 'dismiss') {
    if (action === 'accept') {
      // 采纳建议：先弹窗确认想调整的时间或补充想法
      const insight =
        todayData?.insights.find((i) => i.id === id) ||
        bodyHistory?.find((i) => i.id === id) ||
        fridgeHistory?.find((i) => i.id === id) ||
        savedInsights?.find((i) => i.id === id);
      setAdjustTarget('今天');
      setAdjustNote('');
      setAdjustStep('form');
      setAdjustPreview(null);
      setAdjust({ id, title: insight?.title || '调整建议', content: insight?.content || '' });
    } else {
      // 暂不调整：直接标记已读关闭
      markInsightRead(id);
    }
  }

  function closeAdjustSheet() {
    setAdjust(null);
    setAdjustTarget('今天');
    setAdjustNote('');
    setAdjustStep('form');
    setAdjustPreview(null);
  }

  // 第一阶段：按时间和想法生成调整方案预览（不落库）
  async function handleGenerateAdjustPreview() {
    if (!adjust || adjusting) return;
    const adjustTitle = adjust.title;
    const target = adjustTarget === '明天' ? '明天' : adjustTarget === '本周' ? '本周后续几天' : '今天';
    const note = adjustNote.trim();
    let instruction = `按洞察《${adjustTitle}》调整${target}的饮食安排`;
    if (note) instruction += `，补充要求：${note}`;
    setAdjusting(true);
    try {
      const res = await fetch('/api/plan/adjust', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          instruction,
          mode: 'preview',
          context: {
            measurements: buildMeasurements(),
            foods,
            currentPlan: todayData?.plan,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data?.meals) {
        setAdjustPreview(data as AdjustPreview);
        setAdjustStep('preview');
      } else {
        alert(data?.error || '没想好方案，稍后再试试吧。');
      }
    } catch {
      alert('网络好像不太好，方案没能生成，稍后再试。');
    } finally {
      setAdjusting(false);
    }
  }

  // 第二阶段：确认应用方案（落库 + 刷新主页 + 同步聊天）
  async function handleApplyAdjustPreview() {
    if (!adjust || !adjustPreview || adjusting) return;
    const insightId = adjust.id;
    setAdjusting(true);
    try {
      const res = await fetch('/api/plan/adjust', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'apply', plan: adjustPreview }),
      });
      const data = await res.json();
      if (res.ok) {
        const todayRes = await fetch('/api/plan/today');
        const todayData2 = await todayRes.json();
        setTodayData(todayData2);
        markInsightRead(insightId);
        closeAdjustSheet();

        // 持久化小养的确认消息，再重载聊天历史，刷新后也不丢
        try {
          await fetch('/api/chat/messages', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'assistant', content: '✅ 已按你的要求调整好今天的安排，首页已同步更新～' }] }),
          });
        } catch { /* 持久化失败不影响主流程 */ }
        await loadChatHistory();
        // 若当前不在营养师页，切过去让小养的回复可见
        if (tab !== 'coach') setTab('coach');
      } else {
        alert(data?.error || '调整失败了，稍后再试试吧。');
      }
    } catch {
      alert('网络好像不太好，调整没能完成，稍后再试。');
    } finally {
      setAdjusting(false);
    }
  }

  function handleBackToAdjustForm() {
    setAdjustStep('form');
    setAdjustPreview(null);
  }

  function addFood(f: { name: string; amount: string; zone: string; days: number }) {
    if (!f.name.trim()) return;
    const zoneName = f.zone === '冷冻' ? '冷冻' : '冷藏';
    setFoods((prev) => [...prev, { ...f, zone: zoneName, icon: '🥡', shelf: 0 }]);
    setZones((prev) =>
      prev.map((z) => (z.name === zoneName ? { ...z, used: Math.min(z.capacity, z.used + 1) } : z))
    );
    // 冰箱数据更新，Agent 主动触发库存洞察
    void silentAnalyze('fridge', `冰箱新增食材：${f.name}（${f.amount || '若干'}，放入${zoneName}）`);
  }

  async function saveAiConfig() {
    if (!aiKey.trim()) return;
    setAiSaving(true); setAiSaved(false);
    const response = await fetch('/api/settings/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: '火山方舟', endpoint: aiEndpoint, model: aiModel, apiKey: aiKey }),
    });
    setAiSaving(false);
    if (response.ok) { setAiKey(''); setAiSaved(true); setTimeout(() => setAiSettingsOpen(false), 800); }
  }

  async function loadShoppingList() {
    setShoppingLoading(true);
    try {
      const res = await fetch('/api/shopping');
      const data = await res.json();
      if (data.items) setShoppingItems(data.items);
    } finally {
      setShoppingLoading(false);
    }
  }

  // 静默分析：数据更新时由 Agent 主动触发，只写入 DB，不打扰用户
  async function silentAnalyze(triggerType: 'body' | 'fridge' | 'both', changes: string) {
    try {
      await fetch('/api/agent/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          triggerType,
          changes,
          ...(triggerType === 'body' || triggerType === 'both' ? { measurements: buildMeasurements() } : {}),
          ...(triggerType === 'fridge' || triggerType === 'both' ? { foods, zones } : {}),
        }),
      });
    } catch { /* 静默失败，不打断用户 */ }
  }

  // 刷新三处洞察列表（分析覆盖后丢弃旧数据）
  function refreshInsightLists() {
    void fetch('/api/insights/list').then((r) => r.json()).then((d: { insights?: Insight[] }) => setSavedInsights(d.insights ?? [])).catch(() => {});
    void fetch('/api/insights/list?scope=body').then((r) => r.json()).then((d: { insights?: Insight[] }) => setBodyHistory(d.insights ?? [])).catch(() => {});
    void fetch('/api/insights/list?scope=fridge').then((r) => r.json()).then((d: { insights?: Insight[] }) => setFridgeHistory(d.insights ?? [])).catch(() => {});
  }

  async function toggleShoppingItem(id: number, purchased: boolean) {
    setShoppingItems((prev) => prev.map((item) => item.id === id ? { ...item, purchased } : item));
    await fetch('/api/shopping', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, purchased }),
    });
  }

  async function loadWeekData() {
    setWeeklyLoading(true);
    try {
      const res = await fetch('/api/plan/week');
      const data = await res.json();
      if (data.needsRoll) {
        // 明天及未来有缺失：自动续期补齐
        try {
          await fetch('/api/plan/roll', { method: 'POST' });
        } catch { /* 续期失败不阻塞展示，仍用当前数据 */ }
        const rel = await fetch('/api/plan/week');
        const data2 = await rel.json();
        setWeeklyData(data2);
        // 续期后同步刷新今日与采购
        const t = await fetch('/api/plan/today').then((r) => r.json()).catch(() => null);
        if (t) setTodayData(t);
        void loadShoppingList();
      } else {
        setWeeklyData(data);
      }
    } finally {
      setWeeklyLoading(false);
    }
  }

  async function triggerAgentAnalysis(triggerType: 'body' | 'fridge' | 'both', changes: string) {
    // 各自独立的 loading，互不干扰
    const setLoading = triggerType === 'fridge' ? setFridgeAnalyzing : setBodyAnalyzing;
    if (loadingRef.current.has(triggerType === 'fridge' ? 'fridge' : triggerType === 'body' ? 'body' : 'body')) return;
    loadingRef.current.add(triggerType === 'fridge' ? 'fridge' : 'body');
    // 各自独立，不互相覆盖
    const setResult = triggerType === 'fridge' ? setFridgeResult : triggerType === 'body' ? setBodyResult : (r: any) => { setFridgeResult(r); setBodyResult(r); };
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch('/api/agent/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          triggerType,
          changes,
          ...(triggerType === 'body' || triggerType === 'both' ? { measurements: buildMeasurements() } : {}),
          ...(triggerType === 'fridge' || triggerType === 'both' ? { foods, zones } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Reload today data to show new insights
        const todayRes = await fetch('/api/plan/today');
        const todayData2 = await todayRes.json();
        setTodayData(todayData2);
        setResult({ success: true, count: data.count, message: `AI 发现了 ${data.count} 条新建议`, insights: data.insights });
        refreshInsightLists();
      } else {
        setResult({ success: false, message: data.error || '分析失败，请稍后再试' });
      }
    } catch {
      setResult({ success: false, message: '网络连接失败，请稍后再试' });
    } finally {
      setLoading(false);
      loadingRef.current.delete(triggerType === 'fridge' ? 'fridge' : 'body');
    }
  }

  const ADJUST_KEYWORDS = ['调整', '修改', '换掉', '改成', '不要', '不吃', '忌口', '替', '增肌', '减脂', '减重', '控制热量', '减少', '加餐', '热量'];
  function isAdjustIntent(text: string) {
    return ADJUST_KEYWORDS.some((k) => text.includes(k));
  }

  async function sendChatMessage() {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    const wasAdjust = isAdjustIntent(msg);

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: msg,
      time: timeStr,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          context: {
            measurements: buildMeasurements(),
            foods,
            currentPlan: todayData?.plan,
          },
        }),
      });
      const data = await res.json();
      const replyTime = new Date();
      const replyTimeStr = `${replyTime.getHours().toString().padStart(2, '0')}:${replyTime.getMinutes().toString().padStart(2, '0')}`;

      if (res.ok) {
        const aiMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.reply || '抱歉，我没有理解你的意思。',
          time: replyTimeStr,
        };
        setChatMessages((prev) => [...prev, aiMsg]);
        // 持久化本轮对话
        void fetch('/api/chat/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: msg }, { role: 'assistant', content: data.reply || '' }] }),
        });
        // 用户在提调整需求时，弹出确认调整卡片（点到确认才真正改计划）
        if (wasAdjust) {
          setPendingAdjustment({ instruction: msg, aiPlan: data.reply || '' });
        }
      } else {
        const errMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: `😕 ${data.error || '出了点小问题，稍后再试试吧。'}`,
          time: replyTimeStr,
        };
        setChatMessages((prev) => [...prev, errMsg]);
      }
    } catch {
      const errMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: '😕 网络好像不太好，检查一下连接再试试吧。',
        time: new Date().toTimeString().slice(0, 5),
      };
      setChatMessages((prev) => [...prev, errMsg]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleConfirmAdjust() {
    if (!pendingAdjustment || adjusting) return;
    setAdjusting(true);
    const instruction = pendingAdjustment.instruction;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    try {
      const res = await fetch('/api/plan/adjust', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          instruction,
          context: {
            measurements: buildMeasurements(),
            foods,
            currentPlan: todayData?.plan,
          },
        }),
      });
      const data = await res.json();

      if (res.ok) {
        // 刷新今日页
        const todayRes = await fetch('/api/plan/today');
        const todayData2 = await todayRes.json();
        setTodayData(todayData2);
        setPendingAdjustment(null);

        // 持久化小养的确认消息，重载历史，刷新后也不丢
        try {
          await fetch('/api/chat/messages', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'assistant', content: '✅ 已按你的要求调整好今天的安排，首页已同步更新～' }] }),
          });
        } catch { /* 持久化失败不影响主流程 */ }
        await loadChatHistory();
      } else {
        const errMsg: ChatMessage = {
          id: `sys-${Date.now()}`,
          role: 'assistant',
          content: `😕 ${data.error || '调整失败了，稍后再试试吧。'}`,
          time: timeStr,
        };
        setChatMessages((prev) => [...prev, errMsg]);
      }
    } catch {
      const errMsg: ChatMessage = {
        id: `sys-${Date.now()}`,
        role: 'assistant',
        content: '😕 网络好像不太好，调整没能完成，稍后再试。',
        time: timeStr,
      };
      setChatMessages((prev) => [...prev, errMsg]);
    } finally {
      setAdjusting(false);
    }
  }

  function handleDismissAdjust() {
    setPendingAdjustment(null);
  }

  // 从服务端拉取完整聊天历史（含刚持久化的系统消息）
  async function loadChatHistory() {
    try {
      const r = await fetch('/api/chat/messages');
      const data = await r.json() as { messages?: Array<{ role: string; content: string; createdAt: string }> };
      const history = data.messages ?? [];
      if (history.length) {
        setChatMessages(history.map((m, i) => ({
          id: `h-${i}-${m.createdAt}`,
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
          time: formatTime(m.createdAt),
        })));
      } else {
        setChatMessages([welcomeMessage]);
      }
    } catch {
      if (chatMessages.length === 0) setChatMessages([welcomeMessage]);
    }
  }

  // 加载聊天历史
  useEffect(() => {
    if (tab === 'coach' && user && chatMessages.length === 0) {
      void loadChatHistory();
    }
  }, [tab, user]);

  // 加载历史身体洞察 / 冰箱洞察（与营养师同一套数据，按来源归类）
  useEffect(() => {
    if (tab === 'body' && bodyHistory === null) {
      void fetch('/api/insights/list?scope=body')
        .then((r) => r.json())
        .then((data: { insights?: Insight[] }) => setBodyHistory(data.insights ?? []))
        .catch(() => setBodyHistory([]));
    }
    if (tab === 'fridge' && fridgeHistory === null) {
      void fetch('/api/insights/list?scope=fridge')
        .then((r) => r.json())
        .then((data: { insights?: Insight[] }) => setFridgeHistory(data.insights ?? []))
        .catch(() => setFridgeHistory([]));
    }
  }, [tab, bodyHistory, fridgeHistory]);

  // 每日主动洞察：进入「今日」时若当天尚未生成，且已有身体数据，静默让 Agent 分析一次
  useEffect(() => {
    const hasBodyData = !!(bodyLatest && Object.keys(bodyLatest).length > 0);
    if (tab === 'today' && user && hasBodyData) {
      const today = todayStr();
      try {
        if (localStorage.getItem('dailyAnalyze') !== today) {
          localStorage.setItem('dailyAnalyze', today);
          void silentAnalyze('both', '每日例行洞察：基于当前身体数据与冰箱库存，主动发现健康或营养问题');
        }
      } catch { /* ignore */ }
    }
  }, [tab, user, bodyLatest]);

  // 加载历史洞察
  useEffect(() => {
    if (tab === 'coach' && user && savedInsights === null) {
      void fetch('/api/insights/list')
        .then((r) => r.json())
        .then((data: { insights?: Insight[] }) => setSavedInsights(data.insights ?? []))
        .catch(() => setSavedInsights([]));
    }
  }, [tab, user, savedInsights]);
  useEffect(() => {
    if (shoppingOpen && user) {
      void loadShoppingList();
    }
  }, [shoppingOpen, user]);

  // Load week data when plan tab opens
  useEffect(() => {
    if (tab === 'plan' && user && todayData?.hasPlan && !weeklyData) {
      void loadWeekData();
    }
  }, [tab, user, todayData?.hasPlan, weeklyData]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  // 加载/刷新轻断食状态
  async function loadFasting() {
    setFastingLoading(true);
    try {
      const r = await fetch('/api/fasting');
      const data = await r.json();
      if (r.ok) setFasting(data as FastingData);
    } catch { /* ignore */ } finally {
      setFastingLoading(false);
    }
  }

  async function fastingAction(action: 'start' | 'complete' | 'stop' | 'set-plan' | 'save-profile', payload?: Record<string, unknown>) {
    try {
      const r = await fetch('/api/fasting', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await r.json();
      if (r.ok) setFasting(data as FastingData);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if ((tab === 'fasting' || tab === 'today') && user && fasting === null) {
      void loadFasting();
    }
  }, [tab, user]);

  const tabItems: [Tab, string, typeof Home][] = [
    ['today', '今日', Home],
    ['plan', '计划', CalendarRange],
    ['coach', '营养师', Bot],
    ['fasting', '轻断食', Timer],
    ['fridge', '冰箱', Refrigerator],
    ['body', '身体', Activity],
  ];

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[var(--grouped-background)] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[var(--system-green)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--grouped-background)] text-[var(--label)] pb-[83px] md:pb-6">
      <div className="safe-top" />

      {/* Content */}
      <div className="hide-scrollbar">
        {tab === 'today' && (
          <TodayView
            user={user}
            todayData={todayData}
            loading={todayLoading}
            generating={generatingPlan}
            error={planError}
            fasting={fasting}
            onGoFasting={() => setTab('fasting')}
            onGenerate={generateWeeklyPlan}
            onPlan={() => setTab('plan')}
            onBody={() => setTab('body')}
            onProfile={() => setProfileOpen(true)}
            onShopping={() => setShoppingOpen(true)}
          />
        )}
        {tab === 'plan' && (
          <PlanView
            todayData={todayData}
            weeklyData={weeklyData}
            weeklyLoading={weeklyLoading}
            generating={generatingPlan}
            error={planError}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            onGenerate={generateWeeklyPlan}
            onSettings={() => setAiSettingsOpen(true)}
            onShopping={() => setShoppingOpen(true)}
          />
        )}
        {tab === 'coach' && (
          <>
            {savedInsights !== null && savedInsights.length > 0 && (
              !insightsOpen ? (
                <button
                  onClick={() => { if (fabMovedRef.current) return; setInsightsOpen(true); }}
                  onPointerDown={onFabPointerDown}
                  onPointerMove={onFabPointerMove}
                  onPointerUp={onFabPointerUp}
                  onPointerCancel={onFabPointerUp}
                  className={`fixed z-40 size-12 rounded-2xl bg-[var(--system-green)] text-white border border-white/40 flex items-center justify-center press-effect backdrop-blur-md select-none ${fabPos ? '' : 'right-4 top-[84px]'}`}
                  style={fabPos ? { left: fabPos.left, top: fabPos.top, touchAction: 'none' } : { touchAction: 'none' }}
                  aria-label="查看最近洞察"
                >
                  <Sparkles className="size-5" />
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--system-red)] text-white text-[11px] font-semibold flex items-center justify-center border-2 border-[var(--background)]">
                    {savedInsights.filter((i) => !i.readAt).length}
                  </span>
                </button>
              ) : (
                <div className="fixed right-4 top-[140px] z-40 w-[300px] max-h-[460px] flex flex-col rounded-2xl bg-[var(--ios-card)]/96 backdrop-blur-xl border border-[var(--separator)] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--separator)]">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-[var(--system-blue)]" />
                      <span className="text-[14px] font-semibold text-[var(--label)]">最近洞察</span>
                    </div>
                    <button
                      onClick={() => setInsightsOpen(false)}
                      className="size-7 rounded-full flex items-center justify-center text-[var(--secondary-label)] hover:text-[var(--label)] press-effect"
                      aria-label="最小化"
                    >
                      <Minus className="size-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {savedInsights.slice(0, 10).map((ins) => (
                      <div key={ins.id} className="rounded-xl px-3 py-2.5 bg-[var(--secondary-grouped-background)]">
                        <div className="flex items-center gap-1.5">
                          {ins.type === 'warning'
                            ? <AlertCircle className="size-3.5 text-[var(--system-red)] shrink-0" />
                            : ins.type === 'suggestion'
                              ? <Sparkles className="size-3.5 text-[var(--system-blue)] shrink-0" />
                              : <Info className="size-3.5 text-[var(--system-green)] shrink-0" />}
                          <p className="text-[13px] font-semibold text-[var(--label)] truncate">{ins.title}</p>
                        </div>
                        <p className="text-[12px] text-[var(--secondary-label)] leading-[17px] mt-1 line-clamp-3">{ins.content}</p>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => markInsightRead(ins.id)}
                            className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--system-gray5)] text-[var(--secondary-label)] press-effect"
                          >
                            已读
                          </button>
                          {(ins.type === 'suggestion' || ins.type === 'warning') && (
                            <button
                              onClick={() => handleInsightAction(ins.id, 'accept')}
                              className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--system-green)] text-white press-effect"
                            >
                              去调整
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
            <CoachChatView
            messages={chatMessages}
            input={chatInput}
            setInput={setChatInput}
            loading={chatLoading}
            onSend={sendChatMessage}
            onSettings={() => setAiSettingsOpen(true)}
            onGenerate={() => { setTab('plan'); void generateWeeklyPlan(); }}
            onConfirmAdjust={handleConfirmAdjust}
            onDismissAdjust={handleDismissAdjust}
            pendingAdjustment={pendingAdjustment}
            adjusting={adjusting}
            hasPlan={todayData?.hasPlan ?? false}
          />
          </>
        )}
        {tab === 'fridge' && (
          <FridgeView
            zones={zones}
            foods={foods}
            onSettings={() => setFridgeSettings(true)}
            onGenerate={() => { setTab('plan'); void generateWeeklyPlan(); }}
            onAgentAnalyze={() => triggerAgentAnalysis('fridge', '冰箱库存有更新')}
            agentAnalyzing={fridgeAnalyzing}
            agentResult={fridgeResult}
              historyInsights={fridgeHistory ?? []}
            onInsightRead={markInsightRead}
            onInsightAction={handleInsightAction}
            onAddFood={addFood}
          />
        )}
        {tab === 'fasting' && (
          <FastingView
            fasting={fasting}
            loading={fastingLoading}
            onAction={fastingAction}
            onGoToday={() => setTab('today')}
          />
        )}
        {tab === 'body' && (
          <BodyView
            onGenerate={() => { setTab('plan'); void generateWeeklyPlan(); }}
            onAgentAnalyze={() => triggerAgentAnalysis('body', '身体数据有更新')}
            agentAnalyzing={bodyAnalyzing}
            agentResult={bodyResult}
            historyInsights={bodyHistory ?? []}
            onInsightRead={markInsightRead}
            onInsightAction={handleInsightAction}
            onBodySaved={() => { void loadFasting(); loadBodyLatest(); }}
            sex={fasting?.profile?.sex ?? null}
          />
        )}
      </div>

      {/* iOS Tab Bar */}
      <nav className="ios-tab-bar">
        <div className="max-w-2xl mx-auto flex justify-around items-center h-[49px]">
          {tabItems.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`ios-tab-item press-effect flex-1 max-w-[80px] ${tab === id ? 'active' : ''}`}
            >
              <Icon className="size-[22px] md:size-[24px]" strokeWidth={tab === id ? 2.5 : 1.8} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Fridge Settings Sheet */}
      <Sheet open={fridgeSettings} onClose={() => setFridgeSettings(false)} title="设置冰箱容量与分区">
        <div className="px-4 pb-4 space-y-4">
          <p className="text-[13px] text-[var(--secondary-label)] leading-[18px]">
            容量用升（L）记录。每种食材也会估算占用体积，用于判断采购能否放得下。
          </p>

          <div className="space-y-3">
            {zones.map((zone) => (
              <div key={zone.id} className="bg-[var(--system-gray6)] rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-[15px] font-medium">{zone.name}</p>
                    <p className="text-[13px] text-[var(--secondary-label)]">{zone.type} · 当前约 {zone.used} L</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-[var(--secondary-label)] whitespace-nowrap">总容量</span>
                  <input
                    type="number"
                    min="1"
                    value={zone.capacity}
                    onChange={(e) => setZones((all) => all.map((z) => z.id === zone.id ? { ...z, capacity: Number(e.target.value) } : z))}
                    className="ios-input flex-1 text-right"
                  />
                  <span className="text-[13px] text-[var(--secondary-label)] whitespace-nowrap">L</span>
                </div>
              </div>
            ))}
          </div>

          <button
            className="ios-button w-full bg-[var(--system-green)] text-white"
            onClick={() => setFridgeSettings(false)}
          >
            保存容量设置
          </button>
        </div>
      </Sheet>

      {/* AI Settings Sheet */}
      <Sheet open={aiSettingsOpen} onClose={() => setAiSettingsOpen(false)} title="AI 服务设置">
        <div className="px-4 pb-4 space-y-4">
          <p className="text-[13px] text-[var(--secondary-label)] leading-[18px]">
            配置只属于你的模型服务。密钥通过 HTTPS 发送，并在服务端加密保存；页面不会再次显示密钥。
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-[13px] text-[var(--secondary-label)] mb-1.5 block">API 接口</label>
              <input value={aiEndpoint} onChange={(e) => setAiEndpoint(e.target.value)} className="ios-input" />
            </div>
            <div>
              <label className="text-[13px] text-[var(--secondary-label)] mb-1.5 block">模型名称</label>
              <input value={aiModel} onChange={(e) => setAiModel(e.target.value)} className="ios-input" />
            </div>
            <div>
              <label className="text-[13px] text-[var(--secondary-label)] mb-1.5 block">API Key</label>
              <input type="password" autoComplete="off" value={aiKey} onChange={(e) => setAiKey(e.target.value)} placeholder="输入你的新密钥" className="ios-input" />
            </div>
          </div>

          <div className="bg-[var(--system-gray6)] rounded-xl p-3 text-[12px] leading-[18px] text-[var(--secondary-label)]">
            请使用新密钥。曾经发到聊天里的旧密钥应当撤销。
          </div>

          <button
            className="ios-button w-full bg-[var(--system-green)] text-white disabled:opacity-50"
            disabled={!aiKey.trim() || aiSaving}
            onClick={() => void saveAiConfig()}
          >
            {aiSaved ? '已安全保存' : aiSaving ? '正在加密保存…' : '保存并启用 AI 营养师'}
          </button>
        </div>
      </Sheet>

      {/* Shopping List Sheet */}
      <Sheet open={shoppingOpen} onClose={() => setShoppingOpen(false)} title="采购清单">
        <div className="px-4 pb-4">
          {shoppingLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="size-6 animate-spin text-[var(--system-green)] mx-auto" />
              <p className="text-[14px] text-[var(--secondary-label)] mt-3">加载中…</p>
            </div>
          ) : shoppingItems.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingCart className="size-12 text-[var(--tertiary-label)] mx-auto" />
              <p className="text-[15px] font-medium mt-4">还没有采购清单</p>
              <p className="text-[13px] text-[var(--secondary-label)] mt-1">生成周计划后，AI 会自动列出需要购买的食材</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-[13px] text-[var(--secondary-label)]">
                  共 {shoppingItems.length} 项 · 已买 {shoppingItems.filter((i) => i.purchased).length} 项
                </p>
                {shoppingItems.some((i) => i.purchased) && (
                  <button
                    onClick={() => {
                      // Quick add all purchased to fridge
                      const purchased = shoppingItems.filter((i) => i.purchased);
                      purchased.forEach((p) => addFood({ name: p.name, amount: p.amount, zone: '冷藏', days: 5 }));
                      alert(`已将 ${purchased.length} 项食材添加到冰箱 🎉`);
                    }}
                    className="text-[12px] font-medium text-[var(--system-green)] flex items-center gap-1"
                  >
                    <Plus className="size-3.5" />
                    全部入冰箱
                  </button>
                )}
              </div>
              <div className="bg-[var(--secondary-grouped-background)] rounded-2xl overflow-hidden">
                {shoppingItems.map((item, i) => (
                  <div
                    key={item.id}
                    className={`${i !== shoppingItems.length - 1 ? 'border-b border-[var(--separator)]' : ''}`}
                  >
                    <button
                      onClick={() => toggleShoppingItem(item.id!, !item.purchased)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left press-effect"
                    >
                      <div className={`size-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                        item.purchased
                          ? 'bg-[var(--system-green)] border-[var(--system-green)]'
                          : 'border-[var(--system-gray4)]'
                      }`}>
                        {item.purchased && (
                          <svg className="size-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[15px] font-medium ${item.purchased ? 'text-[var(--tertiary-label)] line-through' : ''}`}>
                          {item.name}
                        </p>
                        <p className="text-[12px] text-[var(--secondary-label)] mt-0.5">
                          {item.amount}
                          {item.reason && ` · ${item.reason}`}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-[var(--tertiary-label)] shrink-0" />
                    </button>
                    {item.purchased && (
                      <div className="px-4 pb-3 flex gap-2">
                        <button
                          onClick={() => { setQtyAmount(item.amount); setQtyItem({ name: item.name, amount: item.amount }); }}
                          className="flex-1 text-[12px] py-2 rounded-lg bg-[var(--system-green)]/10 text-[var(--system-green)] font-medium press-effect flex items-center justify-center gap-1"
                        >
                          <Plus className="size-3.5" />
                          入冰箱
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex gap-2.5 p-3 bg-[var(--system-blue)]/5 border border-[var(--system-blue)]/20 rounded-2xl">
                  <Info className="size-4 text-[var(--system-blue)] shrink-0 mt-0.5" />
                  <div className="text-[12px] leading-[18px] text-[var(--secondary-label)]">
                    <p className="font-medium text-[var(--label)] mb-0.5">采购小贴士</p>
                    <p>• 在超市：点击打勾快速标记已买</p>
                    <p>• 回到家：点「入冰箱」确认实际数量后入库</p>
                    <p>• 买多买少都可以调整，AI 会自动更新后续计划</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Sheet>

      {/* 入冰箱数量确认 */}
      <Sheet open={!!qtyItem} onClose={() => setQtyItem(null)} title="入冰箱 · 选择分区">
        <div className="px-4 pb-6 space-y-4">
          <p className="text-[13px] text-[var(--secondary-label)] -mt-1">放入 {qtyItem?.name} 到哪个分区？可确认实际购买数量</p>

          <div className="bg-[var(--secondary-grouped-background)] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--separator)]">
              <span className="text-[14px] text-[var(--label)] w-16 shrink-0">分区</span>
              <div className="flex-1 flex gap-2">
                {['冷藏', '冷冻'].map((z) => (
                  <button
                    key={z}
                    onClick={() => setQtyZone(z)}
                    className={`flex-1 h-9 rounded-xl text-[14px] font-medium press-effect ${
                      qtyZone === z
                        ? 'bg-[var(--system-green)] text-white'
                        : 'bg-[var(--system-gray5)] text-[var(--secondary-label)]'
                    }`}
                  >
                    {z === '冷藏' ? '🧊 冷藏' : '❄️ 冷冻'}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-[14px] text-[var(--label)] w-16 shrink-0">数量</span>
              <input
                autoFocus
                value={qtyAmount}
                onChange={(e) => setQtyAmount(e.target.value)}
                placeholder="如：500g"
                className="flex-1 min-w-0 bg-transparent text-[16px] text-[var(--label)] placeholder:text-[var(--tertiary-label)] outline-none text-right"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setQtyItem(null)}
              className="h-12 rounded-2xl bg-[var(--secondary-grouped-background)] text-[var(--secondary-label)] text-[15px] font-semibold press-effect"
            >
              取消
            </button>
            <button
              onClick={() => {
                if (qtyItem) addFood({ name: qtyItem.name, amount: (qtyAmount || qtyItem.amount), zone: qtyZone, days: 5 });
                setQtyItem(null);
              }}
              className="h-12 rounded-2xl bg-[var(--system-green)] text-white text-[15px] font-semibold press-effect"
            >
              确认入库
            </button>
          </div>
        </div>
      </Sheet>

      {/* Profile Sheet */}
      <Sheet open={profileOpen} onClose={() => setProfileOpen(false)} title="个人中心">
        <div className="px-4 pb-4 space-y-4">
          <div className="flex items-center gap-3 py-2">
            <div className="size-14 rounded-full bg-[var(--system-green)] text-white flex items-center justify-center">
              <User className="size-7" />
            </div>
            <div>
              <p className="text-[17px] font-semibold">{user.nickname || '轻养用户'}</p>
              <p className="text-[13px] text-[var(--secondary-label)]">{user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</p>
            </div>
          </div>

          <div className="bg-[var(--secondary-grouped-background)] rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3.5 border-b border-[var(--separator)] press-effect"
              onClick={() => { setProfileOpen(false); setAiSettingsOpen(true); }}
            >
              <span className="text-[15px]">AI 服务设置</span>
              <ChevronRight className="size-5 text-[var(--tertiary-label)]" />
            </button>
            <Link href="/evaluation" className="w-full flex items-center justify-between px-4 py-3.5 border-b border-[var(--separator)] press-effect">
              <span className="text-[15px]">AI 评测中心</span>
              <ChevronRight className="size-5 text-[var(--tertiary-label)]" />
            </Link>
            <button className="w-full flex items-center justify-between px-4 py-3.5 press-effect">
              <span className="text-[15px]">关于轻养</span>
              <ChevronRight className="size-5 text-[var(--tertiary-label)]" />
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="ios-button w-full bg-[var(--system-red)]/10 text-[var(--system-red)]"
          >
            <LogOut className="size-4" />
            退出登录
          </button>
        </div>
      </Sheet>

      {/* Adjust-from-insight confirm sheet */}
      <Sheet
        open={adjust !== null}
        onClose={closeAdjustSheet}
        title={adjustStep === 'preview' ? '确认调整方案' : '确认调整'}
      >
        <div className="px-4 pb-6 space-y-4">
          {adjust && (
            <div className="flex gap-3 items-start rounded-2xl bg-[var(--system-green)]/8 border border-[var(--system-green)]/15 p-3">
              <div className="size-9 rounded-xl bg-[var(--system-green)]/15 flex items-center justify-center shrink-0">
                <Sparkles className="size-4 text-[var(--system-green)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[var(--label)]">{adjust.title}</p>
                <p className="text-[12px] text-[var(--secondary-label)] leading-[18px] mt-0.5 line-clamp-2">{adjust.content}</p>
              </div>
            </div>
          )}

          {adjustStep === 'preview' && adjustPreview ? (
            <>
              {adjustPreview.reason && (
                <p className="text-[12px] text-[var(--secondary-label)] leading-[18px] flex gap-1.5">
                  <Sparkles className="size-4 shrink-0 text-[var(--system-green)]" />
                  <span>这次主要：{adjustPreview.reason}</span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-[var(--system-gray6)] p-3 text-center">
                  <p className="text-[17px] font-bold text-[var(--label)]">{adjustPreview.calories ?? 0}</p>
                  <p className="text-[11px] text-[var(--secondary-label)] mt-0.5">kcal · 总热量</p>
                </div>
                <div className="rounded-xl bg-[var(--system-gray6)] p-3 text-center">
                  <p className="text-[17px] font-bold text-[var(--label)]">{adjustPreview.protein ?? 0}g</p>
                  <p className="text-[11px] text-[var(--secondary-label)] mt-0.5">蛋白质</p>
                </div>
              </div>
              {Object.entries(adjustPreview.meals || {}).map(([key, dishes]) => {
                const mealDot = { breakfast: 'var(--system-orange)', lunch: 'var(--system-blue)', dinner: 'var(--system-indigo)' } as Record<string, string>;
                const mealLab = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' } as Record<string, string>;
                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="size-2 rounded-full" style={{ backgroundColor: mealDot[key] || 'var(--system-gray)' }} />
                      <span className="text-[13px] font-semibold text-[var(--label)]">{mealLab[key] || key}</span>
                    </div>
                    <div className="space-y-1.5">
                      {dishes.map((dish, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--secondary-fill)]">
                          <span className="text-[13px] font-medium text-[var(--label)]">{dish.name || '菜名'}</span>
                          <span className="text-[11px] text-[var(--secondary-label)] whitespace-nowrap">{dish.calories ? `${dish.calories} kcal` : ''}{dish.protein ? ` · ${dish.protein}g` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="flex gap-2.5 pt-1">
                <button onClick={handleBackToAdjustForm} disabled={adjusting} className="ios-button flex-1 bg-[var(--system-gray5)] text-[var(--label)] disabled:opacity-50">
                  返回修改
                </button>
                <button onClick={() => void handleApplyAdjustPreview()} disabled={adjusting} className="ios-button flex-1 bg-[var(--system-green)] text-white disabled:opacity-60">
                  {adjusting ? '应用中…' : '应用调整'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[13px] text-[var(--secondary-label)]">调整到什么时候</p>
              <div className="ios-seg">
                {['今天', '明天', '本周'].map((t) => (
                  <button key={t} onClick={() => setAdjustTarget(t)} className={`ios-seg-item ${adjustTarget === t ? 'active' : ''}`}>
                    {t}
                  </button>
                ))}
              </div>

              <p className="text-[13px] text-[var(--secondary-label)]">补充想法（可选）</p>
              <textarea
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="比如：中午想吃清淡点、晚上别吃碳水"
                rows={3}
                className="ios-input w-full resize-none"
                style={{ height: 'auto', minHeight: '78px', padding: '10px 12px', fontSize: '15px', lineHeight: '21px' }}
              />

              <div className="flex gap-2.5 pt-1">
                <button onClick={closeAdjustSheet} disabled={adjusting} className="ios-button flex-1 bg-[var(--system-gray5)] text-[var(--label)] disabled:opacity-50">
                  取消
                </button>
                <button onClick={() => void handleGenerateAdjustPreview()} disabled={adjusting} className="ios-button flex-1 bg-[var(--system-green)] text-white disabled:opacity-60">
                  {adjusting ? '生成中…' : '生成方案'}
                </button>
              </div>
            </>
          )}
        </div>
      </Sheet>
    </div>
  );
}

/* ==================== Fasting View ==================== */

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
          {screens.map(([key, label, severe]) => (
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

function FastingView({
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

/* ==================== Today View ==================== */

function TodayView({
  user, todayData, loading, generating, error, fasting, onGoFasting, onGenerate, onPlan, onBody, onProfile, onShopping,
}: {
  user: AuthUser;
  todayData: TodayData | null;
  loading: boolean;
  generating: boolean;
  error: string;
  fasting: FastingData | null;
  onGoFasting: () => void;
  onGenerate: () => void;
  onPlan: () => void;
  onBody: () => void;
  onProfile: () => void;
  onShopping: () => void;
}) {
  const today = new Date();
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][today.getDay()];
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日`;

  const meals = todayData?.today.meals || {};
  const hasPlan = todayData?.hasPlan;
  const [openSteps, setOpenSteps] = useState<string>('');
  const [openIngredients, setOpenIngredients] = useState<string>('');

  return (
    <div className="max-w-2xl mx-auto px-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between pt-2 pb-4">
        <div>
          <p className="text-[13px] text-[var(--secondary-label)]">
            {weekday} · {dateStr}
          </p>
          <h1 className="text-large-title">你好，{user.nickname || '轻养用户'}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={onProfile} className="size-10 rounded-full bg-[var(--system-green)]/10 text-[var(--system-green)] flex items-center justify-center press-effect">
            <User className="size-5" />
          </button>
        </div>
      </div>

      {/* 轻断食状态条 */}
      {fasting && (
        <button
          onClick={onGoFasting}
          className="mb-5 w-full flex items-center gap-3 rounded-2xl bg-[var(--secondary-grouped-background)] p-3.5 press-effect text-left"
        >
          <div className="size-10 rounded-xl bg-[var(--system-orange)]/15 flex items-center justify-center shrink-0">
            <Timer className="size-5 text-[var(--system-orange)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-[var(--label)]">
              {fasting.active
                ? `轻断食进行中 · 已坚持 ${Math.floor(fasting.elapsedMinutes / 60)} 小时 ${fasting.elapsedMinutes % 60} 分`
                : fasting.todayCompleted
                  ? `今日已打卡 · 实际禁食 ${Math.round(fasting.todayFastHours * 60) >= 60 ? `${Math.floor(fasting.todayFastHours)} 小时` : `${Math.round(fasting.todayFastHours * 60)} 分钟`}`
                  : `轻断食 · ${fasting.planHours}:${24 - fasting.planHours} 方案`}
            </p>
            <p className="text-[12px] text-[var(--secondary-label)] truncate">
              进食窗口 {fasting.mealGuide.windowStart}–{fasting.mealGuide.windowEnd}{fasting.streak > 0 ? ` · 🔥 连续 ${fasting.streak} 天` : ''}
            </p>
          </div>
          <ChevronRight className="size-5 text-[var(--tertiary-label)] shrink-0" />
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-[var(--secondary-grouped-background)] rounded-2xl p-8 text-center mb-5">
          <Loader2 className="size-6 animate-spin text-[var(--system-green)] mx-auto" />
          <p className="text-[14px] text-[var(--secondary-label)] mt-3">加载中…</p>
        </div>
      )}

      {/* No plan yet */}
      {!loading && !hasPlan && (
        <div className="rounded-2xl bg-[#F0FDF4] p-6 text-[var(--label)] mb-5 border border-[#DCFCE7]">
          <Zap className="size-9" />
          <h2 className="text-[22px] font-bold mt-4">还没有本周计划</h2>
          <p className="mt-2 text-[14px] leading-[22px] text-[var(--secondary-label)]">
            AI 营养师会根据你的身体数据和冰箱库存，生成整周食谱和采购清单。
          </p>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="mt-5 w-full h-11 rounded-xl bg-[var(--system-green)] text-white font-semibold flex items-center justify-center gap-2 press-effect disabled:opacity-50"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating ? '生成中…' : '生成本周计划'}
          </button>
          {error && (
            <p className="mt-3 text-[12px] text-[var(--system-red)]">{error}</p>
          )}
        </div>
      )}

      {/* Plan exists: today's summary */}
      {!loading && hasPlan && todayData && (
        <>
          {/* Calories Ring Card */}
          <div className="bg-gradient-to-br from-[#22C55E] via-[#4ADE80] to-[#16A34A] rounded-2xl p-5 text-white mb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[13px] text-white/80">今日摄入</p>
                <p className="text-[34px] font-bold tracking-tight mt-1">
                  {todayData.today.calories || '—'} <span className="text-[17px] font-normal">kcal</span>
                </p>
              </div>
              <button onClick={onPlan} className="bg-white/20 rounded-full px-3 py-1.5 text-[12px] font-medium press-effect flex items-center gap-1">
                周计划
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="mt-4 flex gap-4">
              <div>
                <p className="text-[12px] text-white/70">蛋白质</p>
                <p className="text-[18px] font-semibold mt-0.5">{todayData.today.protein || 0}g</p>
              </div>
              <div>
                <p className="text-[12px] text-white/70">目标</p>
                <p className="text-[18px] font-semibold mt-0.5">{todayData.plan?.targetCalories || '—'} kcal</p>
              </div>
            </div>
          </div>

          {/* Today's Meals */}
          <SectionTitle eyebrow="今日餐桌" title="三餐安排" action="查看全部" onAction={onPlan} />

          <div className="space-y-3 mb-5">
            {(['breakfast', 'lunch', 'dinner'] as const).map((mealType) => {
              const dishes = meals[mealType] || [];
              const mealCal = dishes.reduce((s, d) => s + (d.calories || 0), 0);
              const mealProtein = dishes.reduce((s, d) => s + (d.protein || 0), 0);
              const labels: Record<string, [string, string]> = {
                breakfast: ['🌅', '早餐'],
                lunch: ['☀️', '午餐'],
                dinner: ['🌙', '晚餐'],
              };
              const [icon, label] = labels[mealType];

              return (
                <div key={mealType} className="bg-[var(--secondary-grouped-background)] rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--separator)]">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{icon}</span>
                      <h3 className="text-[15px] font-semibold">{label}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-semibold text-[var(--system-green)]">{mealCal} kcal</p>
                      <p className="text-[11px] text-[var(--secondary-label)]">蛋白 {mealProtein}g</p>
                    </div>
                  </div>
                  {dishes.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[13px] text-[var(--secondary-label)]">
                      还没有安排
                    </div>
                  ) : (
                    dishes.map((dish, i) => {
                      const dishKey = `${mealType}-${i}`;
                      const isOpen = openSteps === dishKey;
                      const hasSteps = dish.steps && dish.steps.length > 0;
                      const ingAll = dish.ingredients.length > 4;
                      const ingExpanded = openIngredients === dishKey;
                      const visibleIngredients = ingAll && !ingExpanded ? dish.ingredients.slice(0, 4) : dish.ingredients;
                      return (
                        <div key={dish.id || dishKey} className={`px-4 py-3 ${i !== dishes.length - 1 ? 'border-b border-[var(--separator)]' : ''}`}>
                          <div className="flex items-start justify-between">
                            <p className="text-[14px] font-medium">{dish.name || dish.dishName || '未命名菜品'}</p>
                            <span className="text-[11px] text-[var(--secondary-label)] shrink-0 ml-2">
                              {dish.calories} kcal
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {visibleIngredients.map((ing) => (
                              <span
                                key={ing.name}
                                className={`text-[10px] px-2 py-0.5 rounded-full ${
                                  ing.fromFridge
                                    ? 'bg-[var(--system-green)]/10 text-[var(--system-green)]'
                                    : 'bg-[var(--system-gray5)] text-[var(--secondary-label)]'
                                }`}
                              >
                                {ing.fromFridge && '🧊 '}{ing.name}
                              </span>
                            ))}
                            {ingAll && (
                              <button
                                onClick={() => setOpenIngredients(ingExpanded ? '' : dishKey)}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--system-gray4)] text-[var(--secondary-label)] press-effect"
                              >
                                {ingExpanded ? '收起' : `+${dish.ingredients.length - 4}`}
                              </button>
                            )}
                          </div>
                          {hasSteps ? (
                            <button
                              onClick={() => setOpenSteps(isOpen ? '' : dishKey)}
                              className="mt-2.5 text-[12px] font-medium text-[var(--system-green)] press-effect flex items-center gap-1"
                            >
                              {isOpen ? '收起做法' : '查看做法'}
                              <ChevronDown className={`size-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                          ) : (
                            <button
                              onClick={() => setOpenSteps(isOpen ? '' : dishKey)}
                              className="mt-2.5 text-[12px] font-medium text-[var(--system-blue)] press-effect flex items-center gap-1"
                            >
                              {isOpen ? '收起' : '查看做法'}
                              <ChevronDown className={`size-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                          )}
                          {isOpen && (
                            <div className="mt-3 pt-3 border-t border-[var(--separator)]">
                              <a
                                href={`https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(`${dish.name} 家常做法`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mb-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--tertiary-label)] press-effect"
                              >
                                <span className="text-[12px]">📕</span>
                                到小红书搜「{dish.name}」做法
                              </a>
                              {hasSteps ? (
                                <ol className="space-y-2">
                                  {dish.steps!.map((step, si) => (
                                    <li key={si} className="flex gap-2.5 text-[13px] leading-[20px]">
                                      <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--system-green)]/10 text-[var(--system-green)] text-[11px] font-semibold flex items-center justify-center mt-0.5">
                                        {si + 1}
                                      </span>
                                      <span className="text-[var(--label)]">{step}</span>
                                    </li>
                                  ))}
                                </ol>
                              ) : (
                                <p className="text-[13px] text-[var(--secondary-label)]">
                                  这道菜还没有做法记录，点右侧「重新生成」让 AI 补充详细做法。
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              onClick={onShopping}
              className="bg-[var(--secondary-grouped-background)] rounded-2xl p-4 text-left press-effect"
            >
              <ShoppingCart className="size-6 text-[var(--system-orange)]" />
              <p className="text-[14px] font-semibold mt-3">采购清单</p>
              <p className="text-[11px] text-[var(--secondary-label)] mt-1">本周要买的食材</p>
            </button>
            <button
              onClick={onGenerate}
              disabled={generating}
              className="bg-[var(--secondary-grouped-background)] rounded-2xl p-4 text-left press-effect disabled:opacity-50"
            >
              <Sparkles className="size-6 text-[var(--system-green)]" />
              <p className="text-[14px] font-semibold mt-3">重新生成</p>
              <p className="text-[11px] text-[var(--secondary-label)] mt-1">调整目标或偏好</p>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ==================== Body View ==================== */

function BodyView({ onGenerate, onAgentAnalyze, agentAnalyzing, agentResult, historyInsights, onInsightRead, onInsightAction, onBodySaved, sex }: {
  onGenerate: () => void;
  onAgentAnalyze: () => void;
  agentAnalyzing: boolean;
  agentResult: { success: boolean; count?: number; message?: string; insights?: Insight[] } | null;
  historyInsights: Insight[];
  onInsightRead: (id: number) => void;
  onInsightAction: (id: number, action: 'accept' | 'dismiss') => void;
  onBodySaved?: () => void;
  sex?: 'male' | 'female' | null;
}) {
  const [selMetric, setSelMetric] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState<'manual' | 'image'>('manual');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastImage, setLastImage] = useState<string | null>(null);
  const [upMsg, setUpMsg] = useState('');
  const [manualBody, setManualBody] = useState<Record<string, string>>({});
  const [bodyData, setBodyData] = useState<Record<string, string> | null>(null);
  const [bodyUpdatedAt, setBodyUpdatedAt] = useState<string | null>(null);

  async function loadBody() {
    try {
      const res = await fetch('/api/body');
      if (res.ok) {
        const data = await res.json() as { metrics: Record<string, string> | null; measuredAt: string | null };
        setBodyData(data.metrics);
        setBodyUpdatedAt(data.measuredAt);
      }
    } catch { /* 忽略加载失败 */ }
  }

  useEffect(() => { void loadBody(); }, []);

  async function saveBody() {
    setSaving(true);
    setUpMsg('');
    const filled: Record<string, string> = {};
    for (const [k, v] of Object.entries(manualBody)) {
      if (String(v).trim() !== '') filled[k] = String(v).trim();
    }
    try {
      const res = await fetch('/api/body', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ metrics: filled }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (res.ok) {
        setUpMsg(data.message || '已保存');
        await loadBody();
        onBodySaved?.();
        onAgentAnalyze();
      } else {
        setUpMsg(data.error || '保存失败，请重试');
      }
    } catch {
      setUpMsg('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  async function parseImage(dataUrl: string) {
    setParsing(true);
    setUpMsg('');
    try {
      const res = await fetch('/api/body/parse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json() as { metrics?: Record<string, string>; error?: string; message?: string };
      if (data.metrics && Object.keys(data.metrics).length) {
        const n = Object.keys(data.metrics).length;
        setManualBody((prev) => ({ ...prev, ...data.metrics }));
        setUploadTab('manual');
        setUpMsg(`AI 已识别 ${n} 项指标，已填入下方表单，请核对并按需更正后再保存`);
        setLastImage(null);
      } else {
        setUpMsg(data.error || '解析失败，请换张清晰的截图或手动填写');
        setLastImage(dataUrl);
      }
    } catch {
      setUpMsg('解析失败，请换张清晰的截图或手动填写');
      setLastImage(dataUrl);
    } finally {
      setParsing(false);
    }
  }

  // 取某指标的最新真实值（无数据时返回空串，绝不回退到示例值）
  const val = (k: string) => manualBody[k] ?? bodyData?.[k] ?? '';

  return (
    <div className="max-w-2xl mx-auto px-4 pb-6">
      <div className="pt-2 pb-4">
        <h1 className="text-large-title">身体数据</h1>
        {bodyUpdatedAt && (
          <p className="mt-1 text-[12px] text-[var(--tertiary-label)]">数据更新于 {fmtDateTime(bodyUpdatedAt)}</p>
        )}
      </div>

      {/* 历史身体洞察（来自小养主动发现，与营养师同步） */}
      {historyInsights.length > 0 && (
        <div className="mb-4">
          <p className="text-[13px] font-semibold text-[var(--secondary-label)] mb-2 flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-[var(--system-blue)] shrink-0" /> 小养的身体洞察
            <span className="ml-1 flex-1 text-[12px] font-medium text-[var(--secondary-label)] truncate">
              {historyInsights.find((i) => i.type === 'observation')?.title || '记得固定时间称体脂，小养才更懂你'}
              <span className="text-[var(--system-pink)]"> ♥</span>
            </span>
          </p>
          <div className="space-y-2">
            {historyInsights.filter((i) => i.type !== 'observation').slice(0, 6).map((ins) => {
              const open = expanded === ins.id;
              return (
                <button
                  key={ins.id}
                  onClick={() => setExpanded(open ? null : ins.id)}
                  className={`w-full text-left rounded-2xl px-4 py-3 press-effect ${
                    ins.type === 'warning'
                      ? 'bg-[var(--system-red)]/8 border border-[var(--system-red)]/18'
                      : 'bg-[var(--secondary-grouped-background)]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {ins.type === 'warning' ? (
                      <AlertCircle className="size-4 text-[var(--system-red)] shrink-0" />
                    ) : (
                      <Sparkles className="size-4 text-[var(--system-blue)] shrink-0" />
                    )}
                    <span className="flex-1 text-[13px] font-semibold leading-[18px] text-[var(--label)] break-words">{ins.title}</span>
                    <ChevronDown className={`size-4 text-[var(--tertiary-label)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </span>
                  {open && (
                    <span className="block mt-2">
                      <span className="block text-[12px] text-[var(--secondary-label)] leading-[18px] break-words">{ins.content}</span>
                      <span className="flex gap-2 mt-2.5">
                        <span
                          onClick={(e) => { e.stopPropagation(); onInsightRead(ins.id); }}
                          className="px-3 py-1.5 h-[30px] rounded-full text-[12px] font-medium bg-[var(--system-gray5)] text-[var(--secondary-label)] press-effect cursor-pointer"
                        >
                          已读
                        </span>
                        <span
                          onClick={(e) => { e.stopPropagation(); onInsightAction(ins.id, 'accept'); }}
                          className="px-3 py-1.5 h-[30px] rounded-full text-[12px] font-semibold bg-[var(--system-green)] text-white press-effect cursor-pointer"
                        >
                          去调整
                        </span>
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Analysis Result */}
      {agentResult && (
        <div className={`mb-4 rounded-2xl p-3 flex items-start gap-3 ${
          agentResult.success
            ? 'bg-[var(--system-green)]/10 border border-[var(--system-green)]/20'
            : 'bg-[var(--system-orange)]/10 border border-[var(--system-orange)]/20'
        }`}>
          {agentResult.success ? (
            <Sparkles className="size-5 text-[var(--system-green)] shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="size-5 text-[var(--system-orange)] shrink-0 mt-0.5" />
          )}
          <p className="text-[12px] leading-[18px] text-[var(--secondary-label)]">
            {agentResult.message}
          </p>
        </div>
      )}

      {/* 就地建议卡片 end（历史洞察区已承载，且分析后自动刷新，避免重复） */}

      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          className="ios-button bg-[var(--secondary-grouped-background)] text-[var(--label)]"
          onClick={onAgentAnalyze}
          disabled={agentAnalyzing}
        >
          {agentAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          {agentAnalyzing ? 'AI 分析中…' : 'AI 分析数据'}
        </button>
        <button
          className="ios-button bg-[var(--system-green)] text-white"
          onClick={onGenerate}
        >
          <Sparkles className="size-4" />
          生成周计划
        </button>
      </div>

      {/* 上传数据 */}
      <button
        onClick={() => setUploadOpen(true)}
        className="ios-button w-full mb-5 bg-[var(--system-blue)]/5 border border-[var(--system-blue)]/20 text-[var(--system-blue)]"
      >
        <Upload className="size-4" />
        上传数据（手动填写 / 图片解析）
      </button>

      {/* AI Agent Status */}
      <div className="mb-5 bg-[var(--system-blue)]/5 border border-[var(--system-blue)]/20 rounded-2xl p-3 flex items-center gap-3">
        <div className="relative">
          <Bot className="size-5 text-[var(--system-blue)]" />
          <span className="absolute -top-0.5 -right-0.5 size-2 bg-[var(--system-green)] rounded-full animate-pulse" />
        </div>
        <p className="text-[12px] text-[var(--secondary-label)] leading-[18px]">
          AI 主动洞察：身体数据更新后分析变化，建议经你确认后再使用。
        </p>
      </div>

      {/* 体重总览（基于最新真实身体数据，无示例值） */}
      <div className="mb-5 bg-[#F0FDF4] border border-[#DCFCE7] rounded-2xl p-5">
        <p className="text-[13px] text-[var(--secondary-label)]">当前体重</p>
        <p className="text-[36px] font-bold tracking-tight mt-1">
          {val('体重') || '—'}
          <span className="text-[14px] font-normal ml-1 text-[var(--secondary-label)]">kg</span>
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniStat light label="体脂率" value={val('体脂率') ? `${val('体脂率')}%` : '—'} />
          <MiniStat light label="肌肉量" value={val('肌肉量') ? `${val('肌肉量')}kg` : '—'} />
          <MiniStat light label="内脏脂肪" value={val('内脏脂肪') || '—'} />
        </div>
      </div>

      {/* Metrics Grid */}
      <SectionTitle eyebrow="全部指标" title="详细数据" />
      <div className="grid grid-cols-2 gap-3 mb-5 md:grid-cols-3 lg:grid-cols-6">
        {metrics.map(([name, value, unit]) => {
          const shown = manualBody[name] ?? bodyData?.[name] ?? value;
          const num = parseFloat(shown);
          const loc = locateZone(STANDARDS[name], sex, isFinite(num) ? num : null);
          return (
            <button key={name} onClick={() => setSelMetric(name)} className="text-left press-effect">
              <MetricCard name={name} value={shown} unit={unit} note={zoneNote(loc.zone)} noteColor={loc.zone?.color ?? null} level={loc.zone?.label ?? null} levelColor={loc.zone?.color ?? null} />
            </button>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="flex gap-3 p-4 bg-[var(--secondary-grouped-background)] rounded-2xl text-[13px] leading-[18px] text-[var(--secondary-label)]">
        <Info className="size-5 shrink-0 text-[var(--system-blue)] mt-0.5" />
        <p>体脂秤使用生物电阻抗估算；饮水、进食、运动、经期都会改变结果。建议每天在相似条件下测量。标准区间为常见健康参考，不构成医疗建议。</p>
      </div>

      {/* 指标详情（科学分级区间 + 我的位置） */}
      {(() => {
        if (!selMetric) return null;
        const m = metrics.find(([n]) => n === selMetric);
        if (!m) return null;
        const [name, , unit] = m;
        const value = (manualBody[name] ?? bodyData?.[name] ?? '') as string;
        const displayValue = value !== '' ? value : '—';
        const std = STANDARDS[name];
        const num = parseFloat(value);
        const zones = resolveZones(std, sex);
        const located = locateZone(std, sex, isFinite(num) ? num : null);
        return (
          <Sheet open onClose={() => setSelMetric(null)} title={name}>
            <div className="px-5 pb-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[13px] text-[var(--secondary-label)]">你的当前值</p>
                  <p className="mt-1 text-[40px] font-bold tracking-tight text-[var(--label)]">
                    {displayValue}<span className="ml-1 text-[18px] font-medium text-[var(--secondary-label)]">{unit}</span>
                  </p>
                </div>
                {located.zone && (
                  <span
                    className="px-3 py-1 rounded-full text-[12px] font-semibold"
                    style={{ backgroundColor: `${located.zone.color}1f`, color: located.zone.color }}
                  >
                    {located.zone.label}
                  </span>
                )}
              </div>

              {zones && zones.length > 1 && (
                <div className="mt-6">
                  <p className="text-[13px] font-semibold text-[var(--label)] mb-3">科学参考区间</p>

                  {/* 区间色块条 + 当前值游标 */}
                  <div className="relative h-8">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2.5 rounded-full overflow-hidden flex">
                      {zones.map((z, i) => {
                        const span = zones[zones.length - 1].max - zones[0].min;
                        const w = span > 0 ? ((z.max - z.min) / span) * 100 : 100 / zones.length;
                        return (
                          <div
                            key={i}
                            className="h-full"
                            style={{ width: `${w}%`, backgroundColor: z.color }}
                          />
                        );
                      })}
                    </div>
                    {isFinite(num) && (
                      <div
                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 size-[18px] rounded-full border-[3px] border-white"
                        style={{ left: `${located.pos}%`, backgroundColor: located.zone?.color ?? '#22C55E' }}
                      />
                    )}
                  </div>

                  {/* 各区间标签 */}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                    {zones.map((z, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 text-[12px]">
                        <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: z.color }} />
                        <span className={located.zone === z ? 'font-semibold text-[var(--label)]' : 'text-[var(--secondary-label)]'}>
                          {z.label}
                        </span>
                        <span className="text-[var(--tertiary-label)]">{z.min}–{z.max}{unit ? ` ${unit}` : ''}</span>
                      </span>
                    ))}
                  </div>

                  {isFinite(num) && located.zone && (
                    <p className="mt-3 text-[12px] text-[var(--secondary-label)]">
                      你的 {name} 处于 <span style={{ color: located.zone.color }} className="font-semibold">{located.zone.label}</span> 区间
                    </p>
                  )}
                </div>
              )}

              <div className="mt-5 rounded-2xl bg-[var(--secondary-grouped-background)] p-4">
                <p className="text-[13px] font-semibold text-[var(--label)] mb-1.5">参考说明</p>
                <p className="text-[13px] leading-[21px] text-[var(--secondary-label)]">{std?.guide}</p>
              </div>
            </div>
          </Sheet>
        );
      })()}

      {/* 上传数据 */}
      <Sheet open={uploadOpen} onClose={() => setUploadOpen(false)} title="上传身体数据">
        <div className="px-4 pb-6">
          <div className="flex rounded-full bg-[var(--secondary-grouped-background)] p-1 mb-4">
            {(['manual', 'image'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setUploadTab(t)}
                className={`flex-1 h-9 rounded-full text-[14px] font-medium press-effect ${
                  uploadTab === t ? 'bg-[var(--label)] text-[var(--background)]' : 'text-[var(--secondary-label)]'
                }`}
              >
                {t === 'manual' ? '手动填写' : '图片解析'}
              </button>
            ))}
          </div>

          {upMsg && (
            <div className={`mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] ${
              upMsg.startsWith('已') || upMsg.startsWith('AI 已识别')
                ? 'bg-[var(--system-green)]/10 text-[var(--system-green)]'
                : 'bg-[var(--system-orange)]/10 text-[var(--system-orange)]'
            }`}>
              <span className="flex-1">{upMsg}</span>
              {uploadTab === 'image' && lastImage && !parsing && (
                <button
                  onClick={() => void parseImage(lastImage)}
                  className="shrink-0 rounded-lg bg-[var(--system-green)]/15 px-2.5 py-1 font-semibold press-effect"
                >
                  重新解析
                </button>
              )}
            </div>
          )}

          {uploadTab === 'manual' ? (
            <>
              <div className="bg-[var(--secondary-grouped-background)] rounded-2xl overflow-hidden mb-4">
                {metrics.map(([name, , unit]) => (
                  <label key={name} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-[var(--separator)]">
                    <span className="text-[14px] text-[var(--label)] w-20 shrink-0">
                      {name}
                      {unit ? <span className="text-[11px] text-[var(--tertiary-label)] ml-0.5">{unit}</span> : null}
                    </span>
                    <input
                      value={manualBody[name] ?? ''}
                      onChange={(e) => setManualBody((prev) => ({ ...prev, [name]: e.target.value }))}
                      placeholder="留空则沿用当前值"
                      inputMode="decimal"
                      className="flex-1 min-w-0 bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--tertiary-label)] outline-none text-right"
                    />
                  </label>
                ))}
              </div>
              <button
                onClick={saveBody}
                disabled={saving}
                className="w-full h-12 rounded-2xl bg-[var(--system-green)] text-white text-[15px] font-semibold press-effect disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-5 animate-spin mx-auto" /> : '保存并同步'}
              </button>
              <p className="mt-2 text-[12px] text-[var(--tertiary-label)] text-center">每一项可单独填写，留空则沿用当前值；保存后同步到轻断食体重参考</p>
            </>
          ) : (
            <>
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === 'string') void parseImage(reader.result);
                    };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }}
                />
                <div className={`h-40 rounded-2xl border-2 border-dashed border-[var(--system-gray4)] flex flex-col items-center justify-center gap-2 text-[var(--secondary-label)] mb-4 press-effect ${parsing ? 'opacity-60' : ''}`}>
                  {parsing ? <Loader2 className="size-6 animate-spin text-[var(--system-green)]" /> : <ImageIcon className="size-6" />}
                  <span className="text-[14px]">{parsing ? 'AI 正在识别…' : '点击上传体脂秤截图'}</span>
                  <span className="text-[12px] text-[var(--tertiary-label)]">支持米家 / 华为等体脂秤报告截图</span>
                </div>
              </label>
              <button
                onClick={() => setUploadOpen(false)}
                className="w-full h-12 rounded-2xl bg-[var(--secondary-grouped-background)] text-[var(--secondary-label)] text-[15px] font-semibold press-effect"
              >
                完成
              </button>
            </>
          )}
        </div>
      </Sheet>
    </div>
  );
}

/* ==================== Fridge View ==================== */

function FridgeView({
  zones, foods, onSettings, onGenerate, onAgentAnalyze, agentAnalyzing, agentResult, historyInsights, onInsightRead, onInsightAction, onAddFood,
}: {
  zones: Zone[];
  foods: { name: string; zone: string; amount: string; days: number; icon: string; shelf: number }[];
  onSettings: () => void;
  onGenerate: () => void;
  onAgentAnalyze: () => void;
  agentAnalyzing: boolean;
  agentResult: { success: boolean; count?: number; message?: string; insights?: Insight[] } | null;
  historyInsights: Insight[];
  onInsightRead: (id: number) => void;
  onInsightAction: (id: number, action: 'accept' | 'dismiss') => void;
  onAddFood: (f: { name: string; amount: string; zone: string; days: number }) => void;
}) {
  const total = useMemo(() => zones.reduce((s, z) => s + z.capacity, 0), [zones]);
  const used = useMemo(() => zones.reduce((s, z) => s + z.used, 0), [zones]);
  const [addOpen, setAddOpen] = useState(false);
  const [fName, setFName] = useState('');
  const [fAmount, setFAmount] = useState('');
  const [fZone, setFZone] = useState('冷藏');
  const [fDays, setFDays] = useState('5');
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="max-w-2xl mx-auto px-4 pb-6">
      <div className="pt-2 pb-4 flex items-end justify-between">
        <div>
          <h1 className="text-large-title">我的冰箱</h1>
          <p className="text-[15px] text-[var(--secondary-label)] mt-1">总容量 {total} L · 已用约 {used} L</p>
        </div>
        <button
          onClick={onSettings}
          className="bg-[var(--system-gray5)] text-[var(--label)] rounded-full px-4 py-2 text-[14px] font-medium press-effect flex items-center gap-1.5"
        >
          <Settings className="size-4" />
          设置
        </button>
      </div>

      {/* 历史冰箱洞察（来自小养主动发现，与营养师同步） */}
      {historyInsights.length > 0 && (
        <div className="mb-4">
          <p className="text-[13px] font-semibold text-[var(--secondary-label)] mb-2 flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-[var(--system-blue)] shrink-0" /> 小养的冰箱洞察
            <span className="ml-1 flex-1 text-[12px] font-medium text-[var(--secondary-label)] truncate">
              {historyInsights.find((i) => i.type === 'observation')?.title || '留意临期食材，小养帮你少浪费'}
              <span className="text-[var(--system-pink)]"> ♥</span>
            </span>
          </p>
          <div className="space-y-2">
            {historyInsights.filter((i) => i.type !== 'observation').slice(0, 6).map((ins) => {
              const open = expanded === ins.id;
              return (
                <button
                  key={ins.id}
                  onClick={() => setExpanded(open ? null : ins.id)}
                  className={`w-full text-left rounded-2xl px-4 py-3 press-effect ${
                    ins.type === 'warning'
                      ? 'bg-[var(--system-red)]/8 border border-[var(--system-red)]/18'
                      : 'bg-[var(--secondary-grouped-background)]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {ins.type === 'warning' ? (
                      <AlertCircle className="size-4 text-[var(--system-red)] shrink-0" />
                    ) : ins.type === 'suggestion' ? (
                      <Sparkles className="size-4 text-[var(--system-blue)] shrink-0" />
                    ) : (
                      <Info className="size-4 text-[var(--system-green)] shrink-0" />
                    )}
                    <span className="flex-1 text-[13px] font-semibold leading-[18px] text-[var(--label)] break-words">{ins.title}</span>
                    <ChevronDown className={`size-4 text-[var(--tertiary-label)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </span>
                  {open && (
                    <span className="block mt-2">
                      <span className="block text-[12px] text-[var(--secondary-label)] leading-[18px] break-words">{ins.content}</span>
                      <span className="flex gap-2 mt-2.5">
                        <span
                          onClick={(e) => { e.stopPropagation(); onInsightRead(ins.id); }}
                          className="px-3 py-1.5 h-[30px] rounded-full text-[12px] font-medium bg-[var(--system-gray5)] text-[var(--secondary-label)] press-effect cursor-pointer"
                        >
                          已读
                        </span>
                        {(ins.type === 'suggestion' || ins.type === 'warning') && (
                          <span
                            onClick={(e) => { e.stopPropagation(); onInsightAction(ins.id, 'accept'); }}
                            className="px-3 py-1.5 h-[30px] rounded-full text-[12px] font-semibold bg-[var(--system-green)] text-white press-effect cursor-pointer"
                          >
                            去调整
                          </span>
                        )}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Analysis Result */}
      {agentResult && (
        <div className={`mb-4 rounded-2xl p-3 flex items-start gap-3 ${
          agentResult.success
            ? 'bg-[var(--system-green)]/10 border border-[var(--system-green)]/20'
            : 'bg-[var(--system-orange)]/10 border border-[var(--system-orange)]/20'
        }`}>
          {agentResult.success ? (
            <Sparkles className="size-5 text-[var(--system-green)] shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="size-5 text-[var(--system-orange)] shrink-0 mt-0.5" />
          )}
          <p className="text-[12px] leading-[18px] text-[var(--secondary-label)]">
            {agentResult.message}
          </p>
        </div>
      )}

      {/* In-place AI insights from fridge analysis end（历史洞察区承载，避免重复） */}

      {/* 添加入口 */}
      <SectionTitle eyebrow={`已用 ${used}/${total} L`} title="食材库存" action="添加" onAction={() => setAddOpen(true)} />

      {/* 分区 + 库存（一排排） */}
      {zones.map((z) => {
        const zFoods = foods.filter((f) => f.zone === z.name);
        return (
          <div key={z.id} className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{z.icon}</span>
              <span className="text-[15px] font-semibold">{z.name}</span>
              <span className="text-[12px] text-[var(--secondary-label)]">{z.type}</span>
              <span className="ml-auto text-[13px] text-[var(--secondary-label)]">{z.used}/{z.capacity} L</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--system-gray5)] mb-2">
              <div
                className={`h-full rounded-full ${z.type === '冷冻' ? 'bg-[var(--system-blue)]' : 'bg-[var(--system-green)]'}`}
                style={{ width: `${Math.min(100, (z.used / z.capacity) * 100)}%` }}
              />
            </div>
            <div className="bg-[var(--secondary-grouped-background)] rounded-2xl overflow-hidden">
              {zFoods.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-[var(--secondary-label)]">空</p>
              ) : (
                zFoods.map((food, i) => (
                  <div
                    key={food.name}
                    className={`flex items-center gap-3 px-4 py-3 ${i !== zFoods.length - 1 ? 'border-b border-[var(--separator)]' : ''}`}
                  >
                    <span className="text-2xl">{food.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium">{food.name} · {food.amount}</p>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                        food.days <= 3
                          ? 'bg-[var(--system-red)]/10 text-[var(--system-red)]'
                          : 'bg-[var(--system-gray5)] text-[var(--secondary-label)]'
                      }`}
                    >
                      {food.days} 天
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}

      <div className="grid grid-cols-2 gap-3">
        <button
          className="ios-button bg-[var(--secondary-grouped-background)] text-[var(--label)]"
          onClick={onAgentAnalyze}
          disabled={agentAnalyzing}
        >
          {agentAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          {agentAnalyzing ? 'AI 分析中…' : 'AI 分析库存'}
        </button>
        <button
          className="ios-button bg-[var(--system-green)] text-white"
          onClick={onGenerate}
        >
          <Bot className="size-4" />
          生成周计划
        </button>
      </div>

      {/* AI Agent Status */}
      <div className="mt-4 bg-[var(--system-blue)]/5 border border-[var(--system-blue)]/20 rounded-2xl p-3 flex items-center gap-3">
        <div className="relative">
          <Bot className="size-5 text-[var(--system-blue)]" />
          <span className="absolute -top-0.5 -right-0.5 size-2 bg-[var(--system-green)] rounded-full animate-pulse" />
        </div>
        <p className="text-[12px] text-[var(--secondary-label)] leading-[18px]">
          AI 主动洞察：冰箱数据更新后识别临期风险，并给出待确认建议。
        </p>
      </div>

      {/* 添加食材表单 */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="添加食材">
        <div className="px-4 pb-6 space-y-4">
          <p className="text-[13px] text-[var(--secondary-label)] -mt-1">录入后自动放进对应分区，供 AI 营养师规划时使用</p>

          <div className="bg-[var(--secondary-grouped-background)] rounded-2xl overflow-hidden">
            <label className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--separator)]">
              <span className="text-[14px] text-[var(--label)] w-16 shrink-0">名称</span>
              <input
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                placeholder="如：西兰花"
                className="flex-1 min-w-0 bg-transparent text-[16px] text-[var(--label)] placeholder:text-[var(--tertiary-label)] outline-none text-right"
              />
            </label>
            <label className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--separator)]">
              <span className="text-[14px] text-[var(--label)] w-16 shrink-0">数量</span>
              <input
                value={fAmount}
                onChange={(e) => setFAmount(e.target.value)}
                placeholder="如：300g"
                className="flex-1 min-w-0 bg-transparent text-[16px] text-[var(--label)] placeholder:text-[var(--tertiary-label)] outline-none text-right"
              />
            </label>
            <label className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--separator)]">
              <span className="text-[14px] text-[var(--label)] w-16 shrink-0">保鲜</span>
              <input
                value={fDays}
                onChange={(e) => setFDays(e.target.value)}
                placeholder="如 5 天"
                inputMode="numeric"
                className="flex-1 min-w-0 bg-transparent text-[16px] text-[var(--label)] placeholder:text-[var(--tertiary-label)] outline-none text-right"
              />
            </label>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-[14px] text-[var(--label)] w-16 shrink-0">分区</span>
              <div className="flex-1 flex gap-2">
                {['冷藏', '冷冻'].map((z) => (
                  <button
                    key={z}
                    onClick={() => setFZone(z)}
                    className={`flex-1 h-9 rounded-xl text-[14px] font-medium press-effect ${
                      fZone === z
                        ? 'bg-[var(--system-green)] text-white'
                        : 'bg-[var(--system-gray5)] text-[var(--secondary-label)]'
                    }`}
                  >
                    {z === '冷藏' ? '🧊 冷藏' : '❄️ 冷冻'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              onAddFood({ name: fName, amount: fAmount || '—', zone: fZone, days: parseInt(fDays || '5', 10) || 5 });
              setFName(''); setFAmount(''); setFDays('5'); setAddOpen(false);
            }}
            disabled={!fName.trim()}
            className="w-full h-12 rounded-2xl bg-[var(--system-green)] text-white text-[15px] font-semibold press-effect disabled:opacity-40"
          >
            加入冰箱
          </button>
        </div>
      </Sheet>
    </div>
  );
}

/* ==================== Coach View ==================== */

function PlanView({
  todayData, weeklyData, weeklyLoading, generating, error, selectedDay, setSelectedDay,
  onGenerate, onSettings, onShopping,
}: {
  todayData: TodayData | null;
  weeklyData: any;
  weeklyLoading: boolean;
  generating: boolean;
  error: string;
  selectedDay: number;
  setSelectedDay: (n: number) => void;
  onGenerate: () => void;
  onSettings: () => void;
  onShopping: () => void;
}) {
  const hasPlan = todayData?.hasPlan;

  // 从 weeklyData 里取每天的日期信息，如果没有就用星期名兜底
  const dayLabels = useMemo(() => {
    if (weeklyData?.days && weeklyData.days.length > 0) {
      const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
      return weeklyData.days.map((d: any) => {
        const [, m, dd] = d.date.split('-').map((s: string) => Number(s));
        const sub = `${m}/${dd}`;
        switch (d.label) {
          case 'today': return { main: '今天', sub };
          case 'yesterday': return { main: '昨天', sub, past: true };
          case 'dayBeforeYesterday': return { main: '前天', sub, past: true };
          case 'tomorrow': return { main: '明天', sub };
          default: {
            const weekday = weekdayNames[new Date(`${d.date}T00:00:00Z`).getUTCDay()];
            return { main: `周${weekday}`, sub };
          }
        }
      });
    }
    return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((d) => ({ main: d, sub: '' }));
  }, [weeklyData]);

  const currentDay = weeklyData?.days?.[selectedDay];
  const meals = currentDay?.meals || {};
  const dayCalories = currentDay?.calories || 0;
  const dayProtein = currentDay?.protein || 0;

  if (!hasPlan) {
    return (
      <div className="max-w-2xl mx-auto px-4 pb-6">
        <div className="pt-2 pb-4 flex items-end justify-between">
          <h1 className="text-large-title">周计划</h1>
          <button
            onClick={onSettings}
            className="bg-[var(--system-gray5)] text-[var(--label)] rounded-full px-4 py-2 text-[14px] font-medium press-effect flex items-center gap-1.5"
          >
            <Settings className="size-4" />
            设置
          </button>
        </div>

        <div className="rounded-2xl bg-[#F0FDF4] p-6 text-[var(--label)] mb-5 border border-[#DCFCE7]">
          <CalendarRange className="size-9" />
          <h2 className="text-[22px] font-bold mt-4">整周饮食规划</h2>
          <p className="mt-2 text-[14px] leading-[22px] text-[var(--secondary-label)]">
            AI 营养师一次生成 7 天食谱，每天不重样，自动匹配冰箱库存。
          </p>
        </div>

        <button
          className="w-full ios-button bg-[var(--system-green)] text-white mb-5"
          onClick={onGenerate}
          disabled={generating}
        >
          {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {generating ? '生成中，可能需要 30 秒…' : '生成本周计划'}
        </button>

        {error && (
          <div className="bg-[var(--system-orange)]/10 border border-[var(--system-orange)]/20 rounded-2xl p-4 mb-5">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="size-5 text-[var(--system-orange)] shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-[var(--system-orange)]">生成失败</p>
                <pre className="text-[13px] text-[var(--label)] mt-1 leading-[18px] whitespace-pre-wrap font-sans">{error}</pre>
                {error.includes('AI 设置') || error.includes('配置') ? (
                  <button
                    onClick={onSettings}
                    className="mt-3 text-[13px] font-medium text-[var(--system-blue)]"
                  >
                    去配置 →
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        <SectionTitle eyebrow="生成后你会得到" title="包含这些内容" />
        <div className="space-y-3">
          {[
            ['🍽️', '7 天三餐', '每天不重样，好吃易做'],
            ['🛒', '采购清单', '本周需要买的所有食材'],
            ['🧊', '库存优先', '临期食材优先消耗'],
            ['📊', '营养分析', '每天热量和蛋白质跟踪'],
            ['💡', 'AI 洞察', '主动发现问题并给出建议'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="bg-[var(--secondary-grouped-background)] rounded-2xl p-4 flex items-center gap-3">
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-[15px] font-semibold">{title}</p>
                <p className="text-[12px] text-[var(--secondary-label)] mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-6">
      <div className="pt-2 pb-4 flex items-end justify-between">
        <h1 className="text-large-title">周计划</h1>
        <div className="flex gap-2">
          <button
            onClick={onShopping}
            className="bg-[var(--system-gray5)] text-[var(--label)] rounded-full px-3 py-2 text-[13px] font-medium press-effect flex items-center gap-1.5"
          >
            <ShoppingCart className="size-4" />
            采购
          </button>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="bg-[var(--system-gray5)] text-[var(--label)] rounded-full px-3 py-2 text-[13px] font-medium press-effect flex items-center gap-1.5 disabled:opacity-50"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            重生成
          </button>
        </div>
      </div>

      {/* Week Summary Card */}
      <div className="bg-gradient-to-br from-[#22C55E] via-[#4ADE80] to-[#16A34A] rounded-2xl p-5 text-white mb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] text-white/80">本周目标</p>
            <p className="text-[20px] font-bold mt-1">{weeklyData?.plan?.goal || todayData?.plan?.goal || '健康减脂'}</p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-white/80">日均热量</p>
            <p className="text-[20px] font-bold mt-1">{weeklyData?.plan?.targetCalories || todayData?.plan?.targetCalories || '—'} kcal</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-white/15 p-3 text-[13px] leading-[18px] text-white/90">
          {weeklyData?.plan?.rationale || todayData?.plan?.rationale || 'AI 正在分析你的身体数据和冰箱库存…'}
        </div>
      </div>

      {/* Day Selector */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 hide-scrollbar">
        {dayLabels.map((day: any, i: number) => {
          const dayData = weeklyData?.days?.[i];
          const cal = dayData?.calories || 0;
          const hasData = dayData?.hasData;
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={`shrink-0 px-2.5 py-2 rounded-xl text-[12px] font-medium transition-all flex flex-col items-center min-w-[56px] ${
                selectedDay === i
                  ? 'bg-[var(--system-green)] text-white'
                  : hasData
                    ? 'bg-[var(--secondary-grouped-background)] text-[var(--label)]'
                    : 'bg-[var(--secondary-grouped-background)]/50 text-[var(--tertiary-label)]'
              }`}
            >
              <span className="text-[12px]">{day.main}</span>
              {day.sub && <span className={`text-[10px] opacity-70`}>{day.sub}</span>}
              <span className={`text-[10px] mt-0.5 ${selectedDay === i ? 'text-white/80' : ''}`}>
                {cal > 0 ? `${Math.round(cal)}` : hasData ? '—' : '待生成'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Day Summary */}
      {currentDay && currentDay.hasData && (
        <div className="bg-[var(--secondary-grouped-background)] rounded-2xl p-4 mb-5 flex items-center justify-between">
          <div>
            <p className="text-[13px] text-[var(--secondary-label)]">{dayLabels[selectedDay]?.main || ''} 总计</p>
            <p className="text-[22px] font-bold mt-1">{dayCalories} <span className="text-[13px] font-normal text-[var(--secondary-label)]">kcal</span></p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-[var(--secondary-label)]">蛋白质</p>
            <p className="text-[22px] font-bold mt-1 text-[var(--system-green)]">{dayProtein} <span className="text-[13px] font-normal">g</span></p>
          </div>
        </div>
      )}
      {currentDay && !currentDay.hasData && (
        <div className="bg-[var(--system-gray5)]/50 rounded-2xl p-4 mb-5 text-center">
          <p className="text-[13px] text-[var(--secondary-label)]">这天还没有安排</p>
          <p className="text-[12px] text-[var(--tertiary-label)] mt-1">小养会自动补齐未来几天的食谱，刷新后即可看到。</p>
        </div>
      )}

      {/* Loading */}
      {weeklyLoading && (
        <div className="bg-[var(--secondary-grouped-background)] rounded-2xl p-8 text-center mb-5">
          <Loader2 className="size-6 animate-spin text-[var(--system-green)] mx-auto" />
          <p className="text-[14px] text-[var(--secondary-label)] mt-3">加载周计划…</p>
        </div>
      )}

      {/* Selected Day Meals */}
      {!weeklyLoading && (
        <div className="space-y-3 mb-5">
          {(['breakfast', 'lunch', 'dinner'] as const).map((mealType) => {
            const dishes = meals[mealType] || [];
            const mealCal = dishes.reduce((s: number, d: Dish) => s + (d.calories || 0), 0);
            const mealProtein = dishes.reduce((s: number, d: Dish) => s + (d.protein || 0), 0);
            const labels: Record<string, [string, string]> = {
              breakfast: ['🌅', '早餐'],
              lunch: ['☀️', '午餐'],
              dinner: ['🌙', '晚餐'],
            };
            const [icon, label] = labels[mealType];

            return (
              <div key={mealType} className="bg-[var(--secondary-grouped-background)] rounded-2xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--separator)]">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    <h3 className="text-[15px] font-semibold">{label}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-semibold text-[var(--system-green)]">{mealCal} kcal</p>
                    <p className="text-[10px] text-[var(--secondary-label)]">蛋白 {mealProtein}g</p>
                  </div>
                </div>
                {dishes.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[13px] text-[var(--secondary-label)]">
                    还没有安排
                  </div>
                ) : (
                  dishes.map((dish: Dish, i: number) => (
                    <div key={dish.id || i} className={`px-4 py-3 ${i !== dishes.length - 1 ? 'border-b border-[var(--separator)]' : ''}`}>
                      <div className="flex items-start justify-between">
                        <p className="text-[14px] font-medium">{dish.name}</p>
                        <span className="text-[11px] text-[var(--secondary-label)] shrink-0 ml-2">
                          {dish.calories} kcal · {dish.protein}g
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {dish.ingredients.slice(0, 5).map((ing) => (
                          <span
                            key={ing.name}
                            className={`text-[10px] px-2 py-0.5 rounded-full ${
                              ing.fromFridge
                                ? 'bg-[var(--system-green)]/10 text-[var(--system-green)]'
                                : 'bg-[var(--system-gray5)] text-[var(--secondary-label)]'
                            }`}
                          >
                            {ing.fromFridge && '🧊 '}{ing.name}
                          </span>
                        ))}
                        {dish.ingredients.length > 5 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--system-gray5)] text-[var(--secondary-label)]">
                            +{dish.ingredients.length - 5}
                          </span>
                        )}
                      </div>
                      {dish.steps && dish.steps.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-[var(--separator)]/50">
                          <p className="text-[11px] text-[var(--secondary-label)] mb-1">做法</p>
                          <ol className="text-[11px] text-[var(--secondary-label)] space-y-0.5 list-decimal list-inside">
                            {dish.steps.slice(0, 3).map((step, si) => (
                              <li key={si} className="line-clamp-1">{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AI Agent Note */}
      <div className="bg-[var(--system-blue)]/5 border border-[var(--system-blue)]/20 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Zap className="size-5 text-[var(--system-blue)] shrink-0 mt-0.5" />
          <div>
            <p className="text-[14px] font-semibold">AI 主动洞察</p>
            <p className="text-[12px] text-[var(--secondary-label)] mt-1 leading-[18px]">
              当你更新体重或冰箱食材时，AI 会主动分析变化并给出调整建议，不用你主动问。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==================== Coach Chat View ==================== */

function CoachChatView({
  messages, input, setInput, loading, onSend, onSettings, onGenerate, hasPlan,
  onConfirmAdjust, onDismissAdjust, pendingAdjustment, adjusting,
}: {
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  onSend: () => void;
  onSettings: () => void;
  onGenerate: () => void;
  onConfirmAdjust: () => void;
  onDismissAdjust: () => void;
  pendingAdjustment: { instruction: string; aiPlan?: string } | null;
  adjusting: boolean;
  hasPlan: boolean;
}) {
  const [planExpanded, setPlanExpanded] = useState(false);
  const quickPrompts = [
    '我想改成增肌目标',
    '我不吃香菜',
    '今天中午吃什么好',
    '帮我看看这周计划',
  ];

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-83px)] md:h-[calc(100vh-24px)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="px-4 pt-2 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="size-10 rounded-full bg-[var(--system-green)] flex items-center justify-center">
              <Bot className="size-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 size-3 bg-[var(--system-green)] rounded-full border-2 border-[var(--grouped-background)]" />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold">小养营养师</h1>
            <p className="text-[11px] text-[var(--system-green)]">在线 · AI 驱动</p>
          </div>
        </div>
        <button
          onClick={onSettings}
          className="size-9 rounded-full bg-[var(--system-gray5)] flex items-center justify-center press-effect"
        >
          <Settings className="size-4" />
        </button>
      </div>

      {/* Agent Status Banner */}
      <div className="mx-4 mb-3 bg-[var(--system-blue)]/5 border border-[var(--system-blue)]/20 rounded-xl p-2.5 flex items-center gap-2">
        <Zap className="size-4 text-[var(--system-blue)] shrink-0" />
        <p className="text-[11px] text-[var(--secondary-label)] leading-[16px]">
          主动洞察已开启：数据更新后我会分析变化，所有建议都由你决定是否采用。
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3 ios-scroll">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="size-8 rounded-full bg-[var(--system-green)] flex items-center justify-center mr-2 shrink-0 mt-0.5">
                <Bot className="size-4 text-white" />
              </div>
            )}
            <div className={`max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <div
                className={`px-3.5 py-2.5 rounded-2xl text-[14px] leading-[22px] whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[var(--system-green)] text-white rounded-br-md'
                    : 'bg-[var(--secondary-grouped-background)] text-[var(--label)] rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
              <span className="text-[10px] text-[var(--tertiary-label)] mt-1 mx-1">
                {msg.time}
              </span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="size-8 rounded-full bg-[var(--system-green)] flex items-center justify-center mr-2 shrink-0">
              <Bot className="size-4 text-white" />
            </div>
            <div className="bg-[var(--secondary-grouped-background)] rounded-2xl rounded-bl-md px-3.5 py-3">
              <div className="flex gap-1">
                <span className="size-2 bg-[var(--system-gray4)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="size-2 bg-[var(--system-gray4)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="size-2 bg-[var(--system-gray4)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pending Adjustment → 统一 Sheet */}
      <Sheet open={!!pendingAdjustment} onClose={onDismissAdjust} title="确认调整">
        {pendingAdjustment && (
          <div className="px-4 pb-6 space-y-4">
            <div className="flex gap-3 items-start rounded-2xl bg-[var(--system-green)]/8 border border-[var(--system-green)]/15 p-3">
              <div className="size-9 rounded-xl bg-[var(--system-green)]/15 flex items-center justify-center shrink-0">
                <Sparkles className="size-4 text-[var(--system-green)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[var(--label)]">小养建议调整今天的安排</p>
                <p className="text-[12px] text-[var(--tertiary-label)] mt-0.5">你的需求：{pendingAdjustment.instruction}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-[var(--secondary-grouped-background)] p-3.5">
              <p className="text-[12px] font-semibold text-[var(--label)] mb-1">将怎么调整</p>
              <p className={`text-[13px] text-[var(--secondary-label)] leading-[20px] whitespace-pre-line ${planExpanded ? '' : 'line-clamp-4'}`}>
                {pendingAdjustment.aiPlan || 'AI 将根据你的新要求重新安排今天的早午晚餐。'}
              </p>
              {pendingAdjustment.aiPlan && (
                <button
                  onClick={() => setPlanExpanded(!planExpanded)}
                  className="mt-2 text-[12px] font-medium text-[var(--system-green)] press-effect flex items-center gap-0.5"
                >
                  {planExpanded ? '收起' : '展开全部'}
                  <ChevronDown className={`size-3.5 transition-transform ${planExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            <p className="text-[11px] text-[var(--tertiary-label)]">确认后更新「今日」页食谱</p>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={onDismissAdjust}
                disabled={adjusting}
                className="ios-button flex-1 bg-[var(--system-gray5)] text-[var(--label)] disabled:opacity-50"
              >
                {adjusting ? '调整中…' : '暂不调整'}
              </button>
              <button
                onClick={onConfirmAdjust}
                disabled={adjusting}
                className="ios-button flex-1 bg-[var(--system-green)] text-white disabled:opacity-60"
              >
                {adjusting ? '调整中…' : '确认调整'}
              </button>
            </div>
          </div>
        )}
      </Sheet>

      {/* Quick Prompts */}
      {messages.length <= 1 && !loading && (
        <div className="px-4 pb-2">
          <p className="text-[11px] text-[var(--tertiary-label)] mb-2 px-1">试试问我：</p>
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => { setInput(prompt); }}
                className="text-[12px] px-3 py-1.5 rounded-full bg-[var(--secondary-grouped-background)] text-[var(--secondary-label)] press-effect"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="px-4 py-3 border-t border-[var(--separator)] bg-[var(--grouped-background)]">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-[var(--secondary-grouped-background)] rounded-2xl px-3 py-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="跟小养说点什么…"
              rows={1}
              className="w-full bg-transparent text-[14px] leading-[20px] resize-none outline-none placeholder:text-[var(--tertiary-label)]"
              style={{ maxHeight: '100px' }}
            />
          </div>
          <button
            onClick={onSend}
            disabled={!input.trim() || loading}
            className="size-10 rounded-full bg-[var(--system-green)] text-white flex items-center justify-center shrink-0 press-effect disabled:opacity-40 disabled:press-effect-none"
          >
            <Send className="size-4" />
          </button>
        </div>
        {!hasPlan && (
          <button
            onClick={onGenerate}
            className="mt-2 w-full text-[12px] text-[var(--system-blue)] text-center"
          >
            还没有周计划？让小养生成一份 →
          </button>
        )}
      </div>
    </div>
  );
}

/* ==================== Shared Components ==================== */

function MiniStat({ label, value, light = false }: { label: string; value: string; light?: boolean }) {
  return (
    <div className={`rounded-xl p-2.5 ${light ? 'bg-white/75 dark:bg-[var(--system-gray5)]/50' : 'bg-white/12'}`}>
      <p className={`text-[10px] ${light ? 'text-[var(--secondary-label)]' : 'text-white/70'}`}>{label}</p>
      <p className={`text-[13px] font-semibold mt-0.5 ${light ? '' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function SectionTitle({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-end justify-between mb-3 px-1">
      <div>
        <p className="text-[11px] font-semibold text-[var(--system-green)] uppercase tracking-wider">{eyebrow}</p>
        <h2 className="text-[20px] font-bold mt-1">{title}</h2>
      </div>
      {action && (
        <button onClick={onAction} className="text-[14px] text-[var(--system-blue)] font-medium">
          {action}
        </button>
      )}
    </div>
  );
}

function MealRow({ label, name, detail, emoji, last }: { label: string; name: string; detail: string; emoji: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${!last ? 'border-b border-[var(--separator)]' : ''}`}>
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium">{name}</p>
        <p className="text-[12px] text-[var(--secondary-label)]">{detail}</p>
      </div>
      <span className="text-[12px] font-semibold text-[var(--system-green)] bg-[var(--system-green)]/10 px-2.5 py-1 rounded-full">
        {label}
      </span>
    </div>
  );
}

function ReasonItem({
  icon, iconBg, iconColor, title, text, last = false,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  text: string;
  last?: boolean;
}) {
  return (
    <div className={`flex gap-3 px-4 py-3.5 ${!last ? 'border-b border-[var(--separator)]' : ''}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${iconBg} ${iconColor}`}>
        {icon}
      </span>
      <div className="flex-1">
        <p className="text-[14px] font-medium">{title}</p>
        <p className="mt-1 text-[12px] text-[var(--secondary-label)] leading-[18px]">{text}</p>
      </div>
    </div>
  );
}

function MetricCard({ name, value, unit, note, noteColor, level, levelColor }: { name: string; value: string; unit: string; note: string; noteColor?: string | null; level?: string | null; levelColor?: string | null }) {
  return (
    <div className="bg-[var(--secondary-grouped-background)] rounded-2xl p-4 relative">
      <div className="flex items-start justify-between gap-1">
        <p className="text-[12px] text-[var(--secondary-label)]">{name}</p>
        {level && levelColor && (
          <span
            className="mt-0.5 shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold leading-[14px]"
            style={{ color: levelColor, backgroundColor: `${levelColor}1f` }}
          >
            {level}
          </span>
        )}
      </div>
      <p className="text-[20px] font-bold tracking-tight mt-2">
        {value || '—'}<span className="text-[10px] font-normal text-[var(--secondary-label)] ml-1">{unit}</span>
      </p>
      {note ? (
        <p className="text-[10px] mt-1" style={{ color: noteColor ?? 'var(--secondary-label)' }}>{note}</p>
      ) : null}
    </div>
  );
}

/* ==================== Sheet Component ==================== */

function Sheet({
  open, onClose, title, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className={`ios-sheet-overlay ${open ? 'open' : ''}`}
        onClick={onClose}
        style={{ pointerEvents: open ? 'auto' : 'none' }}
      />
      <div
        className={`ios-sheet ${open ? 'open' : ''}`}
        style={{ pointerEvents: open ? 'auto' : 'none' }}
      >
        <div className="ios-sheet-grabber" />
        <div className="relative flex items-center justify-center px-4 py-3 border-b border-[var(--separator)]">
          <h3 className="text-[16px] font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[var(--system-gray5)] flex items-center justify-center press-effect"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[calc(90vh-60px)] ios-scroll pt-4">
          {children}
        </div>
      </div>
    </>
  );
}
