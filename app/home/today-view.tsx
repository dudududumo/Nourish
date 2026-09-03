'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, ShoppingCart, Sparkles, Timer, User, Zap } from 'lucide-react';
import { CoreJourney } from './core-journey';
import { SectionTitle } from './shared-components';
import type { AuthUser, FastingData, TodayData } from './types';

export function TodayView({
  user, todayData, loading, generating, error, fasting, hasBody, onGoFasting, onGenerate, onPlan, onBody, onProfile, onShopping,
}: {
  user: AuthUser;
  todayData: TodayData | null;
  loading: boolean;
  generating: boolean;
  error: string;
  fasting: FastingData | null;
  hasBody: boolean;
  onGoFasting: () => void;
  onGenerate: () => void;
  onPlan: () => void;
  onBody: () => void;
  onProfile: () => void;
  onShopping: () => void;
}) {
  const today = new Date();
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][today.getDay()];
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日`;

  const meals = todayData?.today.meals || {};
  const hasPlan = todayData?.hasPlan;
  const [openSteps, setOpenSteps] = useState<string>('');
  const [openIngredients, setOpenIngredients] = useState<string>('');

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
          <button onClick={onProfile} className="size-10 rounded-full bg-[var(--system-green)]/10 text-[var(--system-green)] flex items-center justify-center press-effect">
            <User className="size-5" />
          </button>
        </div>
      </div>

      <CoreJourney hasBody={hasBody} hasPlan={Boolean(hasPlan)} onBody={onBody} onPlan={hasPlan ? onPlan : onGenerate} />

      {/* 轻断食状态条 */}
      {fasting && (
        <button
          onClick={onGoFasting}
          className="mb-5 w-full flex items-center gap-3 rounded-2xl bg-[var(--secondary-grouped-background)] p-3.5 press-effect text-left"
        >
          <div className="size-10 rounded-xl bg-[var(--system-orange)]/15 flex items-center justify-center shrink-0">
            <Timer className="size-5 text-[var(--system-orange)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-[var(--label)]">
              {fasting.active
                ? `轻断食进行中 · 已坚持 ${Math.floor(fasting.elapsedMinutes / 60)} 小时 ${fasting.elapsedMinutes % 60} 分`
                : fasting.todayCompleted
                  ? `今日已打卡 · 实际禁食 ${Math.round(fasting.todayFastHours * 60) >= 60 ? `${Math.floor(fasting.todayFastHours)} 小时` : `${Math.round(fasting.todayFastHours * 60)} 分钟`}`
                  : `轻断食 · ${fasting.planHours}:${24 - fasting.planHours} 方案`}
            </p>
            <p className="text-[12px] text-[var(--secondary-label)] truncate">
              进食窗口 {fasting.mealGuide.windowStart}–{fasting.mealGuide.windowEnd}{fasting.streak > 0 ? ` · 🔥 连续 ${fasting.streak} 天` : ''}
            </p>
          </div>
          <ChevronRight className="size-5 text-[var(--tertiary-label)] shrink-0" />
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-[var(--secondary-grouped-background)] rounded-2xl p-8 text-center mb-5">
          <Loader2 className="size-6 animate-spin text-[var(--system-green)] mx-auto" />
          <p className="text-[14px] text-[var(--secondary-label)] mt-3">加载中…</p>
        </div>
      )}

      {/* No plan yet */}
      {!loading && !hasPlan && (
        <div className="rounded-2xl bg-[#F0FDF4] p-6 text-[var(--label)] mb-5 border border-[#DCFCE7]">
          <Zap className="size-9" />
          <h2 className="text-[22px] font-bold mt-4">还没有本周计划</h2>
          <p className="mt-2 text-[14px] leading-[22px] text-[var(--secondary-label)]">
            AI 营养师会根据你的身体数据和冰箱库存，生成整周食谱和采购清单。
          </p>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="mt-5 w-full h-11 rounded-xl bg-[var(--system-green)] text-white font-semibold flex items-center justify-center gap-2 press-effect disabled:opacity-50"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating ? '生成中…' : '生成本周计划'}
          </button>
          {error && (
            <p className="mt-3 text-[12px] text-[var(--system-red)]">{error}</p>
          )}
        </div>
      )}

      {/* Plan exists: today's summary */}
      {!loading && hasPlan && todayData && (
        <>
          {/* Calories Ring Card */}
          <div className="bg-gradient-to-br from-[#22C55E] via-[#4ADE80] to-[#16A34A] rounded-2xl p-5 text-white mb-5">
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
                    dishes.map((dish, i) => {
                      const dishKey = `${mealType}-${i}`;
                      const isOpen = openSteps === dishKey;
                      const hasSteps = dish.steps && dish.steps.length > 0;
                      const ingAll = dish.ingredients.length > 4;
                      const ingExpanded = openIngredients === dishKey;
                      const visibleIngredients = ingAll && !ingExpanded ? dish.ingredients.slice(0, 4) : dish.ingredients;
                      return (
                        <div key={dish.id || dishKey} className={`px-4 py-3 ${i !== dishes.length - 1 ? 'border-b border-[var(--separator)]' : ''}`}>
                          <div className="flex items-start justify-between">
                            <p className="text-[14px] font-medium">{dish.name || dish.dishName || '未命名菜品'}</p>
                            <span className="text-[11px] text-[var(--secondary-label)] shrink-0 ml-2">
                              {dish.calories} kcal
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {visibleIngredients.map((ing) => (
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
                            {ingAll && (
                              <button
                                onClick={() => setOpenIngredients(ingExpanded ? '' : dishKey)}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--system-gray4)] text-[var(--secondary-label)] press-effect"
                              >
                                {ingExpanded ? '收起' : `+${dish.ingredients.length - 4}`}
                              </button>
                            )}
                          </div>
                          {hasSteps ? (
                            <button
                              onClick={() => setOpenSteps(isOpen ? '' : dishKey)}
                              className="mt-2.5 text-[12px] font-medium text-[var(--system-green)] press-effect flex items-center gap-1"
                            >
                              {isOpen ? '收起做法' : '查看做法'}
                              <ChevronDown className={`size-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                          ) : (
                            <button
                              onClick={() => setOpenSteps(isOpen ? '' : dishKey)}
                              className="mt-2.5 text-[12px] font-medium text-[var(--system-blue)] press-effect flex items-center gap-1"
                            >
                              {isOpen ? '收起' : '查看做法'}
                              <ChevronDown className={`size-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                          )}
                          {isOpen && (
                            <div className="mt-3 pt-3 border-t border-[var(--separator)]">
                              <a
                                href={`https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(`${dish.name} 家常做法`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mb-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--tertiary-label)] press-effect"
                              >
                                <span className="text-[12px]">📕</span>
                                到小红书搜「{dish.name}」做法
                              </a>
                              {hasSteps ? (
                                <ol className="space-y-2">
                                  {dish.steps!.map((step, si) => (
                                    <li key={si} className="flex gap-2.5 text-[13px] leading-[20px]">
                                      <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--system-green)]/10 text-[var(--system-green)] text-[11px] font-semibold flex items-center justify-center mt-0.5">
                                        {si + 1}
                                      </span>
                                      <span className="text-[var(--label)]">{step}</span>
                                    </li>
                                  ))}
                                </ol>
                              ) : (
                                <p className="text-[13px] text-[var(--secondary-label)]">
                                  这道菜还没有做法记录，点右侧「重新生成」让 AI 补充详细做法。
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
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


