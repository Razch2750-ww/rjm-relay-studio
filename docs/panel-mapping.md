# Pemetaan wiring Lion Super Indo dan DSV Solutions

Penelusuran dari dua PDF unggahan pemilik repository. PDF asli dipertahankan; diagram simulator digambar ulang menjadi komponen, terminal, dan kabel yang bisa diedit. Ini model fungsional untuk memeriksa logika gambar, bukan gambar instalasi yang telah disahkan.

## Cara mencoba

Pilih **Proyek**, lalu salah satu template. Klik **Jalankan**, buka **Panel uji**, operasikan selector atau sakelar. Inspektor komponen menampilkan rating, tag dan parameter. Klik **Jeda** untuk mengubah setelan timer; **Reset simulasi** mengembalikan seluruh keadaan runtime.

| Template | Coba | Hasil yang dimodelkan |
| --- | --- | --- |
| SDP | Buka M6 | Showcase PAJU 2 dan waterloop-nya padam; cabang lain tetap tersuplai |
| Water pump | Jalankan AUTO | Pump 1 setelah delay 2 s; pada 60 s pindah ke pump 2 setelah delay 2 s; tiga fan independen |
| Water pump | MAN, pilih 1/0/2 | Pump pilihan aktif; 0 memutus kedua pump; KP1 memutus jalur MAN |
| Water pump | Ganggu KP1 saat AUTO | AUTO tetap dapat berjalan, karena KP1 hanya berada pada jalur MAN di gambar |
| Freezer/chiller | Trip overload fan freezer | Common output fan/comp freezer terputus, chiller tetap bekerja |
| Lion XR70CX | Tekan defrost manual | Status controller DEFROST, compressor/fan OFF, heater tetap OFF karena COM6 kosong |
| DSV | Jalankan AUTO | Timer NC memilih mesin 1, NO memilih mesin 2; controller/sensor tiap mesin tetap menentukan beban |
| DSV | Kedua selector MAN | Kedua mesin dapat aktif bersamaan; MAN melewati timer, bukan melewati controller |
| DSV | Emergency | Seluruh kontrol mesin 1 dan 2 padam |
| Panel dengan PFR | Pilih sumber, hilangkan R/S/T | PFR melepas dan semua coil beban yang dikontrol padam |

Suhu awal dan seluruh waktu merupakan contoh. Timer berulang 60/60 s tidak meniru jadwal kalender Theben. Delay 2 s menggambarkan fungsi yang diasumsikan dari TDR; durasi dan tipe kontak aslinya belum tertulis lengkap.

## Temuan pada sumber

