# SiRUP Sanding DIPA ↔ RUP & Revisi Massal

Userscript Tampermonkey untuk akun **KPA** di SiRUP (sirup.inaproc.id). Script ini menggantikan alur lama
"generate RKA dari SAKTI → sanding RUP", yang berhenti berfungsi sejak izin API Kemenkeu untuk LKPP diputus pada 31 Juli 2026.
Sejak itu RKA/PKKR di SiRUP beku di revisi terakhir sebelum cutoff, sehingga DIPA terbaru dibaca langsung dari PDF SAKTI.

## Pasang

1. Pasang ekstensi [Tampermonkey](https://www.tampermonkey.net/) di Chrome/Edge.
   - Di Chrome 138 ke atas, buka `chrome://extensions`, lalu aktifkan **Developer mode**. Kalau ada tombol **Allow User Scripts** di detail Tampermonkey, aktifkan juga. Tanpa ini, userscript tidak dijalankan.
2. Klik tautan instal berikut. Tampermonkey akan membuka halaman instal; klik **Install**.

   **[Instal SiRUP Sanding DIPA ↔ RUP](https://raw.githubusercontent.com/Fakhry-Glob/sirup-sanding-dipa/main/dist/sirup_sanding_dipa.user.js)**

3. Buka [sirup.inaproc.id](https://sirup.inaproc.id/sirup/), lalu login dengan akun **KPA** satker. Tombol "⇄ Sanding DIPA ↔ RUP" muncul di kanan bawah.

Pembaruan berjalan otomatis. Tampermonkey hanya mengunduh `dist/sirup_sanding_dipa.meta.js` (blok metadata, ±1 KB) untuk membandingkan `@version`. Skrip lengkap baru diunduh bila versinya lebih tinggi. Untuk memeriksa segera, buka Dashboard Tampermonkey → *Check for userscript updates*.
Bila skrip versi lama pernah dipasang manual dengan nama yang sama, instalasi ini menimpanya.

Sebelum menjalankan perubahan di SiRUP:
- Periksa rencananya di langkah 4.
- Mulai dengan **"Jalankan 1 langkah"**.
- Semua revisi, pembatalan, dan pengumuman tercatat atas nama akun KPA yang login.

File yang dipasang: `dist/sirup_sanding_dipa.user.js` (hasil `node build.js`).

## Alur (5 langkah di panel "⇄ Sanding DIPA ↔ RUP")

| Langkah | Apa yang dilakukan | Mengubah SiRUP? |
|---|---|---|
| 1. Data & Login | Cek sesi login (role harus PAKPA/KPA), lalu unggah PDF **FA Detail 16 Segmen** dan/atau **Rincian Kertas Kerja Satker**. Satu file sudah cukup (FA diutamakan karena memuat pagu revisi terkini). RKK yang diunggah bersama FA melengkapi lokasi KRO (untuk paket baru), sumber dana per akun (penting untuk satker multi-dana), serta volume dan harga item. Parser memvalidasi jumlah item = total alokasi. | Tidak |
| 2. Struktur PKKR | Membaca pohon Program › Kegiatan › KRO › RO › Komponen › Sub Komponen, lalu membandingkannya dengan DIPA. Cabang baru yang memuat belanja pengadaan bisa ditambahkan sebagai PKKR **Manual** (cabang gaji/non-pengadaan dilewati). **Penyesuaian PKKR Manual** menyamakan pagu/nama node Manual dengan DIPA dan menonaktifkan node Manual yang tidak ada lagi di DIPA bila tidak dipakai paket. | Ya, setelah konfirmasi |
| 3. Sanding RUP | Membaca seluruh paket (JSON `paketpenyediadenormalisasibyid` + modal detail), mengklasifikasi tiap item DIPA (Pengadaan / Non / Perlu cek), dan menyandingkan per MAK 7 segmen. Klasifikasi bisa diubah per item. | Tidak |
| 4. Rekap & Eksekusi | Empat sub-langkah dengan proyeksi RUP (sekarang → setelah rencana → target pagu pengadaan DIPA) yang selalu tampil: **Putuskan** (kartu kebijakan per kelompok), **Pengajuan revisi** (daftar satu baris = satu pengajuan ke SiRUP; klik untuk popup isian pengajuan seperti form revisi SiRUP, ubah isian/alasan, atau ajukan satu pengajuan saja), **Paket baru** (hanya MAK tanpa paket, dititipkan ke paket satu komponen), **Jalankan** (antrean yang memeriksa ulang SiRUP sebelum tiap langkah, bisa dijalankan satu per satu dan dilanjutkan; paket yang dibatalkan bisa diaktifkan kembali). | Ya, setelah konfirmasi |
| 5. Struktur Anggaran | Membaca **ulang** RUP terumumkan langsung dari SiRUP (daftar + baris anggaran tiap paket), lalu membandingkannya dengan struktur anggaran SiRUP dan pagu pengadaan DIPA per jenis belanja (52/53/57/56/lainnya). Sebelum menyimpan, RUP dibaca sekali lagi; bila berubah, penyimpanan dibatalkan dan tabel diperbarui. Setelah disimpan, IKU (RUP ÷ struktur anggaran) ditampilkan. | Ya, setelah konfirmasi |

## Aturan penting yang sudah ditanam

- **IKU RUP (manual Biro PBJ KKP)** = RUP terumumkan ÷ pagu pengadaan (Statistik Moner = Struktur Anggaran) × 100%. Kelebihan di atas 100% **mengurangi** capaian, jadi targetnya harus sama persis.
- Non-pengadaan: belanja pegawai 51xxxx, perjalanan dinas 5241xx, honor (521115/521213/522151 narasumber/525113), uang saku/harian/transport, pajak/tol/retribusi, BPJS, honor PPNPN/tenaga kontrak, bantuan/beasiswa/tugas belajar.
- Pengadaan: PJLP / jasa lainnya perorangan (satpam, cleaning service, pramubakti, pengemudi). Paket meeting 524119/524114 berupa penginapan/ruang rapat = pengadaan dengan metode **Dikecualikan**. Bila RAB memuat hiburan/MC/dekorasi/sound system, paket dianggap EO: ≤ batas PL memakai Pengadaan Langsung, di atasnya memakai metode EO dari Pengaturan (default Tender).
- Perlu cek: "bantuan" makan/seragam taruna (sering berupa kontrak katering), belanja modal "Pengelolaan Kegiatan", jasa profesi non-honor, 526/56/57.
- Ambang PL (Perpres 46/2025): barang/jasa lainnya Rp200 jt, konstruksi Rp400 jt, konsultansi Rp100 jt. Nilainya bisa diubah di ⚙.
- Sumber dana (`id_dana_apbn`): A=RM, D=PNBP, F=BLU, T=SBSN, B=PLN. FA Detail tidak memuat SD, jadi satker multi-dana sebaiknya mengunggah RKK juga.

## Logika rencana (src/rencana.js)

- **Kartu keputusan per kelompok, bukan per paket.** Jenis kartu:
  - MAK lama: paket yang MAK-nya tidak ada di DIPA, dikelompokkan per akun tujuan. Tujuannya akun berkode sama di kegiatan yang sama, dengan urutan komponen > RO > KRO > kode sub-komponen; huruf O dan angka 0 disamakan karena ada satker yang salah ketik. Opsinya:
    - sesuaikan ke DIPA: pagu dibagi per bagian item DIPA;
    - pagu tetap;
    - susun ulang: pilih paket yang dipertahankan, sisanya dibatalkan;
    - tunda.
  - Kelebihan di MAK yang sama: potong, batalkan paket (dengan penanda kemungkinan ganda), atau biarkan.
  - Non-pengadaan yang terumumkan.
  - Item "perlu dicek": dianggap pengadaan atau non-pengadaan.
  - Final draft bermasalah.
- **Aturan keputusan default:**
  - Kartu otomatis diputuskan bila selisihnya kecil. Kartu wajib diputuskan bila kelebihannya ≥ ambang keputusan (default Rp100 jt) atau padanan MAK-nya lemah (tujuan hanya sama kegiatan).
  - Selama kartu belum diputuskan, akun tujuannya **tidak dibuatkan paket baru**, supaya tidak dobel.
- **Paket yang sudah tidak relevan (v1.4.0):**
  - MAK lama tanpa padanan sama sekali (kegiatannya tidak punya akun berkode sama) bernilai di bawah ambang keputusan: default **dikeluarkan**. Paket terumumkan yang tinggal baris itu dibatalkan, dan final draft-nya dikembalikan ke PPK. Di atas ambang, kartunya wajib diputuskan.
  - Final draft bermasalah default **dikembalikan ke PPK** bila jelas tidak relevan: seluruh barisnya non-pengadaan, tidak punya baris anggaran, atau kembar dengan paket terumumkan (MAK sama, pagu sama sampai Rp100 rb) **dan** MAK-nya sudah penuh. Dua paket sah bernilai sama di MAK yang masih longgar tetap diumumkan. Final draft lain (MAK "perlu dicek", MAK penuh tanpa kembaran) tetap menunggu keputusan.
  - Paket asal revisi 1→1 hilang dari daftar KPA begitu revisinya tersimpan (rekaman 2 Okt 2026), jadi draf revisi tidak pernah dianggap kembar dengan paket asalnya.
- **Menutup kekurangan pagu:**
  - Bila MAK sudah punya paket umum ("Belanja Bahan", nama akun, atau nama komponen), pagunya ditambah lewat revisi 1→1.
  - Bila tidak ada paket, atau paketnya spesifik, dibuat paket baru.
  - Selisih ≤ ambang (default Rp1 jt) diabaikan.
  - Semua pilihan ini bisa diubah per akun.
- **Paket baru:**
  - Dikelompokkan per sub-komponen + jenis pengadaan. Pengelompokan bisa diubah di ⚙, dan paket meeting selalu dipisah.
  - Dititipkan (revisi 1→N) ke paket di **komponen yang sama**. Paket yang memang sedang dikoreksi didahulukan, supaya koreksi dan titipan jadi satu revisi.
  - Isian otomatis:
    - Nama diambil dari item dominan dan sub-komponen.
    - Uraian dan spesifikasi diambil dari item DIPA; spesifikasi paling banyak 1.000 karakter.
    - Lokasi diambil dari lokasi KRO di RKK, lalu paket satu komponen, lalu **lokasi satker** yang diatur sekali per satker. Lokasi paket terbanyak di satker tidak pernah dipakai.
    - Jadwal mengikuti paket satu komponen. Bila tidak ada, mulai Januari untuk akun yang sudah ada realisasinya, atau bulan depan untuk yang belum.
  - Metode dihitung dari total paket. Ada peringatan untuk pemecahan paket dan untuk metode Tender/Seleksi pada akun yang sudah terealisasi.
- **Revisi paket existing:**
  - Baris anggaran lain tidak digabung; hanya baris yang terdampak yang diubah.
  - Tahun dana, sumber dana, dan kode BA/eselon/satker tiap baris diambil dari paket itu sendiri.
- **Antrean eksekusi:**
  - Urutan langkahnya: revisi 1→1 → titipan 1→N → umumkan final draft → pembatalan → kembalikan final draft ke PPK. Dengan urutan ini, paket yang akan digantikan tidak terlanjur dibatalkan bila revisi penggantinya gagal.
  - Sebelum tiap langkah dikirim, isian diperiksa lagi (aturan form SiRUP: jadwal, lokasi, spesifikasi, komponen PKKR). Status dan pagu paket juga dicocokkan dengan saat dibaca.
  - Bila ada yang berubah, langkah berhenti. Langkah yang gagal tidak diulang otomatis.
  - Antrean dan keputusan disimpan per satker + tahun di peramban.
  - Setelah antrean dijalankan, paket RUP **dibaca ulang otomatis** sebelum layar lain (rencana, struktur anggaran, Excel) dipakai.
    v1.3.0 tidak melakukan ini: di satker 653526 struktur anggaran sempat tersimpan dari data RUP sebelum revisi
    (barang/jasa Rp3.491.897.808, padahal RUP sesudah revisi Rp2.936,2 jt; diperbaiki di v1.3.1).
  - Antrean disusun dari daftar pengajuan yang dicentang. "Ajukan sekarang" di popup mengirim satu pengajuan saja,
    dengan pemeriksaan yang sama, dan mencatatnya di antrean ("diajukan satuan").
  - Pembatalan yang sudah selesai bisa dibatalkan lewat **"Aktifkan kembali"**: revisi "Aktifkan" SiRUP
    (`kajiulangpaket?jenis=aktif` → `formkajiulangaktif` → `POST /revisictr/kajiulangaktifkan`, kode RUP tetap,
    status menjadi Final Draft), lalu langsung diumumkan ulang.

## Penyesuaian PKKR Manual (src/pkkr.js, v1.4.0)

- Hanya node **Manual** yang diubah. Node hasil integrasi SAKTI terkunci dan hanya ditampilkan sebagai informasi.
- Pagu target:
  - salinan induk rantai Manual (kode sama dengan node Integrasi, mis. Program "… (Manual)") = jumlah pagu cabang Manual di bawahnya. Anak yang sudah tidak ada di DIPA tetapi tidak bisa dinonaktifkan (dipakai paket, atau paket belum dibaca) tetap dihitung, karena SiRUP menolak induk yang lebih kecil dari jumlah anaknya;
  - salinan Sub Komponen (daun) dan cabang Manual biasa = pagu DIPA node itu;
  - salinan non-daun yang belum punya anak Manual (rantai belum selesai dibuat, mis. "Tambahkan cabang" gagal di tengah) dibiarkan;
  - penurunan pagu salinan ditahan selama masih ada cabang DIPA (pengadaan) di bawahnya yang belum dibuat.
- Nama: catatan SAKTI berbentuk "[…]" dibuang; cabang Manual mengikuti uraian DIPA; salinan Program/Kegiatan diberi akhiran "(Manual)".
- Node Manual yang tidak ada lagi di DIPA dinonaktifkan **hanya bila tidak dipakai**:
  - paket penyedia aktif yang baris anggarannya memakai id komponen di bawah node itu (atau MAK berawalan kode node, untuk cabang non-salinan);
  - paket swakelola aktif yang jalur komponennya (kolom daftar paket) berada di bawah node itu.
  Sebelum menonaktifkan, daftar paket dibaca ulang; bila berubah, detail paket dibaca ulang dulu. Tanpa paket RUP terbaca, tidak ada node yang bisa dinonaktifkan.
- Urutan eksekusi: nonaktifkan (anak dulu) → turunkan pagu (anak dulu) → naikkan pagu / ganti nama (induk dulu).
- Form "Ubah" dan dialog "Nonaktifkan" dibaca dari SiRUP saat eksekusi dan dikirim apa adanya; yang diganti hanya nama/pagu dan **alasan baku** (`id_predifine`: 2 Penambahan Anggaran bila naik, 1 Pengurangan Anggaran bila turun, 4 Kesalahan Penulisan bila hanya nama). Hasil ubah diverifikasi dengan membaca form lagi (sekaligus menangkap pesan SiRUP); hasil nonaktifkan diverifikasi dengan membaca ulang PKKR.
- Yang dijalankan hanya baris yang tampil di tabel. Bila PKKR berubah sejak tabel digambar, tabel diperbarui dan tidak ada yang dijalankan.
- **Tambah cabang** (tombol di atas) juga mengikuti aturan anak ≤ induk: induk Manual yang sudah ada (mis. Program DL "(Manual)" yang sudah penuh oleh Kegiatan 2376) dinaikkan dulu dari atas ke bawah, baru node baru dibuat. Setelah proses (berhasil atau gagal di tengah) PKKR selalu dibaca ulang.
- **Kelebihan RUP sekecil apa pun dipotong** (di atas Rp1.000), karena RUP di atas pagu DIPA membuat IKU > 100%, yang
  dikurangkan dari capaian. Ambang Rp1 jt hanya berlaku untuk kekurangan (supaya tidak ada paket baru yang sangat kecil).
- Teks yang dikirim ke SiRUP memakai tanda baca ASCII (`-`, `>`, `x`, `...`) supaya aman di ekspor/sistem lain.

## Parser PDF FA Detail 16 Segmen (v1.4.2)

- Halaman FA berupa landscape dengan teks diputar; kolom dikenali dari posisi x setelah diputar balik.
- Nama node yang terbungkus ditaruh SAKTI **di atas dan di bawah** baris kodenya, dan baris kodenya sendiri tidak memuat nama (mis. RBJ.725: "Gedung, … Ditingkatkan" / "RBJ.725" / "Kapasitasnya"). Potongan di kolom uraian node dipasangkan ke baris node terdekat yang kolom namanya cocok (Kegiatan/Komponen x 53–62, RO 62–75, Sub Komponen 75–88, Akun 88–95). Sebelum v1.4.2, 331 dari 2.133 nama node di 45 PDF FA (Sep 2026) kosong, termasuk Kegiatan WA.2378 di hampir semua satker.
- Sambungan uraian item hanya diambil dari kolom item (x 95–110). Sebelumnya kepala tabel "Uraian" di awal halaman berikutnya tertempel ke item terakhir (27 item di 626402).
- `test/test_parser_fa.js` memeriksa semua PDF FA di satu folder: tidak ada nama node kosong dan tidak ada kepala tabel di uraian item. 5 dari 45 PDF di folder Sep 2026 (245124, 403818, 427536, 427602, 440043) tidak dikenali sebagai FA maupun RKK dan belum diperiksa.

## Pengaman untuk satker lain

- PDF DIPA (dan RKK pendamping) harus milik satker yang sedang login, dengan tahun yang sama dengan tahun SiRUP.
- Paket RUP yang terbaca juga harus milik satker yang sama. Pemeriksaannya memakai `kode_satker` pada baris anggaran.
- Kode BA, eselon, satker, dan KLDI tidak diasumsikan. Nilainya diambil dari data paket satker itu, atau dari form revisi SiRUP.
- Keputusan, centang, isian, antrean, dan lokasi satker disimpan dengan kunci satker + tahun, sehingga tidak terbawa ke satker lain.
- Paket bersumber dana SBSN/PLN tidak dicentang otomatis dan tidak dipakai sebagai paket titipan, karena jalurnya belum pernah diuji.
- Paket swakelola belum ikut disandingkan. Panel menampilkan jumlahnya; kekurangan yang sudah ditutup swakelola bisa diabaikan per akun.
- Uji ketahanan `test/plan_all_satker.js` menjalankan rencana untuk 42 satker BPPSDMKP dan memeriksa invarian berikut:
  - proyeksi = target bila semua kartu mengikuti DIPA;
  - tidak ada paket baru di bawah ambang;
  - tidak ada titipan lintas komponen bila ada paket satu komponen;
  - tidak ada paket ganda di antrean;
  - isian lolos aturan form.

## Perilaku SiRUP yang perlu diketahui (hasil rekaman 30 Sep 2026)

- Revisi 1→N: `kajiulangpaket?jenis=satukebanyak` → satu `POST simpankajiulangonetomanypenyedia` per paket hasil (`isSelesai=true` pada paket terakhir). **Paket asal hilang dari daftar, dan semua paket hasil berstatus Final Draft** sampai diumumkan KPA. Tool langsung mengumumkannya.
- KPA bisa **membatalkan**, **revisi 1→1**, dan **revisi 1→N**, tetapi tidak bisa membuat paket dari nol. Trik membuat paket tanpa akun PPK: revisi 1→N atas paket existing. **Draft #1 dibiarkan apa adanya** (tool mengirim isi form SiRUP yang sudah terisi otomatis, hasil serialisasi identik dengan FormData browser), lalu draft #2 dst. diisi sebagai paket baru. Form yang sama menjadi template, sehingga field tersembunyi yang tidak dikenal tetap ikut terkirim.
- Koreksi satu paket (pindah MAK, kurangi pagu, keluarkan baris NP, perbaiki dana) memakai revisi **1→1**: `kajiulangpaket?jenis=satukesatu` → `formkajiulangsatukesatu` → `POST /revisictr/simpankajiulangonetoonepenyedia` (payload = 1→N tanpa `count`/`isSelesai`). Paket berganti kode dan berstatus **Final Draft**, jadi harus diumumkan ulang oleh KPA (rekaman 30 Sep 2026: 67445218 → 67984573, lalu diumumkan 13:28:36). Tool mengumumkannya otomatis.
- Hasil revisi 1→1 maupun 1→N selalu berstatus Final Draft. Setiap paket hasil mendapat id baris anggaran/lokasi/jenis baru, walaupun form mengirim id lama, sehingga menyalin id dari form yang terisi otomatis aman.
- MAK paket = `id_komponen` (id node Komponen PKKR) + teks `SUB.AKUN`. Karena itu cabang PKKR harus ada terlebih dahulu.
- Node PKKR hasil integrasi terkunci (nama/kode/pagu readonly), hanya PPK-nya yang bisa diubah.
- Node PKKR Manual punya tautan Ubah (`programctr/edit{Program,Kegiatan,Output,SubOutput,Komponen,SubKomponen}`, form ke `programctr/simpan…` dengan `isEdit=true`) dan Nonaktifkan (`programctr/delete…Confirm?id=`, form konfirmasinya tanpa `method` = GET ke `programctr/delete…`).
- **Jumlah pagu anak tidak boleh melebihi pagu induk.** Tambah node yang melanggarnya ditolak tanpa pesan, dengan redirect yang sama seperti berhasil (ke `index…` level itu). Rekaman: 30 Sep 13:46 KRO RAA Rp64,59 M di bawah Kegiatan Integrasi DL.2376 (pagu Rp1,24 M); 2 Okt 16:10 Kegiatan 2375 Rp24 M di bawah Program DL "(Manual)" yang sudah penuh oleh Kegiatan 2376.
- Form Ubah PKKR di semua level wajib memilih alasan baku `…id_predifine` (1 Pengurangan Anggaran, 2 Penambahan Anggaran, 3 Pembatalan, 4 Kesalahan Penulisan, 5 Lainnya, 6 Delegasi kepada PPK). Tanpa pilihan ini SiRUP kembali ke form ubah dan tidak menyimpan (2 Okt 16:11, Program WA "(Manual)").
- Pesan flash SiRUP hanya hidup untuk satu permintaan berikutnya. Tool membaca halaman tujuan redirect tepat setelah simpan supaya pesannya tidak hilang.
- Paket yang dibatalkan (status 51, tidak aktif) hanya punya pilihan revisi "aktif". Hasilnya Final Draft berkode sama (rekaman 2 Okt 2026, paket latihan 67984388 → 68014121).

## Batasan / belum diuji di produksi

- POST tambah PKKR di bawah node **integrasi** belum pernah dicoba. Form-nya ter-render, tetapi tombolnya disembunyikan UI.
- Payload metode Dikecualikan disimpulkan dari script form (`metode_dikecualikan=-1`), belum dari rekaman. Periksa hasil revisi pertama.
- Paket swakelola hanya dihitung jumlahnya, belum disandingkan per MAK.
- Kelebihan besar (mis. modernisasi tahun jamak) tidak pernah dipotong otomatis. Kartunya wajib diputuskan pengguna.
- Revisi 1→1 dan 1→N (draft #1 dikoreksi) sudah dijalankan tool di produksi (653526, 1 Okt 2026). Umumkan, 1→1, batal, dan aktifkan kembali sudah dijalankan pada paket latihan 626402 (67984388 → 68014121, 2 Okt 2026) dengan alur permintaan yang sama dengan fungsi tool. "Umumkan lalu revisi" untuk final draft, popup "Ajukan sekarang", dan tombol "Aktifkan kembali" (v1.4.0) baru diuji di halaman uji.
- **Ubah dan nonaktifkan PKKR Manual belum pernah berhasil dijalankan di produksi.** Percobaan pertama (2 Okt 2026, v1.4.0) gagal karena alasan baku belum dikirim; diperbaiki di v1.4.1. Mulai dengan "Jalankan 1 penyesuaian", lalu cek di Kelola PKKR SiRUP. Belum diketahui apakah node yang dinonaktifkan masih ikut terbaca di daftar PKKR; tool hanya memberi peringatan bila masih terbaca.
- Kenaikan besar pagu Program "(Manual)" (mis. DL Rp64,59 M → Rp418,83 M untuk RBJ + cabang 2375) belum pernah dicoba. Bila SiRUP punya batas lain (mis. total pagu program terhadap pagu satker), pesannya sekarang ikut ditampilkan.

## Merilis pembaruan

1. Naikkan `@version` di `src/header.js`, misalnya 1.4.1 → 1.4.2. Tanpa ini, pengguna tidak menerima pembaruan.
2. Jalankan `node build.js`. Perintah ini menulis `dist/sirup_sanding_dipa.user.js` dan `dist/sirup_sanding_dipa.meta.js` dari header yang sama.
3. Commit **kedua file `dist/`** bersama perubahan `src/`, lalu push ke `main`.

## Pengembangan

```
node build.js                      # gabung src/ → dist/
node test/test_rencana.js          # uji rencana dengan data 626402 (test/data, tidak ikut git)
node test/test_pkkr.js             # uji penyesuaian PKKR Manual (rantai Manual tiruan di atas PKKR 626402)
SDR_FA_DIR="<folder PDF FA>" node test/test_parser_fa.js   # uji parser FA pada semua PDF FA di folder itu
node test/plan_all_satker.js       # uji invarian rencana untuk 42 satker
node test/debug_satker.js <kode>   # rincian rencana satu satker
node test/cek_satker_pdf.js <pdf> [rup.json]   # pagu pengadaan per jenis belanja dari satu PDF + sanding dengan RUP
node test/survey_dipa.js           # parse + klasifikasi semua PDF satker
python test/anomali_lintas_satker.py
```

Uji tampilan tanpa SiRUP: jalankan server statis di folder proyek (mis. `python -m http.server 8765`), lalu buka
`http://localhost:8765/test/harness/rekap.html`. Halaman ini memuat userscript dengan API SiRUP tiruan dan data 626402,
ditambah rantai PKKR Manual tiruan dan satu paket swakelola untuk menguji penyesuaian PKKR (`?tanpaManual` untuk mematikannya).
`test/harness/fixture.js` dibuat dengan `node test/harness/buat_fixture.js`.
