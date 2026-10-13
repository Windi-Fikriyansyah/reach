const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SRC_DIR = path.join(__dirname, 'extension-src');
const OUT_DIR = 'D:/reachowlextension';

const manifestJson = {
  manifest_version: 3,
  name: 'ReachOwl Background Bridge',
  version: '2.3.0',
  description: 'Silent background bridge for ReachOwl. Automates social account detection with real profile extraction.',
  permissions: ['cookies', 'tabs', 'alarms', 'scripting', 'storage'],
  host_permissions: [
    'https://*.facebook.com/*',
    'https://*.instagram.com/*',
    'http://localhost:3000/*',
    'http://127.0.0.1:3000/*',
  ],
  background: { service_worker: 'background.js' },
  content_scripts: [
    {
      matches: ['http://localhost:3000/*', 'http://127.0.0.1:3000/*'],
      js: ['content.js'],
      run_at: 'document_start',
    },
    {
      matches: ['https://*.facebook.com/*'],
      js: ['facebook-bridge.js'],
      run_at: 'document_idle',
    },
    {
      // Hanya aktif di tab pemindaian (URL berisi reachowl_scan=1)
      matches: ['https://*.facebook.com/groups/joins*'],
      js: ['fb-scan-main.js'],
      run_at: 'document_start',
      world: 'MAIN',
    },
  ],
  action: { default_popup: 'popup.html', default_title: 'ReachOwl Silent Bridge' },
};

const files = ['background.js', 'content.js', 'facebook-bridge.js', 'fb-scan-main.js'];

// Validasi sintaks sebelum menulis agar service worker tidak pernah rusak
for (const f of files) {
  execFileSync(process.execPath, ['--check', path.join(SRC_DIR, f)], { stdio: 'inherit' });
}

fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifestJson, null, 2), 'utf8');
console.log('Written manifest.json');

for (const f of files) {
  fs.copyFileSync(path.join(SRC_DIR, f), path.join(OUT_DIR, f));
  console.log('Written ' + f);
}
