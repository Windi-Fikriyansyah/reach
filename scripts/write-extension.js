const fs = require('fs');

const backgroundJs = `/**
 * ReachOwl Background Bridge (Event-Driven Headless Worker)
 * - Pengecekan sesi & pengambilan data profil riil (nama + avatar) on-demand saat tombol Connect diklik.
 * - Saat pengguna BENAR-BENAR LOGOUT dari Facebook atau Instagram, otomatis mengirim WEBHOOK ke aplikasi.
 */

const WEBHOOK_URL = 'http://localhost:3000/api/browser-accounts/webhook';

// Mengambil profil riil Facebook (Nama & Foto Asli)
async function getFacebookProfile(accountId) {
  let name = 'FB User (' + accountId.slice(-5) + ')';
  const avatarUrl = 'https://graph.facebook.com/' + accountId + '/picture?type=large';

  // 1. Cek judul tab Facebook yang sedang terbuka
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
    for (const t of tabs) {
      if (t.title) {
        let clean = t.title.replace(/\\s*\\|\\s*Facebook.*$/i, '').replace(/^\\(\\d+\\)\\s*/, '').trim();
        if (clean && !clean.toLowerCase().includes('facebook') && !clean.toLowerCase().includes('log in') && !clean.toLowerCase().includes('masuk')) {
          name = clean;
          break;
        }
      }
    }
  } catch {}

  // 2. Coba fetch mbasic Facebook untuk ambil nama dari <title>
  if (name.startsWith('FB User')) {
    try {
      const res = await fetch('https://mbasic.facebook.com/me', {
        headers: { 'Accept': 'text/html' },
        credentials: 'include',
      });
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\\/title>/i);
      if (titleMatch && titleMatch[1]) {
        let t = titleMatch[1].replace(/\\s*\\|\\s*Facebook/i, '').trim();
        if (t && !t.toLowerCase().includes('facebook') && !t.toLowerCase().includes('log in') && !t.toLowerCase().includes('masuk')) {
          name = t;
        }
      }
    } catch {}
  }

  // 3. Fallback fetch www.facebook.com/me
  if (name.startsWith('FB User')) {
    try {
      const res = await fetch('https://www.facebook.com/me', { credentials: 'include' });
      const html = await res.text();
      const nameMatch = html.match(/"NAME":\\s*"([^"]+)"/) || html.match(/"user_name":\\s*"([^"]+)"/);
      if (nameMatch && nameMatch[1]) {
        name = nameMatch[1];
      }
    } catch {}
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

fs.writeFileSync('D:/reachowlextension/background.js', backgroundJs, 'utf8');
console.log('Successfully written real-profile background.js to D:/reachowlextension/background.js');
