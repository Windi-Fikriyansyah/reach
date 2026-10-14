/**
 * ReachOwl Background Bridge (Event-Driven Headless Worker)
 * - Pengecekan sesi & pengambilan data profil riil (nama + avatar) on-demand saat tombol Connect diklik.
 * - Saat pengguna BENAR-BENAR LOGOUT dari Facebook atau Instagram, otomatis mengirim WEBHOOK ke aplikasi.
 * - Pemindaian otomatis grup Facebook yang diikuti untuk fitur Campaign.
 */

const WEBHOOK_URL = 'http://localhost:3000/api/browser-accounts/webhook';
const DEFAULT_AVATAR_MARK = '84628273_176159830277856';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFacebookUserId() {
  try {
    const c1 = await chrome.cookies.get({ url: 'https://www.facebook.com', name: 'c_user' });
    if (c1 && c1.value) return c1.value;
  } catch (e) {}
  try {
    const c2 = await chrome.cookies.get({ url: 'https://facebook.com', name: 'c_user' });
    if (c2 && c2.value) return c2.value;
  } catch (e) {}
  try {
    const all = await chrome.cookies.getAll({ name: 'c_user' });
    const fb = all.find((c) => (c.domain || '').includes('facebook.com'));
    if (fb && fb.value) return fb.value;
  } catch (e) {}
  return null;
}

function isValidAvatar(src) {
  return (
    src &&
    src.includes('scontent') &&
    !src.includes(DEFAULT_AVATAR_MARK) &&
    !src.includes('rsrc.php') &&
    !src.includes('static.xx')
  );
}

// ---------------------------------------------------------------------------
// Profil Facebook
// ---------------------------------------------------------------------------

async function getFacebookProfile(accountId) {
  let name = 'FB User (' + accountId.slice(-5) + ')';
  let avatarUrl = null;

  // 1. Storage lokal (diisi oleh facebook-bridge.js)
  try {
    const stored = await chrome.storage.local.get(['reachowl_fb_avatar']);
    if (stored && isValidAvatar(stored.reachowl_fb_avatar)) {
      avatarUrl = stored.reachowl_fb_avatar;
    }
  } catch (e) {}

  // 2. Tab Facebook yang sedang terbuka
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
    for (const t of tabs) {
      if (t.id && !avatarUrl && !t.discarded) {
        const results = await withTimeout(
          chrome.scripting
            .executeScript({
              target: { tabId: t.id },
              func: () => {
                const imgs = Array.from(
                  document.querySelectorAll('img[src*="scontent"], svg image')
                );
                const ok = (s) =>
                  s && s.includes('scontent') && !s.includes('84628273_176159830277856') && !s.includes('rsrc.php');
                for (const img of imgs) {
                  const src = img.src || img.getAttribute('xlink:href') || img.getAttribute('href');
                  if (ok(src) && (src.includes('stp=c') || src.includes('t39.30808-1') || src.includes('t1.30497-1'))) {
                    return src;
                  }
                }
                for (const img of imgs) {
                  const src = img.src || img.getAttribute('xlink:href') || img.getAttribute('href');
                  if (ok(src)) return src;
                }
                return null;
              },
            })
            .catch(() => null),
          2000,
          null
        );
        if (results && results[0] && results[0].result) {
          avatarUrl = results[0].result;
        }
      }

      if (t.title) {
        const clean = t.title.replace(/\s*\|\s*Facebook.*$/i, '').replace(/^\(\d+\)\s*/, '').trim();
        const low = clean.toLowerCase();
        if (clean && !low.includes('facebook') && !low.includes('log in') && !low.includes('masuk')) {
          name = clean;
        }
      }
      if (avatarUrl && !name.startsWith('FB User')) break;
    }
  } catch (e) {}

  // 3. www.facebook.com/me (data Relay)
  if (!avatarUrl || name.startsWith('FB User')) {
    try {
      const res = await fetch('https://www.facebook.com/me', {
        credentials: 'include',
        signal: AbortSignal.timeout(4000),
      });
      const html = await res.text();

      if (name.startsWith('FB User')) {
        const nameMatch = html.match(/"NAME":\s*"([^"]+)"/) || html.match(/"user_name":\s*"([^"]+)"/);
        if (nameMatch && nameMatch[1]) name = nameMatch[1];
      }

      if (!avatarUrl) {
        const patterns = [
          /"profilePicLarge":\s*\{\s*"uri":\s*"([^"]+)"/,
          /"profile_picture":\s*\{\s*"uri":\s*"([^"]+)"/,
          /"profilePhoto":\s*\{\s*"uri":\s*"([^"]+)"/,
          /"profile_pic_uri":\s*"([^"]+)"/,
        ];
        for (const p of patterns) {
          const m = html.match(p);
          if (m && m[1]) {
            const raw = m[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
            if (isValidAvatar(raw)) {
              avatarUrl = raw;
              break;
            }
          }
        }
      }
    } catch (e) {}
  }

  if (avatarUrl) {
    chrome.storage.local.set({ reachowl_fb_avatar: avatarUrl }).catch(() => {});
  }
  return { name, avatarUrl };
}

