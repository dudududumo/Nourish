import { Activity, CalendarRange, Check, ChevronRight, MessageSquareText } from 'lucide-react';

export function CoreJourney({ hasBody, hasPlan, onBody, onPlan }: { hasBody: boolean; hasPlan: boolean; onBody: () => void; onPlan: () => void }) {
  const steps = [
    { title: '身体输入', detail: hasBody ? '已录入，可用于个性化计划' : '先录入体重与身体指标', done: hasBody, action: onBody, Icon: Activity },
    { title: '计划生成', detail: hasPlan ? '本周计划已生成' : '基于已确认数据生成', done: hasPlan, action: hasBody ? onPlan : onBody, Icon: CalendarRange },
    { title: '调整确认', detail: hasPlan ? '先预览，再确认应用' : '生成计划后开放', done: false, action: onPlan, Icon: Check },
    { title: '执行反馈', detail: hasPlan ? '记录执行，进入下一轮优化' : '执行后记录真实反馈', done: false, action: onPlan, Icon: MessageSquareText },
  ];
  return <section className="mb-5 rounded-2xl border border-[#DCFCE7] bg-white p-4"><div className="mb-3"><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--system-green)]">核心闭环</p><h2 className="mt-1 text-[17px] font-semibold">从身体数据到可执行反馈</h2></div><div className="grid gap-2 sm:grid-cols-4">{steps.map(({ title, detail, done, action, Icon }, index) => <button key={title} onClick={action} className="group rounded-xl bg-[#F0FDF4] p-3 text-left press-effect"><div className="flex items-center justify-between"><span className="flex size-7 items-center justify-center rounded-lg bg-white text-[var(--system-green)]">{done ? <Check className="size-4" /> : <Icon className="size-4" />}</span><span className="text-[10px] font-semibold text-[var(--tertiary-label)]">0{index + 1}</span></div><p className="mt-3 text-[13px] font-semibold">{title}</p><p className="mt-1 min-h-8 text-[11px] leading-4 text-[var(--secondary-label)]">{detail}</p><ChevronRight className="mt-2 size-3.5 text-[var(--system-green)] transition-transform group-hover:translate-x-0.5" /></button>)}</div></section>;
}
