'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Apple, Archive, ArrowUpRight, Bot, Check, ChevronRight, CircleHelp, Dumbbell, Flame, HeartPulse, Home, Info, Leaf, MessageCircle, Plus, Refrigerator, Send, Settings2, Snowflake, Sparkles, TrendingDown, Utensils, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';

type Tab = 'today' | 'body' | 'fridge' | 'coach';
type Zone = { id: string; name: string; type: '冷藏' | '冷冻'; capacity: number; used: number; icon: string };

const metrics = [
  ['体重', '53.4', 'kg', '较上次 +0.3', 'normal'], ['BMI', '20.9', '', '标准', 'normal'], ['体脂率', '26.5', '%', '较上次 −0.4', 'normal'], ['脂肪量', '14.2', 'kg', '趋势下降', 'normal'],
  ['肌肉量', '37.0', 'kg', '较上次 +0.5', 'good'], ['肌肉率', '69.3', '%', '较上次 +0.4', 'good'], ['骨骼肌', '19.5', 'kg', '较上次 +0.7', 'good'], ['去脂体重', '39.2', 'kg', '较上次 +0.4', 'good'],
  ['体水分', '52.8', '%', '较上次 +1.4', 'normal'], ['蛋白质率', '15.5', '%', '较上次 +1.3', 'normal'], ['骨量', '2.2', 'kg', '正常', 'normal'], ['骨盐率', '4.1', '%', '正常', 'normal'],
  ['内脏脂肪', '7', '级', '留意趋势', 'warn'], ['基础代谢', '1217', 'kcal', '估算值', 'normal'], ['腰臀比', '1.1', '', '建议复测', 'warn'], ['心率', '102', '次/分', '静息时需复测', 'warn'],
  ['身体得分', '80', '分', '整体健康', 'good'], ['身体年龄', '18', '岁', '设备估算', 'normal'],
] as const;

const initialZones: Zone[] = [
  { id: 'fresh', name: '冷藏上层', type: '冷藏', capacity: 32, used: 21, icon: '🥬' },
  { id: 'drawer', name: '果蔬抽屉', type: '冷藏', capacity: 18, used: 10, icon: '🥑' },
  { id: 'freezer', name: '冷冻柜', type: '冷冻', capacity: 45, used: 24, icon: '🧊' },
];

