'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, CalendarRange, Refrigerator, Activity, ChevronRight,
  Sparkles, TrendingDown, Dumbbell, Archive,
  Flame, Info, Settings, Send, Plus, X,
  LogOut, User, Loader2, AlertCircle,
  Bell, ChevronDown, ShoppingCart, Zap, Bot, Upload, ImageIcon, Minus,
} from 'lucide-react';

type Tab = 'today' | 'plan' | 'coach' | 'fridge' | 'body';

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

const metrics = [
  ['体重', '53.4', 'kg', '较上次 +0.3', 'normal'], ['BMI', '20.9', '', '标准', 'normal'],
  ['体脂率', '26.5', '%', '较上次 −0.4', 'normal'], ['脂肪量', '14.2', 'kg', '趋势下降', 'normal'],
  ['肌肉量', '37.0', 'kg', '较上次 +0.5', 'good'], ['肌肉率', '69.3', '%', '较上次 +0.4', 'good'],
  ['骨骼肌', '19.5', 'kg', '较上次 +0.7', 'good'], ['去脂体重', '39.2', 'kg', '较上次 +0.4', 'good'],
  ['体水分', '52.8', '%', '较上次 +1.4', 'normal'], ['蛋白质率', '15.5', '%', '较上次 +1.3', 'normal'],
  ['骨量', '2.2', 'kg', '正常', 'normal'], ['骨盐率', '4.1', '%', '正常', 'normal'],
  ['内脏脂肪', '7', '级', '留意趋势', 'warn'], ['基础代谢', '1217', 'kcal', '估算值', 'normal'],
  ['腰臀比', '1.1', '', '建议复测', 'warn'], ['心率', '102', '次/分', '静息时需复测', 'warn'],
  ['身体得分', '80', '分', '整体健康', 'good'], ['身体年龄', '18', '岁', '设备估算', 'normal'],
] as const;

// 各指标的标准区间（常规/健康参考，不构成医疗建议）
type Standard = {
  low?: number; high?: number;
  femaleLow?: number; femaleHigh?: number;
  guide: string; note?: string;
};
const STANDARDS: Record<string, Standard> = {
  BMI: { low: 18.5, high: 23.9, guide: 'BMI = 体重(kg) ÷ 身高(m)²。18.5–23.9 为亚洲成年人正常范围，低于 18.5 偏瘦、24–27.9 超重、≥28 肥胖。' },
  体脂率: { low: 18, high: 28, femaleLow: 18, femaleHigh: 28, guide: '男性标准 10–18%，女性标准 18–28%。30–35% 为轻度偏高，女性 >35% 肥胖。' },
  内脏脂肪: { low: 1, high: 9, guide: '<10 为正常，10–14 偏高，≥15 视为较高，内脏脂肪过高与心血管、代谢风险相关。' },
  肌肉率: { low: 30, high: 40, femaleLow: 30, femaleHigh: 40, guide: '健康成年人肌肉量约为体重的 30–40%（女性偏低、男性偏高），长期久坐易下降。' },
  体水分: { low: 55, high: 65, femaleLow: 50, femaleHigh: 60, guide: '男性标准约 55–65%，女性约 50–60%。饮水不足或肌肉量偏低时数值下降。' },
  蛋白质率: { low: 14, high: 17, guide: '正常参考约 14–17%，偏低常见于蛋白质摄入不足或肌肉流失。' },
  基础代谢: { low: 1100, high: 1500, femaleLow: 1100, femaleHigh: 1400, guide: '指维持生命体征每天消耗的热量(基础值)。女性约 1100–1400 kcal、男性 1400–1700 kcal，具体因人而异。' },
  腰臀比: { low: 0.75, high: 0.9, femaleLow: 0.75, femaleHigh: 0.85, guide: '腰围÷臀围。男性 >0.90、女性 >0.85 提示向心性肥胖风险增加。' },
  心率: { low: 60, high: 100, guide: '静息心率成人正常约 60–100 次/分。>100(静息) 为心动过速，长期偏高建议复查。' },
  身体得分: { low: 70, high: 100, guide: '综合评分，越高代表整体越健康，正常一般 70–100 分。' },
  骨量: { low: 2, high: 4, guide: '骨量正常参考约男 3–4kg、女 2–3kg，受年龄、激素、运动影响。' },
  骨盐率: { low: 3, high: 5, guide: '骨盐量占体重百分比，正常约 3–5%，反映骨骼无机盐含量。' },
  体重: { guide: '体重本身无绝对标准，需结合身高(BMI)与身体成分判断，女性标准体重≈(身高cm−100)×0.9kg。' },
  脂肪量: { guide: '脂肪量是否正常取决于体脂率，而不只是绝对重量。' },
  肌肉量: { guide: '骨骼肌+平滑肌等总和，正常约占体重 30–40%，肌肉量高通常代谢更好。' },
  骨骼肌: { guide: '骨骼肌是维持姿势与运动的主要肌肉，女性约占体重的 25–30%、男性 35–40%。' },
  去脂体重: { guide: '体重减去脂肪后的重量，由肌肉、骨骼、水分等组成，越高反映瘦体重越多。' },
  '身体年龄': { guide: '设备根据身体成分估算的生理年龄，低于实际年龄通常代表代谢状态更好。' },
};

