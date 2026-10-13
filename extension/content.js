/**
 * ReachOwl Social Browser Bridge - Content Script
 * Menghubungkan halaman web ReachOwl dengan background script ekstensi
 */

// Tandai bahwa ekstensi terpasang di window
function notifyExtensionReady() {
  window.postMessage(
    {
      type: "REACHOWL_EXTENSION_READY",
      version: "1.0.0",
    },
    "*"
  );
}

// Beri tahu halaman setiap kali halaman selesai load
notifyExtensionReady();
window.addEventListener("load", notifyExtensionReady);

// Menerima pesan dari background script dan meneruskannya ke halaman
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "REACHOWL_ACCOUNTS_UPDATE") {
    window.postMessage(
      {
        type: "REACHOWL_EXTENSION_ACCOUNTS_SYNC",
        accounts: message.accounts,
      },
      "*"
    );
  }
});

// Mendengarkan permintaan dari halaman web (misal tombol 'Refresh' atau 'Sinkronkan')
window.addEventListener("message", (event) => {
  // Hanya proses pesan dari origin yang sama
  if (event.source !== window) return;

  if (event.data && event.data.type === "REACHOWL_TRIGGER_SCAN_FROM_PAGE") {
    chrome.runtime.sendMessage({ type: "REACHOWL_TRIGGER_SCAN" }, (response) => {
      if (response && response.accounts) {
        window.postMessage(
          {
            type: "REACHOWL_EXTENSION_ACCOUNTS_SYNC",
            accounts: response.accounts,
          },
          "*"
        );
      }
    });
  }

  if (event.data && event.data.type === "REACHOWL_CHECK_EXTENSION_STATUS") {
    notifyExtensionReady();
    chrome.runtime.sendMessage({ type: "REACHOWL_GET_STATUS" }, (response) => {
      if (response && response.accounts) {
        window.postMessage(
          {
            type: "REACHOWL_EXTENSION_ACCOUNTS_SYNC",
            accounts: response.accounts,
          },
          "*"
        );
      }
    });
  }
});