// ---------------------------------------------------------------------------
// Profil Instagram
// ---------------------------------------------------------------------------

async function getInstagramProfile(accountId) {
  let name = 'IG User (' + accountId.slice(-5) + ')';
  let avatarUrl = null;

  try {
    const tabs = await chrome.tabs.query({ url: '*://*.instagram.com/*' });
    for (const t of tabs) {
      if (t.title) {
        const clean = t.title.replace(/\s*•\s*Instagram.*$/i, '').replace(/\s*\|\s*Instagram/i, '').trim();
        const low = clean.toLowerCase();
        if (clean && !low.includes('instagram') && !low.includes('login') && !low.includes('masuk')) {
          name = clean;
          break;
        }
      }
    }
  } catch (e) {}

  try {
    const res = await fetch('https://i.instagram.com/api/v1/users/' + accountId + '/info/', {
      headers: { 'X-IG-App-ID': '936619743392459' },
      credentials: 'include',
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.user) {
        if (data.user.full_name || data.user.username) {
          name = data.user.full_name
            ? data.user.full_name + ' (@' + data.user.username + ')'
            : '@' + data.user.username;
        }
        if (data.user.profile_pic_url) avatarUrl = data.user.profile_pic_url;
      }
    }
  } catch (e) {}

  return { name, avatarUrl };
}

// ---------------------------------------------------------------------------
// Cek sesi on-demand
// ---------------------------------------------------------------------------

async function checkPlatformSession(platform) {
  if (platform === 'Facebook') {
    try {
      const uid = await getFacebookUserId();
      if (uid) {
        const profile = await getFacebookProfile(uid);
        return {
          platform: 'Facebook',
          isLoggedIn: true,
          accountId: uid,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          lastLoggedIn: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.error('Gagal membaca sesi Facebook:', err);
    }
    return { platform: 'Facebook', isLoggedIn: false, accountId: null, name: 'Akun Facebook', avatarUrl: null, lastLoggedIn: null };
  }

  if (platform === 'Instagram') {
    try {
      const dsUserId = await chrome.cookies.get({ url: 'https://www.instagram.com', name: 'ds_user_id' });
      const sessionId = await chrome.cookies.get({ url: 'https://www.instagram.com', name: 'sessionid' });
      if (dsUserId && dsUserId.value && sessionId && sessionId.value) {
        const profile = await getInstagramProfile(dsUserId.value);
        return {
          platform: 'Instagram',
          isLoggedIn: true,
          accountId: dsUserId.value,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          lastLoggedIn: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.error('Gagal membaca sesi Instagram:', err);
    }
    return { platform: 'Instagram', isLoggedIn: false, accountId: null, name: 'Akun Instagram', avatarUrl: null, lastLoggedIn: null };
  }

  return { isLoggedIn: false };
}

// ---------------------------------------------------------------------------
// Webhook logout
// ---------------------------------------------------------------------------

async function triggerLogoutWebhook(platform) {
  console.log('[ReachOwl] Logout terverifikasi pada ' + platform + ', mengirim webhook...');
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'logout', platform, timestamp: new Date().toISOString() }),
    });
  } catch (err) {
    console.warn('[ReachOwl] Gagal menghubungi webhook:', err);
  }

  try {
    const tabs = await chrome.tabs.query({ url: ['http://localhost:3000/*', 'http://127.0.0.1:3000/*'] });
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'REACHOWL_ACCOUNT_LOGGED_OUT', platform }).catch(() => {});
      }
    }
  } catch (e) {}
}

const logoutDebounceTimers = {};

