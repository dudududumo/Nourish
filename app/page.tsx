'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, Activity, Refrigerator, Bot, ChevronRight,
  Sparkles, TrendingDown, Dumbbell, Archive,
  Flame, Info, Settings, Send, Plus, X,
  LogOut, User, Loader2, AlertCircle,
} from 'lucide-react';

type Tab = 'today' | 'body' | 'fridge' | 'coach';
type Zone = { id: string; name: string; type: '冷藏' | '冷冻'; capacity: number; used: number; icon: string };

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
  const [aiOpen, setAiOpen] = useState(false);
  const [fridgeSettings, setFridgeSettings] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [aiEndpoint, setAiEndpoint] = useState('https://ark.cn-beijing.volces.com/api/v3/chat/completions');
  const [aiModel, setAiModel] = useState('deepseek-v4-flash-ga-260731');
  const [aiKey, setAiKey] = useState('');
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [zones, setZones] = useState(initialZones);
  const [prompt, setPrompt] = useState('为什么今天这样安排？');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [aiError, setAiError] = useState('');
  const [fridgeOpen, setFridgeOpen] = useState(false);

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

  async function askCoach(question = prompt) {
    if (!question.trim() || asking) return;
    setAsking(true); setAnswer(''); setAiError(''); setAiOpen(true);
    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question,
          context: {
            latestMeasurement: Object.fromEntries(metrics.map(([key, value, unit]) => [key, `${value}${unit}`])),
            zones,
            goal: '健康减脂并提升肌肉量',
            constraints: '宿舍环境、偏好普拉提、希望好吃易做',
          },
        }),
      });
      const data = await response.json() as { answer?: string; error?: string };
      if (!response.ok) {
        setAiError(data.error ?? '暂时无法连接营养师，请稍后再试。');
      } else {
        setAnswer(data.answer ?? '');
      }
    } catch {
      setAiError('网络连接失败，请稍后再试。');
    } finally {
      setAsking(false);
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

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const tabItems: [Tab, string, typeof Home][] = [
    ['today', '今日', Home],
    ['body', '身体', Activity],
    ['fridge', '冰箱', Refrigerator],
    ['coach', '营养师', Bot],
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
        {tab === 'today' && <TodayView user={user} onAsk={askCoach} onBody={() => setTab('body')} onProfile={() => setProfileOpen(true)} />}
        {tab === 'body' && <BodyView onAsk={askCoach} />}
        {tab === 'fridge' && <FridgeView zones={zones} fridgeOpen={fridgeOpen} setFridgeOpen={setFridgeOpen} onSettings={() => setFridgeSettings(true)} onAsk={askCoach} />}
        {tab === 'coach' && <CoachView onAsk={askCoach} onSettings={() => setAiSettingsOpen(true)} />}
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

      {/* AI Coach Sheet */}
      <Sheet open={aiOpen} onClose={() => setAiOpen(false)} title="轻养 AI 营养师">
        <div className="flex flex-col h-full">
          <div className="px-4 pb-3">
            <p className="text-[13px] text-[var(--secondary-label)] leading-[18px]">
              基于你的身体趋势、实际饮食、冰箱库存和训练恢复回答。
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4 ios-scroll">
            <div className="max-w-[88%] bg-[var(--secondary-grouped-background)] rounded-2xl rounded-tl-md px-4 py-3 text-[15px] leading-[22px] shadow-sm">
              <p className="mb-1 font-semibold text-[var(--system-green)]">今天我会重点看三件事</p>
              <p className="text-[var(--secondary-label)]">体重与体脂的长期趋势、蛋白质是否分布到每餐，以及冰箱中临期食材是否能在营养目标内优先消耗。你可以质疑或调整任何建议。</p>
            </div>

            {asking && (
              <div className="w-fit bg-[var(--secondary-grouped-background)] rounded-full px-4 py-2 text-[13px] text-[var(--secondary-label)] shadow-sm">
                正在结合你的数据分析…
              </div>
            )}

            {aiError && (
              <div className="bg-[var(--system-orange)]/10 border border-[var(--system-orange)]/20 rounded-2xl px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="size-5 text-[var(--system-orange)] shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold text-[var(--system-orange)]">暂时无法使用</p>
                    <p className="text-[13px] text-[var(--label)] mt-1 leading-[18px]">{aiError}</p>
                    {aiError.includes('AI 设置') || aiError.includes('配置') ? (
                      <button
                        onClick={() => { setAiOpen(false); setAiSettingsOpen(true); }}
                        className="mt-3 text-[13px] font-medium text-[var(--system-blue)]"
                      >
                        去配置 →
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {answer && (
              <div className="max-w-[92%] whitespace-pre-wrap bg-[var(--secondary-grouped-background)] rounded-2xl rounded-tl-md px-4 py-3 text-[15px] leading-[22px] shadow-sm">
                {answer}
              </div>
            )}

            {!answer && !asking && (
              <div className="flex flex-wrap gap-2 pt-2">
                {['为什么不建议激进减脂？', '用冰箱现有食材换一份晚餐', '今天适合做普拉提吗？'].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setPrompt(q); void askCoach(q); }}
                    className="rounded-full bg-[var(--secondary-grouped-background)] px-3 py-2 text-[13px] text-[var(--system-blue)] press-effect"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t border-[var(--separator)] bg-[var(--secondary-grouped-background)] p-3">
            <input
              className="ios-input flex-1"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void askCoach()}
              placeholder="问我任何饮食或训练问题"
            />
            <button
              className="w-9 h-9 rounded-full bg-[var(--system-green)] text-white flex items-center justify-center press-effect disabled:opacity-50"
              onClick={() => void askCoach()}
              disabled={asking}
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      </Sheet>

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
  user, onAsk, onBody, onProfile,
}: {
  user: AuthUser;
  onAsk: (q: string) => void;
  onBody: () => void;
  onProfile: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 pb-6">
      {/* Header with avatar */}
      <div className="flex items-center justify-between pt-2 pb-4">
        <div>
          <p className="text-[13px] text-[var(--secondary-label)]">你好，{user.nickname || '轻养用户'}</p>
          <h1 className="text-large-title">今日</h1>
        </div>
        <button onClick={onProfile} className="size-10 rounded-full bg-[var(--system-green)]/10 text-[var(--system-green)] flex items-center justify-center press-effect">
          <User className="size-5" />
        </button>
      </div>

      {/* Weight Summary Card */}
      <div className="bg-gradient-to-br from-[var(--system-green)] to-[#30B050] rounded-2xl p-5 text-white mb-5 shadow-lg shadow-green-500/20">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] text-white/80">身体基线 · 待更新</p>
            <p className="text-[34px] font-bold tracking-tight mt-1">53.4 <span className="text-[17px] font-normal">kg</span></p>
          </div>
          <button onClick={onBody} className="bg-white/20 rounded-full p-2 press-effect">
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniStat label="体脂率" value="26.5%" />
          <MiniStat label="肌肉量" value="37.0kg" />
          <MiniStat label="得分" value="80" />
        </div>
        <div className="mt-4 rounded-xl bg-white/15 p-3 text-[13px] leading-[18px] text-white/90">
          方向：不追求继续降体重，优先轻微减脂并提升肌肉。
        </div>
      </div>

      {/* Meals Section */}
      <SectionTitle eyebrow="今日餐桌" title="先用临期食材" action="AI 调整" onAction={() => onAsk('请结合我的体脂秤数据和冰箱库存，调整今天三餐并逐条解释原因。')} />

      <div className="bg-[var(--secondary-grouped-background)] rounded-2xl overflow-hidden mb-5">
        {[
          ['早', '鸡蛋牛油果吐司', '约 430 kcal · 蛋白质 24g', '🥑'],
          ['午', '番茄菌菇鸡腿饭', '约 560 kcal · 蛋白质 38g', '🍅'],
          ['晚', '柠檬虾仁蔬菜碗', '约 420 kcal · 蛋白质 32g', '🍤'],
        ].map((m, i) => (
          <MealRow key={m[0]} label={m[0]} name={m[1]} detail={m[2]} emoji={m[3]} last={i === 2} />
        ))}
      </div>

      <p className="text-[12px] text-[var(--secondary-label)] leading-[18px] -mt-3 mb-5 px-1">
        以上热量仍是临时示例范围；完成性别、年龄、身高、活动量后 AI 才会生成正式目标。
      </p>

      {/* Why This Plan */}
      <SectionTitle eyebrow="计划说明" title="为什么这样规划" />

      <div className="bg-[var(--secondary-grouped-background)] rounded-2xl overflow-hidden mb-5">
        <ReasonItem icon={<TrendingDown className="size-5" />} iconBg="bg-[var(--system-blue)]/10" iconColor="text-[var(--system-blue)]" title="不做大热量缺口" text="BMI 20.9 已在正常范围，目标更适合身体重组。" />
        <ReasonItem icon={<Dumbbell className="size-5" />} iconBg="bg-[var(--system-orange)]/10" iconColor="text-[var(--system-orange)]" title="每餐分配蛋白质" text="蛋白质分散到三餐而非集中在晚餐。" />
        <ReasonItem icon={<Archive className="size-5" />} iconBg="bg-[var(--system-green)]/10" iconColor="text-[var(--system-green)]" title="库存优先" text="先用临期食材，减少浪费。" last />
      </div>

      {/* Fasting Card */}
      <div className="bg-[var(--secondary-grouped-background)] rounded-2xl p-4 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[var(--system-orange)]">轻断食</p>
            <h3 className="text-[16px] font-semibold mt-1">暂不自动开启</h3>
          </div>
          <Flame className="size-6 text-[var(--system-orange)]" />
        </div>
        <p className="text-[13px] text-[var(--secondary-label)] leading-[18px] mt-3">
          确认安全信息前，不执行强制断食。
        </p>
      </div>
    </div>
  );
}

/* ==================== Body View ==================== */

function BodyView({ onAsk }: { onAsk: (q: string) => void }) {
  return (
    <div className="max-w-2xl mx-auto px-4 pb-6">
      <div className="pt-2 pb-4">
        <p className="text-[13px] text-[var(--secondary-label)]">2026-03-16 · 沐米体脂秤</p>
        <h1 className="text-large-title">身体数据</h1>
      </div>

      <button
        className="w-full mb-5 ios-button bg-[var(--system-green)] text-white"
        onClick={() => onAsk('请解读我全部体脂秤指标：区分可直接采用、只看趋势、需要复测和需要就医关注的项目。')}
      >
        <Sparkles className="size-4" />
        AI 全面解读
      </button>

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
  zones, fridgeOpen, setFridgeOpen, onSettings, onAsk,
}: {
  zones: Zone[];
  fridgeOpen: boolean;
  setFridgeOpen: (v: boolean) => void;
  onSettings: () => void;
  onAsk: (q: string) => void;
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

      <button
        className="w-full ios-button bg-[var(--system-green)] text-white"
        onClick={() => onAsk('请根据冷藏和冷冻分区容量、现有库存与保质期，生成三天采购清单，并解释每样食材放在哪里。')}
      >
        <Bot className="size-4" />
        让 AI 规划采购
      </button>
    </div>
  );
}

/* ==================== Coach View ==================== */

function CoachView({ onAsk, onSettings }: { onAsk: (q: string) => void; onSettings: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-4 pb-6">
      <div className="pt-2 pb-4 flex items-end justify-between">
        <h1 className="text-large-title">营养师</h1>
        <button
          onClick={onSettings}
          className="bg-[var(--system-gray5)] text-[var(--label)] rounded-full px-4 py-2 text-[14px] font-medium press-effect flex items-center gap-1.5"
        >
          <Settings className="size-4" />
          设置
        </button>
      </div>

      {/* Hero Card */}
      <div className="bg-gradient-to-br from-[#174f3c] to-[#2b7b5d] rounded-2xl p-6 text-white mb-5">
        <Bot className="size-9" />
        <h2 className="text-[24px] font-bold mt-4">随叫随到的营养师</h2>
        <p className="mt-2 text-[14px] leading-[22px] text-[#c5ddd3]">
          每次建议都说明使用了哪些数据、哪些是估算、为什么调整。
        </p>
      </div>

      {/* Quick Actions */}
      <SectionTitle eyebrow="快捷功能" title="我想..." />
      <div className="grid gap-3 mb-5 sm:grid-cols-2">
        {[
          ['生成 3 天计划', '结合身体趋势、预算和库存'],
          ['追问每顿原因', '热量、蛋白质、饱腹感'],
          ['替换菜谱', '不爱吃、没时间时重排'],
          ['训练恢复建议', '普拉提、步行安排'],
        ].map(([t, d]) => (
          <button
            key={t}
            onClick={() => onAsk(`请开始"${t}"，并先告诉我你还缺少哪些必要信息。`)}
            className="bg-[var(--secondary-grouped-background)] rounded-2xl p-4 text-left press-effect"
          >
            <p className="text-[15px] font-semibold">{t}</p>
            <p className="mt-1 text-[12px] text-[var(--secondary-label)] leading-[18px]">{d}</p>
            <ChevronRight className="mt-3 size-4 text-[var(--system-green)]" />
          </button>
        ))}
      </div>

      {/* Safety */}
      <div className="bg-[var(--secondary-grouped-background)] rounded-2xl p-4">
        <h3 className="text-[15px] font-semibold">安全边界</h3>
        <p className="mt-2 text-[13px] text-[var(--secondary-label)] leading-[18px]">
          不诊断疾病、不把断食当惩罚。出现头晕心悸、月经异常等不适时建议就医。
        </p>
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
