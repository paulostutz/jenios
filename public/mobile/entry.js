(() => {
  'use strict';
  let promptEvent = null;
  const button = document.querySelector('#install-button');
  const notice = document.querySelector('#offline-notice');
  const connection = () => { if (notice) notice.hidden = navigator.onLine; };
  connection(); window.addEventListener('online', connection); window.addEventListener('offline', connection);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); promptEvent = event; if (button) button.hidden = false; });
  button?.addEventListener('click', async () => {
    if (!promptEvent) return;
    const selected = promptEvent; promptEvent = null; button.hidden = true;
    try { await selected.prompt(); await selected.userChoice; } catch { /* Instructions remain available. */ }
  });
  window.addEventListener('appinstalled', () => { promptEvent = null; if (button) button.hidden = true; });
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/jenios-mobile-sw.js', { scope: '/' }).catch(() => { /* Online flows remain usable. */ });
})();
