'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertCircle, ChevronRight, ImageIcon, Loader2, Sparkles, TrendingDown, Upload } from 'lucide-react';
import { MetricCard, MiniStat, SectionTitle, Sheet } from './shared-components';
import { STANDARDS, fmtDateTime, locateZone, metrics, zoneNote } from './body-standards';
import type { Insight } from './types';

export function BodyView({ onGenerate, onAgentAnalyze, agentAnalyzing, agentResult, historyInsights, onInsightRead, onInsightAction, onBodySaved, sex }: {
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

