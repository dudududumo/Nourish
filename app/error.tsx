'use client';

import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Nourish client error', error); }, [error]);
  async function recover() {
    if ('serviceWorker' in navigator) (await navigator.serviceWorker.getRegistrations()).forEach((registration) => registration.unregister());
    if ('caches' in window) await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
    location.replace(`/?_recover=${Date.now()}`);
  }
  return <main className="flex min-h-screen items-center justify-center bg-white p-6 text-center"><div className="max-w-sm"><p className="text-sm font-semibold text-[#16A34A]">页面加载遇到问题</p><h1 className="mt-2 text-2xl font-semibold">可能仍在使用旧版本资源</h1><p className="mt-3 text-sm leading-6 text-gray-500">先重试当前页面；若仍未恢复，再清理旧缓存。不会删除你的云端数据。</p><div className="mt-6 grid gap-3"><button type="button" onClick={reset} className="h-11 w-full rounded-2xl border border-[#BBF7D0] font-semibold text-[#16A34A]">重试</button><button type="button" onClick={() => void recover()} className="h-11 w-full rounded-2xl bg-[#22C55E] font-semibold text-white">清理缓存并重新进入</button></div></div></main>;
}
