'use strict';
const CACHE = 'jenios-mobile-public-m02-v1';
const SHELL = ['/mobile.html','/mobile/entry.css','/mobile/entry.js','/mobile/offline.html','/mobile/manifest.webmanifest','/mobile/apple-touch-icon.png','/mobile/icon-256.png','/mobile/icon-512.webp','/brand/jenios-j.webp'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('jenios-mobile-public-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('authorization') || url.pathname.startsWith('/api/')) return;
  // Private pages, account responses, feeds, quotes and signed URLs are NEVER cached.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (url.pathname === '/mobile.html' && !url.search ? await caches.match('/mobile.html') : null) || await caches.match('/mobile/offline.html') || new Response('Sem conexão.', {status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}})));
    return;
  }
  if (url.search || !SHELL.includes(url.pathname)) return;
  event.respondWith(fetch(request).catch(() => caches.match(url.pathname).then(response => response || new Response('', {status:503}))));
});
