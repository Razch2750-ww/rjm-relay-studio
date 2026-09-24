# Engineering model & commissioning

RJM Relay Studio memakai satu project untuk wiring, layout panel, dan simulasi. Ini model latihan dan pemeriksaan awal; data pabrikan tetap diperlukan untuk pemilihan perangkat dan persetujuan instalasi.

## Mencoba versi ini

1. Pilih **Proyek → Cold storage · commissioning**. Contoh baru tidak menimpa project lama. Contoh ini berisi 63 komponen dan 124 konduktor dengan parameter latihan, bukan revisi dari PDF pelanggan.
2. Pilih **Jalankan**. Buka **Front Panel**; selector dan emergency stop mengubah perangkat yang sama dengan wiring Power/Control. Lampu dan controller mengikuti hasil engine.
3. Buka **Simulation → Parameter** untuk melihat arus fase/netral, daya, thermal proteksi, suhu dan jam virtual. Kecepatan 1/5/10/60× memperbesar langkah virtual; kecepatan nyata dibatasi kemampuan perangkat.
4. **Fault simulator** mengaktifkan gangguan. **Check wiring** memeriksa kondisi saat itu; klik temuan untuk menuju komponen/kabelnya. Uji start, running dan mode lain secara terpisah.
5. **Scenario tests → Jalankan semua skenario** memakai salinan project dan menyimpan hasil ke project. PASS = respons yang disebutkan tercapai; WARNING = prasyarat tidak terpenuhi; FAIL = respons/interlock yang diharapkan tidak tercapai. Ini tidak membuktikan semua kemungkinan rangkaian aman.
6. **Multimeter**: pilih pasangan terminal untuk voltase; pilih satu konduktor untuk clamp. Matikan seluruh sumber sebelum continuity/resistance.
7. **BOM & laporan**: simpan snapshot, unduh tiga schedule Excel, atau buka laporan lalu **Cetak / Simpan PDF**. Gambar aktif juga dapat diunduh sebagai SVG/PNG atau dicetak. Excel memakai SpreadsheetML `.xml`, bukan `.xlsx`.

Project autosave menyimpan komponen, kabel, lembar, layout mm, parameter ruang, hasil skenario dan snapshot yang disimpan. Jeda simulasi menyimpan snapshot; **Unduh project** juga menyertakan hasil runtime saat sudah berjalan. Project tidak melanjutkan transien engine persis setelah dibuka kembali; simulasi dimulai ulang. Simpan/ekspor sebelum menghapus data browser.

## Koneksi dan penyelesaian engine

- Graf dibuat dari terminal dan kabel aktual. Crossing adalah garis bersilangan; junction adalah sambungan. Kontak/coil berhubungan lewat tag, bus antarlembar lewat nama net. Kabel langsung antarlembar ditolak saat validasi.
- Kontak ideal membuka/menutup berdasarkan state dan coil. Iterasi logika dibatasi 40; keadaan tidak konvergen menghasilkan diagnostik. Integrasi waktu menggunakan substep paling besar 100 ms.
- Sumber tiga fase memakai sudut R=0°, S=−120°, T=120°. Neutral menjumlahkan arus secara fasor. Jaringan kabel resistif diselesaikan secara nodal untuk arus cabang, jalur paralel dan drop tegangan. Impedansi kontak numerik yang sangat kecil menjaga sistem persamaan; tidak dimaksudkan sebagai resistansi kontak pabrikan.
- Beban tiga fase diasumsikan seimbang. Model tidak menghitung harmonisa, induktansi jalur, kapasitansi, saturasi, arcing, torsi atau transien elektromagnetik. Trafo adalah rasio tegangan dengan sekunder terisolasi; rugi inti/winding tidak dimodelkan.

## Motor dan daya

Arus nameplate yang positif selalu diprioritaskan. Jika arus belum tersedia, mode `quick` memakai HP/PK **daya poros**:

`I = HP × konversi watt / (V × faktor fase × PF × efisiensi)`

Konversi: HP=745,7 W; PK=735,5 W. Faktor fase = √3 untuk tiga fase, 1 untuk satu fase/DC. Kapasitas pendinginan bukan daya poros; pilihan `cooling` menolak estimasi ampere tersebut.

Start memakai LRA, atau arus nominal × faktor start, selama durasi yang ditentukan. Model DOL memakai nilai penuh; star-delta memakai sepertiga arus start dan soft-start membatasi hingga tiga kali arus nominal. Pada motor 3 terminal ini hanya pendekatan arus; gunakan Motor 3 fase · star–delta untuk sambungan enam terminal. Ramp motor fisik tidak dihitung. Locked rotor mempertahankan kondisi start. Arus start mengikuti rasio tegangan; running memakai pendekatan daya konstan dengan batas tegangan minimum numerik.

`fanCount` menggandakan beban fan identik. Untuk nameplate/kerusakan fan yang berbeda, buat komponen terpisah. kW mencakup beban dan konsumsi kontrol; kVA dan PF dihitung dari hasil arus kompleks.

## Proteksi dan gangguan

Thermal proteksi memakai state panas `H`:

- Bila `I/Ir > 1`: `ΔH = ((I/Ir)² − 1) × Δt / thermalSeconds`.
- Bila tidak overload: panas berkurang `Δt / coolingSeconds`.
- Trip pada H≥1. Magnetic breaker menggunakan batas model B=5×, C=10×, D=20× Ir atau setelan adjustable.
- Breaker latch sampai di-reset setelah cukup dingin. Overload dapat manual/auto reset saat panas ≤20%. Overload membuka kontak bantu NC dan menutup NO; power pole tetap konduktif. Tanpa wiring pemutus coil, motor bisa tetap menyala dan skenario harus menunjukkan kegagalan.

Konstanta ini tidak identik dengan trip class IEC atau kurva waktu-arus produk. RCCB menggunakan kebocoran yang dimasukkan/injeksi; belum menghitung arus bocor fisik dari jaringan PE.

PFR membaca fase, urutan, tegangan, imbalance dan delay dari terminal. HP/LP memakai cut-out/cut-in, hysteresis, jenis kontak serta mode reset. Fault mencakup phase loss/reversal, under/overvoltage, neutral putus, coil open, welded contact, motor overload/locked, probe putus, controller gagal, breaker trip dan jalur kabel.

Fault overload motor/kabel memakai pengali 3× beban terkait. Overload kabel menelusuri beban melalui jalur graf; rangkaian paralel kompleks tidak setara studi fault lengkap. Kabel loose menambahkan 2 Ω sebagai gangguan demonstrasi; nilai ini bukan karakteristik sambungan tertentu.

Short memakai **Isc prospektif sumber** serta resistansi jalur satu loop. Isc sumber yang kosong atau breaking capacity yang kurang menghasilkan penghentian dan diagnostik. Ini belum mencakup kontribusi motor, X/R, komponen DC, bus multi-sumber, selektivitas atau I²t kabel. Nilai sumber contoh 6 kA adalah input latihan.

## Kabel

Setiap wire adalah satu konduktor listrik. `cores` adalah metadata schedule; tidak otomatis menambah konduktor ke graf.

Resistansi memakai `ρ × panjang / luas` dengan Cu 0,017241 dan Al 0,028264 Ω·mm²/m, koreksi suhu model 0,00393/°C, serta resistansi tambahan. Arus aktual dan resistansi digunakan untuk drop jaringan.

Kapasitas dasar live memakai Schneider EIG G20 / IEC B.52.4 untuk tiga konduktor berbeban, Cu/PVC, metode A2/B2/C dan ukuran 1,5–50 mm². Al, XLPE dan ukuran di luar tabel memerlukan `ampacity` dari datasheet. Override ini harus berupa kapasitas dasar yang sesuai pemasangan. Mode `advanced` mengalikan faktor suhu (dibulatkan konservatif ke baris suhu berikutnya) dan grouping; mode `simple` memakai kapasitas dasar tanpa koreksi itu. Di suhu yang tidak didukung tabel PVC, kapasitas dianggap nol.