chrome.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.cause === 'overwrite' || !changeInfo.removed) return;

  const cookieName = changeInfo.cookie.name;
  const domain = (changeInfo.cookie.domain || '').toLowerCase();

  if (cookieName === 'c_user' && domain.includes('facebook.com')) {
    clearTimeout(logoutDebounceTimers.Facebook);
    logoutDebounceTimers.Facebook = setTimeout(async () => {
      const uid = await getFacebookUserId();
      if (!uid) triggerLogoutWebhook('Facebook');
    }, 2500);
  }

  if ((cookieName === 'ds_user_id' || cookieName === 'sessionid') && domain.includes('instagram.com')) {
    clearTimeout(logoutDebounceTimers.Instagram);
    logoutDebounceTimers.Instagram = setTimeout(async () => {
      const ds = await chrome.cookies.get({ url: 'https://www.instagram.com', name: 'ds_user_id' });
      const sid = await chrome.cookies.get({ url: 'https://www.instagram.com', name: 'sessionid' });
      if (!ds || !ds.value || !sid || !sid.value) triggerLogoutWebhook('Instagram');
    }, 2500);
  }
});

// ---------------------------------------------------------------------------
// Scrape grup Facebook (otomatis, sampai habis)
// ---------------------------------------------------------------------------

/**
 * Fungsi ini dijalankan DI DALAM tab facebook.com (ISOLATED world via chrome.scripting).
 * Mengumpulkan grup secara akumulatif (aman untuk list virtual), terus menggulir
 * agar Facebook memuat halaman berikutnya, mengirim progres ke background,
 * dan berhenti ketika jumlah grup tidak bertambah lagi.
 * Harus self-contained (tidak boleh memakai variabel dari luar).
 */
