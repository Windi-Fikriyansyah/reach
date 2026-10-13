function updateUI(accounts) {
  const fb = accounts.find((a) => a.platform === "Facebook") || { isLoggedIn: false };
  const ig = accounts.find((a) => a.platform === "Instagram") || { isLoggedIn: false };

  // Update Facebook UI
  const fbState = document.getElementById("fb-state");
  const fbStatusText = document.getElementById("fb-status-text");
  const fbStateLabel = document.getElementById("fb-state-label");

  if (fb.isLoggedIn) {
    fbState.className = "state-indicator online";
    fbStateLabel.textContent = "Login";
    fbStatusText.textContent = fb.name || "Akun Terdeteksi";
  } else {
    fbState.className = "state-indicator offline";
    fbStateLabel.textContent = "Belum Login";
    fbStatusText.textContent = "Tidak ada sesi aktif";
  }

  // Update Instagram UI
  const igState = document.getElementById("ig-state");
  const igStatusText = document.getElementById("ig-status-text");
  const igStateLabel = document.getElementById("ig-state-label");

  if (ig.isLoggedIn) {
    igState.className = "state-indicator online";
    igStateLabel.textContent = "Login";
    igStatusText.textContent = ig.name || "Akun Terdeteksi";
  } else {
    igState.className = "state-indicator offline";
    igStateLabel.textContent = "Belum Login";
    igStatusText.textContent = "Tidak ada sesi aktif";
  }
}

// Request current status
chrome.runtime.sendMessage({ type: "REACHOWL_GET_STATUS" }, (response) => {
  if (response && response.accounts && response.accounts.length) {
    updateUI(response.accounts);
  } else {
    triggerScan();
  }
});

function triggerScan() {
  const btn = document.getElementById("btn-sync");
  btn.textContent = "Memindai...";
  btn.disabled = true;

  chrome.runtime.sendMessage({ type: "REACHOWL_TRIGGER_SCAN" }, (response) => {
    btn.textContent = "Periksa & Sinkronkan ke ReachOwl";
    btn.disabled = false;
    if (response && response.accounts) {
      updateUI(response.accounts);
    }
  });
}

document.getElementById("btn-sync").addEventListener("click", triggerScan);
