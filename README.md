# RJM Relay Studio

Editor wiring dan simulator kontrol listrik berbasis web, berbahasa Indonesia. Menggambar di PC/laptop, melihat dan menjalankan simulasi dari HP. Template mengikuti PDF proyek Jago Coffee, Lion Super Indo, dan DSV Solutions yang disediakan pemilik repository.

## Cara pakai

1. Buka aplikasi, lalu pilih **Proyek → Mulai dari wiring proyek**. Pilih panel Lion, DSV, Jago Coffee, atau latihan START/STOP.
2. Pilih komponen di palet lalu klik kanvas, atau seret komponen ke kanvas.
3. Klik terminal asal lalu tujuan untuk menyambung kabel. Klik area kosong di antaranya untuk membuat belokan; Esc membatalkan.
4. Klik komponen untuk mengatur tag, keterangan dan parameter. Coil dan kontak dengan **tag sama** tertaut antarlembar Power/Control.
5. Tekan **Jalankan**. Klik sakelar/MCB untuk mengoperasikan. Tahan push button lalu lepaskan; Space/Enter juga tersedia.
6. Ubah suhu sensor di tray simulasi. Coba trip F1/F2, gangguan PFR, emergency stop dan HP/LP. Pilih sumber saat simulasi untuk mencoba kehilangan fase.
7. **Unduh project** menghasilkan JSON yang dapat diimpor sebagai project baru. **SVG** mengunduh gambar aktif; tombol printer membuka cetak/PDF.
8. **Sinkronkan** membutuhkan host dengan sesi akun ChatGPT. Konflik: pakai lokal, pakai akun, atau simpan keduanya. Backend standalone saat ini sementara: gunakan ekspor JSON sebagai cadangan permanen.

Project tersimpan di browser perangkat. Setelah aplikasi memuat aset dan menampilkan **Offline siap**, halaman dapat dibuka lagi tanpa jaringan. Sinkronisasi memerlukan koneksi dan sesi akun. Unduh project sebagai cadangan sebelum menghapus data browser. PDF acuan memerlukan jaringan jika belum tersimpan di browser.

## Fitur

- Kanvas SVG: grid, pan/zoom, drag, putar, salin, hapus, undo/redo, terminal, belokan, warna dan label kabel.
- Sumber AC 1/3 fase dan DC; MCB 1–4P, sekering, RCCB, overload, PFR; kontaktor 1–4P.
- Tombol NO/NC, emergency stop, limit switch, MAN–OFF–AUTO, selector 1–0–2, kontak NO/NC/tukar, coil, TON, TOFF, impulse dan timer pergantian berulang.
- Motor/evaporator/compressor 1 atau 3 fase, heater, lampu, buzzer visual, solenoid, probe, controller ETC-974 dan XR70CX dengan pemetaan terminal berbeda.
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

## Template Lion Super Indo dan DSV

| Template | Halaman PDF | Perilaku utama |
| --- | --- | --- |
| Lion · Distribusi SDP | 2–3 | MCCB 200 A, 12 feeder, showcase R/S/T/N dan waterloop S–N |
| Lion · Water pump | 5–7 | 3 dry cooler, 2 pump, MAN/OFF/AUTO, selector 1–0–2, timer dan delay |
| Lion · Freezer & chiller | 9–11 | Dua XR70CX, waterloop/fan/heater satu fase, kontrol independen |
| Lion · Chiller | 13–15 | Satu XR70CX, pemetaan tag mengikuti power |
| DSV · Dua CDU 8 HP | 2–4 | Dua ETC-974, pergantian AUTO, MAN per unit, emergency bersama |

**Temuan yang ikut dimodelkan:** COM6 defrost pada kedua gambar kontrol Lion tidak terlihat tersuplai. Template mempertahankan terminal kosong itu; menekan defrost tidak otomatis menyalakan heater. DSV memiliki konflik main **60 A pada power / 80 A pada layout**; template memakai label power 60 A. KP1 water pump Lion hanya berada di jalur MAN; AUTO melewatinya sesuai gambar.

Catatan lengkap, normalisasi tag, pemetaan halaman dan skenario mencoba tersedia di [docs/panel-mapping.md](docs/panel-mapping.md). Tab Referensi membuka halaman yang sesuai dengan template aktif. PDF sumber dipertahankan byte demi byte; checksum tersimpan di [docs/source-pdfs.json](docs/source-pdfs.json).

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

Node.js ≥22.13; React/TypeScript, Next.js standalone dan SVG native. Gunakan checkout terbaru; backend mengikuti perubahan standalone di commit `b95255d`.

    npm install
    npm run dev
    npm test
    npm run typecheck
    npm run build

Versi standalone memakai **Map dalam proses server**, dipisahkan per pemilik dengan pemeriksaan revisi sebelum update/delete. Data server hilang ketika proses restart dan tidak dibagi antar-instance; ini belum memenuhi sinkronisasi cloud permanen. Data offline tetap di browser. Adapter `db/project-store.ts` perlu penyimpanan persisten sebelum digunakan sebagai cadangan akun produksi.

Autentikasi yang ada masih bergantung pada gateway ChatGPT/Sites. Hosting mandiri membutuhkan adapter autentikasi tepercaya; **jangan mempercayai header identitas dari klien**. Konfigurasi/migrasi Sites lama tetap tersimpan sebagai konteks deployment sebelumnya dan tidak dijalankan oleh `next build`. Tidak ada token GitHub di browser. Jangan memasukkan database lokal, kredensial atau build output ke Git.

Struktur inti:

| File | Fungsi |
| --- | --- |
| lib/circuit.ts | Format project dan katalog komponen |
| lib/simulator.ts | Graf koneksi dan engine kontrol |
| lib/templates.ts | Template Jago Coffee dan self-hold |
| lib/panel-templates.ts | Lima panel dari PDF Lion dan DSV |
| lib/project-presets.ts | Pilihan template dan tautan PDF per halaman |
| lib/calculation.ts | Arus, KHA dan voltage drop |
| app/schematic.tsx | Editor SVG |
| app/studio.tsx | Ruang kerja dan panel uji |
| app/use-workspace.ts | Offline dan sinkronisasi |
| db/project-store.ts | Data per pemilik dan pemeriksaan revisi |

Pengujian otomatis mencakup wiring aktual, self-hold, pemutusan suplai, trip, fase, sensor, defrost, timer, rumus kabel, validasi berkas, konflik, perubahan saat upload dan isolasi pemilik database. Typecheck/build memeriksa integrasi source. Browser dan perangkat nyata merupakan pemeriksaan terpisah; unit test tidak berarti interaksi browser sudah diuji.

Repository dan PDF proyek bersifat privat. Tidak ada lisensi publik yang diberikan untuk materi proyek.
