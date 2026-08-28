'use client';

import { useState } from 'react';
import { Apple, ArrowRight, Check, ChevronRight, Dumbbell, Flame, Leaf, Refrigerator, ScanLine, Sparkles, Utensils } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const meals = [
  { time: '08:30', name: '照烧鸡蛋牛油果吐司', meta: '早餐 · 18 分钟', kcal: 438, protein: 27, color: 'from-[#f7b955] to-[#e98142]', icon: '🥑' },
  { time: '12:20', name: '番茄菌菇鸡腿焖饭', meta: '午餐 · 一锅完成', kcal: 586, protein: 39, color: 'from-[#f08d67] to-[#c8543f]', icon: '🍅' },
  { time: '18:30', name: '柠檬虾仁藜麦沙拉', meta: '晚餐 · 清爽高蛋白', kcal: 426, protein: 35, color: 'from-[#a9c75a] to-[#568f58]', icon: '🥗' },
];

const fridgeItems = [
  ['鸡蛋', '8 枚', '10天', '🥚'], ['小番茄', '320g', '3天', '🍅'], ['鸡腿肉', '460g', '2天', '🍗'], ['牛油果', '2 个', '4天', '🥑'],
];

export default function Home() {
  const [fridgeOpen, setFridgeOpen] = useState(false);
  const [doorOpen, setDoorOpen] = useState(true);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [items, setItems] = useState(fridgeItems);
  const [newItem, setNewItem] = useState('');
  const [saved, setSaved] = useState(false);

  function addItem() {
    if (!newItem.trim()) return;
    setItems((current) => [...current, [newItem.trim(), '1 份', '7天', '🥬']]);
    setNewItem('');
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-[13px] bg-primary text-primary-foreground shadow-sm"><Leaf className="size-5" /></div>
            <div><p className="font-semibold tracking-[-0.02em]">轻养 · Nourish</p><p className="text-[10px] tracking-[0.14em] text-muted-foreground">YOUR DAILY HEALTH OS</p></div>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a className="font-medium text-foreground" href="#today">今日</a><a href="#plan">计划</a><a href="#fridge">冰箱</a><a href="#progress">趋势</a>
          </nav>
          <Button className="rounded-full px-4" size="lg" onClick={() => setCheckinOpen(true)}><ScanLine /> 录入今日数据</Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-6 px-5 py-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(330px,.75fr)] lg:px-8">
        <section className="space-y-6" id="today">
          <div className="overflow-hidden rounded-[28px] bg-[#173d32] px-6 py-7 text-white shadow-[0_18px_50px_rgba(23,61,50,.14)] md:px-8">
            <div className="flex flex-col justify-between gap-7 md:flex-row md:items-center">
              <div>
                <Badge className="mb-4 bg-white/12 text-[#d8ead7]" variant="secondary"><Sparkles /> 周五 · 适度热量缺口日</Badge>
                <h1 className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.04em] md:text-[40px]">今天不用完美，<br />把下一顿吃好就够了。</h1>
                <p className="mt-4 max-w-lg text-sm leading-6 text-[#bed1c9]">根据你的恢复状态，今天安排 1,620 kcal 与 25 分钟低冲击普拉提。晚餐会优先用掉临期虾仁。</p>
              </div>
              <div className="grid min-w-[245px] grid-cols-2 gap-3">
                <Metric icon={<Flame />} value="1,024" unit="/ 1,620 kcal" label="已规划" /><Metric icon={<Apple />} value="101g" unit="/ 112g" label="蛋白质" /><Metric icon={<Dumbbell />} value="25" unit="分钟" label="今日训练" /><Metric icon={<Check />} value="2/5" unit="项" label="今日打卡" />
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border bg-card p-5 shadow-[0_10px_35px_rgba(39,51,45,.05)] md:p-7" id="plan">
            <div className="mb-6 flex items-end justify-between">
              <div><p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">TODAY&apos;S TABLE</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">今天吃什么</h2></div>
              <button className="flex items-center gap-1 text-sm font-medium text-primary">调整计划 <ChevronRight className="size-4" /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {meals.map((meal, index) => (
                <article key={meal.name} className="group overflow-hidden rounded-[22px] border bg-background transition hover:-translate-y-1 hover:shadow-xl">
                  <div className={`relative flex h-32 items-center justify-center bg-gradient-to-br ${meal.color}`}>
                    <span className="text-6xl drop-shadow-lg transition group-hover:scale-110">{meal.icon}</span><span className="absolute left-3 top-3 rounded-full bg-black/18 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">{meal.time}</span>{index === 1 && <span className="absolute right-3 top-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#9d3e2e]">推荐</span>}
                  </div>
                  <div className="p-4"><p className="text-xs text-muted-foreground">{meal.meta}</p><h3 className="mt-1.5 min-h-11 font-semibold leading-snug">{meal.name}</h3><div className="mt-4 flex items-center justify-between border-t pt-3 text-xs"><span><strong className="text-sm">{meal.kcal}</strong> kcal</span><span className="text-muted-foreground">蛋白质 {meal.protein}g</span></div></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[26px] border bg-card p-5 shadow-[0_10px_35px_rgba(39,51,45,.05)]" id="fridge">
            <div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-[#e6f1ea] text-primary"><Refrigerator /></div><div><h2 className="font-semibold">我的冰箱</h2><p className="text-xs text-muted-foreground">容量使用 68% · 2 件临期</p></div></div><Button variant="outline" size="sm" className="rounded-full" onClick={() => setFridgeOpen(true)}>打开冰箱</Button></div>
            <Progress value={68} className="mb-5"><ProgressLabel>冷藏层</ProgressLabel><ProgressValue>68%</ProgressValue></Progress>
            <div className="grid grid-cols-2 gap-2.5">
              {items.slice(0, 4).map(([name, amount, expiry, icon], index) => <div key={name} className="flex items-center gap-3 rounded-2xl bg-muted/65 p-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-2xl shadow-sm">{icon}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{name}</p><p className="text-[11px] text-muted-foreground">{amount} · <span className={index === 2 ? 'font-medium text-[#c4553d]' : ''}>{expiry}</span></p></div></div>)}
            </div>
            <button onClick={() => setFridgeOpen(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-sm text-muted-foreground hover:bg-muted">添加现有食材 <ArrowRight className="size-4" /></button>
          </section>

          <section className="rounded-[26px] border bg-[#f2eadc] p-5" id="progress">
            <div className="flex items-start justify-between"><div><p className="text-xs font-medium uppercase tracking-[0.14em] text-[#9a6b40]">TODAY&apos;S COACH</p><h2 className="mt-1 text-xl font-semibold tracking-tight">晚间轻断食</h2></div><div className="rounded-2xl bg-white/70 p-2.5 text-[#9a6b40]"><Utensils /></div></div>
            <p className="mt-4 text-sm leading-6 text-[#725942]">今晚 20:00 后进入 14 小时空腹窗口。轻断食不是惩罚；如果出现头晕、心悸或不适，立即停止并进食。</p>
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/60 p-4"><div><p className="text-xs text-[#8d7359]">距离窗口开始</p><p className="mt-0.5 text-2xl font-semibold tabular-nums">01:42:18</p></div><Button className="rounded-full bg-[#8d6443] text-white hover:bg-[#775237]">开始打卡</Button></div>
          </section>
        </aside>
      </div>

      <Dialog open={fridgeOpen} onOpenChange={setFridgeOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-4xl">
          <div className="grid min-h-[610px] md:grid-cols-[1.05fr_.95fr]">
            <div className="overflow-hidden rounded-l-xl bg-[#183f34] p-6 text-white">
              <DialogHeader><DialogTitle className="text-xl text-white">3D 冰箱空间</DialogTitle><DialogDescription className="text-[#bad0c7]">点击冰箱门开合；使用食材后库存与容量会同步变化。</DialogDescription></DialogHeader>
              <div className="fridge-scene mx-auto mt-8 h-[430px] w-[280px]">
                <div className="fridge-body">
                  <div className="fridge-cavity">
                    {[0, 1, 2].map((shelf) => <div className="fridge-shelf" key={shelf} style={{ top: `${26 + shelf * 29}%` }}>{items.slice(shelf * 2, shelf * 2 + 2).map((item) => <span key={item[0]} title={item[0]}>{item[3]}</span>)}</div>)}
                  </div>
                  <button aria-label={doorOpen ? '关闭冰箱门' : '打开冰箱门'} onClick={() => setDoorOpen((v) => !v)} className={`fridge-door ${doorOpen ? 'is-open' : ''}`}><span className="fridge-handle" /><span className="fridge-brand">NOURISH</span></button>
                </div>
              </div>
              <p className="text-center text-xs text-[#9fc0b2]">{doorOpen ? '冰箱已打开 · 点击门关闭' : '冰箱已关闭 · 点击门打开'}</p>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-semibold">库存与保鲜顺序</h3><p className="mt-1 text-sm text-muted-foreground">先吃快过期的食物，系统会据此生成下一餐。</p>
              <div className="mt-5 max-h-72 space-y-2 overflow-y-auto pr-1">
                {items.map((item, index) => <div key={`${item[0]}-${index}`} className="flex items-center gap-3 rounded-xl border p-3"><span className="text-2xl">{item[3]}</span><div className="flex-1"><p className="text-sm font-medium">{item[0]}</p><p className="text-xs text-muted-foreground">{item[1]} · 约 {item[2]}后到期</p></div><Button size="xs" variant="ghost" onClick={() => setItems((all) => all.filter((_, i) => i !== index))}>已用完</Button></div>)}
              </div>
              <div className="mt-5 rounded-2xl bg-muted/60 p-4"><Label htmlFor="new-food">放入新食材</Label><div className="mt-2 flex gap-2"><Input id="new-food" value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addItem()} placeholder="例如：西兰花 300g" /><Button onClick={addItem}>放入</Button></div><p className="mt-2 text-xs text-muted-foreground">正式版会继续询问数量、购买日、保质期和存放区域。</p></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-xl">今日身体与状态</DialogTitle><DialogDescription>体脂秤的单次波动很常见，我们更关注 7–14 天趋势。</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2"><Field label="体重（kg）" placeholder="例如 62.4" /><Field label="体脂率（%）" placeholder="例如 27.8" /><Field label="昨晚睡眠（小时）" placeholder="例如 7.2" /><Field label="今日步数" placeholder="例如 6200" /><Field label="腰围（cm，可选）" placeholder="例如 72" /><Field label="精力（1–10）" placeholder="例如 7" /></div>
          <div className="rounded-xl bg-[#eef5ef] p-3 text-xs leading-5 text-[#476454]">如果你有进食障碍史、怀孕/哺乳、糖尿病用药、低血糖、未满 18 岁或医生要求特殊饮食，请不要自行轻断食，并先告诉我。</div>
          <Button size="lg" className="w-full" onClick={() => { setSaved(true); setTimeout(() => setCheckinOpen(false), 700); }}>{saved ? <><Check /> 已保存，做得很好</> : '保存并更新今日计划'}</Button>
        </DialogContent>
      </Dialog>

      <nav className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-around rounded-2xl border bg-background/95 p-2 shadow-2xl backdrop-blur md:hidden">
        {[['今日', Leaf], ['饮食', Utensils], ['冰箱', Refrigerator], ['训练', Dumbbell]].map(([label, Icon], index) => { const NavIcon = Icon as typeof Leaf; return <button key={label as string} className={`flex min-w-16 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] ${index === 0 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><NavIcon className="size-4" />{label as string}</button>; })}
      </nav>
    </main>
  );
}

function Field({ label, placeholder }: { label: string; placeholder: string }) { return <div className="space-y-2"><Label>{label}</Label><Input inputMode="decimal" placeholder={placeholder} /></div>; }

function Metric({ icon, value, unit, label }: { icon: React.ReactNode; value: string; unit: string; label: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[.075] p-3.5 backdrop-blur"><div className="mb-3 text-[#9fc8a7] [&_svg]:size-4">{icon}</div><p className="text-lg font-semibold tabular-nums">{value} <span className="text-[10px] font-normal text-[#aac0b7]">{unit}</span></p><p className="mt-0.5 text-[11px] text-[#aac0b7]">{label}</p></div>;
}