function pageCollectGroups(maxWaitMs, idleStopMs) {
  const IGNORED = new Set([
    'create', 'discover', 'feed', 'joins', 'categories', 'notifications', 'search',
    'settings', 'my_groups', 'your_groups', 'learning_content', 'manage', 'invites',
  ]);
  const BAD_TEXT = /^(view group|lihat grup|visit group|kunjungi grup|join group|gabung|see all|lihat semua|create new group|buat grup baru)$/i;
  const found = new Map();

  const parseCardMeta = (str) => {
    if (!str || typeof str !== 'string') return { privacy: 'Public', members: null };

    // 1. Deteksi Privasi (Public vs Private)
    let privacy = 'Public';
    if (/privat|private|tertutup|closed/i.test(str)) {
      privacy = 'Private';
    } else if (/publik|public|terbuka|open/i.test(str)) {
      privacy = 'Public';
    }

    // 2. Deteksi Jumlah Member / Anggota
    let members = null;
    const memberRegexes = [
      /(\d[\d.,]*\s*(?:rb|k|jt|m|ribu|juta)?)\s*(?:anggota|members?)/i,
      /(?:anggota|members?)\s*[:·-]?\s*(\d[\d.,]*\s*(?:rb|k|jt|m|ribu|juta)?)/i,
    ];
    for (const rx of memberRegexes) {
      const match = str.match(rx);
      if (match && match[1]) {
        members = match[0].trim();
        break;
      }
    }

    return { privacy, members };
  };

  const upsert = (id, name, image, privacy, members) => {
    if (!id || IGNORED.has(id.toLowerCase())) return;
    const prev = found.get(id) || { id, name: '', image: null, privacy: 'Public', members: null };
    if (name && name.length > 1 && !BAD_TEXT.test(name) && (!prev.name || prev.name.length < name.length)) {
      prev.name = name;
    }
    if (!prev.image && image && image.includes('scontent')) prev.image = image;
    if (privacy) prev.privacy = privacy;
    if (members && (!prev.members || prev.members === '-')) prev.members = members;
    found.set(id, prev);
  };

  const collect = () => {
    // A. DOM yang sudah dirender
    document.querySelectorAll('a[href*="/groups/"]').forEach((a) => {
      const href = a.href || '';
      const m = href.match(/facebook\.com\/groups\/([^/?#]+)/i);
      if (!m) return;
      let id = m[1];
      try { id = decodeURIComponent(id); } catch (e) {}
      if (!id || IGNORED.has(id.toLowerCase())) return;

      let lines = (a.innerText || a.textContent || a.getAttribute('aria-label') || '')
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s && !BAD_TEXT.test(s));
      let text = lines[0] || '';

      let img = a.querySelector('img, image');
      let src = img ? img.getAttribute('src') || img.getAttribute('xlink:href') || img.getAttribute('href') : null;

      // Ambil teks dari a dan card parent untuk mendeteksi privasi dan jumlah member
      const card = a.closest('div[role="listitem"], div[role="article"], div[data-visualcompletion], div[role="gridcell"]') || a.parentElement;
      const combinedText = [
        a.innerText || a.textContent || '',
        card ? (card.innerText || card.textContent || '') : '',
      ].join('\n');

      const meta = parseCardMeta(combinedText);
      let privacy = meta.privacy;
      let members = meta.members;

      // Jika link tidak memiliki nama atau gambar, cari di card parent
      if (!text || !src) {
        if (card) {
          if (!text) {
            const h = card.querySelector('h2, h3, span[dir="auto"], strong');
            if (h) {
              const hLines = (h.innerText || h.textContent || '')
                .split('\n')
                .map((s) => s.trim())
                .filter((s) => s && !BAD_TEXT.test(s));
              text = hLines[0] || '';
            }
          }
          if (!src) {
            const cardImg = card.querySelector('img[src*="scontent"], image');
            if (cardImg) src = cardImg.getAttribute('src') || cardImg.getAttribute('xlink:href') || null;
          }
        }
      }

      upsert(id, text, src, privacy, members);
    });

    // B. Data Relay/JSON yang tertanam di halaman
    try {
      const html = document.documentElement.innerHTML;
      const re = /"__typename":"Group","id":"(\d+)","name":"((?:[^"\\]|\\.)*)"/g;
      let mm;
      while ((mm = re.exec(html)) !== null) {
        let name = mm[2];
        try { name = JSON.parse('"' + name + '"'); } catch (e) {}
        upsert(mm[1], name, null, 'Public', null);
      }
    } catch (e) {}

    // Kembalikan semua grup unik berdasarkan ID grup Facebook asli.
    // JANGAN deduplikasi berdasarkan nama, karena pengguna sering kali bergabung ke beberapa
    // grup berbeda yang memiliki nama sama/serupa (misal grup jual beli/komunitas daerah).
    return Array.from(found.values()).filter((g) => g && g.id && g.name && !BAD_TEXT.test(g.name));
  };

  // Jumlah total dari judul / teks Facebook
  const readExpectedTotal = () => {
    try {
      const txt = document.body ? document.body.innerText : '';
      const patterns = [
        /(?:groups you've joined|grup yang (?:telah )?anda (?:ikuti|gabung)i?|semua grup|all groups|grup anda)[^\n(]*\((\d[\d.,]*)\)/i,
        /\((\d[\d.,]*)\)\s*(?:grup|groups)/i,
        /(\d[\d.,]*)\s*(?:grup yang anda ikuti|groups you've joined)/i,
        /all groups you've joined[^\d]*(\d[\d.,]*)/i,
      ];
      for (const p of patterns) {
        const m = txt.match(p);
        if (m && m[1]) {
          const val = parseInt(m[1].replace(/[.,]/g, ''), 10);
          if (val > 0) return val;
        }
      }
    } catch (e) {}
    return 0;
  };

  const scrollToEnd = () => {
    try {
      // 1. Gulir window
      const h = Math.max(
        document.documentElement ? document.documentElement.scrollHeight : 0,
        document.body ? document.body.scrollHeight : 0,
        999999
      );
      window.scrollTo(0, h);
      if (document.documentElement) document.documentElement.scrollTop = h;
      if (document.body) document.body.scrollTop = h;

      // 2. Gulir semua container scrollable (sidebar, rail, list) dan dispatch event langsung
      document.querySelectorAll('div, main, section, nav, [role="navigation"], [role="main"]').forEach((el) => {
        if (el.scrollHeight > el.clientHeight + 15) {
          el.scrollTop = el.scrollHeight;
          // Event scroll TIDAK bubble dalam spesifikasi DOM!
          // Wajib di-dispatch langsung pada elemen target agar React onScroll terpanggil:
          el.dispatchEvent(new Event('scroll', { bubbles: false }));
          el.dispatchEvent(new UIEvent('scroll'));
          el.dispatchEvent(new WheelEvent('wheel', { deltaY: 2500, bubbles: true, cancelable: true }));
        }
      });

      // 3. Scroll link grup terakhir langsung ke viewport bawah (memaksa sentinel Relay aktif)
      const allGroupLinks = document.querySelectorAll('a[href*="/groups/"]');
      if (allGroupLinks.length > 0) {
        const lastLink = allGroupLinks[allGroupLinks.length - 1];
        lastLink.scrollIntoView({ behavior: 'instant', block: 'end' });

        let curr = lastLink.parentElement;
        while (curr && curr !== document.body) {
          if (curr.scrollHeight > curr.clientHeight) {
            curr.scrollTop = curr.scrollHeight;
            curr.dispatchEvent(new Event('scroll', { bubbles: false }));
            curr.dispatchEvent(new WheelEvent('wheel', { deltaY: 2500, bubbles: true }));
          }
          curr = curr.parentElement;
        }
      }

      // 4. Klik tombol "Lihat selengkapnya" / "See more" jika ada
      document.querySelectorAll('div[role="button"], span, a').forEach((btn) => {
        const txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
        if (/^(lihat selengkapnya|lihat lainnya|see more|muat lainnya|load more)$/i.test(txt)) {
          try { btn.click(); } catch (e) {}
        }
      });
    } catch (e) {}
  };

  const report = (groupsList, expected) => {
    try {
      chrome.runtime.sendMessage({
        action: 'scan_progress',
        count: groupsList.length,
        expected,
        groups: groupsList,
      });
    } catch (e) {}
  };

  return new Promise((resolve) => {
    const start = Date.now();
    let lastCount = 0;
    let lastGrowthAt = Date.now();

    const tick = () => {
      if (/\/login|checkpoint/i.test(location.pathname)) {
        resolve({ loginRequired: true, groups: [] });
        return;
      }

      scrollToEnd();
      const groups = collect();
      const expected = readExpectedTotal();

      if (groups.length > lastCount) {
        lastCount = groups.length;
        lastGrowthAt = Date.now();
        report(groups, expected);
      }

      const reachedTotal = expected > 0 && groups.length >= expected;
      // Jika kita tahu totalnya (misal 169) dan saat ini belum tercapai:
      // Berikan toleransi hingga 30 detik per batch jaringan agar dapat memuat semua 169 grup sampai tuntas
      const currentIdleLimit = (expected > 0 && groups.length < expected) ? 30000 : 12000;
      const idle = groups.length > 0 && (Date.now() - lastGrowthAt > currentIdleLimit);
      const timedOut = Date.now() - start > maxWaitMs;

      if (reachedTotal || idle || timedOut) {
        try {
          chrome.runtime.sendMessage({ action: 'scan_complete', groups, expected });
        } catch (e) {}
        resolve({ loginRequired: false, groups, expected });
        return;
      }
      setTimeout(tick, 500);
    };

    tick();
  });
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve) => {
    let finished = false;
    const done = (ok) => {
      if (finished) return;
      finished = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve(ok);
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') done(true);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId, (t) => {
      if (!chrome.runtime.lastError && t && t.status === 'complete') done(true);
    });
  });
}