const foods = [
  { name: '鸡腿肉', zone: '冷藏上层', amount: '460g', days: 2, icon: '🍗' },
  { name: '小番茄', zone: '果蔬抽屉', amount: '320g', days: 3, icon: '🍅' },
  { name: '虾仁', zone: '冷冻柜', amount: '300g', days: 24, icon: '🍤' },
  { name: '牛油果', zone: '果蔬抽屉', amount: '2 个', days: 4, icon: '🥑' },
];

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('today');
  const [aiOpen, setAiOpen] = useState(false);
  const [fridgeSettings, setFridgeSettings] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [aiEndpoint, setAiEndpoint] = useState('https://ark.cn-beijing.volces.com/api/v3/chat/completions');
  const [aiModel, setAiModel] = useState('deepseek-v4-flash-ga-260731');
  const [aiKey, setAiKey] = useState('');
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [zones, setZones] = useState(initialZones);
  const [prompt, setPrompt] = useState('为什么今天这样安排？');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  async function askCoach(question = prompt) {
    if (!question.trim() || asking) return;
    setAsking(true); setAnswer(''); setAiOpen(true);
    try {
      const response = await fetch('/api/coach', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, context: { latestMeasurement: Object.fromEntries(metrics.map(([key, value, unit]) => [key, `${value}${unit}`])), zones, goal: '健康减脂并提升肌肉量', constraints: '宿舍环境、偏好普拉提、希望好吃易做' } }) });
      const data = await response.json() as { answer?: string; error?: string };
      setAnswer(data.answer ?? data.error ?? '暂时无法连接营养师，请稍后再试。');
    } catch { setAnswer('网络连接失败，请稍后再试。'); }
    finally { setAsking(false); }
  }

  async function saveAiConfig() {
    if (!aiKey.trim()) return;
    setAiSaving(true); setAiSaved(false);
    const response = await fetch('/api/settings/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: '火山方舟', endpoint: aiEndpoint, model: aiModel, apiKey: aiKey }) });
    setAiSaving(false);
    if (response.ok) { setAiKey(''); setAiSaved(true); setTimeout(() => setAiSettingsOpen(false), 800); }
  }

  return (
    <main className="min-h-screen bg-[#f2f2f7] pb-24 text-[#171719] md:pb-8">
      <header className="sticky top-0 z-30 border-b border-black/[.06] bg-white/82 backdrop-blur-2xl">
        <div className="mx-auto flex h-[62px] max-w-6xl items-center justify-between px-4 md:px-7">
          <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-[12px] bg-[#1c6b4a] text-white"><Leaf className="size-5" /></span><div><p className="text-[17px] font-semibold tracking-tight">轻养</p><p className="text-[10px] text-[#818188]">AI 营养师在线</p></div></div>
          <div className="flex items-center gap-2"><Badge className="hidden bg-[#e7f5ec] text-[#1c6b4a] sm:flex" variant="secondary"><span className="size-1.5 rounded-full bg-[#34c759]" />数据已保护</Badge><Button size="icon" variant="ghost" className="rounded-full" onClick={() => setAiOpen(true)} aria-label="打开 AI 营养师"><MessageCircle /></Button></div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5 md:px-7">
        {tab === 'today' && <TodayView onAsk={askCoach} onBody={() => setTab('body')} />}
        {tab === 'body' && <BodyView onAsk={askCoach} />}
        {tab === 'fridge' && <FridgeView zones={zones} onSettings={() => setFridgeSettings(true)} onAsk={askCoach} />}
        {tab === 'coach' && <CoachView onAsk={askCoach} onSettings={() => setAiSettingsOpen(true)} />}
      </div>

      <BottomNav tab={tab} setTab={setTab} />

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="h-[min(720px,92vh)] gap-0 overflow-hidden p-0 sm:max-w-xl">
          <div className="bg-[#174f3c] p-5 text-white"><DialogHeader><DialogTitle className="flex items-center gap-2 text-lg text-white"><span className="grid size-9 place-items-center rounded-full bg-white/12"><Bot /></span>轻养 AI 营养师</DialogTitle><DialogDescription className="text-[#bcd4ca]">基于你的身体趋势、实际饮食、冰箱库存和训练恢复回答。</DialogDescription></DialogHeader></div>
          <div className="flex min-h-0 flex-1 flex-col bg-[#f6f6f8]">
            <div className="flex-1 overflow-y-auto p-5">
              <div className="max-w-[88%] rounded-[18px] rounded-tl-[5px] bg-white p-4 text-sm leading-6 shadow-sm"><p className="mb-1 font-medium text-[#1c6b4a]">今天我会重点看三件事</p><p>体重与体脂的长期趋势、蛋白质是否分布到每餐，以及冰箱中临期食材是否能在营养目标内优先消耗。你可以质疑或调整任何建议。</p></div>
              {asking && <div className="mt-3 w-fit rounded-full bg-white px-4 py-2 text-sm text-[#777] shadow-sm">正在结合你的数据分析…</div>}
              {answer && <div className="mt-3 max-w-[92%] whitespace-pre-wrap rounded-[18px] rounded-tl-[5px] bg-white p-4 text-sm leading-6 shadow-sm">{answer}</div>}
              {!answer && !asking && <div className="mt-5 flex flex-wrap gap-2">{['为什么不建议激进减脂？','用冰箱现有食材换一份晚餐','今天适合做普拉提吗？'].map((q) => <button key={q} onClick={() => { setPrompt(q); void askCoach(q); }} className="rounded-full border bg-white px-3 py-2 text-xs text-[#436458]">{q}</button>)}</div>}
            </div>
            <div className="flex gap-2 border-t bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))]"><Input className="h-11 rounded-full bg-[#f2f2f7] px-4" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void askCoach()} placeholder="问我任何饮食或训练问题" /><Button className="size-11 rounded-full" size="icon" onClick={() => void askCoach()} disabled={asking}><Send /></Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={fridgeSettings} onOpenChange={setFridgeSettings}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="text-xl">设置冰箱容量与分区</DialogTitle><DialogDescription>容量用升（L）记录。每种食材也会估算占用体积，用于判断采购能否放得下。</DialogDescription></DialogHeader><div className="space-y-3">{zones.map((zone) => <div key={zone.id} className="grid grid-cols-[1fr_90px] items-end gap-3 rounded-2xl bg-[#f2f2f7] p-4"><div><Label>{zone.name}</Label><p className="mt-1 text-xs text-[#777]">{zone.type} · 当前约 {zone.used} L</p></div><div><Label className="mb-2 text-xs">总容量（L）</Label><Input type="number" min="1" value={zone.capacity} onChange={(e) => setZones((all) => all.map((z) => z.id === zone.id ? { ...z, capacity: Number(e.target.value) } : z))} /></div></div>)}</div><Button className="h-11 w-full rounded-xl" onClick={() => setFridgeSettings(false)}><Check />保存容量设置</Button></DialogContent>
      </Dialog>

      <Dialog open={aiSettingsOpen} onOpenChange={setAiSettingsOpen}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="text-xl">AI 服务设置</DialogTitle><DialogDescription>配置只属于你的模型服务。密钥通过 HTTPS 发送，并在服务端加密保存；页面不会再次显示密钥。</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>API 接口</Label><Input value={aiEndpoint} onChange={(e) => setAiEndpoint(e.target.value)} /></div><div className="space-y-2"><Label>模型名称</Label><Input value={aiModel} onChange={(e) => setAiModel(e.target.value)} /></div><div className="space-y-2"><Label>API Key</Label><Input type="password" autoComplete="off" value={aiKey} onChange={(e) => setAiKey(e.target.value)} placeholder="输入你的新密钥" /></div><div className="rounded-xl bg-[#fff6e7] p-3 text-xs leading-5 text-[#805d35]">请使用新密钥。曾经发到聊天里的旧密钥应当撤销。</div><Button className="h-11 w-full rounded-xl" disabled={!aiKey.trim() || aiSaving} onClick={() => void saveAiConfig()}>{aiSaved ? <><Check />已安全保存</> : aiSaving ? '正在加密保存…' : '保存并启用 AI 营养师'}</Button></div></DialogContent>
      </Dialog>
    </main>
  );
}

