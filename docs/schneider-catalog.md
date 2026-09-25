# Pilihan tipe Schneider Electric

Data diperiksa pada 25 September 2026. Implementasi berada di `lib/schneider-catalog.ts` dan `app/device-product.tsx`.

| Perangkat | Preset | Cakupan |
|---|---:|---|
| Kontaktor TeSys Deca LC1D | 11 | 3P / 3 NO, 9–95 A AC-3 pada 400 V; pilihan coil B7, F7, M7, P7, U7, Q7, V7 |
| Thermal overload TeSys LRD | 24 | LRD01–LRD35 dan LRD3322–LRD3365; rentang 0,1–104 A; kelas 10A |
| MCB Acti9 iC60N | 36 | 1–4P, kurva C, 6–63 A, kode A9F74…, Icn 6 kA IEC 60898-1 |
| MCCB EasyPact CVS B | 12 | CVS100B / 160B / 250B, 3P / 3d, TM-D 16–250 A, Icu 25 kA pada 415 V |

Total 83 preset dasar, dengan variasi tegangan coil terpisah. Ini subset katalog: model, jumlah kutub, dan spesifikasi lain tetap bisa dimasukkan melalui **Custom**.

## Perilaku

- Komponen baru memakai preset yang sesuai rating awal bila tersedia. Rangkaian lama dan impor mempertahankan data asal sampai pengguna memilih tipe.
- Pemilihan tipe tidak mengubah ID, tag, posisi, putaran, terminal, kabel, atau keterangan pengguna. Model dan ampere tampil dekat simbol.
- Tipe mengisi parameter katalog. Setelan ampere LRD dan Ir MCCB tetap dapat diubah dalam rentangnya; pergantian tipe membatasi nilai lama ke rentang baru.
- Coil biasa dengan tag sama mengikuti model, tegangan, frekuensi simulasi 50 Hz, dan konsumsi VA saat menahan dari kontaktor LC1D. Timer dan coil dengan tag lain tidak berubah.
- Custom mempertahankan nilai terakhir dan membuka isian manual. Kembali ke preset mengembalikan parameter katalog.
- Ambang magnetik MCCB merupakan ampere absolut sehingga tidak ikut bergeser ketika Ir diubah. Icn MCB dan Icu MCCB ditampilkan beserta standar acuannya.
- Kurva waktu trip tetap merupakan model pendekatan aplikasi, bukan kurva koordinasi pabrikan. Kelas trip yang ditampilkan adalah metadata produk.

## Acuan resmi

- [Tabel LC1D, kontak utama dan kontak bantu](https://productinfo.se.com/nadigest/5c51d645347bdf0001f1f280/Master/17718_MAIN%20(bookmap)_0000058904.xml/$/TeSys%E2%84%A2-Deca-Series-9-150-Amperes)
- [Kode tegangan coil](https://www.se.com/us/en/faqs/FA105276/)
- [Konsumsi coil LC1D09–38](https://www.se.com/us/en/faqs/FA112524/), [LC1D40A–65A](https://eshop.se.com/sa/lxd3p7-contactor-coil-tesys-deca-lxd3-230v-ac-50-60hz-for-40-65a-contactor.html), [LC1D80](https://iportal.se.com/Contents/docs/SQD-LC1D80F7.PDF), [LC1D95](https://eshop.se.com/sg/contactor-tesys-deca-3p-3no-ac-3-ac-3e-lt-440v-95a-120v-ac-50-60hz-coil-screw-clamp-terminals-lc1d95g7.html)
- [Rentang arus LRD](https://www.se.com/uk/en/faqs/FA142123/), [datasheet LRD12](https://iportal.se.com/Contents/docs/SQD-LRD12_DATA%20SHEET.PDF)
- [iC60N A9F74316](https://www.se.com/id/en/product/A9F74316/ic60n-miniature-circuit-breaker-3p-16a-c-curve/)
- [CVS100B TM100D](https://www.se.com/id/en/product/LV510307/easypact-cvs-cvs100b-tm100d-circuit-breaker-3p-3d/), [CVS160B TM160D dan rentang Ir](https://eshop.se.com/sg/easypact-cvs160b-circuit-breaker-25-ka-at-415-vac-3p-3d-tm-d-160-a-trip-unit-lv516303.html), [CVS250B TM250D](https://www.se.com/id/en/product/LV525303/easypact-cvs-cvs250b-tm250d-circuit-breaker-3p-3d/)
- [Easy Series Coordination Table 2025: ambang magnetik TM-D](https://ckm-content.se.com/ckmContent/sfc/servlet.shepherd/document/download/069Kj00000UMJbAIAX)

## Verifikasi

`node --experimental-strip-types --test tests/schneider-catalog.test.mjs` memeriksa semua preset, penyimpanan/impor, pelestarian kabel dan terminal, mode Custom, sinkronisasi coil, kesesuaian kutub, dan ambang magnetik yang tetap terhadap perubahan Ir.