const SCAN_MAX_WAIT_MS = 150 * 1000; // batas aman total pemindaian (2.5 menit untuk 169 grup)
const SCAN_IDLE_STOP_MS = 30000;

let scanRequesterTabId = null;
let latestScannedGroups = [];

async function runCollectorInTab(tabId) {
  const results = await withTimeout(
    chrome.scripting
      .executeScript({ target: { tabId }, func: pageCollectGroups, args: [SCAN_MAX_WAIT_MS, SCAN_IDLE_STOP_MS] })
      .catch((e) => {
        console.warn('[ReachOwl] executeScript gagal:', e);
        return null;
      }),
    SCAN_MAX_WAIT_MS + 5000,
    null
  );
  return results && results[0] && results[0].result ? results[0].result : null;
}

async function scrapeFacebookGroups(requesterTabId) {
  console.log('[ReachOwl] Memulai pemindaian grup Facebook...');

  const uid = await getFacebookUserId();
  if (!uid) {
    return {
      success: false,
      groups: [],
      error: 'Sesi login Facebook tidak terdeteksi di Chrome. Silakan login ke Facebook terlebih dahulu.',
    };
  }

  latestScannedGroups = [];
  let collected = [];
  let tempTabId = null;
  try {
    // Buka tab Facebook /groups/joins/ di LATAR BELAKANG (active: false).
    // Layar pengguna tetap 100% di ReachOwl, tidak pernah berpindah tab.
    // fb-scan-main.js menjaga Relay infinite scroll tetap aktif di background.
    const tab = await chrome.tabs.create({
      url: 'https://www.facebook.com/groups/joins/?nav_source=tab',
      active: false,
    });
    tempTabId = tab.id;

    await waitForTabComplete(tempTabId, 25000);
    await sleep(1500);

    const result = await runCollectorInTab(tempTabId);
    if (result && result.loginRequired) {
      return {
        success: false,
        groups: [],
        error: 'Facebook meminta login ulang. Silakan login ke Facebook di Chrome lalu coba lagi.',
      };
    }
    if (result && Array.isArray(result.groups) && result.groups.length > 0) {
      collected = result.groups;
    }
  } catch (err) {
    console.warn('[ReachOwl] Gagal memindai grup via tab Facebook:', err);
  } finally {
    // Tutup tab pemindaian latar belakang setelah selesai
    if (tempTabId) {
      chrome.tabs.remove(tempTabId).catch(() => {});
    }
  }

  // Jaring pengaman: Jika executeScript IPC terputus di Chromium,
  // gunakan data streaming yang sudah terkirim via runtime.sendMessage
  if (collected.length === 0 && latestScannedGroups.length > 0) {
    console.log('[ReachOwl] Menggunakan data dari streaming progress (' + latestScannedGroups.length + ' grup)');
    collected = latestScannedGroups;
  }

  const groups = collected
    .filter((g) => g && g.id && g.name)
    .map((g) => ({
      id: g.id,
      name: g.name,
      url: 'https://www.facebook.com/groups/' + g.id,
      image: g.image || null,
      privacy: g.privacy || 'Public',
      members: g.members || null,
    }));

  console.log('[ReachOwl] Pemindaian selesai. Total grup:', groups.length);

  // Otomatis simpan ke database aplikasi
  if (groups.length > 0) {
    try {
      fetch('http://localhost:3000/api/facebook-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups }),
      }).catch(() => {});
    } catch (e) {}
  }

  if (groups.length === 0) {
    return {
      success: false,
      groups: [],
      error: 'Tidak ada grup yang ditemukan. Pastikan akun Facebook Anda sudah bergabung ke minimal satu grup.',
    };
  }

  return { success: true, groups, total: groups.length };
}

