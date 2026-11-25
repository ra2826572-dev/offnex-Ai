(function () {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(function (reg) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        if (!navigator.serviceWorker.controller && reg.active) {
          reg.active.postMessage({ type: 'CLAIM_CLIENTS' });
        }
        reg.addEventListener('updatefound', function () {
          var inst = reg.installing;
          if (!inst) return;
          inst.addEventListener('statechange', function () {
            if (inst.state === 'installed') {
              inst.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(function () {});
  } catch (e) {}
})();
