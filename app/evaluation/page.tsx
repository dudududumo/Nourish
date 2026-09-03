'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, CircleAlert, Download, FlaskConical, History, Loader2, ShieldCheck, ThumbsDown, ThumbsUp } from 'lucide-react';
import { EVALUATION_CASES, SMOKE_CASE_IDS } from '@/lib/evaluation-cases';

type RunResult = typeof EVALUATION_CASES[number] & {
  answer: string;
  passed: boolean;
  requiredHits: string[];
  forbiddenHits: string[];
  jsonValid?: boolean;
  missingJsonKeys?: string[];
  missingJsonPaths?: string[];
  durationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  failureType?: string;
  manualReview?: 'approved' | 'rejected' | null;
  error?: string;
};

type ModelRun = { runId?: string; model: string; passed: number; total: number; passRate: number; durationMs?: number; totalTokens?: number; datasetVersion?: string; promptVersion?: string; failureSummary?: Record<string, number>; results: RunResult[]; persistenceWarning?: string };
type EvaluationResponse = {
  runs?: ModelRun[];
  datasetSize?: number;
  selectedCases?: number;
  error?: string;
};

type RunHistory = { id?: string; model: string; passed: number; total: number; passRate: number; ranAt: string; durationMs?: number | null; totalTokens?: number | null; promptVersion?: string | null };
type ManualReview = Record<string, 'approved' | 'rejected'>;
const FAILURE_LABELS: Record<string, string> = {
  infrastructure_error: '服务异常', invalid_json: 'JSON 无效', schema_missing: '字段缺失',
  safety_violation: '安全违规', required_evidence_missing: '必要证据缺失', response_too_short: '回答过短',
};