// ---------------------------------------------------------------------------
// Listener pesan dari content script
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'check_platform_session') {
    checkPlatformSession(message.platform)
      .then((result) => sendResponse({ success: true, result }))
      .catch(() => sendResponse({ success: false }));
    return true;
  }

  if (message.action === 'open_login_tab') {
    const targetUrl =
      message.platform === 'Facebook'
        ? 'https://www.facebook.com/login.php'
        : 'https://www.instagram.com/accounts/login/';
    chrome.tabs.create({ url: targetUrl, active: true }, (tab) => {
      sendResponse({ success: true, tabId: tab && tab.id });
    });
    return true;
  }

  // Progres streaming dari tab pemindaian -> simpan ke latestScannedGroups & teruskan ke aplikasi
  if (message.action === 'scan_progress') {
    if (Array.isArray(message.groups) && message.groups.length > latestScannedGroups.length) {
      latestScannedGroups = message.groups;
    }
    if (scanRequesterTabId) {
      chrome.tabs
        .sendMessage(scanRequesterTabId, {
          type: 'REACHOWL_SCAN_PROGRESS',
          count: message.count,
          expected: message.expected || 0,
        })
        .catch(() => {});
    }
    return false;
  }

  if (message.action === 'scan_complete') {
    if (Array.isArray(message.groups) && message.groups.length > 0) {
      latestScannedGroups = message.groups;
    }
    return false;
  }

  if (message.action === 'scrape_facebook_groups') {
    scanRequesterTabId = sender && sender.tab ? sender.tab.id : null;
    scrapeFacebookGroups(scanRequesterTabId)
      .then((result) => sendResponse(result))
      .catch((err) =>
        sendResponse({ success: false, groups: [], error: 'Gagal memindai grup: ' + (err && err.message ? err.message : String(err)) })
      )
      .finally(() => {
        scanRequesterTabId = null;
      });
    return true;
  }
});
