import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Service Worker kill-switch — manual recovery page.
//
// Why this exists: an older service worker (sw.js v3) cached redirect
// responses for auth-gated routes. When users' session cookies expired,
// the SW served stale 307s out of cache, putting Chrome in "This page
// couldn't load" state. Subsequent fixes (Phase 16+) stopped the
// poisoning at the source — but users who already had the bad v3
// installed can't reach the new sw.js because the bad SW intercepts
// every navigation.
//
// This route lives under /api/, which the SW explicitly skips (see
// public/sw.js's "Never cache API calls or auth routes" guard). So
// navigating here bypasses any SW. The inline JS then:
//   1. Unregisters every service worker on this origin.
//   2. Deletes every cache.
//   3. Redirects to /.
// After running once, the browser has no SW + no cache, and the next
// page load fetches everything fresh from the server — including the
// new sw.js v4, which doesn't repeat the original bug.
//
// User-facing URL: https://protocol-tawny.vercel.app/api/reset
// Safe to bookmark; can be run as many times as needed.

const HTML = `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Resetare Protocol</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #08090d;
    color: #ecedef;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    max-width: 420px;
    width: 100%;
    background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)), #0f1218;
    border: 1px solid #20242d;
    border-radius: 20px;
    padding: 28px;
    text-align: center;
    box-shadow: 0 12px 40px rgba(0,0,0,0.55);
  }
  h1 { margin: 0 0 12px; font-size: 20px; letter-spacing: -0.02em; }
  p { margin: 8px 0; font-size: 13px; line-height: 1.6; color: #9ca3af; }
  .ok { color: #34d399; font-weight: 600; }
  .err { color: #f87171; font-weight: 600; }
  .spinner {
    width: 28px; height: 28px;
    border: 3px solid #20242d;
    border-top-color: #34d399;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 16px auto;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  ul { text-align: left; margin: 16px 0 0; padding-left: 18px; font-size: 12px; }
  ul li { color: #6b7280; padding: 2px 0; }
  ul li.done { color: #34d399; }
  ul li.fail { color: #f87171; }
  a.manual {
    display: inline-block;
    margin-top: 14px;
    padding: 8px 14px;
    border-radius: 10px;
    background: #34d399;
    color: #08090d;
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
  }
</style>
</head>
<body>
  <div class="card">
    <h1>Resetez Protocol în browser-ul tău</h1>
    <p>Sterg Service Worker-ul vechi care blochează încărcarea. Durează 2 secunde.</p>
    <div class="spinner" id="spin"></div>
    <ul id="log">
      <li id="s-sw">Service Workers…</li>
      <li id="s-cache">Cache…</li>
      <li id="s-storage">Storage…</li>
    </ul>
    <p id="status">Rulez…</p>
    <a class="manual" id="manual" href="/" hidden>Deschide aplicația</a>
  </div>
<script>
(async function() {
  const log = (id, ok, msg) => {
    const li = document.getElementById(id);
    if (!li) return;
    li.className = ok ? 'done' : 'fail';
    li.textContent = msg;
  };
  const setStatus = (txt, cls) => {
    const el = document.getElementById('status');
    el.textContent = txt;
    el.className = cls || '';
  };
  try {
    // 1. Service Workers
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister().catch(() => null)));
      log('s-sw', true, '✓ Service Workers șterse (' + regs.length + ')');
    } else {
      log('s-sw', true, '✓ Service Workers — niciunul');
    }

    // 2. Caches
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k).catch(() => null)));
      log('s-cache', true, '✓ Cache șters (' + keys.length + ' chei)');
    } else {
      log('s-cache', true, '✓ Cache — niciunul');
    }

    // 3. Storage flags we control — leave Supabase session intact!
    try {
      localStorage.removeItem('protocol:cron-banner-seen');
      localStorage.removeItem('protocol:regen-diff:latest');
      log('s-storage', true, '✓ Flag-uri locale curățate');
    } catch (e) {
      log('s-storage', true, '✓ Storage — skip');
    }

    setStatus('✓ Gata. Redirectez în 2 secunde…', 'ok');
    document.getElementById('spin').style.display = 'none';
    document.getElementById('manual').hidden = false;
    setTimeout(() => { window.location.replace('/'); }, 2000);
  } catch (err) {
    setStatus('A eșuat: ' + (err && err.message || err) + ' — apasă butonul de mai jos', 'err');
    document.getElementById('spin').style.display = 'none';
    document.getElementById('manual').hidden = false;
  }
})();
</script>
</body>
</html>`;

export async function GET() {
  return new NextResponse(HTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Aggressively bypass every cache layer: client, CDN, and any
      // intermediate proxy. We need this to always return fresh HTML
      // because users hitting it are already in a broken cache state.
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      // Belt-and-suspenders: tell any SW that intercepts (it shouldn't,
      // since /api/ is excluded, but if a future SW change forgets that)
      // not to cache this response.
      'X-Service-Worker-Skip': 'true',
    },
  });
}

export const POST = GET;
