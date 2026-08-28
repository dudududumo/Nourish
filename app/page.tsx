'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, CalendarRange, Refrigerator, Activity, ChevronRight,
  Sparkles, TrendingDown, Dumbbell, Archive,
  Flame, Info, Settings, Send, Plus, X,
  LogOut, User, Loader2, AlertCircle,
  Bell, ChevronDown, ShoppingCart, Zap, Bot,
} from 'lucide-react';

type Tab = 'today' | 'plan' | 'fridge' | 'body';
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

const initialZones: Zone[] = [
  { id: 'fresh', name: '冷藏上层', type: '冷藏', capacity: 32, used: 21, icon: '🥬' },
  { id: 'drawer', name: '果蔬抽屉', type: '冷藏', capacity: 18, used: 10, icon: '🥑' },
  { id: 'freezer', name: '冷冻柜', type: '冷冻', capacity: 45, used: 24, icon: '🧊' },
];

const foods = [
  { name: '鸡腿肉', zone: '冷藏上层', amount: '460g', days: 2, icon: '🍗', shelf: 0 },
  { name: '小番茄', zone: '果蔬抽屉', amount: '320g', days: 3, icon: '🍅', shelf: 1 },
  { name: '虾仁', zone: '冷冻柜', amount: '300g', days: 24, icon: '🍤', shelf: 2 },
  { name: '牛油果', zone: '果蔬抽屉', amount: '2 个', days: 4, icon: '🥑', shelf: 1 },
];

type AuthUser = { id: string; phone: string; nickname: string | null };

