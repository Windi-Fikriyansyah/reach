/**
 * ReachOwl — Facebook scan helper (MAIN world, document_start)
 *
 * Only active in the background tab the extension opens for scanning
 * (the URL carries `reachowl_scan=1`). Chrome does not run the rendering
 * pipeline for inactive tabs, so IntersectionObserver / requestAnimationFrame /
 * scroll events never fire and Facebook's infinite scroll stops after the
 * first batch (~25 groups). This shim makes the page believe it is visible
 * and that observed elements (incl. the pagination sentinel) are on screen,
 * so Facebook keeps loading pages until the list is exhausted.
 */
(() => {
  if (!/[?&]reachowl_scan=1(?:&|$)/.test(location.search)) return;

  // 1. Halaman dianggap selalu terlihat & fokus
  try {
    Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => 'visible' });
    Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => false });
    Document.prototype.hasFocus = () => true;
  } catch (e) {}

  // 2. requestAnimationFrame tetap berjalan di tab tidak aktif
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
  window.cancelAnimationFrame = (id) => clearTimeout(id);

  // 3. IntersectionObserver palsu: elemen yang diamati selalu dilaporkan
  //    sedang berpotongan (isIntersecting = true) sehingga sentinel paginasi
  //    Facebook memicu muat halaman berikutnya sampai semua grup habis.
  class ReachOwlIntersectionObserver {
    constructor(callback, options) {
      this._cb = callback;
      this._targets = new Set();
      this._timer = null;
      this.root = (options && options.root) || null;
      this.rootMargin = (options && options.rootMargin) || '0px';
      const th = options && options.threshold !== undefined ? options.threshold : 0;
      this.thresholds = Array.isArray(th) ? th : [th];
    }

    _entries(visible) {
      const now = performance.now();
      const list = [];
      this._targets.forEach((t) => {
        if (!t || !t.isConnected) return;
        const r = t.getBoundingClientRect();
        list.push({
          target: t,
          time: now,
          isIntersecting: visible,
          intersectionRatio: visible ? 1 : 0,
          boundingClientRect: r,
          intersectionRect: r,
          rootBounds: null,
        });
      });
      return list;
    }

    _emit(visible) {
      const entries = this._entries(visible);
      if (!entries.length) return;
      try {
        this._cb(entries, this);
      } catch (e) {}
    }

    _cycle() {
      this._emit(false);
      setTimeout(() => this._emit(true), 30);
    }

    observe(target) {
      if (!target) return;
      this._targets.add(target);
      // Langsung picu intersecting agar paginasi langsung terpanggil
      setTimeout(() => this._emit(true), 20);
      if (!this._timer) this._timer = setInterval(() => this._cycle(), 600);
    }

    unobserve(target) {
      this._targets.delete(target);
    }

    disconnect() {
      this._targets.clear();
      if (this._timer) clearInterval(this._timer);
      this._timer = null;
    }

    takeRecords() {
      return [];
    }
  }

  ReachOwlIntersectionObserver.prototype.THROTTLE_TIMEOUT = 100;
  window.IntersectionObserver = ReachOwlIntersectionObserver;
})();
