# Katalog komponen dan Elitech ETC-974

161 komponen yang dapat dipilih, ditambah pick point internal yang dibuat lewat kabel. Penambahan mengikuti kelompok pada lembar simbol referensi pengguna. Simbol berbentuk SVG dan menggunakan terminal listrik yang sebenarnya, bukan gambar tempel.

| Kelompok | Jumlah | Cakupan |
|---|---:|---|
| Sumber | 18 | AC 1/3 fase, variasi L1/L2/L3/N/PE, DC, baterai, generator, trafo, AC/DC 1/3 fase, konektor net ±/L1/L2/L3/N/PE, ground |
| Proteksi | 39 | MCB/MCCB, sekering 1–4P, switch-fuse 1–4P, isolator/pemutus beban 1–4P, thermal/magnetic breaker 1–4P, overload 1–3P, RCCB 2/4P, RCBO 2–4P, PFR, SPD |
| Kontaktor | 8 | Kontak utama NO dan NC, masing-masing 1–4P |
| Tombol & sakelar | 25 | Push, sakelar tetap, limit, rotary, key; NO/NC, gabungan, kontak tukar; emergency, MAN–OFF–AUTO, selector 1–0–2 |
| Kontak bantu | 14 | NO, NC, NO+NC, changeover, ON/OFF delayed untuk keempat susunan; overload NC 95–96 / NO 97–98 terpisah |
| Coil & timer | 9 | Coil kontaktor/relay, ON-delay, OFF-delay, ON+OFF delay, interval, impulse, cyclic, schedule |
| Motor | 6 | 1 fase, 3 fase, 6 terminal Y/Δ, dua kecepatan, Dahlander Δ/YY, DC |
| Beban | 12 | Lampu/berkedip, buzzer, bel, sirene, heater dan beban resistif lainnya |
| Refrigerasi | 14 | Compressor, evaporator, valve, sensor, pressure control, ETC-974 ringkas/detail dan controller lain yang sudah ada |
| Lainnya | 16 | Terminal, bus, konektor lurus/siku/T/silang bertitik, diode DC, panah, teks, meter |

Kategori Motor dipisahkan dari Beban. Pencarian nama dan pemilihan kategori tetap tersedia. Seluruh terminal tetap memakai snap 20 unit, pitch 40 unit dalam satu baris, dan radius pin 3,5 unit. Koneksi T/silang bertitik menyambungkan semua pin; persilangan kabel biasa tetap berupa bridge tanpa sambungan.

## Memakai ETC-974 detail

Cari **Elitech** di katalog, pilih **Elitech ETC-974 · detail**, lalu klik kanvas. Untuk controller lama, pilih komponennya lalu **Tampilkan detail ETC-974**. Pergantian ringkas/detail menyimpan ID, tag, parameter dan sambungan terminal; geometri/rute kabel menyesuaikan. Undo mengembalikan perubahan.

| Terminal | Fungsi pada referensi |
|---|---|
| 1 | Common relay / Line |
| 2 | Defrost NO |
| 3 | Defrost NC |
| 4 | Output compressor NO |
| 5 | Output fan NO |
| 6–7 | Supply controller |
| 8–9 | Probe evaporator Pb2 |
| 9–10 | Probe ruangan Pb1 |
| Copy key | Gambar port pemrograman, bukan terminal daya |

Simbol memperlihatkan sepuluh sekrup, slot terminal, common bus dan kontak relay yang bergerak saat simulasi. Supply 6–7 tidak otomatis memberi listrik ke common 1; common harus diberi feed melalui wiring. Terminal sensor tidak boleh diberi tegangan daya. Inspektor menampilkan peta terminal dan parameter suhu, differential, jeda restart, defrost, drip dan fan delay. Rating kontak diisi dari varian nameplate; nilai 0 berarti belum diisi, bukan rating pabrikan.

Acuan visual: gambar ETC-974 yang diunggah pengguna; pembanding primer: [katalog resmi Elitech, diagram ETC974](https://www.elitechglobal.com/static/upload/file/20250707/Smart%20HVAC%20Tools%20and%20Controllers.pdf). Fungsi controller mengikuti model aplikasi yang terdokumentasi di engineering-model.md; tidak menjalankan firmware Elitech atau menyalin konfigurasi melalui copy key.

## Perilaku model tambahan

- Kontak NO+NC bergerak bersama. Push bersifat momentary; switch, limit, rotary dan key tetap pada posisi setelah klik. Kontak bantu dan kontaktor memakai tag penggerak yang sama dengan coil. Kontak timed memiliki delay sendiri; parameter delay timer coil dan delay kontak akan berurutan bila keduanya digunakan.
- Kontaktor NC menutup saat coil lepas. RCCB/RCBO menggunakan nilai kebocoran yang dimasukkan, bukan perhitungan kebocoran tanah fisik. Isolator dan pemutus beban hanya menyambung/memutus, tanpa trip arus lebih. Magnetic-only tidak trip termal; thermal-only tidak punya trip magnetik.
- Motor Y/Δ: U1/V1/W1 menerima tiga fase berbeda. Mode Y memerlukan U2/V2/W2 dijumper; mode Δ memakai U1–W2, V1–U2, W1–V2. Nameplate current menjadi acuan arus line pada Δ. Model Y memakai sepertiganya; arus jumper Y dihitung lewat jaringan titik bintang floating, arus cabang Δ = arus line/√3. Kontaktor starter dan interlock dibuat di luar motor. Tidak ada transien elektromagnetik perpindahan Y/Δ.
- Dua kecepatan memakai dua set 1U/1V/1W dan 2U/2V/2W. Kedua set aktif bersamaan membuat motor tidak berjalan dan mengeluarkan peringatan. Isi arus rendah/tinggi; 0 memakai arus nominal utama. Dahlander hanya varian Δ/YY: rendah disuplai di set 1; tinggi di set 2 dan set 1 dijumper. Model Dahlander menghitung arus suplai; pembagian arus internal/jumper antar-kumparan tidak diselesaikan.
- Ukuran kabel motor enam terminal memakai arus nominal maksimum secara konservatif untuk cabang dan jumper. Grafik semua posisi kontak dapat mendeteksi kemungkinan fase bertabrakan pada starter yang kompleks; bila demikian rekomendasi otomatis diblokir dan alasan ditampilkan. Sizing jumper tidak merupakan analisis drop lengkap pada kumparan.
- AC/DC adalah catu terisolasi ideal. Output DC hanya hidup bila input benar; daya output dipantulkan ke input dan sizing input memakai rating VA penuh. Rugi switching, ripple dan current limiting tidak dimodelkan. Dioda ideal mendukung rangkaian DC dengan arah A→K; tidak melakukan penyearahan gelombang AC. Generator ideal tidak mempunyai AVR/governor.
- SPD hanya simbol/koneksi dan deteksi suplai, tanpa simulasi gelombang impuls. Lampu berkedip adalah animasi periodik dengan konsumsi listrik dianggap kontinu. Copy key hanya detail visual. Batas ini juga terlihat di deskripsi komponen terkait.

Kompatibilitas: ID komponen lama dipertahankan. Project lama, ekspor/impor dan penyimpanan menggunakan schema yang sama. Tidak ada migrasi otomatis ke simbol ETC-974 yang lebih besar agar tata letak proyek lama tetap dapat dipilih pengguna.
