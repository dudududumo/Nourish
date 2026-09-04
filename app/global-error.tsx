'use client';

export default function GlobalError() {
  async function recover() {
    if ('serviceWorker' in navigator) (await navigator.serviceWorker.getRegistrations()).forEach((registration) => registration.unregister());
    if ('caches' in window) await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
    location.replace(`/?_recover=${Date.now()}`);
  }

  return <html lang="zh-CN"><body><main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', textAlign: 'center' }}><div style={{ maxWidth: 360 }}><p style={{ color: '#16A34A', fontWeight: 600 }}>页面版本需要刷新</p><h1 style={{ fontSize: 24 }}>检测到旧资源与新版本不一致</h1><p style={{ color: '#6B7280', lineHeight: 1.6 }}>清理旧缓存后即可恢复底栏和页面切换，不会删除你的云端数据。</p><button type="button" onClick={() => void recover()} style={{ marginTop: 16, width: '100%', height: 44, border: 0, borderRadius: 16, background: '#22C55E', color: 'white', fontWeight: 600 }}>清理缓存并重新进入</button></div></main></body></html>;
}
