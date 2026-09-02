'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, CircleAlert, Download, FlaskConical, History, Loader2, ShieldCheck, ThumbsDown, ThumbsUp } from 'lucide-react';
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

type RunHistory = { model: string; passed: number; total: number; passRate: number; ranAt: string };
type ManualReview = Record<string, 'approved' | 'rejected'>;

export default function EvaluationPage() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[]>([]);
  const [summary, setSummary] = useState<{ model: string; passed: number; total: number; passRate: number } | null>(null);
  const [error, setError] = useState('');
  const [ranAt, setRanAt] = useState('');
  const [history, setHistory] = useState<RunHistory[]>([]);
  const [manualReview, setManualReview] = useState<ManualReview>({});
  const resultMap = useMemo(() => new Map(results.map((item) => [item.id, item])), [results]);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem('nourish-eval-history') || '[]')); } catch { setHistory([]); }
  }, []);

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
      setManualReview({});
      const completedAt = new Date().toISOString();
      setRanAt(completedAt);
      const nextHistory = [{ model: data.model, passed: data.passed, total: data.total, passRate: data.passRate, ranAt: completedAt }, ...history].slice(0, 5);
      setHistory(nextHistory);
      localStorage.setItem('nourish-eval-history', JSON.stringify(nextHistory));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '评测运行失败');
    } finally {
      setRunning(false);
    }
  }

  function exportEvidence() {
    if (!summary) return;
    const payload = { project: 'Nourish Eval Lab', ...summary, ranAt, scoring: 'deterministic-rules-with-human-review', manualReview, results };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `nourish-eval-${ranAt.slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
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
          <div className="rounded-3xl border border-[var(--separator)] bg-[var(--secondary-grouped-background)] p-5">
            <p className="text-xs text-[var(--secondary-label)]">本轮结果</p>
            <div className="mt-2 flex items-end gap-2"><strong className="text-4xl">{summary ? `${summary.passRate}%` : '—'}</strong><span className="pb-1 text-sm text-[var(--secondary-label)]">通过率</span></div>
            <p className="mt-2 text-xs text-[var(--secondary-label)]">{summary ? `${summary.model} · ${summary.passed}/${summary.total} 通过` : '运行后显示真实结果，不预填演示数据'}</p>
            <button onClick={() => void runEvaluation()} disabled={running} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--system-green)] font-semibold text-white disabled:opacity-50">
              {running ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}{running ? '正在逐条评测…' : '运行全部用例'}
            </button>
            {summary && <button onClick={exportEvidence} className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--separator)] text-sm font-semibold text-[var(--system-green)]"><Download className="size-4" />导出评测证据</button>}
            {error && <p className="mt-3 text-xs leading-5 text-[var(--system-red)]">{error}</p>}
          </div>
        </section>

        {history.length > 0 && <section className="mt-8 rounded-3xl border border-[var(--separator)] bg-white p-5 md:p-6">
          <div className="flex items-center gap-2"><History className="size-5 text-[var(--system-green)]" /><h2 className="font-semibold">最近模型运行</h2></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{history.map((run) => <div key={`${run.ranAt}-${run.model}`} className="rounded-2xl bg-[var(--system-gray6)] p-3"><p className="truncate text-xs text-[var(--secondary-label)]">{run.model}</p><p className="mt-1 text-xl font-semibold text-[var(--system-green)]">{run.passRate}%</p><p className="mt-1 text-[11px] text-[var(--tertiary-label)]">{new Date(run.ranAt).toLocaleString('zh-CN')}</p></div>)}</div>
        </section>}

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-semibold">首批核心测试集</h2><p className="mt-1 text-sm text-[var(--secondary-label)]">6 条高价值用例，优先覆盖严重失败模式</p></div><ShieldCheck className="size-6 text-[var(--system-green)]" /></div>
          <div className="grid gap-4">
            {EVALUATION_CASES.map((testCase) => {
              const result = resultMap.get(testCase.id);
              return <article key={testCase.id} className="rounded-3xl border border-[var(--separator)] bg-[var(--secondary-grouped-background)] p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><span className="text-xs font-semibold text-[var(--system-green)]">{testCase.category}</span><h3 className="mt-1 text-base font-semibold">{testCase.title}</h3></div>
                  {result && <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${result.passed ? 'bg-[var(--system-green)]/12 text-[var(--system-green)]' : 'bg-[var(--system-red)]/10 text-[var(--system-red)]'}`}>{result.passed ? <CheckCircle2 className="size-4" /> : <CircleAlert className="size-4" />}{result.passed ? '通过' : '待复核'}</span>}
                </div>
                <p className="mt-4 rounded-2xl bg-[var(--system-gray6)] p-4 text-sm leading-6">“{testCase.input}”</p>
                <p className="mt-3 text-xs leading-5 text-[var(--secondary-label)]">评测依据：{testCase.rationale}</p>
                {result && <div className="mt-4 border-t border-[var(--separator)] pt-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-[var(--secondary-label)]">模型回答</p><div className="flex gap-1"><button aria-label="人工复核通过" onClick={() => setManualReview((old) => ({ ...old, [testCase.id]: 'approved' }))} className={`rounded-lg p-1.5 ${manualReview[testCase.id] === 'approved' ? 'bg-[var(--system-green)] text-white' : 'bg-[var(--system-gray6)] text-[var(--secondary-label)]'}`}><ThumbsUp className="size-3.5" /></button><button aria-label="人工复核不通过" onClick={() => setManualReview((old) => ({ ...old, [testCase.id]: 'rejected' }))} className={`rounded-lg p-1.5 ${manualReview[testCase.id] === 'rejected' ? 'bg-[var(--system-red)] text-white' : 'bg-[var(--system-gray6)] text-[var(--secondary-label)]'}`}><ThumbsDown className="size-3.5" /></button></div></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{result.error || result.answer}</p>{result.forbiddenHits.length > 0 && <p className="mt-2 text-xs text-[var(--system-red)]">命中风险表达：{result.forbiddenHits.join('、')}</p>}</div>}
              </article>;
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