Kalkulator **Hitungan** mempertahankan tabel konservatif G21 1,5–25 mm² dan tidak identik dengan pilihan tabel live. Jangan menyamakan kandidat kalkulator dengan rating kabel yang sudah diverifikasi pada kondisi lapangan.

Suhu kabel menuju `ambient + (batas insulasi − ambient) × (I/Iz)²` dengan konstanta waktu model 120 s. Batas PVC=70°C, XLPE=90°C. Status SAFE/WARNING/UNDERSIZED/DANGEROUS berasal dari utilisasi dan suhu model. OVERSIZED berarti utilisasi sangat rendah, bukan larangan ukuran tersebut. Kabel panas tidak memutus dirinya; breaker yang terhubung menentukan trip.

## Cold room dan kontrol

Ruang tunggal memakai neraca energi antara panas envelope, beban lain, pintu, heater dan pendinginan. Massa udara dan produk memberi kapasitas panas. Pendinginan tersedia jika compressor dan fan evaporator ON, dibatasi nilai terkecil kapasitas compressor/evaporator. Suhu evaporator memakai respons orde satu 60 s. Belum ada model refrigeran, kelembapan, es, superheat/subcooling atau beberapa ruang independen.

Probe harus terhubung fisik ke input controller. Isi **Probe thermal ruangan** dengan `room` atau `evaporator`; kosong untuk suhu manual. HP/LP dapat mengikuti suction/discharge virtual yang diubah pengguna. Tekanan tidak dihitung dari siklus refrigerasi.

Controller mencakup thermostat/differential, jeda restart, defrost waktu/suhu/manual, drip, fan delay dan alarm dasar. Timer mingguan memakai hari 1–7 dan interval termasuk lintas tengah malam; override AUTO/ON/OFF mengubah permintaan timer. Semua output tetap memerlukan suplai common dan wiring kontak yang benar. Model ETC-974/XR70CX adalah fungsi latihan, bukan firmware pabrikan.

## Panel, meter dan laporan

Front/Internal memakai referensi node project yang sama. Posisi/dimensi/rotasi disimpan dalam mm; snap 5 mm. Pemeriksaan layout mencakup batas enclosure dan tumpang tindih perangkat. DIN rail dan duct adalah elemen layout; belum menghitung bending radius, duct fill atau clearance wajib pabrikan.

Voltmeter mengukur beda potensial dengan referensi sumber yang sama; terminal floating/terisolasi menghasilkan OL. Clamp menunjukkan arus satu konduktor. Resistance membaca jalur konduktor yang ditemukan graf; bukan resistansi ekuivalen paralel, winding atau pengujian insulasi. Continuity hanya diizinkan saat seluruh sumber OFF.

BOM mengelompokkan perangkat berdasarkan tag, dengan brand/model/rating yang dimasukkan. Coil/kontak bertag sama mewakili satu perangkat; aksesori tambahan perlu item tersendiri. Cable/terminal schedule serta laporan memakai project dan snapshot yang sama. Brand default Custom tidak mengklaim SKU pabrikan.

## Penyimpanan dan kompatibilitas

Format project versi 1 dipertahankan; data engineering bersifat opsional agar project lama tetap terbuka. Validasi mencakup referensi terminal/layout dan batas 500 komponen, 2.000 wire, serta berkas impor 2 MB. PDF asli dan template pelanggan dipertahankan beserta catatan interpretasinya.

Status **Offline siap** baru muncul setelah halaman, aset dan worker tersimpan. Sinkron akun memerlukan koneksi. Website Sites memakai D1 persisten; checkout GitHub standalone masih memakai Map per proses sesuai adapter sebelumnya. Lihat README checkout masing-masing sebelum hosting mandiri.

