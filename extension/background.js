/**
 * ReachOwl Social Browser Bridge - Background Service Worker
 * Mendeteksi status login Facebook & Instagram melalui cookie dan mengirimkannya ke ReachOwl
 */

const REACHOWL_API = "http://localhost:3000/api/browser-accounts";

// Cek status login Facebook
async function checkFacebook() {
  try {
    const cUser = await chrome.cookies.get({
      url: "https://www.facebook.com",
      name: "c_user",
    });

    if (cUser && cUser.value) {
      // User aktif login di Facebook
      return {
        platform: "Facebook",
        isLoggedIn: true,
        accountId: cUser.value,
        name: `FB User (${cUser.value.slice(-5)})`,
        lastLoggedIn: new Date().toISOString(),
      };
    }
  } catch (err) {
    console.error("Gagal memeriksa cookie Facebook:", err);
  }

  return {
    platform: "Facebook",
    isLoggedIn: false,
    accountId: null,
    name: "Akun Facebook",
    lastLoggedIn: null,
  };
}

// Cek status login Instagram
async function checkInstagram() {
  try {
    const dsUserId = await chrome.cookies.get({
      url: "https://www.instagram.com",
      name: "ds_user_id",
    });
    const sessionId = await chrome.cookies.get({
      url: "https://www.instagram.com",
      name: "sessionid",
    });

    if (dsUserId && dsUserId.value && sessionId && sessionId.value) {
      // User aktif login di Instagram
      return {
        platform: "Instagram",
        isLoggedIn: true,
        accountId: dsUserId.value,
        name: `IG User (${dsUserId.value.slice(-5)})`,
        lastLoggedIn: new Date().toISOString(),
      };
    }
  } catch (err) {
    console.error("Gagal memeriksa cookie Instagram:", err);
  }

  return {
    platform: "Instagram",
    isLoggedIn: false,
    accountId: null,
    name: "Akun Instagram",
    lastLoggedIn: null,
  };
}

// Lakukan sinkronisasi ke aplikasi ReachOwl
async function syncToReachOwl(accounts) {
  try {
    await fetch(REACHOWL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accounts }),
    });
  } catch (err) {
    // Aplikasi mungkin belum terbuka atau URL berbeda, tidak masalah
  }
}

// Fungsi utama pengecekan
async function performScan() {
  const [fb, ig] = await Promise.all([checkFacebook(), checkInstagram()]);
  const accounts = [fb, ig];

  // Simpan di local storage ekstensi
  await chrome.storage.local.set({
    reachowl_accounts: accounts,
    last_scanned: new Date().toISOString(),
  });

  // Kirim data ke API ReachOwl
  await syncToReachOwl(accounts);

  // Broadcast ke tab ReachOwl yang sedang terbuka
  const tabs = await chrome.tabs.query({
    url: ["http://localhost:3000/*", "http://127.0.0.1:3000/*"],
  });

  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: "REACHOWL_ACCOUNTS_UPDATE",
        accounts,
      }).catch(() => {});
    }
  }

  return accounts;
}

// Jalankan saat ekstensi dipasang
chrome.runtime.onInstalled.addListener(() => {
  performScan();
  chrome.alarms.create("check_social_interval", { periodInMinutes: 1 });
});

// Periodic alarm check
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "check_social_interval") {
    performScan();
  }
});

// Listener saat cookie Facebook / Instagram berubah (login/logout realtime)
chrome.cookies.onChanged.addListener((changeInfo) => {
  const domain = changeInfo.cookie.domain;
  if (domain.includes("facebook.com") || domain.includes("instagram.com")) {
    performScan();
  }
});

// Komunikasi dengan content script atau popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "REACHOWL_TRIGGER_SCAN") {
    performScan().then((accounts) => {
      sendResponse({ success: true, accounts });
    });
    return true; // async sendResponse
  }

  if (message.type === "REACHOWL_GET_STATUS") {
    chrome.storage.local.get(["reachowl_accounts", "last_scanned"], (data) => {
      sendResponse({
        accounts: data.reachowl_accounts || [],
        lastScanned: data.last_scanned,
      });
    });
    return true;
  }
});