| Sumber / halaman | Temuan | Pilihan pada template |
| --- | --- | --- |
| Lion 2–3 | MC1 200 A 3P; feeder ke water pump 40 A, FZ/CH 40 A, CH 32 A | Breaker ideal; keluaran tiga panel berakhir pada terminal, tidak terhubung lintas project |
| Lion 2 | Cabang waterloop MUAN/PAJU/MAPO mengambil S setelah MCB showcase yang sama | Dua beban terpisah per MCB; waterloop S–N dan showcase ekuivalen R/S/T/N |
| Lion 3 | MCB control 2 A tampak pada layout, tanpa sheet penelusuran control SDP | Tidak mengarang sambungan; indikator fase Panel uji membaca net bus |
| Lion 5–6 | Pump 2 F5 pada power, F4 berulang pada control | F5 digunakan untuk overload dan kontak pump 2 |
| Lion 6 | KP1 hanya pada MAN; TDR1/2 tergambar tanpa rangkaian coil/kontak lengkap | KP1 tetap hanya MAN; terminal coil dan kontak NO TDR dilengkapi sebagai asumsi fungsional yang diberi label |
| Lion 7 | Tambahan MCB kecil pada layout tanpa penelusuran control lengkap | Tidak membuat cabang tambahan berdasarkan tebakan |
| Lion 9–10 | Fan freezer/chiller F3/F4 pada power; F2 digandakan pada control | Gunakan F3/F4; K1/K2 waterloop, K3/K4 fan, K5/K6 heater |
| Lion 13–14 | Power K1 waterloop, K2 fan, K3 heater; control K1/K3/K5 | Gunakan K1/K2/K3 pada seluruh komponen terkait |
| Lion 10 dan 14 | Terminal COM6 defrost tidak terlihat memiliki kabel suplai | Pertahankan kosong. Menambahkan suplai membutuhkan keputusan eksplisit pengguna setelah verifikasi gambar/perangkat |
| Lion 9 dan 13 | Cabang beban mengambil fase R dan netral, walaupun main 3P | Beban dan MCB cabang satu fase; tidak membagi fase secara otomatis |
| Lion incoming | Tertulis 380/230 V, sementara 380/√3 = 219,4 V | Model sumber ideal memakai 380 V antar-fase; angka 230 V adalah nominal komponen |
| DSV 2 vs 4 | Main 60 A vs 80 A | Pakai 60 A yang tertulis di power dan tampilkan konflik; bukan rekomendasi proteksi |
| DSV 3 | Timer NC/NO, dua MAN/AUTO, satu emergency | Timer fungsi bergantian; MAN masing-masing unit; emergency bersama |
| DSV 3 vs 4 | Dua HP/LP fault di control, satu indikator HP/LP pada layout | Tampilkan diagnostik per unit, tidak mengklaim reproduksi pintu panel persis |
| DSV 2 | CDU bertuliskan 8 HP tanpa arus nameplate atau basis daya | Kalkulator meminta kejelasan basis; tidak menerbitkan ukuran kabel hanya dari angka tersebut |

## Terminal controller

Pemetaan mengikuti blok pada PDF unggahan. Varian perangkat fisik dan nomor terminal aktual perlu dicocokkan dengan perangkat; model ini tidak mengemulasi firmware pabrikan.

| Fungsi | ETC-974 pada DSV | XR70CX pada Lion |
| --- | --- | --- |
| Common fan / compressor | 1 | 1 |
| Compressor | 4 | 3 |
| Fan | 5 | 2 |
| Common defrost | 1, bersama output lain | 6, terpisah |
| Defrost / NC | 2 / 3 | 7 / 8 |
| Supply L / N | 6 / 7 | 4 / 5 |
| Sensor evaporator | 8–9 | 10–11 |
| Sensor ruang | 9–10 | 11–12 |
| Tidak dipakai | — | 9 |

DSV memiliki anotasi sensor 12/13/14 di bawah blok bernomor 8/9/10; template mengikuti angka pada blok. Lion menggunakan TB10/11/12 untuk sensor setiap controller. TB01–05 dipakai HP/LP, perintah compressor, dan fault; TB06–09 cadangan. DSV memakai TB01–05 untuk mesin 1, TB06–07 cadangan, TB08–12 untuk mesin 2.

## Batas data dan implementasi

- Arus, daya heater, panjang kabel, setelan overload, jadwal aktual Theben, dan setelan TDR belum tersedia. Nilai kosong/0 tetap berstatus belum diketahui.
- Kontak internal/feedback compressor yang tidak dirinci dilengkapi sebagai model latihan, bukan kepastian wiring outdoor. Jalur PE model ditambahkan dan diberi label.
- Showcase SDP memakai beban ekuivalen; pembagian arus tiap fase dan arus netral aktual tidak dihitung. Subpanel dibuka sebagai project terpisah; simulasi tidak menyambungkan net antarproject.
- UI panel menampilkan perintah coil dan indikasi tegangan, bukan pengukuran putaran motor.
- Backend standalone dari main sebelumnya memakai memori proses. Pembaruan ini mengembalikan pemisahan pemilik, pemeriksaan revisi, dan snapshot data agar perubahan luar tidak memutasi dokumen server. Persistensi lintas restart tetap belum tersedia.

Pengujian tambahan di `tests/panels.test.mjs` mencakup semua skenario di atas, checksum PDF, validasi impor, neutral-required showcase, serta batas waktu pergantian timer. Pengujian browser langsung dan validasi panel fisik merupakan pekerjaan terpisah.
