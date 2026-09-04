import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function MiniStat({ label, value, light = false }: { label: string; value: string; light?: boolean }) {
  return <div className={`rounded-xl p-2.5 ${light ? 'bg-white/75 dark:bg-[var(--system-gray5)]/50' : 'bg-white/12'}`}><p className={`text-[10px] ${light ? 'text-[var(--secondary-label)]' : 'text-white/70'}`}>{label}</p><p className={`mt-0.5 text-[13px] font-semibold ${light ? '' : 'text-white'}`}>{value}</p></div>;
}

export function SectionTitle({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) {
  return <div className="mb-3 flex items-end justify-between px-1"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--system-green)]">{eyebrow}</p><h2 className="mt-1 text-[20px] font-bold">{title}</h2></div>{action && <button type="button" onClick={onAction} className="text-[14px] font-medium text-[var(--system-blue)]">{action}</button>}</div>;
}

export function MetricCard({ name, value, unit, note, noteColor, level, levelColor }: { name: string; value: string; unit: string; note: string; noteColor?: string | null; level?: string | null; levelColor?: string | null }) {
  return <div className="relative rounded-2xl bg-[var(--secondary-grouped-background)] p-4"><div className="flex items-start justify-between gap-1"><p className="text-[12px] text-[var(--secondary-label)]">{name}</p>{level && levelColor && <span className="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-[14px]" style={{ color: levelColor, backgroundColor: `${levelColor}1f` }}>{level}</span>}</div><p className="mt-2 text-[20px] font-bold tracking-tight">{value || '—'}<span className="ml-1 text-[10px] font-normal text-[var(--secondary-label)]">{unit}</span></p>{note ? <p className="mt-1 text-[10px]" style={{ color: noteColor ?? 'var(--secondary-label)' }}>{note}</p> : null}</div>;
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return <><button type="button" aria-label="关闭弹窗" className={`ios-sheet-overlay ${open ? 'open' : ''}`} onClick={onClose} style={{ pointerEvents: open ? 'auto' : 'none' }} /><div className={`ios-sheet ${open ? 'open' : ''}`} style={{ pointerEvents: open ? 'auto' : 'none' }}><div className="ios-sheet-grabber" /><div className="relative flex items-center justify-center border-b border-[var(--separator)] px-4 py-3"><h3 className="text-[16px] font-semibold">{title}</h3><button type="button" aria-label="关闭" onClick={onClose} className="press-effect absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--system-gray5)]"><X className="size-4" /></button></div><div className="ios-scroll max-h-[calc(90vh-60px)] overflow-y-auto pt-4">{children}</div></div></>;
}
