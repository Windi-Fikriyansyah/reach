/**
 * ReachOwl Content Script (Bridge)
 * Menjembatani aplikasi web ReachOwl dengan background extension secara on-demand.
 */

const BRIDGE_VERSION = '2.3.0';

function announceReady() {
  window.postMessage(
    { type: 'REACHOWL_BRIDGE_READY', version: BRIDGE_VERSION, isInstalled: true, timestamp: new Date().toISOString() },
    '*'
  );
}

announceReady();
window.addEventListener('load', announceReady);

// Meneruskan sinyal logout dan progres pemindaian dari background ke halaman web
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'REACHOWL_ACCOUNT_LOGGED_OUT') {
    window.postMessage({ type: 'REACHOWL_ACCOUNT_LOGGED_OUT_EVENT', platform: message.platform }, '*');
  }
  if (message.type === 'REACHOWL_SCAN_PROGRESS') {
    window.postMessage(
      {
        type: 'REACHOWL_SCAN_PROGRESS_EVENT',
        count: message.count,
        expected: message.expected || 0,
      },
      '*'
    );
  }
});

function sendToBackground(payload, onResult) {
  try {
    chrome.runtime.sendMessage(payload, (res) => {
      if (chrome.runtime.lastError) {
        onResult(null, chrome.runtime.lastError.message || 'Ekstensi tidak merespons');
        return;
      }
      onResult(res, null);
    });
  } catch (e) {
    onResult(null, (e && e.message) || 'Ekstensi perlu dimuat ulang');
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data) return;
  const type = event.data.type;

  // 1. Handshake Ping-Pong
  if (type === 'REACHOWL_PING') {
    window.postMessage(
      { type: 'REACHOWL_PONG', version: BRIDGE_VERSION, isInstalled: true, timestamp: new Date().toISOString() },
      '*'
    );
  }

  // 2. Cek sesi on-demand saat klik Connect
  if (type === 'REACHOWL_ON_DEMAND_CHECK_PLATFORM') {
    sendToBackground({ action: 'check_platform_session', platform: event.data.platform }, (res) => {
      if (res && res.result) {
        window.postMessage({ type: 'REACHOWL_ON_DEMAND_CHECK_RESULT', result: res.result }, '*');
      }
    });
  }

  // 3. Buka tab login
  if (type === 'REACHOWL_REQUEST_CONNECT_TAB') {
    sendToBackground({ action: 'open_login_tab', platform: event.data.platform }, () => {
      window.postMessage({ type: 'REACHOWL_CONNECT_TAB_OPENED', platform: event.data.platform }, '*');
    });
  }

  // 4. Scrape grup Facebook
  if (type === 'REACHOWL_SCRAPE_FB_GROUPS') {
    sendToBackground({ action: 'scrape_facebook_groups' }, (res, err) => {
      if (err) {
        window.postMessage(
          {
            type: 'REACHOWL_SCRAPE_FB_GROUPS_RESULT',
            success: false,
            groups: [],
            error: 'Koneksi ke ekstensi terputus (' + err + '). Reload ekstensi di chrome://extensions lalu refresh halaman ini.',
          },
          '*'
        );
        return;
      }
      window.postMessage(
        {
          type: 'REACHOWL_SCRAPE_FB_GROUPS_RESULT',
          success: !!(res && res.success),
          groups: (res && res.groups) || [],
          error: (res && res.error) || null,
        },
        '*'
      );
    });
  }
});
