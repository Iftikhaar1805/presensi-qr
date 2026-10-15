# PRD — Presensi QR Sekolah (SMP Dharma Bakti)

> Project PKM Mahasiswa Teknik Informatika, Universitas Pamulang — T.A. 2025/2026
> Judul kegiatan: *Implementasi Aplikasi Presensi QR Code Guna Mempermudah Rekapitulasi Kehadiran Siswa di SMP Dharma Bakti*

---

> **Perubahan keputusan (14 Oktober 2026)**
> - **Tidak ada akun siswa.** Peran hanya admin dan guru. Guru dan admin dapat melihat QR semua siswa dan mencetaknya (Data Siswa, Cetak Kartu QR). Bagian "Siswa" di tabel peran dan halaman Kartu Saya/Riwayat di dokumen ini tidak dibuat.
> - **Teknologi:** Next.js 16 (React, App Router) dengan API di proyek yang sama, Drizzle + libSQL (bukan Laravel). Alasan: satu proyek dan satu bahasa, bisa jalan di laptop (file SQLite) dan di hosting gratis (Vercel + Turso). Lihat README.
> - **Presensi dilakukan di dalam kelas** oleh guru kelas, bukan di gerbang. Halaman Scan punya pilihan kelas, daftar "belum absen" yang ikut berubah, dan peringatan jika kartu siswa dari kelas lain.
> - **Wali kelas tidak memindai.** Yang memindai adalah guru yang sedang mengajar, per mata pelajaran. Guru **mengambil kelas** (satu kelas satu guru pada satu waktu), memindai, lalu **mengakhiri pelajaran**; kelas lalu berstatus Kosong sampai guru berikutnya mengambilnya. Wali kelas melihat kelasnya di halaman **Kelas Saya** (siapa mengajar, jadwal hari ini, hadir, bolos) dan menginput izin atau sakit.
> - **Deteksi bolos:** siswa yang hadir di pindaian pertama hari itu tetapi tidak dipindai di suatu pelajaran tercatat bolos. Guru mapel menyerahkan rekap pelajarannya ke wali kelas (Rekap per Pelajaran).
> - **Tambahan untuk demo:** kelas DEMO (10 kartu tetap: 3 contoh dan 7 anggota tim), tombol "Siapkan latihan sekarang", Papan kehadiran yang memperbarui diri otomatis.

## 1. Ringkasan

Aplikasi web untuk mencatat kehadiran harian siswa dengan memindai kartu QR milik siswa menggunakan kamera HP/laptop guru kelas. Kehadiran tercatat otomatis (Hadir/Terlambat), siswa yang tidak scan otomatis Alpa, dan rekap per siswa/kelas/periode bisa langsung di-export ke Excel/PDF.

Aplikasi akan didemokan dan dilatihkan dalam kegiatan PKM (±2,5 jam, ±40 peserta siswa & guru), lalu diserahkan ke sekolah untuk dipakai seterusnya.

## 2. Masalah

Guru kelas dan wali kelas masih mencatat absen di buku/kertas: memanggil nama satu per satu tiap pagi, lalu tiap akhir bulan menghitung manual hadir/izin/sakit/alpa untuk laporan dan rapor.

- Rekap bulanan/semester memakan waktu lama.
- Sering salah catat, kertas hilang, tulisan tidak terbaca.
- Rawan titip absen.
- Data terlambat/alpa tidak bisa dipantau real-time oleh guru kelas, BK, dan kepala sekolah.

## 3. Tujuan & Ukuran Keberhasilan

| Tujuan | Ukuran keberhasilan |
|---|---|
| Presensi cepat | Presensi 1 kelas (±30 siswa) selesai dalam hitungan menit; 1 scan → feedback < 2 detik |
| Rekap otomatis | Rekap bulanan per kelas didapat dalam hitungan detik lewat export |
| Data akurat | Tidak ada salah tulis; 1 siswa maksimal 1 presensi masuk per hari |
| Mudah dipakai | Guru bisa scan & lihat rekap mandiri setelah pelatihan; kuesioner peserta menilai "mudah digunakan" |
| Berkelanjutan | Sekolah bersedia memakai setelah PKM selesai |

## 4. Pengguna & Hak Akses

