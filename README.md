# RJM Relay Studio

Editor wiring dan simulator kontrol listrik berbasis web, berbahasa Indonesia. Menggambar di PC/laptop, melihat dan menjalankan simulasi dari HP. Contoh pertama mengikuti POWER, CONTROL dan CONTROL PANEL LAMP proyek Jago Coffee yang disediakan pemilik repository.

## Cara pakai

1. Buka aplikasi, lalu pilih **Proyek → Jago Coffee** atau **START/STOP**.
2. Pilih komponen di palet lalu klik kanvas, atau seret komponen ke kanvas.
3. Klik terminal asal lalu tujuan untuk menyambung kabel. Klik area kosong di antaranya untuk membuat belokan; Esc membatalkan.
4. Klik komponen untuk mengatur tag, keterangan dan parameter. Coil dan kontak dengan **tag sama** tertaut antarlembar Power/Control.
5. Tekan **Jalankan**. Klik sakelar/MCB untuk mengoperasikan. Tahan push button lalu lepaskan; Space/Enter juga tersedia.
6. Ubah suhu sensor di tray simulasi. Coba trip F1/F2, gangguan PFR, emergency stop dan HP/LP. Pilih sumber saat simulasi untuk mencoba kehilangan fase.
7. **Unduh project** menghasilkan JSON yang dapat diimpor sebagai project baru. **SVG** mengunduh gambar aktif; tombol printer membuka cetak/PDF.
8. **Sinkronkan** menyambungkan penyimpanan lokal dengan akun ChatGPT pada website privat. Konflik: pakai lokal, pakai akun, atau simpan keduanya.

Project tersimpan di browser perangkat. Setelah aplikasi memuat aset dan menampilkan **Offline siap**, halaman dapat dibuka lagi tanpa jaringan. Sinkronisasi memerlukan koneksi dan sesi akun. Unduh project sebagai cadangan sebelum menghapus data browser. PDF acuan memerlukan jaringan jika belum tersimpan di browser.

## Fitur

- Kanvas SVG: grid, pan/zoom, drag, putar, salin, hapus, undo/redo, terminal, belokan, warna dan label kabel.
- Sumber AC 1/3 fase dan DC; MCB 1–4P, sekering, RCCB, overload, PFR; kontaktor 1–4P.
- Tombol NO/NC, emergency stop, limit switch, MAN–OFF–AUTO, kontak NO/NC/tukar, coil, TON, TOFF dan impulse.
- Motor, heater, lampu, buzzer visual, solenoid, probe dan controller cold room.
- Engine mengikuti **graf kabel yang digambar**; menghapus sambungan mengubah hasil. Crossing tidak otomatis terhubung.
- Thermostat, differential, jeda restart compressor, defrost interval/manual, batas waktu/suhu, drip dan fan delay.
- Panel uji, riwayat, diagnostik dan gangguan fase, sensor, HP/LP, overload.
- Perhitungan arus, kW/kVA, starting, drop tegangan dan kandidat kabel Cu/PVC.
- Input ampere nameplate atau HP/PK **daya poros**, dengan efisiensi dan faktor daya eksplisit.
- Penyimpanan offline, import/export tervalidasi, akun terpisah, pemeriksaan revisi atomik, pilihan konflik.

## Pemetaan Jago Coffee

| Bagian | Interpretasi template |
| --- | --- |
| Kontaktor | K1 CDU, K2 heater, K3 fan mengikuti POWER. CONTROL asli menukar K2/K3. |
| MCB | M1 40 A; M2/M3 20 A; M4 4 A; M5/M6 2 A; control 4 A sesuai label gambar. Belum memvalidasi pemilihan rating. |
| F2 | NC 95–96 memutus common output controller: suplai relay compressor, heater dan fan ikut terputus. |
| CDU | Coil dan kontak F1 internal adalah asumsi; wiring internal outdoor tidak disediakan. |
| Tegangan | Asumsi 400/230 V, 50 Hz; label incoming asli tidak utuh. |
| PFR | T/S/R ke L1/L2/L3 mengikuti gambar. Pemeriksaan urutan fase belum diaktifkan sampai tipe PFR dikonfirmasi. |
| Controller | Model fungsional, bukan firmware ETC-974. Sensor 8/9/10 mengikuti block; anotasi 12/13/14 perlu verifikasi perangkat fisik. |
| Data mesin | Arus, watt heater, setelan overload dan panjang kabel belum disediakan. Nilai 0 berarti belum diketahui. |

