const fs = require('fs');

const contentJs = `/**
 * ReachOwl Content Script (Bridge)
 * Menjembatani aplikasi web ReachOwl dengan background extension secara on-demand.
 */

function announceReady() {
  window.postMessage(
    {
      type: 'REACHOWL_BRIDGE_READY',
      version: '2.1.0',
      isInstalled: true,
      timestamp: new Date().toISOString(),
    },
    '*'
  );
}

announceReady();
window.addEventListener('load', announceReady);

// Meneruskan sinyal logout dari background ke halaman web
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'REACHOWL_ACCOUNT_LOGGED_OUT') {
    window.postMessage(
      {
        type: 'REACHOWL_ACCOUNT_LOGGED_OUT_EVENT',
        platform: message.platform,
      },
      '*'
    );
  }
});

// Mendengarkan permintaan on-demand dari aplikasi web
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data) return;

  // 1. Handshake Ping-Pong deteksi status aktif ekstensi
  if (event.data.type === 'REACHOWL_PING') {
    window.postMessage(
      {
        type: 'REACHOWL_PONG',
        version: '2.1.0',
        isInstalled: true,
        timestamp: new Date().toISOString(),
      },
      '*'
    );
  }

  // 2. On-demand session check saat user klik Connect
  if (event.data.type === 'REACHOWL_ON_DEMAND_CHECK_PLATFORM') {
    chrome.runtime.sendMessage(
      { action: 'check_platform_session', platform: event.data.platform },
      (res) => {
        if (res && res.result) {
          window.postMessage(
            {
              type: 'REACHOWL_ON_DEMAND_CHECK_RESULT',
              result: res.result,
            },
            '*'
          );
        }
      }
    );
  }

  // 3. Permintaan membuka tab login
  if (event.data.type === 'REACHOWL_REQUEST_CONNECT_TAB') {
    chrome.runtime.sendMessage(
      { action: 'open_login_tab', platform: event.data.platform },
      (res) => {
        window.postMessage(
          {
            type: 'REACHOWL_CONNECT_TAB_OPENED',
            platform: event.data.platform,
          },
          '*'
        );
      }
    );
  }
});
`;

fs.writeFileSync('D:/reachowlextension/content.js', contentJs, 'utf8');
console.log('Successfully updated D:/reachowlextension/content.js with REACHOWL_PING/PONG handlers');
