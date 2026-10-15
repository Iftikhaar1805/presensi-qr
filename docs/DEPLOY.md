# Deploy gratis: Vercel + Turso

Waktu sekitar 20 menit. Semua gratis dan tanpa kartu kredit. Dikerjakan sekali; setelah itu aplikasi punya alamat `https://...vercel.app` yang bisa dibuka dari HP mana saja, dan kamera berfungsi karena HTTPS.

## 1. Database di Turso
1. Buka turso.tech, daftar dengan akun GitHub atau Google.
2. Buat database baru (nama bebas, misalnya `presensi-qr`). **Pilih wilayah AWS AP NorthEast (Tokyo)** (Singapura tidak tersedia di Turso). Fungsi Vercel sudah diatur di `vercel.json` ke Tokyo (`hnd1`) supaya dekat dengan database; jarak jauh membuat tiap ketukan terasa lambat. Jika memakai wilayah Turso lain, ubah `regions` di `vercel.json` ke wilayah Vercel yang sama (Mumbai `bom1`, Sydney `syd1`).
3. Buka database itu. Salin **URL** (diawali `libsql://`).
4. Buat **token** untuk database itu (menu Generate Token atau Create Token). Salin dan simpan, token hanya tampil sekali.

## 2. Aplikasi di Vercel
Next.js dikenali Vercel otomatis, jadi tidak ada pengaturan build yang perlu diisi. Dari folder proyek, di terminal:

```bash
npx vercel login
npx vercel link
npx vercel env add DATABASE_URL production
npx vercel env add DATABASE_AUTH_TOKEN production
npx vercel env add JWT_SECRET production
npx vercel --prod
```

- `DATABASE_URL`: URL libsql dari langkah 1.
- `DATABASE_AUTH_TOKEN`: token dari langkah 1.
- `JWT_SECRET`: teks acak panjang. Buat dengan `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

Setelah selesai Vercel menampilkan alamat produksi. Jangan isi `SHOW_DEMO_ACCOUNTS`.

## 3. Pertama kali dibuka
1. Buka alamatnya sekali di laptop. Permintaan pertama agak lama (beberapa detik) karena mengisi data contoh ke Turso.
2. Masuk `admin` / `admin123`, lalu **ganti password** di Profil.
3. Di **Pengaturan**: unggah logo sekolah, cek nama dan alamat, atur jam presensi.
4. Di **Pengaturan**: ketuk **Unduh cadangan** dan simpan berkas. Ulangi sebelum dan sesudah acara.

## 4. Uji sebelum hari H
- Buka dari 2 sampai 3 HP berbeda (Android dan iPhone bila ada). Masuk sebagai guru, **Mulai mengajar**, nyalakan kamera, pindai kartu cetak.
- Coba dua HP mengambil kelas yang sama: yang kedua harus ditolak.
- Buka `/cek-kartu` dari HP lain dan pindai satu kartu.
- Cetak satu halaman **Cetak Kartu QR**, lalu pindai hasil cetaknya.

## Jika bermasalah
| Gejala | Tindakan |
|---|---|
| Halaman putih atau error setelah deploy | Periksa tiga variabel di Vercel (Settings, Environment Variables), lalu `npx vercel --prod` lagi. |
| "Server presensi tidak bisa dihubungi" | Buka `https://alamat/api/health`. Jika tidak `{"ok":true}`, lihat log di dashboard Vercel. |
| Terasa lambat atau berputar lama | Buka `https://alamat/api/warmup` di HP. Angka `dbMs` di atas 300 berarti database terlalu jauh dari server: pastikan wilayah Turso dan Vercel sama (Tokyo). |
| Lambat di permintaan pertama | Normal setelah lama tidak dipakai. Buka sekali sebelum acara; ping harian sudah diatur di `vercel.json`. |
| Data berantakan | Pengaturan, lalu **Pulihkan cadangan** dengan berkas yang diunduh tadi. |
