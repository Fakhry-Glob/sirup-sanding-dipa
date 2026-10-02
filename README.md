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

Pembaruan berjalan otomatis: Tampermonkey memeriksa versi baru dari tautan yang sama. Untuk memeriksa segera, buka Dashboard Tampermonkey → *Check for userscript updates*.
Bila skrip versi lama pernah dipasang manual dengan nama yang sama, instalasi ini menimpanya.

Sebelum menjalankan perubahan di SiRUP:
- Periksa rencananya di langkah 4.
- Mulai dengan **"Jalankan 1 langkah"**.
- Semua revisi, pembatalan, dan pengumuman tercatat atas nama akun KPA yang login.

File yang dipasang: `dist/sirup_sanding_dipa.user.js` (hasil `node build.js`).

## Alur (5 langkah di panel "⇄ Sanding DIPA ↔ RUP")

| Langkah | Apa yang dilakukan | Mengubah SiRUP? |
|---|---|---|
| 1. Data & Login | Cek sesi login (role harus PAKPA/KPA), lalu unggah PDF **FA Detail 16 Segmen** dan/atau **Rincian Kertas Kerja Satker**. Parser memvalidasi jumlah item = total alokasi. | Tidak |
| 2. Struktur PKKR | Membaca pohon Program › Kegiatan › KRO › RO › Komponen › Sub Komponen, lalu membandingkannya dengan DIPA. Cabang baru yang memuat belanja pengadaan bisa ditambahkan sebagai PKKR **Manual** (cabang gaji/non-pengadaan dilewati). | Ya, setelah konfirmasi |
| 3. Sanding RUP | Membaca seluruh paket (JSON `paketpenyediadenormalisasibyid` + modal detail), mengklasifikasi tiap item DIPA (Pengadaan / Non / Perlu cek), dan menyandingkan per MAK 7 segmen. Klasifikasi bisa diubah per item. | Tidak |
| 4. Rekap & Eksekusi | Empat sub-langkah dengan proyeksi RUP (sekarang → setelah rencana → target pagu pengadaan DIPA) yang selalu tampil: **Putuskan** (kartu kebijakan per kelompok), **Perubahan paket** (satu paket = satu revisi, sebelum → sesudah), **Paket baru** (hanya MAK tanpa paket, dititipkan ke paket satu komponen), **Jalankan** (antrean yang memeriksa ulang SiRUP sebelum tiap langkah, bisa dijalankan satu per satu dan dilanjutkan). | Ya, setelah konfirmasi |
| 5. Struktur Anggaran | Membaca **ulang** RUP terumumkan langsung dari SiRUP (daftar + baris anggaran tiap paket), lalu membandingkannya dengan struktur anggaran SiRUP dan pagu pengadaan DIPA per jenis belanja (52/53/57/56/lainnya). Sebelum menyimpan, RUP dibaca sekali lagi; bila berubah, penyimpanan dibatalkan dan tabel diperbarui. Setelah disimpan, IKU (RUP ÷ struktur anggaran) ditampilkan. | Ya, setelah konfirmasi |

## Aturan penting yang sudah ditanam

- **IKU RUP (manual Biro PBJ KKP)** = RUP terumumkan ÷ pagu pengadaan (Statistik Moner = Struktur Anggaran) × 100%. Kelebihan di atas 100% **mengurangi** capaian, jadi targetnya harus sama persis.
- Non-pengadaan: belanja pegawai 51xxxx, perjalanan dinas 5241xx, honor (521115/521213/522151 narasumber/525113), uang saku/harian/transport, pajak/tol/retribusi, BPJS, honor PPNPN/tenaga kontrak, bantuan/beasiswa/tugas belajar.
- Pengadaan: PJLP / jasa lainnya perorangan (satpam, cleaning service, pramubakti, pengemudi). Paket meeting 524119/524114 berupa penginapan/ruang rapat = pengadaan dengan metode **Dikecualikan**. Bila RAB memuat hiburan/MC/dekorasi/sound system, paket dianggap EO: ≤ batas PL memakai Pengadaan Langsung, di atasnya memakai metode EO dari Pengaturan (default Tender).
- Perlu cek: "bantuan" makan/seragam taruna (sering berupa kontrak katering), belanja modal "Pengelolaan Kegiatan", jasa profesi non-honor, 526/56/57.
- Ambang PL (Perpres 46/2025): barang/jasa lainnya Rp200 jt, konstruksi Rp400 jt, konsultansi Rp100 jt. Nilainya bisa diubah di ⚙.
- Sumber dana (`id_dana_apbn`): A=RM, D=PNBP, F=BLU, T=SBSN, B=PLN. FA Detail tidak memuat SD, jadi satker multi-dana sebaiknya mengunggah RKK juga.

## Logika rencana (src/rencana.js, v1.3.0)

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
- **Kelebihan RUP sekecil apa pun dipotong** (di atas Rp1.000), karena RUP di atas pagu DIPA membuat IKU > 100%, yang
  dikurangkan dari capaian. Ambang Rp1 jt hanya berlaku untuk kekurangan (supaya tidak ada paket baru yang sangat kecil).
- Teks yang dikirim ke SiRUP memakai tanda baca ASCII (`-`, `>`, `x`, `...`) supaya aman di ekspor/sistem lain.

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

## Batasan / belum diuji di produksi

- POST tambah PKKR di bawah node **integrasi** belum pernah dicoba. Form-nya ter-render, tetapi tombolnya disembunyikan UI.
- Payload metode Dikecualikan disimpulkan dari script form (`metode_dikecualikan=-1`), belum dari rekaman. Periksa hasil revisi pertama.
- Paket swakelola hanya dihitung jumlahnya, belum disandingkan per MAK.
- Kelebihan besar (mis. modernisasi tahun jamak) tidak pernah dipotong otomatis. Kartunya wajib diputuskan pengguna.
- Eksekutor 1→1, 1→N (termasuk draft #1 yang dikoreksi), dan "umumkan lalu revisi" untuk final draft belum pernah dijalankan tool ini di produksi. Uji pertama sebaiknya satu langkah dulu ("Jalankan 1 langkah").

## Pengembangan

```
node build.js                      # gabung src/ → dist/
node test/test_rencana.js          # uji rencana dengan data 626402 (test/data, tidak ikut git)
node test/plan_all_satker.js       # uji invarian rencana untuk 42 satker
node test/debug_satker.js <kode>   # rincian rencana satu satker
node test/cek_satker_pdf.js <pdf> [rup.json]   # pagu pengadaan per jenis belanja dari satu PDF + sanding dengan RUP
node test/survey_dipa.js           # parse + klasifikasi semua PDF satker
python test/anomali_lintas_satker.py
```

Uji tampilan tanpa SiRUP: jalankan server statis di folder proyek (mis. `python -m http.server 8765`), lalu buka
`http://localhost:8765/test/harness/rekap.html`. Halaman ini memuat userscript dengan API SiRUP tiruan dan data 626402.
`test/harness/fixture.js` dibuat dengan `node test/harness/buat_fixture.js`.
