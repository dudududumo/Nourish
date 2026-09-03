'use client';

import { useState } from 'react';
import { ArrowLeft, FlaskConical, ImagePlus, Loader2, Trash2 } from 'lucide-react';

type Sample = { id: string; name: string; image: string; truthText: string };
type EvalResult = { datasetVersion: string; promptVersion: string; total: number; fieldAccuracy: number; precision: number; expectedCount: number; matched: number; durationMs: number; totalTokens: number; estimatedCost?: number; currency?: string; results: Array<{ id: string; error?: string; fields: Array<{ field: string; expected?: number; predicted?: number; status: string }> }> };

export default function ImageEvaluationPage() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [error, setError] = useState('');
  const [inputPrice, setInputPrice] = useState('');
  const [outputPrice, setOutputPrice] = useState('');

  function addFiles(files: FileList | null) {
    if (!files) return;
    [...files].slice(0, 5 - samples.length).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setSamples((old) => [...old, { id: crypto.randomUUID(), name: file.name, image: String(reader.result), truthText: '{\n  "体重": "",\n  "BMI": "",\n  "体脂率": ""\n}' }].slice(0, 5));
      reader.readAsDataURL(file);
    });
  }

  async function runEvaluation() {
    setRunning(true); setError(''); setResult(null);
    try {
      const cases = samples.map((sample) => ({ id: sample.id, image: sample.image, groundTruth: JSON.parse(sample.truthText) as Record<string, string | number> }));
      const pricing = inputPrice.trim() && outputPrice.trim() ? { inputPerMillion: Number(inputPrice), outputPerMillion: Number(outputPrice), currency: 'CNY' } : undefined;
      const response = await fetch('/api/evaluation/image', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cases, pricing }) });
      const data = await response.json() as EvalResult & { error?: string };
      if (!response.ok) throw new Error(data.error || '图片评测失败');
      setResult(data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '图片评测失败'); }
    finally { setRunning(false); }
  }

  return <main className="min-h-screen bg-[var(--grouped-background)] text-[var(--label)]"><div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12">
    <a href="/evaluation" className="inline-flex items-center gap-2 text-sm text-[var(--secondary-label)]"><ArrowLeft className="size-4" />返回文本评测</a>
    <div className="mt-7"><div className="inline-flex items-center gap-2 rounded-full bg-[var(--system-green)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--system-green)]"><ImagePlus className="size-4" />Image Eval Dataset</div><h1 className="mt-4 text-3xl font-semibold tracking-tight">体脂秤截图字段级评测</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--secondary-label)]">上传脱敏截图并填写人工核对真值。系统按字段计算准确率、精确率、漏提取、错提取与多提取；图片只用于本轮模型调用，不写入 D1。</p></div>
    <section className="mt-7 rounded-3xl border border-[var(--separator)] bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl bg-[var(--system-green)] px-4 text-sm font-semibold text-white"><ImagePlus className="size-4" />添加截图（最多 5 张）<input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => addFiles(event.target.files)} /></label><div className="flex gap-2"><input value={inputPrice} onChange={(event) => setInputPrice(event.target.value)} placeholder="输入 ¥/百万 Token" className="h-10 w-36 rounded-xl border border-[var(--separator)] px-3 text-xs" /><input value={outputPrice} onChange={(event) => setOutputPrice(event.target.value)} placeholder="输出 ¥/百万 Token" className="h-10 w-36 rounded-xl border border-[var(--separator)] px-3 text-xs" /></div></div>
      <div className="mt-5 grid gap-4">{samples.map((sample) => <article key={sample.id} className="grid gap-4 rounded-2xl bg-[var(--system-gray6)] p-4 md:grid-cols-[160px_1fr_auto]"><img src={sample.image} alt={sample.name} className="h-40 w-full rounded-xl object-contain bg-white" /><div><p className="mb-2 truncate text-xs font-semibold">{sample.name}</p><textarea value={sample.truthText} onChange={(event) => setSamples((old) => old.map((item) => item.id === sample.id ? { ...item, truthText: event.target.value } : item))} className="h-32 w-full rounded-xl border border-[var(--separator)] bg-white p-3 font-mono text-xs" /></div><button aria-label="删除样本" onClick={() => setSamples((old) => old.filter((item) => item.id !== sample.id))} className="self-start rounded-xl p-2 text-[var(--system-red)]"><Trash2 className="size-4" /></button></article>)}</div>
      <button disabled={running || !samples.length} onClick={() => void runEvaluation()} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--system-green)] font-semibold text-white disabled:opacity-40">{running ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}{running ? '正在解析并逐字段对比…' : `运行图片评测 · ${samples.length} 条`}</button>{error && <p className="mt-3 text-sm text-[var(--system-red)]">{error}</p>}
    </section>
    {result && <section className="mt-6 rounded-3xl border border-[var(--separator)] bg-white p-5"><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="字段准确率" value={`${result.fieldAccuracy}%`} /><Stat label="字段精确率" value={`${result.precision}%`} /><Stat label="正确字段" value={`${result.matched}/${result.expectedCount}`} /><Stat label="成本" value={result.estimatedCost != null ? `${result.estimatedCost.toFixed(4)} ${result.currency ?? ''}` : '未配置'} /></div><p className="mt-4 text-xs text-[var(--secondary-label)]">{result.datasetVersion} · {result.promptVersion} · {(result.durationMs / 1000).toFixed(1)} 秒 · {result.totalTokens.toLocaleString()} tokens</p><div className="mt-5 grid gap-3">{result.results.map((item) => <div key={item.id} className="rounded-2xl bg-[var(--system-gray6)] p-4"><p className="text-xs font-semibold">样本 {item.id.slice(0, 8)} {item.error ? `· ${item.error}` : ''}</p><div className="mt-2 flex flex-wrap gap-1.5">{item.fields.map((field) => <span key={field.field} className={`rounded-full px-2 py-1 text-[11px] ${field.status === 'matched' ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-red-50 text-[var(--system-red)]'}`}>{field.field} · {field.status} · {field.predicted ?? '缺失'}/{field.expected ?? '无真值'}</span>)}</div></div>)}</div></section>}
  </div></main>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-[#F0FDF4] p-4"><p className="text-xs text-[var(--secondary-label)]">{label}</p><p className="mt-1 text-xl font-semibold text-[var(--system-green)]">{value}</p></div>; }
