# ReachOwl Social Browser Bridge (Chrome Extension)

Ekstensi Chrome resmi ReachOwl untuk mendeteksi status login akun **Facebook** dan **Instagram** secara otomatis di browser Anda, kemudian menyinkronkannya secara realtime ke dalam tabel aplikasi ReachOwl.

---

## 🛠️ Cara Memasang Ekstensi (Load Unpacked)

1. Buka browser berbasis Chromium (**Google Chrome**, **Microsoft Edge**, atau **Brave**).
2. Buka halaman ekstensi browser:
   - **Chrome**: Kunjungi `chrome://extensions/`
   - **Edge**: Kunjungi `edge://extensions/`
   - **Brave**: Kunjungi `brave://extensions/`
3. Aktifkan sakelar **"Developer mode"** (Mode Pengembang) di pojok kanan atas.
4. Klik tombol **"Load unpacked"** (Muat ekstensi belum dibongkar).
5. Pilih folder ekstensi ini:
   ```
   D:\reachowl\extension
   ```
6. Ekstensi **"ReachOwl Social Browser Bridge"** sekarang sudah aktif!

---

## ⚡ Cara Kerja
1. Ekstensi secara berkala memeriksa cookie sesi:
   - **Facebook**: Cookie `c_user`
   - **Instagram**: Cookie `ds_user_id` & `sessionid`
2. Ketika Anda login ke Facebook atau Instagram di browser tersebut, ekstensi langsung mendeteksi status aktif.
3. Ekstensi otomatis mengirimkan data akun ke tab ReachOwl (`http://localhost:3000/browsers`) melalui pesan realtime dan API internal.
4. Tabel di halaman **Browsers** akan langsung menampilkan akun tersebut sebagai **Connected** beserta avatar, ID, platform, dan status Primary.
