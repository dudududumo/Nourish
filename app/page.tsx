'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, CalendarRange, Refrigerator, Activity, ChevronRight,
  Sparkles, Info, Plus, LogOut, User, Loader2, AlertCircle,
  ShoppingCart, Bot, Minus, Timer,
} from 'lucide-react';
import { todayStr } from '@/lib/utils';
import { Sheet } from '@/app/home/shared-components';
import { TodayView } from '@/app/home/today-view';
import { FastingView } from '@/app/home/fasting-view';
import { PlanView } from '@/app/home/plan-view';
import { CoachChatView } from '@/app/home/coach-chat-view';
import { FridgeView } from '@/app/home/fridge-view';
import { metrics } from '@/app/home/body-standards';
import { BodyView } from '@/app/home/body-view';
import type { AdjustPreview, AuthUser, ChatMessage, FastingData, Insight, ShoppingItem, Tab, TodayData, Zone } from '@/app/home/types';

const initialZones: Zone[] = [
  { id: 'fridge', name: '冷藏', type: '冷藏', capacity: 50, used: 0, icon: '🧊' },
  { id: 'freezer', name: '冷冻', type: '冷冻', capacity: 45, used: 0, icon: '❄️' },
];

const initialFoods: { name: string; zone: string; amount: string; days: number; icon: string; shelf: number }[] = [];

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
            hasBody={Boolean(bodyLatest && Object.keys(bodyLatest).length)}
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
              type="button"
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
            <a href="/evaluation" className="w-full flex items-center justify-between px-4 py-3.5 border-b border-[var(--separator)] press-effect">
              <span className="text-[15px]">AI 评测中心</span>
              <ChevronRight className="size-5 text-[var(--tertiary-label)]" />
            </a>
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

/* ==================== Today View ==================== */

/* ==================== Body View ==================== */

/* ==================== Fridge View ==================== */

/* ==================== Coach View ==================== */

/* ==================== Coach Chat View ==================== */
