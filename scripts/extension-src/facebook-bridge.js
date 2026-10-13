/**
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
    ];

    for (const el of candidates) {
      const src = el.src || el.getAttribute('xlink:href') || el.getAttribute('href');
      if (src && src.includes('scontent') && !src.includes('84628273_176159830277856') && !src.includes('rsrc.php') && !src.includes('static.xx')) {
        chrome.storage.local.set({ reachowl_fb_avatar: src });
        break;
      }
    }
  } catch (e) {}
}

extractAndSaveFacebookAvatar();
setTimeout(extractAndSaveFacebookAvatar, 1500);
setTimeout(extractAndSaveFacebookAvatar, 3500);
