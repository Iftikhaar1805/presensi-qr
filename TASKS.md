# Task Breakdown — Presensi QR Sekolah

Urutan pengerjaan mengikuti fase di [PRD.md](PRD.md). Setiap task cukup kecil untuk dikerjakan 1 orang / diberikan ke AI coding tool satu per satu.

## Fase 0 — Fondasi
- [ ] T0.1 Buat project Laravel 11, set `APP_TIMEZONE=Asia/Jakarta`, koneksi MySQL
- [ ] T0.2 Pasang Tailwind + Alpine, buat layout dasar (sidebar/topbar responsif)
- [ ] T0.3 Migration semua tabel (lihat PRD §9) + model & relasi
- [ ] T0.4 Seeder: 1 admin, 2 guru, 1 tahun ajaran, 2 kelas, 40 siswa demo + `qr_token`
- [ ] T0.5 Login sederhana + middleware role (dipakai sejak awal agar scanner terlindungi)

## Fase 1 — Inti presensi
**F1 Scan Presensi QR**
- [ ] T1.1 Halaman Scanner: html5-qrcode, pilih kamera, auto-start
- [ ] T1.2 Endpoint `POST /scan` (token → siswa → cek duplikat → hitung Hadir/Terlambat → simpan), respons JSON
- [ ] T1.3 Feedback UI: kartu hasil (nama, kelas, status, jam), warna & suara beep sukses/gagal/duplikat
- [ ] T1.4 Jeda 2 detik antar scan agar QR yang sama tidak terbaca berulang
- [ ] T1.5 Form input NIS manual
- [ ] T1.6 Daftar 10 scan terakhir

**F2 Rekap Harian Kelas**
- [ ] T2.1 Dashboard: kartu jumlah per status hari ini (sekolah & per kelas)
- [ ] T2.2 Halaman rekap harian per kelas: tabel siswa, jam, status
- [ ] T2.3 Pencarian siswa (nama/NIS)

## Fase 2 — Data & status
**F3 Kartu QR Siswa**
- [ ] T3.1 Service generate token unik (`Str::random(32)`)
- [ ] T3.2 Template kartu (logo, nama sekolah, nama, NIS, kelas, QR) → PDF A4 per kelas (dompdf)
- [ ] T3.3 Tombol regenerate token + cetak ulang satu kartu

**F4 Data Siswa & Kelas**
- [ ] T4.1 CRUD kelas (+ wali kelas)
- [ ] T4.2 CRUD siswa (auto buat token & akun siswa)
- [ ] T4.3 Import Excel/CSV + template unduhan + laporan baris gagal
- [ ] T4.4 CRUD guru (+ akun)

**F5 Status Kehadiran**
- [ ] T5.1 Ubah status (Izin/Sakit/Alpa) + keterangan; wali kelas hanya kelasnya
- [ ] T5.2 Simpan `attendance_logs` setiap perubahan
- [ ] T5.3 Command `attendance:mark-absent` (lewati libur & Minggu) + jadwal scheduler
- [ ] T5.4 Fallback tanpa cron: jalankan mark-absent saat dashboard/rekap dibuka setelah jam batas

## Fase 3 — Laporan & pengaturan
**F6 Rekap & Export**
- [ ] T6.1 Rekap per siswa (jumlah status + % hadir)
- [ ] T6.2 Rekap per kelas & rentang tanggal (matriks siswa × tanggal)
- [ ] T6.3 Export Excel (maatwebsite/excel)
- [ ] T6.4 Export PDF berkop sekolah

**F7 Pengaturan Sekolah**
- [ ] T7.1 Halaman pengaturan: nama & logo sekolah, jam masuk, toleransi, jam batas
- [ ] T7.2 Tahun ajaran (set aktif)
- [ ] T7.3 CRUD hari libur

**F8 Login & Hak Akses**
- [ ] T8.1 Siswa login pakai NIS; halaman Kartu Saya & Riwayat Saya
- [ ] T8.2 Ganti password; admin reset password user
- [ ] T8.3 Uji akses: guru tidak bisa buka menu admin, siswa hanya data sendiri

## Fase 4 — Kebutuhan PKM
**F9 Bantuan & Data Demo**
- [ ] T9.1 Halaman bantuan + panduan PDF (admin & guru, dengan screenshot)
- [ ] T9.2 Tombol reset data demo (hapus presensi hari ini / semua data demo)
- [ ] T9.3 Materi slide, soal kuis, form kuesioner evaluasi

## Deploy & Uji
- [ ] D1 Deploy ke shared hosting (public_html → folder `public`), aktifkan SSL
- [ ] D2 Set cron `php artisan schedule:run` (jika hosting mendukung)
- [ ] D3 Uji scan di minimal 2 HP Android berbeda + 1 laptop
- [ ] D4 Uji 40 scan beruntun (simulasi praktik PKM)
- [ ] D5 Cetak kartu peserta & gladi bersih
