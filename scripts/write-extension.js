const fs = require('fs');

const manifestJson = {
  manifest_version: 3,
  name: "ReachOwl Background Bridge",
  version: "2.1.0",
  description: "Silent background bridge for ReachOwl. Automates social account detection with real profile extraction.",
  permissions: [
    "cookies",
    "tabs",
    "alarms",
    "scripting",
    "storage"
  ],
  host_permissions: [
    "https://*.facebook.com/*",
    "https://*.instagram.com/*",
    "http://localhost:3000/*",
    "http://127.0.0.1:3000/*"
  ],
  background: {
    service_worker: "background.js"
  },
  content_scripts: [
    {
      matches: [
        "http://localhost:3000/*",
        "http://127.0.0.1:3000/*"
      ],
      js: [
        "content.js"
      ],
      run_at: "document_start"
    },
    {
      matches: [
        "https://*.facebook.com/*"
      ],
      js: [
        "facebook-bridge.js"
      ],
      run_at: "document_idle"
    }
  ],
  action: {
    default_popup: "popup.html",
    default_title: "ReachOwl Silent Bridge"
  }
};

const facebookBridgeJs = `/**
 * ReachOwl Facebook Bridge Content Script
 * Berjalan di tab Facebook untuk mendeteksi avatar profil riil dari DOM Facebook secara live.
 */
function extractAndSaveFacebookAvatar() {
  try {
    const candidates = [
      ...document.querySelectorAll('div[role="navigation"] img[src*="scontent"]'),
      ...document.querySelectorAll('div[role="navigation"] svg image'),
      ...document.querySelectorAll('a[href*="/me/"] img[src*="scontent"]'),
      ...document.querySelectorAll('a[aria-label*="Profil"] img, a[aria-label*="Profile"] img'),
      ...document.querySelectorAll('img[src*="scontent"]'),
      ...document.querySelectorAll('svg image[*|href*="scontent"]')
    ];

    for (const el of candidates) {
      const src = el.src || el.getAttribute('xlink:href') || el.getAttribute('href');
      if (src && src.includes('scontent') && !src.includes('84628273_176159830277856') && !src.includes('rsrc.php') && !src.includes('static.xx')) {
        chrome.storage.local.set({ reachowl_fb_avatar: src });
        break;
      }
    }
  } catch {}
}

extractAndSaveFacebookAvatar();
setTimeout(extractAndSaveFacebookAvatar, 1500);
setTimeout(extractAndSaveFacebookAvatar, 3500);
`;

