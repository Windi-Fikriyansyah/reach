/**
 * ReachOwl — Facebook Background Scan Helper (MAIN world, document_start)
 *
 * Diaktifkan khusus pada halaman grup Facebook (/groups/joins).
 * Menjaga siklus rendering & paginasi Facebook tetap aktif saat tab berjalan
 * di latar belakang (active: false), sehingga Relay infinite scroll tetap memuat
 * seluruh grup sampai tuntas tanpa perlu berpindah tab atau mencuri fokus pengguna.
 */
(() => {
  // 1. Visibilitas tab selalu dilaporkan aktif & fokus
  try {
    Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => 'visible' });
    Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => false });
    Document.prototype.hasFocus = () => true;
  } catch (e) {}

  // 2. requestAnimationFrame tetap berdetak normal di tab latar belakang
  try {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  } catch (e) {}

  // 3. Wrapper IntersectionObserver: menjaga instance asli native,
  //    sekaligus memicu callback perpotongan sentinel paginasi secara periodik
  //    meski browser engine Chromium menunda layout pass di tab non-aktif.
  const NativeIO = window.IntersectionObserver;
  if (!NativeIO) return;

  const activeInstances = new Set();

  function ReachOwlIntersectionObserver(callback, options) {
    const inst = new NativeIO(callback, options);
    inst.__userCallback = callback;
    inst.__targets = new Set();

    const origObserve = inst.observe.bind(inst);
    inst.observe = (target) => {
      if (target) inst.__targets.add(target);
      return origObserve(target);
    };

    const origUnobserve = inst.unobserve.bind(inst);
    inst.unobserve = (target) => {
      if (target) inst.__targets.delete(target);
      return origUnobserve(target);
    };

    const origDisconnect = inst.disconnect.bind(inst);
    inst.disconnect = () => {
      inst.__targets.clear();
      activeInstances.delete(inst);
      return origDisconnect();
    };

    activeInstances.add(inst);
    return inst;
  }

  ReachOwlIntersectionObserver.prototype = NativeIO.prototype;
  window.IntersectionObserver = ReachOwlIntersectionObserver;

  // Siklus pemicu sentinel Relay di latar belakang
  setInterval(() => {
    const w = window.innerWidth || 1920;
    const h = window.innerHeight || 1080;
    const rootRect = { x: 0, y: 0, top: 0, left: 0, right: w, bottom: h, width: w, height: h };
    const now = performance.now();

    for (const inst of activeInstances) {
      if (!inst.__targets || !inst.__targets.size) continue;
      const entries = [];
      for (const target of inst.__targets) {
        if (!target || !target.isConnected) {
          inst.__targets.delete(target);
          continue;
        }
        const r = target.getBoundingClientRect();
        entries.push({
          target,
          time: now,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: r,
          intersectionRect: r,
          rootBounds: rootRect,
        });
      }

      if (entries.length > 0 && typeof inst.__userCallback === 'function') {
        try {
          inst.__userCallback(entries, inst);
        } catch (err) {}
      }
    }
  }, 600);

  // 4. Pengguliran berkelanjutan di MAIN world langsung ke elemen scrollable
  setInterval(() => {
    try {
      document.querySelectorAll('div, main, section, nav, [role="navigation"]').forEach((el) => {
        if (el.scrollHeight > el.clientHeight + 15) {
          el.scrollTop = el.scrollHeight;
          el.dispatchEvent(new Event('scroll', { bubbles: false }));
        }
      });
    } catch (e) {}
  }, 500);
})();