export default function EvaluationPage() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[]>([]);
  const [summary, setSummary] = useState<{ model: string; passed: number; total: number; passRate: number } | null>(null);
  const [runs, setRuns] = useState<ModelRun[]>([]);
  const [activeModel, setActiveModel] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [runScope, setRunScope] = useState<'smoke' | 'regression'>('smoke');
  const [completedScope, setCompletedScope] = useState<'smoke' | 'regression' | null>(null);
  const [error, setError] = useState('');
  const [ranAt, setRanAt] = useState('');
  const [history, setHistory] = useState<RunHistory[]>([]);
  const [manualReview, setManualReview] = useState<ManualReview>({});
  const [caseFilter, setCaseFilter] = useState<'all' | 'failed' | 'passed' | 'unreviewed' | 'rejected'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const resultMap = useMemo(() => new Map(results.map((item) => [item.id, item])), [results]);
  const visibleCases = useMemo(() => EVALUATION_CASES.filter((testCase) => {
    if (categoryFilter !== 'all' && testCase.category !== categoryFilter) return false;
    const result = resultMap.get(testCase.id);
    const review = manualReview[`${activeModel}:${testCase.id}`] ?? result?.manualReview ?? undefined;
    if (caseFilter === 'failed') return result?.passed === false;
    if (caseFilter === 'passed') return result?.passed === true;
    if (caseFilter === 'unreviewed') return Boolean(result) && !review;
    if (caseFilter === 'rejected') return review === 'rejected';
    return true;
  }), [activeModel, caseFilter, categoryFilter, manualReview, resultMap]);
  const reviewStats = useMemo(() => results.reduce((stats, result) => {
    const review = manualReview[`${activeModel}:${result.id}`] ?? result.manualReview ?? undefined;
    if (review === 'approved') stats.approved += 1;
    if (review === 'rejected') stats.rejected += 1;
    return stats;
  }, { approved: 0, rejected: 0 }), [activeModel, manualReview, results]);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem('nourish-eval-history') || '[]')); } catch { setHistory([]); }
    void fetch('/api/evaluation/run', { headers: { accept: 'application/json' } })
      .then(async (response) => {
        const text = await response.text();
        if (!response.ok || !text.trim()) return null;
        return JSON.parse(text) as { runs?: Array<{ id: string; model: string; passed: number; total: number; passRate: number; createdAt: string; durationMs?: number | null; totalTokens?: number | null; promptVersion?: string | null }> };
      })
      .then((data) => {
        if (!data?.runs?.length) return;
        setHistory(data.runs.slice(0, 5).map((run) => ({ id: run.id, model: run.model, passed: run.passed, total: run.total, passRate: run.passRate, ranAt: run.createdAt, durationMs: run.durationMs, totalTokens: run.totalTokens, promptVersion: run.promptVersion })));
      })
      .catch(() => undefined);
  }, []);

  async function runEvaluation() {
    setRunning(true);
    setError('');
    try {
      const models = modelInput.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 3);
      const caseIds = runScope === 'smoke' ? SMOKE_CASE_IDS : EVALUATION_CASES.map((item) => item.id);
      const response = await fetch('/api/evaluation/run', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ models, caseIds }) });
      const responseText = await response.text();
      if (!responseText.trim()) throw new Error(`评测服务返回空响应（HTTP ${response.status}），请稍后重试。`);
      let data: EvaluationResponse;
      try {
        data = JSON.parse(responseText) as EvaluationResponse;
      } catch {
        throw new Error(`评测服务响应格式异常（HTTP ${response.status}），请稍后重试。`);
      }
      if (!response.ok) throw new Error(data.error || '评测运行失败');
      if (!data.runs?.length) throw new Error('评测结果结构不完整');
      const first = data.runs[0];
      setRuns(data.runs);
      setCompletedScope(runScope);
      setActiveModel(first.model);
      setResults(first.results);
      setSummary({ model: first.model, passed: first.passed, total: first.total, passRate: first.passRate });
      setManualReview({});
      const completedAt = new Date().toISOString();
      setRanAt(completedAt);
      const nextHistory = [...data.runs.map(({ model, passed, total, passRate, durationMs, totalTokens, promptVersion }) => ({ model, passed, total, passRate, durationMs, totalTokens, promptVersion, ranAt: completedAt })), ...history].slice(0, 5);
      setHistory(nextHistory);
      localStorage.setItem('nourish-eval-history', JSON.stringify(nextHistory));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '评测运行失败');
    } finally {
      setRunning(false);
    }
  }

  function selectRun(run: ModelRun) {
    setActiveModel(run.model);
    setResults(run.results);
    setSummary({ model: run.model, passed: run.passed, total: run.total, passRate: run.passRate });
  }

  async function loadHistoricalRun(historyRun: RunHistory) {
    if (!historyRun.id) return;
    setError('');
    try {
      const response = await fetch(`/api/evaluation/run?runId=${encodeURIComponent(historyRun.id)}`, { headers: { accept: 'application/json' } });
      const data = await response.json() as { run?: ModelRun; error?: string };
      if (!response.ok || !data.run) throw new Error(data.error || '历史详情读取失败');
      const caseMap = new Map(EVALUATION_CASES.map((item) => [item.id, item]));
      const hydrated = data.run.results.map((result) => ({ ...caseMap.get(result.id), ...result })) as RunResult[];
      const selected = { ...data.run, results: hydrated };
      setRuns([selected]);
      setActiveModel(selected.model);
      setResults(hydrated);
      setSummary({ model: selected.model, passed: selected.passed, total: selected.total, passRate: selected.passRate });
      setRanAt(historyRun.ranAt);
      setManualReview(Object.fromEntries(hydrated.flatMap((result) => result.manualReview ? [[`${selected.model}:${result.id}`, result.manualReview]] : [])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '历史详情读取失败');
    }
  }

  async function reviewCase(caseId: string, review: 'approved' | 'rejected') {
    const run = runs.find((item) => item.model === activeModel);
    const key = `${activeModel}:${caseId}`;
    setManualReview((old) => ({ ...old, [key]: review }));
    if (!run?.runId) return;
    try {
      const response = await fetch('/api/evaluation/run', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ runId: run.runId, caseId, review }),
      });
      if (!response.ok) throw new Error('save failed');
    } catch {
      setError('人工复核已保留在当前导出中，但云端保存失败，请稍后重试。');
    }
  }

  function exportEvidence() {
    if (!summary) return;
    const payload = { project: 'Nourish Eval Lab', ranAt, runScope: completedScope, scoring: 'deterministic-rules-with-human-review', manualReview, runs };
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
            {summary && (() => { const active = runs.find((run) => run.model === activeModel); return <p className="mt-1 text-[11px] text-[var(--tertiary-label)]">{active?.durationMs != null ? `${(active.durationMs / 1000).toFixed(1)} 秒` : '耗时未知'} · {active?.totalTokens ? `${active.totalTokens.toLocaleString()} tokens` : '服务商未返回 token'} · {active?.datasetVersion ?? '未记录数据集版本'}</p>; })()}
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[#F0FDF4] p-1 text-xs font-semibold">
              <button onClick={() => setRunScope('smoke')} className={`rounded-xl px-2 py-2 ${runScope === 'smoke' ? 'bg-white text-[var(--system-green)] border border-[#DCFCE7]' : 'text-[var(--secondary-label)]'}`}>冒烟集 · {SMOKE_CASE_IDS.length}</button>
              <button onClick={() => setRunScope('regression')} className={`rounded-xl px-2 py-2 ${runScope === 'regression' ? 'bg-white text-[var(--system-green)] border border-[#DCFCE7]' : 'text-[var(--secondary-label)]'}`}>回归集 · {EVALUATION_CASES.length}</button>
            </div>
            <input value={modelInput} onChange={(event) => setModelInput(event.target.value)} placeholder="模型名，可用逗号分隔（最多 3 个）" className="mt-2 h-10 w-full rounded-xl border border-[var(--separator)] bg-white px-3 text-xs outline-none focus:border-[var(--system-green)]" />
            <p className="mt-1 text-[11px] text-[var(--tertiary-label)]">留空使用当前配置模型；多个模型共用已配置 Endpoint 与密钥。</p>
            <button onClick={() => void runEvaluation()} disabled={running} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--system-green)] font-semibold text-white disabled:opacity-50">
              {running ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}{running ? '正在逐条评测…' : '运行全部用例'}
            </button>
            {summary && <button onClick={exportEvidence} className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--separator)] text-sm font-semibold text-[var(--system-green)]"><Download className="size-4" />导出评测证据</button>}
            {runs.some((run) => run.persistenceWarning) && <p className="mt-3 text-xs leading-5 text-[var(--system-red)]">{runs.find((run) => run.persistenceWarning)?.persistenceWarning}</p>}
            {summary && Object.keys(runs.find((run) => run.model === activeModel)?.failureSummary ?? {}).length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{Object.entries(runs.find((run) => run.model === activeModel)?.failureSummary ?? {}).map(([type, count]) => <span key={type} className="rounded-full bg-[var(--system-red)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--system-red)]">{FAILURE_LABELS[type] ?? type} · {count}</span>)}</div>}
            {error && <p className="mt-3 text-xs leading-5 text-[var(--system-red)]">{error}</p>}
          </div>
        </section>

        {runs.length > 1 && <section className="mt-8 rounded-3xl border border-[var(--separator)] bg-white p-5 md:p-6">
          <p className="text-xs font-semibold text-[var(--secondary-label)]">本轮模型对比</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">{runs.map((run) => <button key={run.model} onClick={() => selectRun(run)} className={`rounded-2xl border p-4 text-left ${activeModel === run.model ? 'border-[var(--system-green)] bg-[#F0FDF4]' : 'border-[var(--separator)] bg-white'}`}><p className="truncate text-xs text-[var(--secondary-label)]">{run.model}</p><p className="mt-1 text-2xl font-semibold text-[var(--system-green)]">{run.passRate}%</p><p className="text-[11px] text-[var(--tertiary-label)]">{run.passed}/{run.total} 通过</p></button>)}</div>
        </section>}

        {history.length > 0 && <section className="mt-8 rounded-3xl border border-[var(--separator)] bg-white p-5 md:p-6">
          <div className="flex items-center gap-2"><History className="size-5 text-[var(--system-green)]" /><h2 className="font-semibold">最近模型运行</h2></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{history.map((run, index) => { const previous = history.slice(index + 1).find((item) => item.model === run.model && item.total === run.total); const delta = previous ? run.passRate - previous.passRate : null; return <button type="button" onClick={() => void loadHistoricalRun(run)} disabled={!run.id} key={`${run.ranAt}-${run.model}`} className="rounded-2xl bg-[var(--system-gray6)] p-3 text-left transition-colors hover:bg-[#F0FDF4] disabled:cursor-default"><p className="truncate text-xs text-[var(--secondary-label)]">{run.model}</p><div className="mt-1 flex items-baseline gap-1.5"><p className="text-xl font-semibold text-[var(--system-green)]">{run.passRate}%</p>{delta !== null && <span className={`text-[11px] font-semibold ${delta >= 0 ? 'text-[var(--system-green)]' : 'text-[var(--system-red)]'}`}>{delta >= 0 ? '+' : ''}{delta}pp</span>}</div><p className="mt-1 text-[11px] text-[var(--tertiary-label)]">{run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s · ` : ''}{run.totalTokens ? `${run.totalTokens.toLocaleString()} tokens` : run.promptVersion ?? '历史基线'}</p><p className="mt-1 text-[11px] text-[var(--tertiary-label)]">{new Date(run.ranAt).toLocaleString('zh-CN')}</p></button>; })}</div>
        </section>}

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-semibold">分层评测数据集</h2><p className="mt-1 text-sm text-[var(--secondary-label)]">{EVALUATION_CASES.length} 条版本化基线：核心冒烟 + 扩展回归</p></div><ShieldCheck className="size-6 text-[var(--system-green)]" /></div>
          {summary && <div className="mb-4 rounded-3xl border border-[var(--separator)] bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-[var(--secondary-label)]">人工复核覆盖</p><p className="mt-1 text-sm"><span className="font-semibold text-[var(--system-green)]">{reviewStats.approved + reviewStats.rejected}/{results.length}</span><span className="text-[var(--secondary-label)]"> 已复核 · 通过 {reviewStats.approved} · 驳回 {reviewStats.rejected}</span></p></div><div className="flex flex-wrap gap-2"><select aria-label="按结果筛选" value={caseFilter} onChange={(event) => setCaseFilter(event.target.value as typeof caseFilter)} className="h-9 rounded-xl border border-[var(--separator)] bg-white px-3 text-xs outline-none"><option value="all">全部结果</option><option value="failed">仅自动失败</option><option value="passed">仅自动通过</option><option value="unreviewed">待人工复核</option><option value="rejected">人工驳回</option></select><select aria-label="按类别筛选" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-9 rounded-xl border border-[var(--separator)] bg-white px-3 text-xs outline-none"><option value="all">全部类别</option>{[...new Set(EVALUATION_CASES.map((item) => item.category))].map((category) => <option key={category} value={category}>{category}</option>)}</select></div></div></div>}
          <div className="grid gap-4">
            {visibleCases.map((testCase) => {
              const result = resultMap.get(testCase.id);
              return <article key={testCase.id} className="rounded-3xl border border-[var(--separator)] bg-[var(--secondary-grouped-background)] p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><span className="text-xs font-semibold text-[var(--system-green)]">{testCase.category} · {testCase.tier === 'smoke' ? '冒烟' : '回归'} · {testCase.severity === 'critical' ? 'P0' : 'P1'}</span><h3 className="mt-1 text-base font-semibold">{testCase.title}</h3></div>
                  {result && <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${result.passed ? 'bg-[var(--system-green)]/12 text-[var(--system-green)]' : 'bg-[var(--system-red)]/10 text-[var(--system-red)]'}`}>{result.passed ? <CheckCircle2 className="size-4" /> : <CircleAlert className="size-4" />}{result.passed ? '通过' : '待复核'}</span>}
                </div>
                <p className="mt-4 rounded-2xl bg-[var(--system-gray6)] p-4 text-sm leading-6">“{testCase.input}”</p>
                <p className="mt-3 text-xs leading-5 text-[var(--secondary-label)]">评测依据：{testCase.rationale}</p>
                {result && <div className="mt-4 border-t border-[var(--separator)] pt-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-[var(--secondary-label)]">模型回答{result.durationMs != null ? ` · ${(result.durationMs / 1000).toFixed(1)} 秒` : ''}{result.totalTokens ? ` · ${result.totalTokens} tokens` : ''}</p><div className="flex gap-1"><button aria-label="人工复核通过" onClick={() => void reviewCase(testCase.id, 'approved')} className={`rounded-lg p-1.5 ${manualReview[`${activeModel}:${testCase.id}`] === 'approved' ? 'bg-[var(--system-green)] text-white' : 'bg-[var(--system-gray6)] text-[var(--secondary-label)]'}`}><ThumbsUp className="size-3.5" /></button><button aria-label="人工复核不通过" onClick={() => void reviewCase(testCase.id, 'rejected')} className={`rounded-lg p-1.5 ${manualReview[`${activeModel}:${testCase.id}`] === 'rejected' ? 'bg-[var(--system-red)] text-white' : 'bg-[var(--system-gray6)] text-[var(--secondary-label)]'}`}><ThumbsDown className="size-3.5" /></button></div></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{result.error || result.answer}</p>{result.jsonValid === false && <p className="mt-2 text-xs text-[var(--system-red)]">结构化输出无法解析为 JSON</p>}{(result.missingJsonKeys?.length ?? 0) > 0 && <p className="mt-2 text-xs text-[var(--system-red)]">缺少顶层字段：{result.missingJsonKeys?.join('、')}</p>}{(result.missingJsonPaths?.length ?? 0) > 0 && <p className="mt-2 text-xs text-[var(--system-red)]">缺少嵌套字段：{result.missingJsonPaths?.join('、')}</p>}{result.forbiddenHits.length > 0 && <p className="mt-2 text-xs text-[var(--system-red)]">命中风险表达：{result.forbiddenHits.join('、')}</p>}</div>}
              </article>;
            })}
            {visibleCases.length === 0 && <div className="rounded-3xl border border-dashed border-[var(--separator)] bg-white p-8 text-center text-sm text-[var(--secondary-label)]">当前筛选条件下没有用例</div>}
          </div>
        </section>
      </div>
    </main>
  );
}