export default function HomePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('today');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [fridgeSettings, setFridgeSettings] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [aiEndpoint, setAiEndpoint] = useState('https://ark.cn-beijing.volces.com/api/v3/chat/completions');
  const [aiModel, setAiModel] = useState('deepseek-v4-flash-ga-260731');
  const [aiKey, setAiKey] = useState('');
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [zones, setZones] = useState(initialZones);
  const [fridgeOpen, setFridgeOpen] = useState(false);
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
        // Reload today data
        const todayRes = await fetch('/api/plan/today');
        const todayData2 = await todayRes.json();
        setTodayData(todayData2);
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
      if (res.ok) {
        // Reload today data to show new insights
        const todayRes = await fetch('/api/plan/today');
        const todayData2 = await todayRes.json();
        setTodayData(todayData2);
      }
    } catch {
      // Silent fail - agent analysis is optional
    } finally {
      setAgentAnalyzing(false);
    }
  }

  // Load shopping list when sheet opens
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
            onInsightRead={markInsightRead}
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
        {tab === 'fridge' && (
          <FridgeView
            zones={zones}
            fridgeOpen={fridgeOpen}
            setFridgeOpen={setFridgeOpen}
            onSettings={() => setFridgeSettings(true)}
            onGenerate={() => { setTab('plan'); void generateWeeklyPlan(); }}
            onAgentAnalyze={() => triggerAgentAnalysis('fridge', '冰箱库存有更新')}
            agentAnalyzing={agentAnalyzing}
          />
        )}
        {tab === 'body' && (
          <BodyView
            onGenerate={() => { setTab('plan'); void generateWeeklyPlan(); }}
            onAgentAnalyze={() => triggerAgentAnalysis('body', '身体数据有更新')}
            agentAnalyzing={agentAnalyzing}
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
              </div>
              <div className="bg-[var(--secondary-grouped-background)] rounded-2xl overflow-hidden">
                {shoppingItems.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => toggleShoppingItem(item.id!, !item.purchased)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${
                      i !== shoppingItems.length - 1 ? 'border-b border-[var(--separator)]' : ''
                    } press-effect`}
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
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-[var(--secondary-label)] mt-4 px-1 leading-[18px]">
                点击食材标记为已采购。采购完成后可以在冰箱页添加到库存，AI 会自动调整后续食谱。
              </p>
            </>
          )}
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
  user, todayData, loading, generating, error, onGenerate, onPlan, onBody, onProfile, onShopping, onInsightRead,
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
  onInsightRead: (id: number) => void;
}) {
  const today = new Date();
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][today.getDay()];
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日`;

  const meals = todayData?.today.meals || {};
  const hasPlan = todayData?.hasPlan;

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
          {todayData?.insights && todayData.insights.length > 0 && (
            <button className="relative size-10 rounded-full bg-[var(--system-gray5)] flex items-center justify-center press-effect">
              <Bell className="size-5 text-[var(--label)]" />
              <span className="absolute top-1.5 right-1.5 size-2 bg-[var(--system-red)] rounded-full" />
            </button>
          )}
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

          {/* AI Insights */}
          {todayData.insights.length > 0 && (
            <div className="mb-5 space-y-2">
              {todayData.insights.slice(0, 3).map((insight) => (
                <button
                  key={insight.id}
                  onClick={() => onInsightRead(insight.id)}
                  className={`w-full text-left rounded-2xl p-4 flex items-start gap-3 ${
                    insight.type === 'warning'
                      ? 'bg-[var(--system-red)]/10 border border-[var(--system-red)]/20'
                      : insight.type === 'suggestion'
                        ? 'bg-[var(--system-blue)]/10 border border-[var(--system-blue)]/20'
                        : 'bg-[var(--secondary-grouped-background)]'
                  }`}
                >
                  {insight.type === 'warning' ? (
                    <AlertCircle className="size-5 text-[var(--system-red)] shrink-0 mt-0.5" />
                  ) : insight.type === 'suggestion' ? (
                    <Sparkles className="size-5 text-[var(--system-blue)] shrink-0 mt-0.5" />
                  ) : (
                    <Info className="size-5 text-[var(--system-green)] shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold">{insight.title}</p>
                    <p className="text-[12px] text-[var(--secondary-label)] mt-1 leading-[18px] line-clamp-2">{insight.content}</p>
                  </div>
                  <ChevronRight className="size-4 text-[var(--tertiary-label)] shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          )}

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
                    dishes.map((dish, i) => (
                      <div key={dish.id || i} className={`px-4 py-3 ${i !== dishes.length - 1 ? 'border-b border-[var(--separator)]' : ''}`}>
                        <div className="flex items-start justify-between">
                          <p className="text-[14px] font-medium">{dish.name}</p>
                          <span className="text-[11px] text-[var(--secondary-label)] shrink-0 ml-2">
                            {dish.calories} kcal
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {dish.ingredients.slice(0, 4).map((ing) => (
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
                          {dish.ingredients.length > 4 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--system-gray5)] text-[var(--secondary-label)]">
                              +{dish.ingredients.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
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

function BodyView({ onGenerate, onAgentAnalyze, agentAnalyzing }: {
  onGenerate: () => void;
  onAgentAnalyze: () => void;
  agentAnalyzing: boolean;
}) {
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

      {/* AI Agent Status */}
      <div className="mb-5 bg-[var(--system-blue)]/5 border border-[var(--system-blue)]/20 rounded-2xl p-3 flex items-center gap-3">
        <div className="relative">
          <Bot className="size-5 text-[var(--system-blue)]" />
          <span className="absolute -top-0.5 -right-0.5 size-2 bg-[var(--system-green)] rounded-full animate-pulse" />
        </div>
        <p className="text-[12px] text-[var(--secondary-label)] leading-[18px]">
          AI 营养师正在监控你的身体变化。体重或体脂波动时，会主动调整饮食建议。
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
      <SectionTitle eyebrow="全部指标" title="详细数据" />
      <div className="grid grid-cols-2 gap-3 mb-5 md:grid-cols-3 lg:grid-cols-6">
        {metrics.map(([name, value, unit, note, status]) => (
          <MetricCard key={name} name={name} value={value} unit={unit} note={note} status={status as string} />
        ))}
      </div>

      {/* Info Box */}
      <div className="flex gap-3 p-4 bg-[var(--secondary-grouped-background)] rounded-2xl text-[13px] leading-[18px] text-[var(--secondary-label)]">
        <Info className="size-5 shrink-0 text-[var(--system-blue)] mt-0.5" />
        <p>体脂秤使用生物电阻抗估算；饮水、进食、运动、经期都会改变结果。建议每天在相似条件下测量。</p>
      </div>
    </div>
  );
}

/* ==================== Fridge View ==================== */

function FridgeView({
  zones, fridgeOpen, setFridgeOpen, onSettings, onGenerate, onAgentAnalyze, agentAnalyzing,
}: {
  zones: Zone[];
  fridgeOpen: boolean;
  setFridgeOpen: (v: boolean) => void;
  onSettings: () => void;
  onGenerate: () => void;
  onAgentAnalyze: () => void;
  agentAnalyzing: boolean;
}) {
  const total = useMemo(() => zones.reduce((s, z) => s + z.capacity, 0), [zones]);
  const used = useMemo(() => zones.reduce((s, z) => s + z.used, 0), [zones]);

  // Organize foods by shelf for 3D view
  const shelfFoods = useMemo(() => {
    const shelves: string[][] = [[], [], []];
    foods.forEach((f) => {
      if (f.shelf >= 0 && f.shelf < 3) shelves[f.shelf].push(f.icon);
    });
    return shelves;
  }, []);

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

      {/* 3D Fridge Scene */}
      <div
        className="fridge-scene bg-gradient-to-b from-[var(--system-gray6)] to-[var(--secondary-grouped-background)] rounded-2xl py-8 mb-5 cursor-pointer"
        onClick={() => setFridgeOpen(!fridgeOpen)}
      >
        <div className="fridge-body">
          <div className="fridge-cavity">
            {shelfFoods.map((items, i) => (
              <div
                key={i}
                className="fridge-shelf"
                style={{ top: `${20 + i * 110}px` }}
              >
                {items.slice(0, 4).map((icon, j) => (
                  <span key={j}>{icon}</span>
                ))}
              </div>
            ))}
          </div>
          <div className={`fridge-door ${fridgeOpen ? 'is-open' : ''}`}>
            <div className="fridge-brand">NOURISH</div>
            <div className="fridge-handle" />
          </div>
        </div>
        <p className="text-[13px] text-[var(--secondary-label)] mt-4 text-center">
          点击{fridgeOpen ? '关闭' : '打开'}冰箱门
        </p>
      </div>

      {/* Capacity Zones */}
      <SectionTitle eyebrow="空间使用" title="分区容量" />
      <div className="bg-[var(--secondary-grouped-background)] rounded-2xl overflow-hidden mb-5">
        {zones.map((z, i) => (
          <div key={z.id} className={`px-4 py-3.5 ${i !== zones.length - 1 ? 'border-b border-[var(--separator)]' : ''}`}>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{z.icon}</span>
                <span className="text-[15px] font-medium">{z.name}</span>
                <span className="text-[12px] text-[var(--secondary-label)]">{z.type}</span>
              </div>
              <span className="text-[14px] text-[var(--secondary-label)]">{z.used}/{z.capacity} L</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--system-gray5)]">
              <div
                className={`h-full rounded-full ${z.type === '冷冻' ? 'bg-[var(--system-blue)]' : 'bg-[var(--system-green)]'}`}
                style={{ width: `${Math.min(100, z.used / z.capacity * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Inventory List */}
      <SectionTitle eyebrow="库存" title="按到期顺序" action="添加" onAction={() => {}} />
      <div className="bg-[var(--secondary-grouped-background)] rounded-2xl overflow-hidden mb-5">
        {foods.map((food, i) => (
          <div
            key={food.name}
            className={`flex items-center gap-3 px-4 py-3.5 ${i !== foods.length - 1 ? 'border-b border-[var(--separator)]' : ''}`}
          >
            <span className="text-2xl">{food.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium">{food.name} · {food.amount}</p>
              <p className="text-[13px] text-[var(--secondary-label)]">{food.zone}</p>
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
        ))}
      </div>

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
          AI 营养师正在监控你的冰箱变化。新增食材或临期时，会主动给出食谱调整建议。
        </p>
      </div>
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
  const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const hasPlan = todayData?.hasPlan;

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
                <p className="text-[13px] text-[var(--label)] mt-1 leading-[18px]">{error}</p>
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
        {weekDays.map((day, i) => {
          const dayData = weeklyData?.days?.[i];
          const cal = dayData?.calories || 0;
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={`shrink-0 px-3 py-2 rounded-xl text-[12px] font-medium transition-all flex flex-col items-center min-w-[52px] ${
                selectedDay === i
                  ? 'bg-[var(--system-green)] text-white'
                  : 'bg-[var(--secondary-grouped-background)] text-[var(--secondary-label)]'
              }`}
            >
              <span>{day}</span>
              <span className={`text-[10px] mt-0.5 ${selectedDay === i ? 'text-white/80' : ''}`}>
                {cal > 0 ? `${Math.round(cal)}` : '—'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Day Summary */}
      {currentDay && (
        <div className="bg-[var(--secondary-grouped-background)] rounded-2xl p-4 mb-5 flex items-center justify-between">
          <div>
            <p className="text-[13px] text-[var(--secondary-label)]">{weekDays[selectedDay]} 总计</p>
            <p className="text-[22px] font-bold mt-1">{dayCalories} <span className="text-[13px] font-normal text-[var(--secondary-label)]">kcal</span></p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-[var(--secondary-label)]">蛋白质</p>
            <p className="text-[22px] font-bold mt-1 text-[var(--system-green)]">{dayProtein} <span className="text-[13px] font-normal">g</span></p>
          </div>
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
