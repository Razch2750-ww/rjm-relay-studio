# RJM Relay Studio

Editor wiring dan simulator kontrol listrik berbasis web, berbahasa Indonesia. Menggambar di PC/laptop, melihat dan menjalankan simulasi dari HP. Template mengikuti PDF proyek Jago Coffee, Lion Super Indo, dan DSV Solutions yang disediakan pemilik repository.

## Cara pakai

1. Buka aplikasi, lalu pilih **Proyek → Mulai dari wiring proyek**. Pilih **Cold storage · commissioning** untuk mencoba seluruh alur, atau panel Lion, DSV, Jago Coffee dan latihan START/STOP.
2. Pilih komponen di palet lalu klik kanvas, atau seret komponen ke kanvas.
3. Klik terminal asal lalu tujuan untuk menyambung kabel. Klik area kosong di antaranya untuk membuat belokan; Esc membatalkan.
4. Klik komponen untuk mengatur tag, keterangan dan parameter. Coil dan kontak dengan **tag sama** tertaut antarlembar Power/Control.
5. Tekan **Jalankan**. Klik sakelar/MCB untuk mengoperasikan. Tahan push button lalu lepaskan; Space/Enter juga tersedia.
6. Ubah suhu sensor di tray simulasi. Coba trip F1/F2, gangguan PFR, emergency stop dan HP/LP. Pilih sumber saat simulasi untuk mencoba kehilangan fase.
7. Buka **Front Panel** untuk menekan tombol fisik, **Panel Internal** untuk layout dalam mm, dan **Simulation** untuk parameter, fault, wiring checker, 13 scenario tests, multimeter serta laporan.
8. **Unduh project** menghasilkan JSON yang dapat diimpor sebagai project baru. **SVG/PNG** mengunduh gambar aktif; tombol printer membuka cetak/PDF. **BOM & laporan** menyediakan tiga schedule Excel (SpreadsheetML XML) dan laporan simulasi PDF melalui dialog cetak.
9. **Sinkronkan** menyimpan project ke akun ChatGPT pada website privat. Konflik: pakai lokal, pakai akun, atau simpan keduanya. Gunakan ekspor JSON sebagai cadangan tambahan.

Project tersimpan di browser perangkat. Setelah aplikasi memuat aset dan menampilkan **Offline siap**, halaman dapat dibuka lagi tanpa jaringan. Sinkronisasi memerlukan koneksi dan sesi akun. Unduh project sebagai cadangan sebelum menghapus data browser. PDF acuan memerlukan jaringan jika belum tersimpan di browser.

## Fitur

- Lima tampilan dari project yang sama: Power, Control, Front Panel, Panel Internal, dan Simulation. Tambah/rename lembar wiring; kontak/coil bertag sama tertaut antarlembar.
- Kanvas SVG terang: grid, pan/zoom, snap alignment, minimap, drag, putar, salin, undo/redo, kabel ortogonal dan belokan manual. Panel atas/bawah/kiri/kanan bisa diminimalkan. Posisi label mengikuti rotasi; huruf tetap terbaca dan keterangan ditempatkan menjauhi kabel.
- 70 komponen: sumber AC/DC, trafo, MCB/MCCB/RCCB, overload, PFR, kontaktor, kontak bantu, selector 4 terminal, tombol, timer delay/interval/mingguan, motor, heater, lampu, buzzer, controller ETC-974/XR70CX, HP/LP, probe, terminal dan meter.
- Engine mengikuti **graf kabel yang digambar**, termasuk pemutusan aktual coil dan interlock. Crossing tanpa junction tidak terhubung. Simulasi dan pengujian skenario berjalan di Web Worker.
- Arus nameplate atau estimasi HP/PK daya poros, LRA/start, arus fase/netral, kW/kVA/PF; jaringan konduktor resistif, pembagian arus jalur paralel, drop tegangan dan pemanasan kabel.
- Proteksi thermal/magnetic, overload manual/auto reset, urutan/kehilangan fase, voltage fault, welded contact, locked rotor, HP/LP dan gangguan kabel. Short-circuit memerlukan Isc sumber.
- Thermostat, anti-short-cycle, defrost/drip/fan delay, jadwal mingguan, override, serta model suhu cold room dengan probe room/evaporator.
- Layout fisik mm: perangkat yang sama dengan skematik, DIN rail, cable duct, snap, rotasi, pemeriksaan tumpang tindih dan pemakaian ruang.
- Wiring checker, 13 scenario tests, multimeter virtual, event log, BOM/cable/terminal schedule, laporan simulasi, SVG/PNG dan cetak PDF.
- Project lama tetap kompatibel. Offline, import/export tervalidasi, akun terpisah, pemeriksaan revisi dan pilihan resolusi konflik.

Panduan model, asumsi dan cara mencoba: [docs/engineering-model.md](docs/engineering-model.md). Spec pengembangan tersimpan di [docs/engineering-spec.md](docs/engineering-spec.md); batas model di bawah tetap berlaku.

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

**Simulasi dan pemeriksaan awal, bukan persetujuan instalasi.** Tidak mengendalikan perangkat nyata. Kontak ideal, model motor arus dan jaringan kabel resistif; bukan SPICE atau studi proteksi tersertifikasi.

- Kurva thermal/magnetic dan panas kabel adalah pendekatan dengan konstanta yang dapat diatur, bukan kurva pabrikan atau kelas trip IEC tersertifikasi. Overload memutus kontak bantu; coil harus benar-benar terhubung agar motor berhenti.
- Arus start menggunakan LRA/faktor dan durasi; belum menghitung torsi, slip, harmonisa atau transien elektromagnetik. PK kapasitas pendinginan tidak dikonversi langsung menjadi ampere.
- Short memakai Isc prospektif sumber dan resistansi satu loop. Nilai Isc yang belum diketahui atau breaking capacity yang tidak cukup menghentikan simulasi dengan diagnostik. Belum ada studi selektivitas atau I²t kabel.
- Suhu ruangan memakai neraca energi sederhana; suction/discharge adalah input virtual, bukan hasil siklus refrigeran.
- Kabel live: Cu/PVC 1,5–50 mm², tabel tiga konduktor berbeban G20, metode A2/B2/C. Al/XLPE/ukuran lain memerlukan ampacity datasheet. Mode advanced memakai koreksi suhu dan grouping; mode simple memakai kapasitas dasar. Kalkulator terpisah mempertahankan tabel konservatif G21 1,5–25 mm².
- PASS menyatakan respons skenario yang diuji; WARNING menyatakan prasyarat belum terpenuhi. Wiring checker tidak mengesahkan PUIL, pemilihan PE, pemutusan gangguan atau instalasi nyata.

Acuan primer dan rumus tercantum dalam [dokumentasi model](docs/engineering-model.md). Data nameplate, metode pemasangan dan datasheet perangkat diperlukan untuk desain final.

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
| lib/simulator.ts + lib/engine/ | Graf, arus, proteksi, refrigerasi, gangguan dan skenario |
| lib/cold-room-template.ts | Contoh commissioning dengan 63 komponen / 124 konduktor |
| lib/panel-layout.ts + app/panel-designer.tsx | Layout fisik mm dan kontrol panel |
| lib/reports.ts + app/engineering.tsx | Meter, diagnostik, skenario dan laporan |
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
