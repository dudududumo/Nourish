'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, CircleAlert, FlaskConical, Loader2, ShieldCheck } from 'lucide-react';
import { EVALUATION_CASES } from '@/lib/evaluation-cases';

type RunResult = typeof EVALUATION_CASES[number] & {
  answer: string;
  passed: boolean;
  requiredHits: string[];
  forbiddenHits: string[];
  error?: string;
};

type EvaluationResponse = {
  model?: string;
  passed?: number;
  total?: number;
  passRate?: number;
  results?: RunResult[];
  error?: string;
};

export default function EvaluationPage() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[]>([]);
  const [summary, setSummary] = useState<{ model: string; passed: number; total: number; passRate: number } | null>(null);
  const [error, setError] = useState('');
  const resultMap = useMemo(() => new Map(results.map((item) => [item.id, item])), [results]);

  async function runEvaluation() {
    setRunning(true);
    setError('');
    try {
      const response = await fetch('/api/evaluation/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
      const data = await response.json() as EvaluationResponse;
      if (!response.ok) throw new Error(data.error || '评测运行失败');
      if (!data.results || data.model === undefined || data.passed === undefined || data.total === undefined || data.passRate === undefined) throw new Error('评测结果结构不完整');
      setResults(data.results);
      setSummary({ model: data.model, passed: data.passed, total: data.total, passRate: data.passRate });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '评测运行失败');
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--grouped-background)] text-[var(--label)]">
      <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[var(--secondary-label)] hover:text-[var(--label)]"><ArrowLeft className="size-4" />返回轻养</Link>

        <section className="mt-7 grid gap-5 md:grid-cols-[1.4fr_.6fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--system-green)]/12 px-3 py-1.5 text-xs font-semibold text-[var(--system-green)]"><FlaskConical className="size-4" />Nourish Eval Lab</div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">让健康建议经过评测，<br />而不只是“看起来合理”</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--secondary-label)]">使用固定测试集检查模型的健康安全边界、关键信息补问、指令遵循与不确定性表达。当前版本采用确定性规则评分，并保留逐条回答用于人工复核。</p>
          </div>
          <div className="rounded-3xl bg-[var(--secondary-grouped-background)] p-5 shadow-sm">
            <p className="text-xs text-[var(--secondary-label)]">本轮结果</p>
            <div className="mt-2 flex items-end gap-2"><strong className="text-4xl">{summary ? `${summary.passRate}%` : '—'}</strong><span className="pb-1 text-sm text-[var(--secondary-label)]">通过率</span></div>
            <p className="mt-2 text-xs text-[var(--secondary-label)]">{summary ? `${summary.model} · ${summary.passed}/${summary.total} 通过` : '运行后显示真实结果，不预填演示数据'}</p>
            <button onClick={() => void runEvaluation()} disabled={running} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--system-green)] font-semibold text-white disabled:opacity-50">
              {running ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}{running ? '正在逐条评测…' : '运行全部用例'}
            </button>
            {error && <p className="mt-3 text-xs leading-5 text-[var(--system-red)]">{error}</p>}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-semibold">首批核心测试集</h2><p className="mt-1 text-sm text-[var(--secondary-label)]">6 条高价值用例，优先覆盖严重失败模式</p></div><ShieldCheck className="size-6 text-[var(--system-green)]" /></div>
          <div className="grid gap-4">
            {EVALUATION_CASES.map((testCase) => {
              const result = resultMap.get(testCase.id);
              return <article key={testCase.id} className="rounded-3xl bg-[var(--secondary-grouped-background)] p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><span className="text-xs font-semibold text-[var(--system-green)]">{testCase.category}</span><h3 className="mt-1 text-base font-semibold">{testCase.title}</h3></div>
                  {result && <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${result.passed ? 'bg-[var(--system-green)]/12 text-[var(--system-green)]' : 'bg-[var(--system-red)]/10 text-[var(--system-red)]'}`}>{result.passed ? <CheckCircle2 className="size-4" /> : <CircleAlert className="size-4" />}{result.passed ? '通过' : '待复核'}</span>}
                </div>
                <p className="mt-4 rounded-2xl bg-[var(--system-gray6)] p-4 text-sm leading-6">“{testCase.input}”</p>
                <p className="mt-3 text-xs leading-5 text-[var(--secondary-label)]">评测依据：{testCase.rationale}</p>
                {result && <div className="mt-4 border-t border-[var(--separator)] pt-4"><p className="text-xs font-semibold text-[var(--secondary-label)]">模型回答</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{result.error || result.answer}</p>{result.forbiddenHits.length > 0 && <p className="mt-2 text-xs text-[var(--system-red)]">命中风险表达：{result.forbiddenHits.join('、')}</p>}</div>}
              </article>;
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