const initialZones: Zone[] = [
  { id: 'fridge', name: '冷藏', type: '冷藏', capacity: 50, used: 32, icon: '🧊' },
  { id: 'freezer', name: '冷冻', type: '冷冻', capacity: 45, used: 24, icon: '❄️' },
];

const initialFoods = [
  { name: '鸡腿肉', zone: '冷藏', amount: '460g', days: 2, icon: '🍗', shelf: 0 },
  { name: '小番茄', zone: '冷藏', amount: '320g', days: 3, icon: '🍅', shelf: 0 },
  { name: '虾仁', zone: '冷冻', amount: '300g', days: 24, icon: '🍤', shelf: 1 },
  { name: '牛油果', zone: '冷藏', amount: '2 个', days: 4, icon: '🥑', shelf: 0 },
];

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
  const [selectedDay, setSelectedDay] = useState(0); // 0=Mon
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [shoppingLoading, setShoppingLoading] = useState(false);
  const [agentAnalyzing, setAgentAnalyzing] = useState(false);
  const [fridgeResult, setFridgeResult] = useState<{ success: boolean; count?: number; message?: string; insights?: Insight[] } | null>(null);
  const [bodyResult, setBodyResult] = useState<{ success: boolean; count?: number; message?: string; insights?: Insight[] } | null>(null);
  const [qtyItem, setQtyItem] = useState<{ name: string; amount: string } | null>(null);
  const [qtyAmount, setQtyAmount] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [savedInsights, setSavedInsights] = useState<Insight[] | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [qtyZone, setQtyZone] = useState('冷藏');
  const [pendingAdjustment, setPendingAdjustment] = useState<{ instruction: string; aiPlan?: string } | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

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
          measurements: Object.fromEntries(metrics.map(([key, value, unit]) => [key, `${value}${unit}`])),
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
  }

  function handleInsightAction(id: number, action: 'accept' | 'dismiss') {
    if (action === 'accept') {
      // 采纳建议：跳转到营养师聊天页，预填调整请求
      const insight = todayData?.insights.find((i) => i.id === id);
      markInsightRead(id);
      setTab('coach');
      if (insight) {
        setChatInput(`帮我调整计划：${insight.title}。${insight.content}`);
      }
    } else {
      // 暂不调整：直接标记已读关闭
      markInsightRead(id);
    }
  }

  function addFood(f: { name: string; amount: string; zone: string; days: number }) {
    if (!f.name.trim()) return;
    const zoneName = f.zone === '冷冻' ? '冷冻' : '冷藏';
    setFoods((prev) => [...prev, { ...f, zone: zoneName, icon: '🥡', shelf: 0 }]);
    setZones((prev) =>
      prev.map((z) => (z.name === zoneName ? { ...z, used: Math.min(z.capacity, z.used + 1) } : z))
    );
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
      setWeeklyData(data);
    } finally {
      setWeeklyLoading(false);
    }
  }

  async function triggerAgentAnalysis(triggerType: 'body' | 'fridge' | 'both', changes: string) {
    if (agentAnalyzing) return;
    setAgentAnalyzing(true);
    // 各自独立，不互相覆盖
    const setResult = triggerType === 'fridge' ? setFridgeResult : triggerType === 'body' ? setBodyResult : (r: any) => { setFridgeResult(r); setBodyResult(r); };
    setResult(null);
    try {
      const res = await fetch('/api/agent/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          triggerType,
          changes,
          measurements: Object.fromEntries(metrics.map(([key, value, unit]) => [key, `${value}${unit}`])),
          foods,
          zones,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Reload today data to show new insights
        const todayRes = await fetch('/api/plan/today');
        const todayData2 = await todayRes.json();
        setTodayData(todayData2);
        setResult({ success: true, count: data.count, message: `AI 发现了 ${data.count} 条新建议`, insights: data.insights });
      } else {
        setResult({ success: false, message: data.error || '分析失败，请稍后再试' });
      }
    } catch {
      setResult({ success: false, message: '网络连接失败，请稍后再试' });
    } finally {
      setAgentAnalyzing(false);
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
            measurements: Object.fromEntries(metrics.map(([key, value, unit]) => [key, `${value}${unit}`])),
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
            measurements: Object.fromEntries(metrics.map(([key, value, unit]) => [key, `${value}${unit}`])),
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

        const okMsg: ChatMessage = {
          id: `sys-${Date.now()}`,
          role: 'assistant',
          content: `✅ 已按你的要求调整好今天的安排，首页已同步更新～`,
          time: timeStr,
        };
        setChatMessages((prev) => [...prev, okMsg]);
        setPendingAdjustment(null);
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

  // 加载聊天历史 + 历史洞察（持久化）
  useEffect(() => {
    if (tab === 'coach' && user && chatMessages.length === 0) {
      void fetch('/api/chat/messages')
        .then((r) => r.json())
        .then((data: { messages?: Array<{ role: string; content: string; createdAt: string }> }) => {
          const history = data.messages ?? [];
          if (history.length) {
            setChatMessages(history.map((m, i) => ({
              id: `h-${i}-${m.createdAt}`,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              time: formatTime(m.createdAt),
            })));
          } else {
            setChatMessages([welcomeMessage]);
          }
        })
        .catch(() => setChatMessages([welcomeMessage]));
    }
  }, [tab, user]);

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

  const tabItems: [Tab, string, typeof Home][] = [
    ['today', '今日', Home],
    ['plan', '计划', CalendarRange],
    ['coach', '营养师', Bot],
    ['fridge', '冰箱', Refrigerator],
    ['body', '身体', Activity],
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--grouped-background)] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[var(--system-green)]" />
      </div>
    );
  }

  if (!user) return null;

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
                  onClick={() => setInsightsOpen(true)}
                  className="fixed right-4 bottom-[92px] z-40 size-12 rounded-2xl bg-[var(--system-blue)]/95 text-white shadow-lg shadow-[var(--system-blue)]/30 flex items-center justify-center press-effect backdrop-blur-md"
                  aria-label="查看最近洞察"
                >
                  <Sparkles className="size-5" />
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--system-red)] text-white text-[11px] font-semibold flex items-center justify-center border-2 border-[var(--background)]">
                    {savedInsights.filter((i) => !i.readAt).length}
                  </span>
                </button>
              ) : (
                <div className="fixed right-4 bottom-[92px] z-40 w-[300px] max-h-[440px] flex flex-col rounded-2xl bg-[var(--ios-card)]/92 backdrop-blur-xl border border-[var(--separator)] shadow-2xl overflow-hidden">
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
            agentAnalyzing={agentAnalyzing}
            agentResult={fridgeResult}
            onInsightRead={markInsightRead}
            onInsightAction={handleInsightAction}
            onAddFood={addFood}
          />
        )}
        {tab === 'body' && (
          <BodyView
            onGenerate={() => { setTab('plan'); void generateWeeklyPlan(); }}
            onAgentAnalyze={() => triggerAgentAnalysis('body', '身体数据有更新')}
            agentAnalyzing={agentAnalyzing}
            agentResult={bodyResult}
            onInsightRead={markInsightRead}
            onInsightAction={handleInsightAction}
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
    </div>
  );
}