| Role | Bisa melakukan |
|---|---|
| **Admin (Operator/TU)** | Semua: data master, pengaturan, kartu QR, semua rekap, kelola akun |
| **Guru / Wali Kelas** | Scanner, lihat & ubah status kehadiran, rekap. Wali kelas: ubah status hanya untuk kelasnya |
| **Siswa** | Lihat kartu QR miliknya & riwayat kehadiran pribadi |

**Pengguna utama:** guru kelas. Presensi dilakukan di dalam kelas, bukan di gerbang. **Hal terpenting saat pertama buka aplikasi:** bisa langsung *scan kartu siswa*.

## 5. Alur Utama

**Persiapan (awal tahun ajaran)**
1. Admin membuat tahun ajaran & kelas.
2. Admin import siswa dari Excel/CSV (template disediakan).
3. Sistem membuat `qr_token` acak unik per siswa.
4. Admin cetak kartu QR massal per kelas (PDF A4, beberapa kartu per lembar).

**Presensi harian**
1. Guru kelas buka menu **Scanner** → kamera aktif di browser.
2. Siswa menunjukkan kartu → sistem validasi token.
3. Status otomatis: `Hadir` jika ≤ jam masuk + toleransi, selain itu `Terlambat`.
4. Feedback instan: nama, kelas, status, jam + bunyi beep. QR tidak valid / sudah scan → peringatan warna & suara berbeda.
5. Cadangan: input NIS manual jika kartu rusak/hilang.

**Setelah jam batas presensi**
1. Siswa yang belum scan otomatis `Alpa` (kecuali hari libur / Minggu).
2. Wali kelas mengubah ke `Izin`/`Sakit` + keterangan. Setiap perubahan tercatat di log.

**Rekap**
1. Dashboard harian: total hadir/terlambat/izin/sakit/alpa per kelas & sekolah.
2. Rekap per siswa / per kelas / rentang tanggal → export Excel & PDF berkop sekolah.

## 6. Fitur per Fase

Prioritas utama (dari hasil diskusi): **Scan QR via kamera HP**, **Rekap & export Excel/PDF**, **Cetak kartu QR per kelas**.

### Fase 1 — Inti presensi
**F1. Scan Presensi QR**
- Buka kamera & scan kartu (html5-qrcode, pilih kamera depan/belakang)
- Hasil instan & suara beep (sukses / gagal / duplikat)
- Input NIS manual
- Anti scan ganda (1 siswa 1 presensi masuk per hari) + daftar 10 scan terakhir

**F2. Rekap Harian Kelas**
- Ringkasan kelas hari ini (jumlah per status)
- Daftar kehadiran per siswa (nama, jam, status)
- Cari siswa cepat (nama/NIS)

### Fase 2 — Data & status
**F3. Kartu QR Siswa**
- Buat kode QR unik (token acak 32 karakter, bukan NIS)
- Cetak kartu massal per kelas (PDF: logo, nama sekolah, nama, NIS, kelas, QR)
- Cetak ulang kartu (regenerate token → kartu lama tidak berlaku)

**F4. Data Siswa & Kelas**
- Import siswa dari Excel/CSV + validasi (NIS duplikat, kelas tidak ada)
- Tambah, ubah, hapus siswa
- Kelola data guru & wali kelas

**F5. Status Kehadiran**
- Hadir & Terlambat otomatis berdasar jam
- Ubah ke Izin, Sakit, atau Alpa + keterangan
- Alpa otomatis lewat jam batas (scheduler / dijalankan saat halaman rekap dibuka jika cron tidak tersedia)
- Log perubahan status (siapa, kapan, dari → ke)

### Fase 3 — Laporan & pengaturan
**F6. Rekap & Export Laporan**
- Rekap per siswa (jumlah tiap status + persentase hadir)
- Rekap per kelas & periode (matriks siswa × tanggal: H/T/I/S/A)
- Export Excel & PDF berkop sekolah

**F7. Pengaturan Sekolah**
- Tahun ajaran & daftar kelas (satu tahun ajaran aktif)
- Jam masuk, toleransi terlambat (menit), jam batas presensi; nama & logo sekolah
- Hari libur

**F8. Login & Hak Akses**
- Masuk & keluar akun (admin/guru: username; siswa: NIS)
- Hak akses sesuai peran (middleware per role)
- Ganti password