const backgroundJs = `/**
 * ReachOwl Background Bridge (Event-Driven Headless Worker)
 * - Pengecekan sesi & pengambilan data profil riil (nama + avatar) on-demand saat tombol Connect diklik.
 * - Saat pengguna BENAR-BENAR LOGOUT dari Facebook atau Instagram, otomatis mengirim WEBHOOK ke aplikasi.
 */

const WEBHOOK_URL = 'http://localhost:3000/api/browser-accounts/webhook';

// Mengambil profil riil Facebook (Nama & Foto Asli)
async function getFacebookProfile(accountId) {
  let name = 'FB User (' + accountId.slice(-5) + ')';
  let avatarUrl = null;

  // 1. Cek storage lokal ekstensi (jika pernah diekstrak oleh facebook-bridge)
  try {
    const stored = await chrome.storage.local.get(['reachowl_fb_avatar']);
    if (stored && stored.reachowl_fb_avatar && !stored.reachowl_fb_avatar.includes('84628273_176159830277856')) {
      avatarUrl = stored.reachowl_fb_avatar;
    }
  } catch {}

  // 2. Cek tab Facebook yang sedang terbuka di Chrome (ambil avatar & nama live dari DOM)
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
    for (const t of tabs) {
      if (t.id && chrome.scripting && !avatarUrl) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: t.id },
            func: () => {
              const imgs = Array.from(document.querySelectorAll('img[src*="scontent"], svg image[*|href*="scontent"], svg image'));
              for (const img of imgs) {
                const src = img.src || img.getAttribute('xlink:href') || img.getAttribute('href');
                if (src && src.includes('scontent') && !src.includes('84628273_176159830277856') && !src.includes('rsrc.php')) {
                  if (src.includes('stp=c') || src.includes('t39.30808-1') || src.includes('dst-jpg') || src.includes('t1.30497-1')) {
                    return src;
                  }
                }
              }
              const first = imgs.find(img => {
                const s = img.src || img.getAttribute('xlink:href') || img.getAttribute('href');
                return s && s.includes('scontent') && !s.includes('84628273_176159830277856') && !s.includes('rsrc.php');
              });
              return first ? (first.src || first.getAttribute('xlink:href') || first.getAttribute('href')) : null;
            }
          });
          if (results && results[0] && results[0].result) {
            avatarUrl = results[0].result;
            chrome.storage.local.set({ reachowl_fb_avatar: avatarUrl }).catch(() => {});
          }
        } catch {}
      }

      if (t.title) {
        let clean = t.title.replace(/\\s*\\|\\s*Facebook.*$/i, '').replace(/^\\(\\d+\\)\\s*/, '').trim();
        if (clean && !clean.toLowerCase().includes('facebook') && !clean.toLowerCase().includes('log in') && !clean.toLowerCase().includes('masuk')) {
          name = clean;
        }
      }
      if (avatarUrl && !name.startsWith('FB User')) break;
    }
  } catch {}

  // 3. Fetch mbasic Facebook (berjalan headless dengan cookie FB yang tersimpan di Chrome)
  try {
    const res = await fetch('https://mbasic.facebook.com/me', {
      headers: { 'Accept': 'text/html' },
      credentials: 'include',
    });
    const html = await res.text();

    if (name.startsWith('FB User')) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\\/title>/i);
      if (titleMatch && titleMatch[1]) {
        let t = titleMatch[1].replace(/\\s*\\|\\s*Facebook/i, '').trim();
        if (t && !t.toLowerCase().includes('facebook') && !t.toLowerCase().includes('log in') && !t.toLowerCase().includes('masuk')) {
          name = t;
        }
      }
    }

    if (!avatarUrl) {
      // Ekstrak tag <img> dengan src scontent dari mbasic
      const imgRegex = /<img[^>]+src=["'](https:\\/\\/[^"'>]*scontent[^"'>]*)["'][^>]*>/gi;
      let match;
      while ((match = imgRegex.exec(html)) !== null) {
        let src = match[1].replace(/&amp;/g, '&');
        if (!src.includes('84628273_176159830277856') && !src.includes('rsrc.php') && !src.includes('static.xx')) {
          avatarUrl = src;
          break;
        }
      }

      if (!avatarUrl) {
        const matches = html.match(/https:\\/\\/[^"'\\s\\<>]*scontent[^"'\\s\\<>]*/g);
        if (matches) {
          for (let u of matches) {
            u = u.replace(/&amp;/g, '&').replace(/\\\\\\//g, '/');
            if (!u.includes('84628273_176159830277856') && !u.includes('rsrc.php') && !u.includes('static.xx')) {
              avatarUrl = u;
              break;
            }
          }
        }
      }
    }
  } catch {}

  // 4. Fetch www.facebook.com/me (ambil avatar dari JSON Relay / Comet)
  if (!avatarUrl || name.startsWith('FB User')) {
    try {
      const res = await fetch('https://www.facebook.com/me', { credentials: 'include' });
      const html = await res.text();

      if (name.startsWith('FB User')) {
        const nameMatch = html.match(/"NAME":\\s*"([^"]+)"/) || html.match(/"user_name":\\s*"([^"]+)"/);
        if (nameMatch && nameMatch[1]) {
          name = nameMatch[1];
        }
      }

      if (!avatarUrl) {
        const picPatterns = [
          /"profilePicLarge":\\s*\\{\\s*"uri":\\s*"([^"]+)"/,
          /"profile_picture":\\s*\\{\\s*"uri":\\s*"([^"]+)"/,
          /"profile_pic_uri":\\s*"([^"]+)"/,
          /"profilePhoto":\\s*\\{\\s*"uri":\\s*"([^"]+)"/,
          /"profile_photo":\\s*\\{\\s*"url":\\s*"([^"]+)"/,
          /"profile_photo_url":\\s*"([^"]+)"/,
          /"profile_pic_large":\\s*"([^"]+)"/,
          /"uri":\\s*"(https:\\\\\\/\\\\\\/[^"]*scontent[^"]*(?:stp=c|dst-jpg|t39\\.30808-1|t1\\.[0-9]+-1)[^"]*)"/i,
          /"(https:\\\\\\/\\\\\\/[^"]*scontent[^"]*(?:stp=c|dst-jpg|t39\\.30808-1)[^"]*)"/i
        ];

        for (const pattern of picPatterns) {
          const m = html.match(pattern);
          if (m && m[1]) {
            const raw = m[1].replace(/\\\\u0026/g, '&').replace(/\\\\\\//g, '/');
            if (!raw.includes('84628273_176159830277856') && !raw.includes('rsrc.php')) {
              avatarUrl = raw;
              break;
            }
          }
        }
      }
    } catch {}
  }

  // 5. Fetch m.facebook.com/me
  if (!avatarUrl) {
    try {
      const res = await fetch('https://m.facebook.com/me', { credentials: 'include' });
      const html = await res.text();
      const matches = html.match(/https:\\/\\/[^"'\\s\\<>]*scontent[^"'\\s\\<>]*/g);
      if (matches) {
        for (let u of matches) {
          u = u.replace(/&amp;/g, '&').replace(/\\\\\\//g, '/').replace(/\\\\u0026/g, '&');
          if (!u.includes('84628273_176159830277856') && !u.includes('rsrc.php') && !u.includes('static.xx')) {
            avatarUrl = u;
            break;
          }
        }
      }
    } catch {}
  }

  if (avatarUrl) {
    chrome.storage.local.set({ reachowl_fb_avatar: avatarUrl }).catch(() => {});
  }

  return { name, avatarUrl };
}

// Mengambil profil riil Instagram (Nama & Foto Asli)
async function getInstagramProfile(accountId) {
  let name = 'IG User (' + accountId.slice(-5) + ')';
  let avatarUrl = null;

  // 1. Cek judul tab Instagram yang sedang terbuka
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.instagram.com/*' });
    for (const t of tabs) {
      if (t.title) {
        let clean = t.title.replace(/\\s*•\\s*Instagram.*$/i, '').replace(/\\s*\\|\\s*Instagram/i, '').trim();
        if (clean && !clean.toLowerCase().includes('instagram') && !clean.toLowerCase().includes('login') && !clean.toLowerCase().includes('masuk')) {
          name = clean;
          break;
        }
      }
    }
  } catch {}

  // 2. Fetch API info Instagram dengan header X-IG-App-ID
  try {
    const res = await fetch('https://i.instagram.com/api/v1/users/' + accountId + '/info/', {
      headers: {
        'X-IG-App-ID': '936619743392459',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      },
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.user) {
        if (data.user.full_name || data.user.username) {
          name = data.user.full_name ? data.user.full_name + ' (@' + data.user.username + ')' : '@' + data.user.username;
        }
        if (data.user.profile_pic_url) {
          avatarUrl = data.user.profile_pic_url;
        }
        return { name, avatarUrl };
      }
    }
  } catch {}

  // 3. Fallback parse HTML Instagram
  try {
    const res = await fetch('https://www.instagram.com/', { credentials: 'include' });
    const html = await res.text();
    const picMatch = html.match(/"profile_pic_url":\\s*"([^"]+)"/);
    if (picMatch && picMatch[1]) {
      avatarUrl = picMatch[1].replace(/\\\\u0026/g, '&').replace(/\\\\\\//g, '/');
    }
    const userMatch = html.match(/"username":\\s*"([^"]+)"/);
    const fullMatch = html.match(/"full_name":\\s*"([^"]+)"/);
    if (fullMatch && fullMatch[1]) {
      name = userMatch && userMatch[1] ? fullMatch[1] + ' (@' + userMatch[1] + ')' : fullMatch[1];
    } else if (userMatch && userMatch[1]) {
      name = '@' + userMatch[1];
    }
  } catch {}

  return { name, avatarUrl };
}

// Fungsi untuk memeriksa satu platform secara on-demand
async function checkPlatformSession(platform) {
  if (platform === 'Facebook') {
    try {
      const cUser = await chrome.cookies.get({
        url: 'https://www.facebook.com',
        name: 'c_user',
      });

      if (cUser && cUser.value) {
        const profile = await getFacebookProfile(cUser.value);
        return {
          platform: 'Facebook',
          isLoggedIn: true,
          accountId: cUser.value,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          lastLoggedIn: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.error('Gagal membaca sesi Facebook:', err);
    }

    return {
      platform: 'Facebook',
      isLoggedIn: false,
      accountId: null,
      name: 'Akun Facebook',
      avatarUrl: null,
      lastLoggedIn: null,
    };
  }

  if (platform === 'Instagram') {
    try {
      const dsUserId = await chrome.cookies.get({
        url: 'https://www.instagram.com',
        name: 'ds_user_id',
      });
      const sessionId = await chrome.cookies.get({
        url: 'https://www.instagram.com',
        name: 'sessionid',
      });

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

    return {
      platform: 'Instagram',
      isLoggedIn: false,
      accountId: null,
      name: 'Akun Instagram',
      avatarUrl: null,
      lastLoggedIn: null,
    };
  }

  return { isLoggedIn: false };
}

// Kirim Webhook ke aplikasi ketika pengguna Logout
async function triggerLogoutWebhook(platform) {
  console.log('[ReachOwl] Logout terverifikasi pada ' + platform + ', mengirim webhook ke aplikasi...');

  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'logout',
        platform: platform,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.warn('[ReachOwl] Gagal menghubungi endpoint webhook:', err);
  }

  try {
    const tabs = await chrome.tabs.query({
      url: ['http://localhost:3000/*', 'http://127.0.0.1:3000/*'],
    });

    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'REACHOWL_ACCOUNT_LOGGED_OUT',
          platform: platform,
        }).catch(() => {});
      }
    }
  } catch {}
}

const logoutDebounceTimers = {};

// Pantau HANYA peristiwa REMOVAL cookie (saat user logout)
chrome.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.cause === 'overwrite') {
    return;
  }

  if (changeInfo.removed) {
    const cookieName = changeInfo.cookie.name;
    const domain = (changeInfo.cookie.domain || '').toLowerCase();

    // Facebook: cookie c_user
    if (cookieName === 'c_user' && domain.includes('facebook.com')) {
      clearTimeout(logoutDebounceTimers['Facebook']);
      logoutDebounceTimers['Facebook'] = setTimeout(async () => {
        try {
          const cUser = await chrome.cookies.get({
            url: 'https://www.facebook.com',
            name: 'c_user',
          });
          if (!cUser || !cUser.value) {
            triggerLogoutWebhook('Facebook');
          }
        } catch (e) {
          console.error('[ReachOwl] Gagal verifikasi status cookie FB:', e);
        }
      }, 2500);
    }

    // Instagram: cookie ds_user_id atau sessionid
    if ((cookieName === 'ds_user_id' || cookieName === 'sessionid') && domain.includes('instagram.com')) {
      clearTimeout(logoutDebounceTimers['Instagram']);
      logoutDebounceTimers['Instagram'] = setTimeout(async () => {
        try {
          const dsUserId = await chrome.cookies.get({
            url: 'https://www.instagram.com',
            name: 'ds_user_id',
          });
          const sessionId = await chrome.cookies.get({
            url: 'https://www.instagram.com',
            name: 'sessionid',
          });
          if (!dsUserId || !dsUserId.value || !sessionId || !sessionId.value) {
            triggerLogoutWebhook('Instagram');
          }
        } catch (e) {
          console.error('[ReachOwl] Gagal verifikasi status cookie IG:', e);
        }
      }, 2500);
    }
  }
});

// Listener pesan dari Content Script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'check_platform_session') {
    checkPlatformSession(message.platform).then((result) => {
      sendResponse({ success: true, result: result });
    });
    return true;
  }

  if (message.action === 'open_login_tab') {
    const targetUrl =
      message.platform === 'Facebook'
        ? 'https://www.facebook.com/login.php'
        : 'https://www.instagram.com/accounts/login/';

    chrome.tabs.create({ url: targetUrl, active: true }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true;
  }
});
`;

fs.writeFileSync('D:/reachowlextension/manifest.json', JSON.stringify(manifestJson, null, 2), 'utf8');
console.log('Successfully written D:/reachowlextension/manifest.json');

fs.writeFileSync('D:/reachowlextension/facebook-bridge.js', facebookBridgeJs, 'utf8');
console.log('Successfully written D:/reachowlextension/facebook-bridge.js');

fs.writeFileSync('D:/reachowlextension/background.js', backgroundJs, 'utf8');
console.log('Successfully written real-profile background.js to D:/reachowlextension/background.js');