/* ==================== Today View ==================== */

function TodayView({
  user, todayData, loading, generating, error, onGenerate, onPlan, onBody, onProfile, onShopping,
}: {
  user: AuthUser;
  todayData: TodayData | null;
  loading: boolean;
  generating: boolean;
  error: string;
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

      {/* Loading */}
      {loading && (
        <div className="bg-[var(--secondary-grouped-background)] rounded-2xl p-8 text-center mb-5">
          <Loader2 className="size-6 animate-spin text-[var(--system-green)] mx-auto" />
          <p className="text-[14px] text-[var(--secondary-label)] mt-3">加载中…</p>
        </div>
      )}

      {/* No plan yet */}
      {!loading && !hasPlan && (
        <div className="bg-gradient-to-br from-[#174f3c] to-[#2b7b5d] rounded-2xl p-6 text-white mb-5">
          <Zap className="size-9" />
          <h2 className="text-[22px] font-bold mt-4">还没有本周计划</h2>
          <p className="mt-2 text-[14px] leading-[22px] text-[#c5ddd3]">
            AI 营养师会根据你的身体数据和冰箱库存，生成整周食谱和采购清单。
          </p>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="mt-5 w-full h-11 rounded-xl bg-white text-[#174f3c] font-semibold flex items-center justify-center gap-2 press-effect disabled:opacity-50"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating ? '生成中…' : '生成本周计划'}
          </button>
          {error && (
            <p className="mt-3 text-[12px] text-[#ffb3b3]">{error}</p>
          )}
        </div>
      )}

      {/* Plan exists: today's summary */}
      {!loading && hasPlan && todayData && (
        <>
          {/* Calories Ring Card */}
          <div className="bg-gradient-to-br from-[var(--system-green)] to-[#30B050] rounded-2xl p-5 text-white mb-5 shadow-lg shadow-green-500/20">
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

function BodyView({ onGenerate, onAgentAnalyze, agentAnalyzing, agentResult, onInsightRead, onInsightAction }: {
  onGenerate: () => void;
  onAgentAnalyze: () => void;
  agentAnalyzing: boolean;
  agentResult: { success: boolean; count?: number; message?: string; insights?: Insight[] } | null;
  onInsightRead: (id: number) => void;
  onInsightAction: (id: number, action: 'accept' | 'dismiss') => void;
}) {
  const [selMetric, setSelMetric] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState<'manual' | 'image'>('manual');
  const [parsing, setParsing] = useState(false);
  const [upMsg, setUpMsg] = useState('');
  const [manualBody, setManualBody] = useState<Record<string, string>>({});
  return (
    <div className="max-w-2xl mx-auto px-4 pb-6">
      <div className="pt-2 pb-4">
        <p className="text-[13px] text-[var(--secondary-label)]">2026-03-16 · 沐米体脂秤</p>
        <h1 className="text-large-title">身体数据</h1>
      </div>

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

      {/* 就地建议卡片 */}
      {agentResult?.insights && agentResult.insights.length > 0 && (
        <div className="space-y-2 mb-4">
          {agentResult.insights.map((ins) => (
            <div
              key={ins.id}
              className={`rounded-2xl px-4 py-3 ${
                ins.type === 'warning'
                  ? 'bg-[var(--system-red)]/8 border border-[var(--system-red)]/18'
                  : ins.type === 'suggestion'
                    ? 'bg-[var(--system-blue)]/6 border border-[var(--system-blue)]/18'
                    : 'bg-[var(--secondary-grouped-background)]'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {ins.type === 'warning' ? (
                  <AlertCircle className="size-4 text-[var(--system-red)] shrink-0 mt-0.5" />
                ) : ins.type === 'suggestion' ? (
                  <Sparkles className="size-4 text-[var(--system-blue)] shrink-0 mt-0.5" />
                ) : (
                  <Info className="size-4 text-[var(--system-green)] shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold leading-[18px] text-[var(--label)]">{ins.title}</p>
                  <p className="text-[12px] text-[var(--secondary-label)] leading-[18px] mt-0.5">{ins.content}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => onInsightRead(ins.id)}
                      className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-[var(--system-gray5)] text-[var(--secondary-label)] press-effect"
                    >
                      已读
                    </button>
                    <button
                      onClick={() => onInsightAction(ins.id, 'accept')}
                      className="px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[var(--system-green)] text-white press-effect"
                    >
                      去调整
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Agent Status */}
      <div className="mb-5 bg-[var(--system-blue)]/5 border border-[var(--system-blue)]/20 rounded-2xl p-3 flex items-center gap-3">
        <div className="relative">
          <Bot className="size-5 text-[var(--system-blue)]" />
          <span className="absolute -top-0.5 -right-0.5 size-2 bg-[var(--system-green)] rounded-full animate-pulse" />
        </div>
        <p className="text-[12px] text-[var(--secondary-label)] leading-[18px]">
          AI 营养师 Agent 模式：主动监控身体变化，体重波动时自动调整饮食建议。
        </p>
      </div>

      {/* Weight Summary */}
      <div className="grid gap-3 mb-5 md:grid-cols-3">
        <div className="bg-gradient-to-br from-[#E2F5FB] to-white dark:from-[#1a3a45] dark:to-[var(--secondary-grouped-background)] rounded-2xl p-5 md:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[13px] text-[#56727c] dark:text-[#7fb0c0]">当前体重</p>
              <p className="text-[36px] font-bold tracking-tight mt-1">53.4<span className="text-[14px] font-normal ml-1 text-[var(--secondary-label)]">kg</span></p>
            </div>
            <span className="bg-white dark:bg-[var(--system-gray5)] text-[var(--system-green)] text-[12px] font-semibold px-2.5 py-1 rounded-full">
              BMI 标准
            </span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <MiniStat light label="水分" value="28.2kg" />
            <MiniStat light label="脂肪" value="14.2kg" />
            <MiniStat light label="蛋白质" value="8.3kg" />
          </div>
        </div>

        <div className="bg-[var(--secondary-grouped-background)] rounded-2xl p-4">
          <p className="text-[14px] font-medium mb-3">设备建议</p>
          <div className="space-y-2 text-[14px]">
            <div className="flex justify-between">
              <span className="text-[var(--secondary-label)]">标准体重</span>
              <b>54.0 kg</b>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--secondary-label)]">脂肪控制</span>
              <b className="text-[var(--system-red)]">−1.8 kg</b>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--secondary-label)]">肌肉控制</span>
              <b className="text-[var(--system-green)]">+2.4 kg</b>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <SectionTitle eyebrow="全部指标" title="详细数据（点击查看标准区间）" />
      <div className="grid grid-cols-2 gap-3 mb-5 md:grid-cols-3 lg:grid-cols-6">
        {metrics.map(([name, value, unit, note, status]) => (
          <button key={name} onClick={() => setSelMetric(name)} className="text-left press-effect">
            <MetricCard name={name} value={manualBody[name] ?? value} unit={unit} note={note} status={status as string} />
          </button>
        ))}
      </div>

      {/* Info Box */}
      <div className="flex gap-3 p-4 bg-[var(--secondary-grouped-background)] rounded-2xl text-[13px] leading-[18px] text-[var(--secondary-label)]">
        <Info className="size-5 shrink-0 text-[var(--system-blue)] mt-0.5" />
        <p>体脂秤使用生物电阻抗估算；饮水、进食、运动、经期都会改变结果。建议每天在相似条件下测量。标准区间为常见健康参考，不构成医疗建议。</p>
      </div>

      {/* 指标详情（标准 + 我的区间） */}
      {(() => {
        if (!selMetric) return null;
        const m = metrics.find(([n]) => n === selMetric);
        if (!m) return null;
        const [name, defVal, unit, note, status] = m;
        const value = (manualBody[name] ?? defVal) as string;
        const std = STANDARDS[name];
        const num = parseFloat(value);
        const hasRange = !!std && std.low != null && std.high != null;
        const pct = hasRange
          ? Math.min(100, Math.max(0, ((num - std!.low!) / (std!.high! - std!.low!)) * 100))
          : 50;
        const statusText = status === 'good' ? '良好' : status === 'warn' ? '需留意' : '标准';
        return (
          <Sheet open onClose={() => setSelMetric(null)} title={name}>
            <div className="px-5 pb-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[13px] text-[var(--secondary-label)]">你的当前值</p>
                  <p className="mt-1 text-[40px] font-bold tracking-tight text-[var(--label)]">
                    {value}<span className="ml-1 text-[18px] font-medium text-[var(--secondary-label)]">{unit}</span>
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-[12px] font-semibold ${
                    status === 'warn'
                      ? 'bg-[var(--system-orange)]/12 text-[var(--system-orange)]'
                      : status === 'good'
                        ? 'bg-[var(--system-green)]/12 text-[var(--system-green)]'
                        : 'bg-[var(--system-blue)]/12 text-[var(--system-blue)]'
                  }`}
                >
                  {statusText}
                </span>
              </div>

              {hasRange && (
                <div className="mt-6">
                  <div className="flex justify-between text-[12px] text-[var(--secondary-label)] mb-1.5">
                    <span>{std!.low}{unit}</span>
                    <span>标准范围</span>
                    <span>{std!.high}{unit}</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-[var(--system-gray5)]">
                    <div
                      className="absolute top-0 left-0 h-full rounded-full bg-[var(--system-green)]/70"
                      style={{ width: '100%' }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-white bg-[var(--system-blue)] shadow"
                      style={{ left: `calc(${pct}% - 8px)` }}
                    />
                  </div>
                  <p className="mt-2 text-[12px] text-[var(--secondary-label)]">
                    {num < std!.low!
                      ? `${name} 低于标准下限`
                      : num > std!.high!
                        ? `${name} 高于标准上限`
                        : `${name} 处于标准范围内`}
                  </p>
                </div>
              )}

              <div className="mt-5 rounded-2xl bg-[var(--secondary-grouped-background)] p-4">
                <p className="text-[13px] font-semibold text-[var(--label)] mb-1.5">参考说明</p>
                <p className="text-[13px] leading-[21px] text-[var(--secondary-label)]">{std?.guide}</p>
                {note && (
                  <p className="mt-2 text-[12px] text-[var(--tertiary-label)]">设备备注：{note}</p>
                )}
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
            <p className={`mb-3 text-[13px] rounded-xl px-3 py-2 ${
              upMsg.startsWith('已')
                ? 'bg-[var(--system-green)]/10 text-[var(--system-green)]'
                : 'bg-[var(--system-orange)]/10 text-[var(--system-orange)]'
            }`}>
              {upMsg}
            </p>
          )}

          {uploadTab === 'manual' ? (
            <>
              <div className="bg-[var(--secondary-grouped-background)] rounded-2xl overflow-hidden mb-4">
                {(['体重', 'BMI', '体脂率', '内脏脂肪', '肌肉率', '基础代谢'] as const).map((f) => (
                  <label key={f} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-[var(--separator)]">
                    <span className="text-[14px] text-[var(--label)] w-20 shrink-0">{f}</span>
                    <input
                      value={manualBody[f] ?? ''}
                      onChange={(e) => setManualBody((prev) => ({ ...prev, [f]: e.target.value }))}
                      placeholder="留空则沿用当前值"
                      inputMode="decimal"
                      className="flex-1 min-w-0 bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--tertiary-label)] outline-none text-right"
                    />
                  </label>
                ))}
              </div>
              <button
                onClick={() => {
                  setUploadTab('image'); setUpMsg('');
                }}
                className="w-full h-12 rounded-2xl bg-[var(--system-green)] text-white text-[15px] font-semibold press-effect"
              >
                保存并同步
              </button>
              <p className="mt-2 text-[12px] text-[var(--tertiary-label)] text-center">已填写的指标会即时更新上方数值</p>
            </>
          ) : (
            <>
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUpMsg(''); setParsing(true);
                    const reader = new FileReader();
                    reader.onload = async () => {
                      try {
                        const res = await fetch('/api/body/parse', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ image: reader.result as string }),
                        });
                        const data = await res.json();
                        if (data.metrics && Object.keys(data.metrics).length) {
                          setManualBody((prev) => ({ ...prev, ...data.metrics }));
                          setUpMsg(data.message || '已解析并更新指标 ✨');
                        } else {
                          setUpMsg(data.error || '解析失败，请换张清晰的截图或手动填写');
                        }
                      } catch {
                        setUpMsg('解析失败，请换张清晰的截图或手动填写');
                      } finally {
                        setParsing(false);
                        e.target.value = '';
                      }
                    };
                    reader.readAsDataURL(file);
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
  zones, foods, onSettings, onGenerate, onAgentAnalyze, agentAnalyzing, agentResult, onInsightRead, onInsightAction, onAddFood,
}: {
  zones: Zone[];
  foods: { name: string; zone: string; amount: string; days: number; icon: string; shelf: number }[];
  onSettings: () => void;
  onGenerate: () => void;
  onAgentAnalyze: () => void;
  agentAnalyzing: boolean;
  agentResult: { success: boolean; count?: number; message?: string; insights?: Insight[] } | null;
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

      {/* AI Analysis Result */}
      {agentResult && (
        <div className={`mt-4 rounded-2xl p-3 flex items-start gap-3 ${
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

      {/* In-place AI insights from fridge analysis */}
      {agentResult?.success && agentResult.insights && agentResult.insights.length > 0 && (
        <div className="mt-3 space-y-2">
          {agentResult.insights.map((ins) => (
            <div
              key={ins.id}
              className={`rounded-2xl p-3.5 ${
                ins.type === 'warning'
                  ? 'bg-[var(--system-red)]/8 border border-[var(--system-red)]/18'
                  : ins.type === 'suggestion'
                    ? 'bg-[var(--system-blue)]/6 border border-[var(--system-blue)]/18'
                    : 'bg-[var(--secondary-grouped-background)]'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {ins.type === 'warning' ? (
                  <AlertCircle className="size-4 text-[var(--system-red)] shrink-0 mt-0.5" />
                ) : ins.type === 'suggestion' ? (
                  <Sparkles className="size-4 text-[var(--system-blue)] shrink-0 mt-0.5" />
                ) : (
                  <Info className="size-4 text-[var(--system-green)] shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold leading-[18px] text-[var(--label)]">{ins.title}</p>
                  <p className="text-[12px] text-[var(--secondary-label)] leading-[18px] mt-0.5">{ins.content}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => onInsightRead(ins.id)}
                      className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-[var(--system-gray5)] text-[var(--secondary-label)] press-effect"
                    >
                      已读
                    </button>
                    <button
                      onClick={() => onInsightAction(ins.id, 'accept')}
                      className="px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[var(--system-green)] text-white press-effect"
                    >
                      去调整
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Agent Status */}
      <div className="mt-4 bg-[var(--system-blue)]/5 border border-[var(--system-blue)]/20 rounded-2xl p-3 flex items-center gap-3">
        <div className="relative">
          <Bot className="size-5 text-[var(--system-blue)]" />
          <span className="absolute -top-0.5 -right-0.5 size-2 bg-[var(--system-green)] rounded-full animate-pulse" />
        </div>
        <p className="text-[12px] text-[var(--secondary-label)] leading-[18px]">
          AI 营养师 Agent 模式：主动监控冰箱变化，临期食材优先消耗。
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
      return weeklyData.days.map((d: any, i: number) => {
        const date = new Date(d.date);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekday = `周${weekdayNames[date.getDay()]}`;
        if (i === 0) return { main: '今天', sub: `${month}/${day}` };
        if (i === 1) return { main: '明天', sub: `${month}/${day}` };
        return { main: weekday, sub: `${month}/${day}` };
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

        <div className="bg-gradient-to-br from-[#174f3c] to-[#2b7b5d] rounded-2xl p-6 text-white mb-5">
          <CalendarRange className="size-9" />
          <h2 className="text-[22px] font-bold mt-4">整周饮食规划</h2>
          <p className="mt-2 text-[14px] leading-[22px] text-[#c5ddd3]">
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
      <div className="bg-gradient-to-br from-[var(--system-green)] to-[#30B050] rounded-2xl p-5 text-white mb-5 shadow-lg shadow-green-500/20">
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
          const hasData = dayData && dayData.meals && Object.keys(dayData.meals).length > 0;
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
      {currentDay && (
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
      {!currentDay && weeklyData?.days && weeklyData.days.length > 0 && (
        <div className="bg-[var(--system-gray5)]/50 rounded-2xl p-4 mb-5 text-center">
          <p className="text-[13px] text-[var(--secondary-label)]">这天还没有安排</p>
          <p className="text-[12px] text-[var(--tertiary-label)] mt-1">AI 只生成了 {weeklyData.days.length} 天的食谱</p>
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
            <p className="text-[14px] font-semibold">AI 营养师 Agent</p>
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
            <div className="size-10 rounded-full bg-gradient-to-br from-[var(--system-green)] to-[#30B050] flex items-center justify-center">
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
          Agent 模式已开启：我会主动关注你的身体和冰箱变化，有问题随时叫我～
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
              <div className="size-8 rounded-full bg-gradient-to-br from-[var(--system-green)] to-[#30B050] flex items-center justify-center mr-2 shrink-0 mt-0.5">
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
            <div className="size-8 rounded-full bg-gradient-to-br from-[var(--system-green)] to-[#30B050] flex items-center justify-center mr-2 shrink-0">
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

      {/* Pending Adjustment Card */}
      {pendingAdjustment && (
        <div className="px-4 pb-2">
          <div className="bg-[var(--system-blue)]/5 border border-[var(--system-blue)]/25 rounded-2xl p-3.5">
            <div className="flex items-start gap-2.5">
              <div className="size-8 rounded-full bg-[var(--system-blue)]/10 flex items-center justify-center shrink-0">
                <Sparkles className="size-4 text-[var(--system-blue)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[var(--system-blue)]">小养建议调整今天的安排</p>
                <p className="text-[11px] text-[var(--tertiary-label)] mt-0.5">你的需求：{pendingAdjustment.instruction}</p>
                <div className="mt-2 rounded-xl bg-[var(--secondary-grouped-background)] p-3">
                  <p className="text-[12px] font-semibold text-[var(--label)] mb-1">将怎么调整</p>
                  <p className={`text-[12px] text-[var(--secondary-label)] leading-[19px] whitespace-pre-line ${planExpanded ? '' : 'line-clamp-4'}`}>
                    {pendingAdjustment.aiPlan || 'AI 将根据你的新要求重新安排今天的早午晚餐。'}
                  </p>
                  {pendingAdjustment.aiPlan && (
                    <button
                      onClick={() => setPlanExpanded(!planExpanded)}
                      className="mt-2 text-[12px] font-medium text-[var(--system-blue)] press-effect flex items-center gap-0.5"
                    >
                      {planExpanded ? '收起' : '展开全部'}
                      <ChevronDown className={`size-3.5 transition-transform ${planExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[var(--tertiary-label)] mt-2">
                  确认后更新「今日」页食谱
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={onDismissAdjust}
                    disabled={adjusting}
                    className="flex-1 py-2 rounded-xl bg-[var(--secondary-grouped-background)] text-[14px] font-medium text-[var(--label)] press-effect disabled:opacity-50"
                  >
                    {adjusting ? '调整中…' : '暂不调整'}
                  </button>
                  <button
                    onClick={onConfirmAdjust}
                    disabled={adjusting}
                    className="flex-1 py-2 rounded-xl bg-[var(--system-green)] text-[14px] font-semibold text-white press-effect disabled:opacity-60"
                  >
                    {adjusting ? '调整中…' : '确认调整'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

function MetricCard({ name, value, unit, note, status }: { name: string; value: string; unit: string; note: string; status: string }) {
  return (
    <div className="bg-[var(--secondary-grouped-background)] rounded-2xl p-4 relative">
      <div className="flex items-start justify-between">
        <p className="text-[12px] text-[var(--secondary-label)]">{name}</p>
        {status === 'warn' && <span className="size-2 rounded-full bg-[var(--system-orange)]" />}
      </div>
      <p className="text-[20px] font-bold tracking-tight mt-2">
        {value}<span className="text-[10px] font-normal text-[var(--secondary-label)] ml-1">{unit}</span>
      </p>
      <p className={`text-[10px] mt-1 ${status === 'good' ? 'text-[var(--system-green)]' : status === 'warn' ? 'text-[var(--system-orange)]' : 'text-[var(--secondary-label)]'}`}>
        {note}
      </p>
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
