# Skenario demo PKM di sekolah

Presensi dilakukan **di dalam kelas oleh guru yang mengajar**, per mata pelajaran. Wali kelas tidak memindai, ia melihat hasilnya di **Kelas Saya**.

Tujuan: guru mencoba sendiri dengan HP masing-masing, melihat kelas berpindah dari Kosong ke Diajar dan kembali Kosong, lalu melihat satu murid baru dibuat dan langsung dipindai.

## Sehari sebelum
1. Buka aplikasi di internet sekali supaya database Turso aktif.
2. Masuk sebagai `admin`, buka **Pengaturan** dan unggah **logo sekolah** (PNG atau JPG dari sekolah). Lalu buka **Cetak Kartu QR**, pilih kelas **DEMO**. Kelas ini berisi 10 siswa: 3 contoh (Andi, Bunga, Candra Contoh) dan 7 anggota tim PKM (NIS 90004 sampai 90010). Cetak, gunting, laminating. Tiap anggota tim memegang kartunya sendiri.
3. Kartu DEMO tetap berlaku walau data di-reset, jadi kartu cetak tidak perlu dicetak ulang.
4. Siapkan HP cadangan dengan kuota, dan proyektor atau layar untuk **Papan kehadiran**.

## Sebelum acara mulai
1. Masuk sebagai `admin`, buka **Pengaturan**, ketuk **Siapkan latihan sekarang**. Jam masuk jadi sekarang, batas presensi sampai malam, dan semua absen serta sesi mengajar hari ini dikosongkan.
2. Tampilkan **Papan kehadiran** di layar besar. Tiap kelas menampilkan Kosong atau nama guru yang sedang mengajar, dan papan memperbarui diri tiap beberapa detik.

## Alur acara
1. **Penjelasan singkat.** Tunjukkan Papan kehadiran dan kartu cetak. Semua kelas berstatus Kosong.
2. **Dua guru berebut satu kelas.** Guru pertama (`guru`, mengampu Matematika dan Informatika) membuka **Mengajar**, memilih Matematika, lalu **Ambil kelas** DEMO. Di layar proyektor DEMO berubah menjadi "Matematika, nama guru, sejak jam ...". Guru kedua (`guru2`, mengampu Matematika dan IPA) mencoba mengambil kelas DEMO dan ditolak karena **Terkunci**.
3. **Memindai.** Guru pertama menyalakan kamera dan memindai beberapa kartu. Stempel HADIR muncul, kotak di layar terisi, daftar **Belum dipindai** berkurang.
4. **Keluar kelas.** Guru pertama mengetuk **Akhiri pelajaran**. Kelas DEMO kembali **Kosong** di proyektor.
5. **Guru kedua mengambil kelas yang sama** untuk IPA, lalu memindai hanya sebagian kartu dan mengakhiri pelajaran. Satu siswa yang hadir tadi tetapi tidak dipindai di IPA tercatat **bolos**.
6. **Wali kelas melihat hasilnya.** Buka **Kelas Saya** (pilih DEMO): pelajaran hari ini beserta gurunya, daftar bolos, dan tabel siswa × pelajaran. Di kelas 7B sudah ada 4 contoh siswa bolos sejak awal.
7. **Guru mapel menyerahkan rekap.** Buka **Rekap per Pelajaran**, pilih kelas dan pelajaran, unduh Excel.
8. **Akun dan murid baru langsung.**
   - Admin buka **Data Guru**, ketuk **Tambah guru**, isi nama dan username. Kata sandi awal `guru123`. Kolom **Mata pelajaran yang diampu** boleh dikosongkan: guru itu boleh mengajar apa saja. Guru baru masuk dari HP-nya.
   - Admin buka **Data Siswa**, ketuk **Tambah siswa**, isi data, lalu ketuk **Kartu** pada nama siswa itu: kartu dan QR-nya tampil di layar. Guru memindai QR dari layar tersebut.
9. **Siswa cek sendiri.** Siswa membuka `/cek-kartu` (atau ketuk "Siswa? Cek kehadiranmu di sini" di halaman masuk), memindai kartunya, dan melihat kehadirannya. Memenuhi bagian proposal "setiap peserta memindai QR masing-masing" tanpa risiko titip absen, karena hanya baca.
10. **Izin atau sakit.** Wali kelas buka **Rekap Harian**, ketuk nama siswa, pilih Izin atau Sakit.

## Kartu hilang atau rusak
Admin atau guru buka **Data Siswa**, ketuk nama siswa, lalu **Cetak kartu ini saja**. Untuk beberapa siswa, buka **Cetak Kartu QR**, ketuk kartu yang dipilih (atau cari nama), lalu **Cetak**. Kartu lama yang masih beredar bisa dimatikan dengan **Buat QR baru** pada siswa itu. Sementara kartu belum jadi, guru cukup mengetik NIS siswa.

## Cadangan sebelum acara
Di **Pengaturan**, ketuk **Unduh cadangan** dan simpan berkasnya. Jika data berantakan saat acara, **Pulihkan cadangan** mengembalikannya dalam satu langkah.

## Jika ada masalah
| Gejala | Tindakan |
|---|---|
| Kamera tidak menyala | Pastikan alamat diawali `https://`. Ketuk gembok di samping alamat, izinkan Kamera. Cadangan: ketik NIS siswa (90001 sampai 90010) di kolom bawah halaman Mengajar. |
| Kelas terkunci padahal gurunya sudah selesai | Admin ketuk **Kosongkan** pada kelas itu di halaman Mengajar. |
| Semua scan tercatat Terlambat atau Alpa | Ketuk **Siapkan latihan sekarang** di Pengaturan. |
| Mau mengulang dari awal | **Pengaturan**, lalu **Ulangi latihan scan** (hapus absen dan sesi hari ini) atau **Kembalikan data contoh**. |
| Muncul pesan "Terlalu banyak percobaan masuk" | Tunggu 10 menit, atau mulai ulang server (di laptop). Terjadi setelah 8 kali salah password dari alamat yang sama. |
| Aplikasi lambat di permintaan pertama | Normal setelah lama tidak dipakai (database tidur). Buka sekali sebelum acara. |
