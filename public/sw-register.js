(function () {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(function (reg) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', function () {
          var inst = reg.installing;
          if (!inst) return;
          inst.addEventListener('statechange', function () {
            if (inst.state === 'installed' && navigator.serviceWorker.controller) {
              inst.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(function () {});
  } catch (e) {}
})();