## Acuan primer

- [Schneider EIG: General method for cable sizing — G20 dan faktor koreksi](https://www.electrical-installation.org/enwiki/General_method_for_cable_sizing)
- [Schneider EIG: Recommended simplified approach — G21](https://www.electrical-installation.org/enwiki/Recommended_simplified_approach_for_cable_sizing)
- [Schneider EIG: Voltage drop in steady load](https://www.electrical-installation.org/enwiki/Calculation_of_voltage_drop_in_steady_load_conditions)
- [Schneider Electric: Miniature circuit breakers dan rentang magnetic B/C/D](https://blog.se.com/buildings/retail/2018/12/18/what-are-miniature-circuit-breakers-mcbs/)

Nilai tabel dan batas magnetic diverifikasi saat pengembangan. Rumus thermal, model room, start motor dan injeksi fault di atas adalah definisi pendekatan aplikasi, bukan kutipan standar.


## Kabel otomatis dan penyuntingan ortogonal

- Kanvas skematik memakai latar hitam. Warna R merah, S kuning, T putih, N biru, PE hijau tetap sama saat OFF, ON, dipilih, dan diekspor. Garis putus bergerak hanya ketika simulasi berjalan **dan arus kabel bukan nol**; ini indikator arus, bukan arah sesaat AC. Preferensi reduced motion menghentikan geraknya.
- Skematik memakai satu grid snap 20 unit, jarak antar-pin dalam baris 40 unit dan radius pin 3,5 unit. Posisi pin tetap masuk grid setelah rotasi 90°. Lebar simbol mengikuti jumlah pin; konektor/junction lebih ringkas. Posisi komponen lama dibulatkan ke grid ketika dibuka; ini tidak mengubah ukuran fisik panel.
- Router memakai ruas horizontal/vertikal pada grid yang sama. Kabel pada net fisik yang sama boleh berbagi ruas; warna fase yang sama saja tidak cukup. Kontak MCB/kontaktor tetap memisahkan net di kedua sisinya. Persilangan antar-net digambar dengan lengkungan, tanpa mengubah sambungan listrik. Belokan manual dipertahankan jika tidak memotong label atau kabel lain; kendala yang terhalang diarahkan ulang.
- Klik **Pick point**, lalu klik ruas kabel, atau klik dua kali kabel. Titik bulat menjadi terminal cabang; klik titik itu lalu terminal tujuan. Kabel dari terminal juga bisa diakhiri langsung pada ruas kabel. Ruas asli dibagi dua, dengan total panjang fisik dan resistansi sambungan tetap. Ukuran/material/mode manual dipertahankan; ukuran otomatis boleh dihitung ulang sesuai beban baru. Undo/Redo, ekspor/impor dan sinkron menyimpan titik beserta kabelnya. Pick point bukan perangkat tambahan di BOM.
- Overload daya hanya menampilkan 1–2 / 3–4 / 5–6. Pilih overload lalu **Tambah NC 95–96** atau **Tambah NO 97–98**, atau ambil kontak terpisah dari katalog dan pilih tag overload. Kontak bisa dipindahkan sendiri. Wiring v1 yang menggunakan 95/96/97/98 pada simbol utama dimigrasikan ke kontak terpisah dengan tag sama. Kontak bantu generik bertag overload pada contoh lama tetap berfungsi.
- Label komponen ditempatkan dekat simbol terlebih dahulu; kabel menghindari ruang label. Label tidak dikumpulkan pada kolom jauh. Diagram yang komponen-komponennya sengaja saling menutupi tetap perlu dirapikan pengguna.
- Pilih kabel, gunakan **Tambah belokan**, kemudian tarik pegangan ruas atau gunakan tombol panah. Ujung terminal tetap; perubahan disimpan ke project dan dapat di-undo. **Rapikan belokan otomatis** menghapus kendala manual. Garis pratinjau juga selalu ortogonal.
- Kabel baru menggunakan ukuran otomatis. Kabel lama yang sudah mempunyai spesifikasi tanpa penanda mode tetap dianggap manual, agar ukuran pekerjaan lama tidak diam-diam berubah. **Ukuran otomatis semua kabel** mengaktifkan perhitungan project. Mengedit angka penampang mengubah kabel tersebut ke mode Manual.
- Grafik perencanaan menelusuri semua kemungkinan kontak dan koneksi antar-sheet, terpisah dari keadaan ON/OFF simulasi. Arus nominal motor (termasuk jumlah fan), nameplate/HP poros, daya heater/lampu, VA coil, dan beban penuh primer trafo membentuk Ib. Model controller memakai konsumsi 3 VA. Konsumsi PFR tanpa datasheet, HP pendinginan, sumber bertentangan, terminal beban terputus, atau beban tidak diketahui tidak menghasilkan rekomendasi. Label **AUTO?** dan inspektor menunjukkan data yang perlu dilengkapi; ukuran terakhir tetap menjadi nilai simulasi, tidak dianggap sudah tervalidasi.
- Feeder menerima jumlah arus desain cabangnya tanpa diversity. Satu blok kabel paralel/cyclic memakai seluruh beban terkait, tanpa menganggap pembagian arus sama; hasil bisa lebih besar daripada kebutuhan operasi sesungguhnya. Netral memakai jumlah konservatif dan rating pengaman fase terkait, bukan cancellation fase seimbang.
- Pemilihan otomatis memakai tabel Cu/PVC tiga konduktor berbeban, metode A2/B2/C, 1,5–50 mm² dengan koreksi ambient dan grouping. Pilih penampang terkecil dengan Iz terkoreksi >= max(Ib, In). Arus di atas setelan pemutus tetap diberi peringatan. Ukuran tidak mengikuti lonjakan start sesaat. Al, XLPE, penampang di luar tabel, dan input ampacity datasheet memerlukan pemilihan manual; satu ampacity datasheet tidak diekstrapolasi menjadi tabel beberapa ukuran.
- Pemeriksaan drop menjumlahkan resistansi kabel fisik seluruh jalur feeder dan kembali pada 70 °C, dengan arus desain total setiap ruas dan tambahan upstream drop dari kalkulator. Untuk tiga fase dipakai jumlah dua drop konduktor terbesar, konservatif terhadap model resistif. Kabel auto dinaikkan bertahap sampai batas project (awal 3%) atau batas tabel tercapai. Ukuran manual tidak diubah; sisa kelebihan drop ditampilkan. Ini model resistif, bukan analisis reaktansi atau transien starting.
- PE Cu otomatis mengikuti penampang fase terbesar yang terkait di seluruh jalurnya, tanpa pengurangan, minimum 4 mm² dengan asumsi PE terpisah tanpa perlindungan mekanis. Ini pilihan konservatif, bukan pemeriksaan adiabatik, loop gangguan tanah, atau waktu pemutusan. Kabel sensor/sinyal tanpa data beban tetap membutuhkan ukuran manual.
- Label komponen membedakan setelan proteksi, rating kontak, arus nominal, estimasi HP, dan konsumsi model. Rating yang belum ada ditampilkan sebagai `— A`, bukan angka pabrikan yang dibuat-buat. Label ampere dan mm² menggunakan area bebas garis dan ikut batas ekspor.

Rujukan: [Schneider — general cable sizing](https://www.electrical-installation.org/enwiki/General_method_for_cable_sizing), [Schneider — protective earthing conductor](https://www.electrical-installation.org/enwiki/Sizing_of_protective_earthing_conductor). Hasil sizing adalah bantuan desain berbasis input dan batas model di atas; koordinasi proteksi, kondisi lapangan, serta data pabrikan tetap diperiksa terpisah.
