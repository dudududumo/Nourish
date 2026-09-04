'use client';

import { useState } from 'react';
import { Bot, ChevronDown, Send, Settings, Sparkles, Zap } from 'lucide-react';
import { Sheet } from './shared-components';
import type { ChatMessage } from './types';

export function CoachChatView({
  messages, input, setInput, loading, onSend, onSettings, onGenerate, hasPlan,
  onConfirmAdjust, onDismissAdjust, pendingAdjustment, adjusting,
}: {
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  onSend: () => void;
  onSettings: () => void;
  onGenerate: () => void;
  onConfirmAdjust: () => void;
  onDismissAdjust: () => void;
  pendingAdjustment: { instruction: string; aiPlan?: string } | null;
  adjusting: boolean;
  hasPlan: boolean;
}) {
  const [planExpanded, setPlanExpanded] = useState(false);
  const quickPrompts = [
    '我想改成增肌目标',
    '我不吃香菜',
    '今天中午吃什么好',
    '帮我看看这周计划',
  ];

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-83px)] md:h-[calc(100vh-24px)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="px-4 pt-2 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="size-10 rounded-full bg-[var(--system-green)] flex items-center justify-center">
              <Bot className="size-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 size-3 bg-[var(--system-green)] rounded-full border-2 border-[var(--grouped-background)]" />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold">小养营养师</h1>
            <p className="text-[11px] text-[var(--system-green)]">在线 · AI 驱动</p>
          </div>
        </div>
        <button
          onClick={onSettings}
          className="size-9 rounded-full bg-[var(--system-gray5)] flex items-center justify-center press-effect"
        >
          <Settings className="size-4" />
        </button>
      </div>

      {/* Agent Status Banner */}
      <div className="mx-4 mb-3 bg-[var(--system-blue)]/5 border border-[var(--system-blue)]/20 rounded-xl p-2.5 flex items-center gap-2">
        <Zap className="size-4 text-[var(--system-blue)] shrink-0" />
        <p className="text-[11px] text-[var(--secondary-label)] leading-[16px]">
          主动洞察已开启：数据更新后我会分析变化，所有建议都由你决定是否采用。
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3 ios-scroll">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="size-8 rounded-full bg-[var(--system-green)] flex items-center justify-center mr-2 shrink-0 mt-0.5">
                <Bot className="size-4 text-white" />
              </div>
            )}
            <div className={`max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <div
                className={`px-3.5 py-2.5 rounded-2xl text-[14px] leading-[22px] whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[var(--system-green)] text-white rounded-br-md'
                    : 'bg-[var(--secondary-grouped-background)] text-[var(--label)] rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
              <span className="text-[10px] text-[var(--tertiary-label)] mt-1 mx-1">
                {msg.time}
              </span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="size-8 rounded-full bg-[var(--system-green)] flex items-center justify-center mr-2 shrink-0">
              <Bot className="size-4 text-white" />
            </div>
            <div className="bg-[var(--secondary-grouped-background)] rounded-2xl rounded-bl-md px-3.5 py-3">
              <div className="flex gap-1">
                <span className="size-2 bg-[var(--system-gray4)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="size-2 bg-[var(--system-gray4)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="size-2 bg-[var(--system-gray4)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pending Adjustment → 统一 Sheet */}
      <Sheet open={!!pendingAdjustment} onClose={onDismissAdjust} title="确认调整">
        {pendingAdjustment && (
          <div className="px-4 pb-6 space-y-4">
            <div className="flex gap-3 items-start rounded-2xl bg-[var(--system-green)]/8 border border-[var(--system-green)]/15 p-3">
              <div className="size-9 rounded-xl bg-[var(--system-green)]/15 flex items-center justify-center shrink-0">
                <Sparkles className="size-4 text-[var(--system-green)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[var(--label)]">小养建议调整今天的安排</p>
                <p className="text-[12px] text-[var(--tertiary-label)] mt-0.5">你的需求：{pendingAdjustment.instruction}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-[var(--secondary-grouped-background)] p-3.5">
              <p className="text-[12px] font-semibold text-[var(--label)] mb-1">将怎么调整</p>
              <p className={`text-[13px] text-[var(--secondary-label)] leading-[20px] whitespace-pre-line ${planExpanded ? '' : 'line-clamp-4'}`}>
                {pendingAdjustment.aiPlan || 'AI 将根据你的新要求重新安排今天的早午晚餐。'}
              </p>
              {pendingAdjustment.aiPlan && (
                <button
                  onClick={() => setPlanExpanded(!planExpanded)}
                  className="mt-2 text-[12px] font-medium text-[var(--system-green)] press-effect flex items-center gap-0.5"
                >
                  {planExpanded ? '收起' : '展开全部'}
                  <ChevronDown className={`size-3.5 transition-transform ${planExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            <p className="text-[11px] text-[var(--tertiary-label)]">确认后更新「今日」页食谱</p>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={onDismissAdjust}
                disabled={adjusting}
                className="ios-button flex-1 bg-[var(--system-gray5)] text-[var(--label)] disabled:opacity-50"
              >
                {adjusting ? '调整中…' : '暂不调整'}
              </button>
              <button
                onClick={onConfirmAdjust}
                disabled={adjusting}
                className="ios-button flex-1 bg-[var(--system-green)] text-white disabled:opacity-60"
              >
                {adjusting ? '调整中…' : '确认调整'}
              </button>
            </div>
          </div>
        )}
      </Sheet>

      {/* Quick Prompts */}
      {messages.length <= 1 && !loading && (
        <div className="px-4 pb-2">
          <p className="text-[11px] text-[var(--tertiary-label)] mb-2 px-1">试试问我：</p>
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => { setInput(prompt); }}
                className="text-[12px] px-3 py-1.5 rounded-full bg-[var(--secondary-grouped-background)] text-[var(--secondary-label)] press-effect"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="px-4 py-3 border-t border-[var(--separator)] bg-[var(--grouped-background)]">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-[var(--secondary-grouped-background)] rounded-2xl px-3 py-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="跟小养说点什么…"
              rows={1}
              className="w-full bg-transparent text-[14px] leading-[20px] resize-none outline-none placeholder:text-[var(--tertiary-label)]"
              style={{ maxHeight: '100px' }}
            />
          </div>
          <button
            onClick={onSend}
            disabled={!input.trim() || loading}
            className="size-10 rounded-full bg-[var(--system-green)] text-white flex items-center justify-center shrink-0 press-effect disabled:opacity-40 disabled:press-effect-none"
          >
            <Send className="size-4" />
          </button>
        </div>
        {!hasPlan && (
          <button
            onClick={onGenerate}
            className="mt-2 w-full text-[12px] text-[var(--system-blue)] text-center"
          >
            还没有周计划？让小养生成一份 →
          </button>
        )}
      </div>
    </div>
  );
}
