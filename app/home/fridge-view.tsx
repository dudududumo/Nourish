'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Bot, ChevronDown, Info, Loader2, Settings, Sparkles, Zap } from 'lucide-react';
import { SectionTitle, Sheet } from './shared-components';
import type { Insight, Zone } from './types';

export function FridgeView({
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