### Fase 4 — Kebutuhan kegiatan PKM
**F9. Bantuan & Data Demo**
- Panduan penggunaan (PDF + halaman bantuan)
- Data demo (1 kelas contoh) & tombol reset demo (admin)
- Materi pelatihan & kuis

### Di luar cakupan versi awal
Aplikasi native Android/iOS, biometrik (sidik jari/wajah), integrasi Dapodik/rapor, mode offline penuh.

**Pengembangan lanjutan (opsional):** scan pulang, notifikasi WhatsApp ke orang tua, grafik tren, daftar "siswa perlu perhatian" untuk BK, QR dinamis, PWA.

## 7. Kebutuhan Non-Fungsional

- **Platform:** web responsif, nyaman di HP Android kelas menengah ke bawah & laptop.
- **Hosting:** shared hosting + domain (±Rp300.000). Kamera browser **wajib HTTPS**.
- **Performa:** scan → feedback < 2 detik; halaman ringan untuk internet sekolah terbatas.
- **Kapasitas:** ratusan siswa, data beberapa tahun ajaran.
- **Keamanan:** password bcrypt, CSRF, query aman (ORM/prepared statement), akses data sesuai role.
- **UI:** bahasa Indonesia, tombol besar, warna status konsisten (Hadir hijau, Terlambat kuning, Izin biru, Sakit ungu, Alpa merah).
- **Zona waktu:** Asia/Jakarta (WIB).
- **Backup:** admin bisa unduh backup database.

## 8. Rekomendasi Teknologi

| Bagian | Pilihan |
|---|---|
| Backend | Laravel 11 (PHP 8.2) |
| Database | MySQL / MariaDB |
| Frontend | Blade + Tailwind CSS + Alpine.js |
| Scanner QR | html5-qrcode (JS) |
| Generate QR | simplesoftwareio/simple-qrcode |
| Excel import/export | maatwebsite/excel |
| PDF | barryvdh/laravel-dompdf |
| Dev lokal | XAMPP + devtunnel/ngrok (HTTPS untuk tes kamera di HP) |

> Alternatif jika tim lebih nyaman PHP native: struktur tabel & alur tetap sama.

## 9. Struktur Data

```
users          (id, name, username, password, role[admin|guru|siswa], timestamps)
academic_years (id, name, is_active)
classes        (id, name, grade, homeroom_teacher_id→teachers, academic_year_id)
teachers       (id, nip, name, user_id)
students       (id, nis UNIQUE, name, gender, class_id, photo, qr_token UNIQUE, user_id)
attendances    (id, student_id, date, check_in_time, status[hadir|terlambat|izin|sakit|alpa],
                note, recorded_by→users, UNIQUE(student_id, date))
attendance_logs(id, attendance_id, old_status, new_status, changed_by, created_at)
settings       (key, value)   -- school_name, logo, check_in_time, late_tolerance, cutoff_time
holidays       (id, date, description)
```

## 10. Halaman

| Halaman | Role |
|---|---|
| Login | semua |
| Dashboard (ringkasan hari ini) | admin, guru |
| Scanner | admin, guru |
| Rekap Harian Kelas | admin, guru |
| Rekap & Export | admin, guru |
| Data Siswa / Guru / Kelas | admin |
| Kartu QR (cetak per kelas) | admin |
| Pengaturan & Hari Libur | admin |
| Kartu Saya & Riwayat Saya | siswa |
| Bantuan | semua |

## 11. Skenario Demo PKM

| Waktu | Kegiatan | Kebutuhan aplikasi |
|---|---|---|
| 09:10–09:30 | Materi pengenalan QR & presensi digital | Slide + halaman bantuan |
| 09:30–10:00 | Praktik: tiap peserta scan kartu, lihat rekap | Data demo 40 peserta, kartu tercetak, dashboard tampil di proyektor |
| 10:00–10:20 | Kuis & doorprize | Soal kuis |
| 10:20–10:40 | Evaluasi & kuesioner | Form kuesioner (kemudahan, kecepatan, akurasi) |

**Checklist hari H:** HTTPS aktif, kartu 40 peserta tercetak, 2+ HP scanner dicoba, data demo di-reset, hotspot cadangan.