function TodayView({ onAsk, onBody }: { onAsk: (q: string) => void; onBody: () => void }) {
  return <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
    <section className="space-y-4"><div className="ios-card overflow-hidden bg-gradient-to-br from-[#174f3c] to-[#247052] p-5 text-white md:p-7"><div className="flex items-start justify-between"><div><p className="text-sm text-[#bcd4ca]">3 月 16 日身体基线 · 待更新</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.04em]">53.4 <span className="text-base font-normal">kg</span></h1></div><button onClick={onBody} className="rounded-full bg-white/12 p-2"><ArrowUpRight /></button></div><div className="mt-6 grid grid-cols-3 gap-2"><MiniStat label="体脂率" value="26.5%" /><MiniStat label="肌肉量" value="37.0kg" /><MiniStat label="身体得分" value="80" /></div><div className="mt-5 rounded-2xl bg-white/10 p-3 text-sm leading-5 text-[#e6f2ed]">方向：不追求继续降体重，优先轻微减脂并提升肌肉。当前数据不足以直接给出真实热量目标。</div></div>
      <section className="ios-card p-5"><SectionTitle eyebrow="今日餐桌" title="先用临期食材" action="让 AI 调整" onAction={() => onAsk('请结合我的体脂秤数据和冰箱库存，调整今天三餐并逐条解释原因。')} /><div className="mt-4 space-y-3">{[['早','鸡蛋牛油果吐司','约 430 kcal · 蛋白质 24g','🥑'],['午','番茄菌菇鸡腿饭','约 560 kcal · 蛋白质 38g','🍅'],['晚','柠檬虾仁蔬菜碗','约 420 kcal · 蛋白质 32g','🍤']].map((m) => <div key={m[0]} className="flex items-center gap-3 rounded-2xl bg-[#f6f6f8] p-3"><span className="grid size-12 place-items-center rounded-2xl bg-white text-2xl shadow-sm">{m[3]}</span><div className="min-w-0 flex-1"><p className="text-[15px] font-medium">{m[1]}</p><p className="text-xs text-[#777]">{m[2]}</p></div><span className="text-xs font-medium text-[#1c6b4a]">{m[0]}</span></div>)}</div><p className="mt-3 text-xs leading-5 text-[#777]">以上热量仍是临时示例范围；完成性别、实际年龄、身高、活动量与健康筛查后，AI 才会生成正式目标。</p></section>
    </section>
    <aside className="space-y-4"><section className="ios-card p-5"><SectionTitle eyebrow="今日解释" title="为什么这样规划" /><div className="mt-4 space-y-4"><Reason icon={<TrendingDown />} title="不做大热量缺口" text="BMI 20.9 已在正常范围，目标更适合身体重组，而不是追求秤重快速下降。" /><Reason icon={<Dumbbell />} title="每餐分配蛋白质" text="你希望减脂同时改善肌肉量，蛋白质会分散到三餐而非集中在晚餐。" /><Reason icon={<Archive />} title="库存优先" text="先用鸡腿肉和小番茄，减少浪费，再根据剩余容量生成采购清单。" /></div><Button variant="outline" className="mt-5 h-11 w-full rounded-xl" onClick={() => onAsk('请详细解释今天饮食和运动计划，并告诉我哪些是依据、哪些仍是估算。')}><CircleHelp />继续追问 AI</Button></section>
      <section className="ios-card p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-[#9a6b40]">轻断食</p><h3 className="mt-1 text-lg font-semibold">暂不自动开启</h3></div><Flame className="text-[#d07845]" /></div><p className="mt-3 text-sm leading-6 text-[#6e5947]">在确认实际年龄、月经/用药/低血糖等安全信息前，不执行强制断食。之后也只做可退出的温和打卡。</p></section></aside>
  </div>;
}

