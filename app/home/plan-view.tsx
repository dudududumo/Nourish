'use client';

import { useMemo } from 'react';
import { AlertCircle, CalendarRange, Loader2, Settings, ShoppingCart, Sparkles, Zap } from 'lucide-react';
import { SectionTitle } from './shared-components';
import type { Dish, TodayData } from './types';

export function PlanView({
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
      return weeklyData.days.map((d: any) => {
        const [, m, dd] = d.date.split('-').map((s: string) => Number(s));
        const sub = `${m}/${dd}`;
        switch (d.label) {
          case 'today': return { main: '今天', sub };
          case 'yesterday': return { main: '昨天', sub, past: true };
          case 'dayBeforeYesterday': return { main: '前天', sub, past: true };
          case 'tomorrow': return { main: '明天', sub };
          default: {
            const weekday = weekdayNames[new Date(`${d.date}T00:00:00Z`).getUTCDay()];
            return { main: `周${weekday}`, sub };
          }
        }
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

        <div className="rounded-2xl bg-[#F0FDF4] p-6 text-[var(--label)] mb-5 border border-[#DCFCE7]">
          <CalendarRange className="size-9" />
          <h2 className="text-[22px] font-bold mt-4">整周饮食规划</h2>
          <p className="mt-2 text-[14px] leading-[22px] text-[var(--secondary-label)]">
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
      <div className="bg-gradient-to-br from-[#22C55E] via-[#4ADE80] to-[#16A34A] rounded-2xl p-5 text-white mb-5">
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
          const hasData = dayData?.hasData;
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
      {currentDay && currentDay.hasData && (
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
      {currentDay && !currentDay.hasData && (
        <div className="bg-[var(--system-gray5)]/50 rounded-2xl p-4 mb-5 text-center">
          <p className="text-[13px] text-[var(--secondary-label)]">这天还没有安排</p>
          <p className="text-[12px] text-[var(--tertiary-label)] mt-1">小养会自动补齐未来几天的食谱，刷新后即可看到。</p>
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
            <p className="text-[14px] font-semibold">AI 主动洞察</p>
            <p className="text-[12px] text-[var(--secondary-label)] mt-1 leading-[18px]">
              当你更新体重或冰箱食材时，AI 会主动分析变化并给出调整建议，不用你主动问。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
