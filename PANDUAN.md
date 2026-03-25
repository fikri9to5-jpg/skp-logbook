# Panduan Deploy — Sistem Laporan Bulanan

## Isi Folder Ini
```
laporan-bulanan/
├── index.html   ← Aplikasi utama (ini yang dibuka di HP/browser)
├── gas.js       ← Script untuk Google Sheets & Drive
└── PANDUAN.md   ← File ini
```

---

## BAGIAN 1 — Deploy Aplikasi ke Vercel (5 menit)

Vercel gratis, tidak perlu kartu kredit.

### Langkah-langkah:

1. **Buka** https://vercel.com dan klik **Sign Up**
   - Pilih **Continue with Google** (lebih mudah)

2. **Setelah login**, klik tombol **+ Add New → Project**

3. Pilih **"Upload"** (bukan import dari GitHub)
   - Seret folder `laporan-bulanan` ke area upload
   - Atau klik dan pilih folder tersebut

4. Klik **Deploy** — tunggu 1-2 menit

5. Vercel akan memberi Anda URL seperti:
   ```
   https://laporan-bulanan-xxxx.vercel.app
   ```

6. **Buka URL itu di HP Anda** — aplikasi sudah bisa dipakai!

### Agar bisa diakses seperti aplikasi (opsional):
- Di HP Android: buka URL → menu browser → **"Add to Home Screen"**
- Di iPhone: buka URL di Safari → Share → **"Add to Home Screen"**

---

## BAGIAN 2 — Setup Google Apps Script (10 menit)

Ini untuk menyimpan data ke Google Sheets dan file ke Google Drive.

### Langkah-langkah:

1. **Buka** https://script.google.com
   - Login dengan akun Google Anda

2. Klik **+ New project**

3. **Hapus** semua kode yang ada (pilih semua → delete)

4. **Copy** seluruh isi file `gas.js` dan paste ke sana

5. Klik **ikon disket (Save)** — beri nama project:
   ```
   Laporan Bulanan API
   ```

6. Klik **Run → Run function → setup**
   - Pertama kali akan minta izin akses → klik **Review permissions**
   - Pilih akun Google Anda → klik **Advanced** → **Go to Laporan Bulanan API**
   - Klik **Allow**

7. Lihat **Execution log** di bawah — akan muncul:
   ```
   === SETUP BERHASIL ===
   Spreadsheet: https://docs.google.com/spreadsheets/d/...
   Drive Folder: https://drive.google.com/drive/folders/...
   ```
   Simpan URL-URL itu!

8. **Deploy sebagai Web App:**
   - Klik menu **Deploy → New deployment**
   - Klik ikon ⚙️ di sebelah "Select type" → pilih **Web app**
   - Isi form:
     ```
     Description  : v1
     Execute as   : Me (akun Anda)
     Who has access: Anyone
     ```
   - Klik **Deploy**
   - Copy URL yang muncul — bentuknya:
     ```
     https://script.google.com/macros/s/AKfycb.../exec
     ```

9. **Masukkan URL ke aplikasi:**
   - Buka aplikasi Anda (URL Vercel)
   - Buka tab **Setelan** (ikon ⚙️)
   - Paste URL tadi ke kolom **"URL Google Apps Script"**
   - Klik **Test koneksi** — harus muncul ✓ hijau
   - Klik **Simpan pengaturan**

---

## BAGIAN 3 — Setup API Key Anthropic

API Key digunakan untuk fitur Generate Laporan dengan AI.

1. Buka https://console.anthropic.com
2. Login / daftar
3. Klik **API Keys → + Create Key**
4. Copy key yang muncul (format: `sk-ant-...`)
5. Buka aplikasi → tab **Setelan** → paste ke kolom **"Anthropic API Key"**
6. Klik **Simpan pengaturan**

> ⚠️ **Catatan biaya:** API Anthropic berbayar per penggunaan.
> Generate 1 laporan ≈ $0.01–0.03 (sangat murah).
> Daftar di console.anthropic.com untuk lihat tarif terbaru.

---

## Setelah Semua Selesai

### Cara pakai sehari-hari:
1. Buka aplikasi di HP (atau dari icon home screen)
2. Tab **Input** → isi kegiatan hari ini → **Simpan**
3. Data otomatis masuk ke Google Sheets Anda
4. Akhir bulan → tab **Generate** → klik **⚡ Generate dengan AI**
5. Laporan narasi siap — bisa disalin atau dibagikan

### Cek data di Google Sheets:
- Buka URL spreadsheet yang muncul saat setup
- Sheet "Logbook" berisi semua entri Anda

### Cek file di Google Drive:
- Buka folder "Lampiran Laporan Bulanan" di Drive Anda

---

## Troubleshooting

**Koneksi ke Sheets gagal?**
- Pastikan URL Apps Script sudah benar (berakhiran `/exec`)
- Coba deploy ulang Apps Script (Deploy → Manage deployments → Edit → Deploy baru)
- Pastikan "Who has access" diset ke **Anyone**

**Generate laporan error?**
- Cek API Key sudah benar
- Pastikan ada entri logbook untuk bulan yang dipilih

**Aplikasi tidak muncul di Vercel?**
- Pastikan file `index.html` ada di root folder (bukan di subfolder)

---

## Pertanyaan?
Tanyakan ke Claude di claude.ai — ceritakan pesan error yang muncul
dan saya akan bantu troubleshoot! 😊