PDF asli tidak diubah, tersedia di public/reference/ dan tab Referensi. Seluruh asumsi ikut disimpan di catatan project. Parameter suhu dan waktu controller adalah contoh latihan.

## Batas model

**Simulasi dan pemeriksaan awal, bukan persetujuan instalasi.** Tidak mengendalikan perangkat nyata. Kontak ideal, bukan SPICE atau studi proteksi tersertifikasi.

- Arus berasal dari input beban. Tidak menyelesaikan pembagian arus kabel paralel, impedansi sumber, arcing, transien/torsi motor atau unbalance.
- Suhu diubah pengguna; tidak ada model termodinamika ruangan/refrigerant.
- Trip MCB/overload adalah model pembelajaran. Short ideal menghentikan simulasi, tanpa angka Ik fiktif. Overload mengubah kontak bantu; rangkaian coil harus dirakit supaya daya motor terputus.
- PK kapasitas pendinginan **tidak** dikonversi langsung menjadi ampere. Mode cepat hanya menghitung setelah pengguna memastikan angka tersebut daya poros motor.
- Kabel: tabel Cu/PVC 1,5–25 mm², tidak ditanam, metode A2/B2/C. Koreksi suhu dan grouping konservatif. Uji awal Ib ≤ In ≤ Iz dan batas drop desain. Tidak ada kandidat jika seluruh ukuran gagal.
- Belum mengesahkan PUIL, ketahanan hubung singkat kabel, waktu pemutusan, selektivitas, harmonisa, ukuran PE, drop hulu saat start atau kode produk kontaktor/overload. Verifikasi final membutuhkan kondisi jalur, data mesin dan datasheet.

Acuan primer:

- [Schneider EIG: simplified cable sizing, Figure G21](https://www.electrical-installation.org/enwiki/Recommended_simplified_approach_for_cable_sizing)
- [Schneider: metode pemasangan dan faktor koreksi](https://www.electrical-installation.org/enwiki/General_method_for_cable_sizing)
- [Schneider: voltage drop](https://www.electrical-installation.org/enwiki/Calculation_of_voltage_drop_in_steady_load_conditions)

## Pengembangan

Node.js ≥22.13; pnpm mengikuti versi packageManager. React/TypeScript, Vinext/Vite dan SVG native. SQLite/D1 hanya untuk sinkronisasi akun.

    pnpm install --frozen-lockfile
    pnpm dev
    pnpm test
    pnpm typecheck
    pnpm lint
    pnpm build

Hosting cloud menggunakan Sites, binding D1 DB, migrasi schema-only di drizzle/, dan identitas dari gateway Sites. Hosting mandiri perlu mengganti adapter autentikasi dan mengikat SQLite/D1. **Jangan mempercayai header identitas dari klien pada hosting selain gateway terpercaya.** Tidak ada token GitHub atau rahasia di browser.

Jalankan pnpm db:generate setelah perubahan db/schema.ts. Hosting memproses migrasi yang dipaketkan bersama versi. Jangan memasukkan database lokal, kredensial atau build output ke Git.

Struktur inti:

| File | Fungsi |
| --- | --- |
| lib/circuit.ts | Format project dan katalog komponen |
| lib/simulator.ts | Graf koneksi dan engine kontrol |
| lib/templates.ts | Template Jago Coffee dan self-hold |
| lib/calculation.ts | Arus, KHA dan voltage drop |
| app/schematic.tsx | Editor SVG |
| app/studio.tsx | Ruang kerja dan panel uji |
| app/use-workspace.ts | Offline dan sinkronisasi |
| db/project-store.ts | Data per pemilik dan pemeriksaan revisi |

Pengujian otomatis mencakup wiring aktual, self-hold, pemutusan suplai, trip, fase, sensor, defrost, timer, rumus kabel, validasi berkas, konflik, perubahan saat upload dan isolasi pemilik database. Typecheck/build memeriksa integrasi source. Browser dan perangkat nyata merupakan pemeriksaan terpisah; unit test tidak berarti interaksi browser sudah diuji.

Repository dan PDF proyek bersifat privat. Tidak ada lisensi publik yang diberikan untuk materi proyek.
