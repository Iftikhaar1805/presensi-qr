# Presensi QR, SMP Dharma Bakti

Aplikasi presensi berbasis QR Code untuk PKM Teknik Informatika Universitas Pamulang. Guru memindai kartu QR siswa dari HP, kehadiran tercatat otomatis, dan rekap tinggal diunduh ke Excel atau dicetak.

**Teknologi (diverifikasi lewat Context7, 14 Oktober 2026):** **Next.js 16** (React 19, App Router) dengan Tailwind 4. API di dalam proyek yang sama (route handler Next.js dengan router Hono), Drizzle ORM, libSQL (SQLite). Jalan di laptop atau hosting gratis Vercel + Turso. Satu proyek, satu perintah.

## Alur singkat

1. Admin menyiapkan kelas, guru, siswa, dan mata pelajaran, lalu mencetak kartu QR per kelas.
2. Guru yang akan mengajar membuka **Mengajar**, memilih pelajarannya, lalu **mengambil kelas** yang berstatus Kosong. Kelas itu terkunci untuk guru lain selama ia mengajar.
3. Guru memindai kartu siswa satu per satu. Pindaian pertama siswa hari itu menjadi kehadiran harian (Hadir atau Terlambat).
4. Di akhir pelajaran guru mengetuk **Akhiri pelajaran**. Yang tidak dipindai ditandai tidak hadir, dan kelas kembali **Kosong** sampai guru berikutnya mengambilnya.
5. Siswa yang hadir pagi tetapi tidak ada di suatu pelajaran tercatat **bolos**.
6. **Wali kelas tidak memindai.** Ia membuka **Kelas Saya**: siapa mengajar sekarang, pelajaran hari ini beserta gurunya, siapa hadir, siapa bolos. Izin dan sakit diinput wali kelas lewat Rekap Harian.
7. **Profil sekolah:** nama, alamat, dan logo diatur admin di Pengaturan. Logo ikut tampil di pojok aplikasi, kartu siswa, dan kop laporan. Logo tersimpan di database, jadi tidak hilang di hosting gratis. Logo SMP Dharma Bhakti (ADY) sudah menjadi logo bawaan saat database baru diisi; berkas aslinya ada di `docs/logo-sekolah.png`.
8. **Cek Kartu Saya** (`/cek-kartu`, tanpa login): siswa memindai kartu QR miliknya untuk melihat kehadiran hari ini, per pelajaran, dan 14 hari terakhir. Hanya baca; mencatat absen tetap tugas guru.
9. **Cadangan dan pemulihan** di Pengaturan: unduh cadangan (memuat akun dan password terenkripsi, simpan baik-baik), lalu pulihkan dari berkas itu. Pemulihan bersifat semua-atau-tidak: berkas rusak tidak mengubah data. **Riwayat perubahan** di bawahnya mencatat siapa mengubah apa.
10. Guru mapel mengunduh rekap pelajarannya (**Rekap per Pelajaran**) untuk diserahkan ke wali kelas. Rekap bulanan harian ada di **Rekap & Export**.

## Akun contoh

| Peran | Username | Password |
|---|---|---|
| Admin / TU | `admin` | `admin123` |
| Guru (wali kelas 7A, mengampu Matematika dan Informatika) | `guru` | `guru123` |
| Guru lain | `guru2` sampai `guru8` | `guru123` |

Tombol akun contoh di halaman masuk tersembunyi secara bawaan. Nyalakan hanya untuk latihan dengan `SHOW_DEMO_ACCOUNTS=1`. Pengguna yang masih memakai password bawaan melihat peringatan ganti password sampai menggantinya. Percobaan masuk yang salah 8 kali dalam 10 menit (alamat dan username sama) ditahan sementara.

Siswa tidak punya akun. Guru dan admin yang memegang semua kartu QR siswa, lalu mencetaknya.

## Menjalankan di laptop (tanpa internet)

Butuh Node.js 22 atau lebih baru.

```bash
npm install
npm run build
npm start
```

Buka `http://localhost:3000`. Data awal terisi sendiri dan tersimpan di `data/presensi.db`. `npm start` menjalankan versi hasil build; jalankan `npm run build` dulu setelah mengubah kode.

Menjalankan tes otomatis backend (44 skenario: login, hak akses, ambil dan akhiri kelas, scan, bolos, kartu QR, logo sekolah, cadangan dan pemulihan, riwayat perubahan, cek kartu siswa): `npm test`. Tes memakai database sementara, data Anda tidak tersentuh.

Mode pengembangan: `npm run dev`, lalu buka `http://localhost:3000`.

Kamera browser hanya jalan di **HTTPS** atau `localhost`. Untuk mencoba scan dari HP lewat laptop, pakai hosting di bawah atau terowongan (devtunnel) yang HTTPS.

## Hosting gratis: Vercel + Turso

Database di Vercel tidak bisa berupa file, jadi dipakai Turso (SQLite di cloud, paket gratis tanpa batas waktu). Kode yang sama otomatis memakai file lokal bila `DATABASE_URL` kosong.

1. **Turso** (turso.tech, daftar gratis). Buat database, lalu salin *URL* (`libsql://...`) dan buat *token*.
2. **Vercel** (vercel.com, daftar gratis). Dari folder proyek ini:
   ```bash
   npx vercel login
   npx vercel link
   npx vercel env add DATABASE_URL production
   npx vercel env add DATABASE_AUTH_TOKEN production
   npx vercel env add JWT_SECRET production
   npx vercel --prod
   ```
   `JWT_SECRET` diisi teks acak panjang. Cara membuatnya: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
3. Buka alamat `https://nama-proyek.vercel.app`. Permintaan pertama mengisi data contoh ke Turso sendiri (beberapa detik).

Database Turso gratis bisa tertidur bila lama tidak dipakai. `vercel.json` memuat jadwal harian yang memanggil `/api/warmup` supaya tetap aktif; tetap buka aplikasi sekali sebelum hari H.

Perubahan struktur database di masa depan ditulis sebagai migrasi di `src/server/db.ts` (daftar `MIGRATIONS`, dijalankan sekali per database).

Catatan: paket Hobby Vercel untuk pemakaian non-komersial, dan kegiatan PKM termasuk. Turso gratis akan tidur bila lama tidak dipakai; buka aplikasinya sekali sehari sebelum hari H.

## Skenario demo di sekolah

Lihat [docs/DEMO.md](docs/DEMO.md).

## Struktur

| Lokasi | Isi |
|---|---|
| `app/` | Halaman dan rute Next.js (App Router). `app/api/[[...route]]/route.ts` meneruskan semua `/api/...` ke router server |
| `src/views/` | Isi tiap halaman (React) |
| `src/components/`, `src/context/`, `src/lib/` | Komponen, state (login, sekolah, pesan), dan klien API |
| `src/server/` | Logika server: router API (Hono), Drizzle, skema, data contoh, tes ada di `test/` |
| `public/` | Gambar dan ikon |
| `vercel.json` | Jadwal ping harian agar database tidak tertidur |
| `docs/` | Skenario demo, panduan deploy, daftar periksa hari H, materi PKM |
| `PRD.md`, `TASKS.md` | Dokumen perencanaan |