function BodyView({ onAsk }: { onAsk: (q: string) => void }) {
  return <section><div className="mb-4 flex items-end justify-between"><div><p className="text-sm text-[#777]">2026-03-16 · 沐米体脂秤 S400</p><h1 className="text-3xl font-semibold tracking-tight">身体数据</h1></div><Button className="rounded-full" onClick={() => onAsk('请解读我全部体脂秤指标：区分可直接采用、只看趋势、需要复测和需要就医关注的项目。')}><Sparkles />AI 全面解读</Button></div>
    <div className="mb-4 grid gap-3 md:grid-cols-3"><div className="ios-card bg-gradient-to-br from-[#e2f5fb] to-white p-5 md:col-span-2"><div className="flex items-start justify-between"><div><p className="text-sm text-[#56727c]">当前体重</p><p className="mt-1 text-5xl font-semibold tracking-[-.05em]">53.4<span className="ml-1 text-base font-normal">kg</span></p></div><Badge className="bg-white text-[#1c6b4a]">BMI 标准</Badge></div><div className="mt-6 grid grid-cols-3 gap-3"><MiniStat light label="水分量" value="28.2kg" /><MiniStat light label="脂肪量" value="14.2kg" /><MiniStat light label="蛋白质量" value="8.3kg" /></div></div><div className="ios-card p-5"><p className="text-sm font-medium">设备建议</p><div className="mt-3 space-y-2 text-sm"><p>标准体重 <b className="float-right">54.0 kg</b></p><p>脂肪控制 <b className="float-right text-[#c65c45]">−1.8 kg</b></p><p>肌肉控制 <b className="float-right text-[#1c6b4a]">+2.4 kg</b></p></div><p className="mt-4 rounded-xl bg-[#fff6e7] p-3 text-xs leading-5 text-[#8b653b]">这是设备算法建议，不会直接作为处方。</p></div></div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">{metrics.map(([name,value,unit,note,status]) => <article key={name} className="ios-card p-4"><div className="flex items-start justify-between"><p className="text-xs text-[#777]">{name}</p>{status === 'warn' && <span className="size-2 rounded-full bg-[#ff9f0a]" />}</div><p className="mt-2 text-2xl font-semibold tracking-tight">{value}<span className="ml-1 text-[11px] font-normal text-[#777]">{unit}</span></p><p className={`mt-1 text-[11px] ${status === 'good' ? 'text-[#1c8b59]' : status === 'warn' ? 'text-[#be7621]' : 'text-[#888]'}`}>{note}</p></article>)}</div>
    <div className="mt-4 ios-card flex gap-3 p-4 text-sm leading-6 text-[#555]"><Info className="mt-0.5 size-5 shrink-0 text-[#28735a]" /><p>体脂秤使用生物电阻抗估算身体组成；饮水、进食、运动、经期和测量时间都可能改变结果。系统会建议每天在相似条件下测量，并使用移动平均而不是追逐单次数字。</p></div>
  </section>;
}

function FridgeView({ zones, onSettings, onAsk }: { zones: Zone[]; onSettings: () => void; onAsk: (q: string) => void }) {
  const total = useMemo(() => zones.reduce((s,z) => s + z.capacity, 0), [zones]); const used = useMemo(() => zones.reduce((s,z) => s + z.used, 0), [zones]);
  return <section><div className="mb-4 flex items-end justify-between"><div><p className="text-sm text-[#777]">总容量 {total} L · 已用约 {used} L</p><h1 className="text-3xl font-semibold tracking-tight">我的冰箱</h1></div><Button variant="outline" className="rounded-full" onClick={onSettings}><Settings2 />设置容量</Button></div>
    <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]"><div className="ios-card overflow-hidden bg-[#183f34] p-5 text-white"><div className="flex items-center justify-between"><div><p className="text-sm text-[#bcd4ca]">空间利用率</p><p className="mt-1 text-3xl font-semibold">{Math.round(used / total * 100)}%</p></div><Refrigerator className="size-8 text-[#8ed0ae]" /></div><div className="mt-5 space-y-3">{zones.map((z) => <div key={z.id} className="rounded-2xl bg-white/10 p-3"><div className="flex justify-between text-sm"><span>{z.icon} {z.name}</span><span>{z.used}/{z.capacity} L</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-black/20"><div className={`h-full rounded-full ${z.type === '冷冻' ? 'bg-[#64d2ff]' : 'bg-[#7bd89e]'}`} style={{width:`${Math.min(100,z.used/z.capacity*100)}%`}} /></div></div>)}</div><Button className="mt-5 h-11 w-full rounded-xl bg-white text-[#174f3c] hover:bg-white/90" onClick={() => onAsk('请根据冷藏和冷冻分区容量、现有库存与保质期，生成三天采购清单，并解释每样食材放在哪里。')}><Bot />让 AI 规划采购</Button></div>
      <div className="ios-card p-5"><SectionTitle eyebrow="库存" title="按到期顺序使用" action="添加食材" /><div className="mt-4 space-y-2">{foods.map((food) => <div key={food.name} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 rounded-2xl bg-[#f6f6f8] p-3"><span className="grid size-12 place-items-center rounded-2xl bg-white text-2xl">{food.icon}</span><div><p className="text-sm font-medium">{food.name} · {food.amount}</p><p className="text-xs text-[#777]">{food.zone}</p></div><Badge variant={food.days <= 3 ? 'destructive' : 'secondary'}>{food.days} 天</Badge></div>)}</div></div></div>
  </section>;
}

function CoachView({ onAsk, onSettings }: { onAsk: (q: string) => void; onSettings: () => void }) { return <section className="mx-auto max-w-3xl"><div className="mb-4 flex justify-end"><Button variant="outline" className="rounded-full" onClick={onSettings}><Settings2 />AI 设置</Button></div><div className="ios-card overflow-hidden"><div className="bg-gradient-to-br from-[#174f3c] to-[#2b7b5d] p-6 text-white"><Bot className="size-9" /><h1 className="mt-4 text-3xl font-semibold">随叫随到的营养师</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#c5ddd3]">它不会只报结论。每次建议都必须说明使用了哪些数据、哪些是估算、为什么调整，以及什么情况下应该停止或改计划。</p></div><div className="grid gap-3 p-5 sm:grid-cols-2">{[['一键生成 3 天计划','结合身体趋势、课表、预算和库存'],['追问每一顿的原因','热量、蛋白质、饱腹感和食材消耗'],['即时替换菜谱','不爱吃、没时间或食材不够时重排'],['训练与恢复建议','普拉提、步行和基础力量渐进安排']].map(([t,d]) => <button key={t} onClick={() => onAsk(`请开始“${t}”，并先告诉我你还缺少哪些必要信息。`)} className="rounded-2xl border bg-[#f7f7f8] p-4 text-left transition hover:border-[#68a489]"><p className="font-medium">{t}</p><p className="mt-1 text-xs leading-5 text-[#777]">{d}</p><ChevronRight className="mt-3 size-4 text-[#1c6b4a]" /></button>)}</div></div><div className="mt-4 ios-card p-5"><h2 className="font-semibold">营养师的安全边界</h2><p className="mt-2 text-sm leading-6 text-[#666]">不诊断疾病、不因一次体脂秤波动大幅调整热量、不把断食作为惩罚。如果静息心率持续偏高、出现头晕心悸、月经异常或其他不适，会优先建议复测和咨询医生。</p></div></section>; }

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) { const items: [Tab,string,typeof Home][] = [['today','今日',Home],['body','身体',Activity],['fridge','冰箱',Refrigerator],['coach','营养师',Bot]]; return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[.08] bg-white/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:sticky md:bottom-4 md:mx-auto md:mt-6 md:flex md:w-fit md:rounded-full md:border md:shadow-lg"><div className="mx-auto flex max-w-lg justify-around px-2 py-1.5 md:gap-1">{items.map(([id,label,Icon]) => <button key={id} onClick={() => setTab(id)} className={`flex min-w-[72px] flex-col items-center gap-1 rounded-full px-3 py-1.5 text-[10px] md:flex-row md:text-sm ${tab === id ? 'bg-[#e4f2e9] font-medium text-[#176440]' : 'text-[#777]'}`}><Icon className="size-[19px]" />{label}</button>)}</div></nav>; }

function MiniStat({ label, value, light = false }: { label: string; value: string; light?: boolean }) { return <div className={`rounded-2xl p-3 ${light ? 'bg-white/75' : 'bg-white/10'}`}><p className={`text-[10px] ${light ? 'text-[#607078]' : 'text-[#bcd4ca]'}`}>{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function SectionTitle({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) { return <div className="flex items-end justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[.13em] text-[#1c6b4a]">{eyebrow}</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2></div>{action && <button onClick={onAction} className="text-sm font-medium text-[#1c6b4a]">{action}</button>}</div>; }
function Reason({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8f3ec] text-[#1c6b4a] [&_svg]:size-4">{icon}</span><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-[#777]">{text}</p></div></div>; }
