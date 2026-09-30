# SiRUP Sanding DIPA ↔ RUP & Revisi Massal

Userscript Tampermonkey untuk akun **KPA** di SiRUP (sirup.inaproc.id). Script ini menggantikan alur lama
"generate RKA dari SAKTI → sanding RUP", yang berhenti berfungsi sejak izin API Kemenkeu untuk LKPP diputus pada 31 Juli 2026.
Sejak itu RKA/PKKR di SiRUP beku di revisi terakhir sebelum cutoff, sehingga DIPA terbaru dibaca langsung dari PDF SAKTI.

File yang dipasang: `dist/sirup_sanding_dipa.user.js` (hasil `node build.js`).

## Alur (5 langkah di panel "⇄ Sanding DIPA ↔ RUP")

| Langkah | Apa yang dilakukan | Mengubah SiRUP? |
|---|---|---|
| 1. Data & Login | Cek sesi login (role harus PAKPA/KPA), lalu unggah PDF **FA Detail 16 Segmen** dan/atau **Rincian Kertas Kerja Satker**. Parser memvalidasi jumlah item = total alokasi. | Tidak |
| 2. Struktur PKKR | Membaca pohon Program › Kegiatan › KRO › RO › Komponen › Sub Komponen, lalu membandingkannya dengan DIPA. Cabang baru yang memuat belanja pengadaan bisa ditambahkan sebagai PKKR **Manual** (cabang gaji/non-pengadaan dilewati). | Ya, setelah konfirmasi |
| 3. Sanding RUP | Membaca seluruh paket (JSON `paketpenyediadenormalisasibyid` + modal detail), mengklasifikasi tiap item DIPA (Pengadaan / Non / Perlu cek), dan menyandingkan per MAK 7 segmen. Klasifikasi bisa diubah per item. | Tidak |
| 4. Rekap & Eksekusi | Rencana aksi yang bisa diedit: umumkan FD yang benar, batalkan paket non-pengadaan, kembalikan FD bermasalah ke PPK, **revisi satu-ke-banyak** (pindah MAK, keluarkan akun NP, tambah paket baru lewat paket donor). Isian massal tersedia untuk jenis/metode/pra-DIPA/jadwal/lokasi. Paket hasil revisi langsung diumumkan. | Ya, setelah konfirmasi |
| 5. Struktur Anggaran | Membandingkan struktur anggaran SiRUP, RUP terumumkan, dan pagu pengadaan DIPA per jenis belanja (52/53/57/56/lainnya), lalu menyimpan nilai yang dipilih. | Ya, setelah konfirmasi |

## Aturan penting yang sudah ditanam

- **IKU RUP (manual Biro PBJ KKP)** = RUP terumumkan ÷ pagu pengadaan (Statistik Moner = Struktur Anggaran) × 100%. Kelebihan di atas 100% **mengurangi** capaian, jadi targetnya harus sama persis.
- Non-pengadaan: belanja pegawai 51xxxx, perjalanan dinas 5241xx, honor (521115/521213/522151 narasumber/525113), uang saku/harian/transport, pajak/tol/retribusi, BPJS, honor PPNPN/tenaga kontrak, bantuan/beasiswa/tugas belajar.
- Pengadaan: PJLP / jasa lainnya perorangan (satpam, cleaning service, pramubakti, pengemudi). Paket meeting 524119/524114 berupa penginapan/ruang rapat = pengadaan dengan metode **Dikecualikan**. Bila RAB memuat hiburan/MC/dekorasi/sound system, paket dianggap EO: ≤ batas PL memakai Pengadaan Langsung, di atasnya memakai metode EO dari Pengaturan (default Tender).
- Perlu cek: "bantuan" makan/seragam taruna (sering berupa kontrak katering), belanja modal "Pengelolaan Kegiatan", jasa profesi non-honor, 526/56/57.
- Ambang PL (Perpres 46/2025): barang/jasa lainnya Rp200 jt, konstruksi Rp400 jt, konsultansi Rp100 jt. Nilainya bisa diubah di ⚙.
- Sumber dana (`id_dana_apbn`): A=RM, D=PNBP, F=BLU, T=SBSN, B=PLN. FA Detail tidak memuat SD, jadi satker multi-dana sebaiknya mengunggah RKK juga.

## Perilaku SiRUP yang perlu diketahui (hasil rekaman 30 Sep 2026)

- Revisi 1→N: `kajiulangpaket?jenis=satukebanyak` → satu `POST simpankajiulangonetomanypenyedia` per paket hasil (`isSelesai=true` pada paket terakhir). **Paket asal hilang dari daftar, dan semua paket hasil berstatus Final Draft** sampai diumumkan KPA. Tool langsung mengumumkannya.
- KPA bisa **membatalkan**, **revisi 1→1**, dan **revisi 1→N**, tetapi tidak bisa membuat paket dari nol. Trik membuat paket tanpa akun PPK: revisi 1→N atas paket existing. **Draft #1 dibiarkan apa adanya** (tool mengirim isi form SiRUP yang sudah terisi otomatis, hasil serialisasi identik dengan FormData browser), lalu draft #2 dst. diisi sebagai paket baru. Form yang sama menjadi template, sehingga field tersembunyi yang tidak dikenal tetap ikut terkirim.
- Koreksi satu paket (pindah MAK, kurangi pagu, keluarkan baris NP, perbaiki dana) memakai revisi **1→1**: `kajiulangpaket?jenis=satukesatu` → `formkajiulangsatukesatu` → `POST /revisictr/simpankajiulangonetoonepenyedia` (payload = 1→N tanpa `count`/`isSelesai`). Paket berganti kode dan **langsung berstatus Terumumkan**, jadi tidak perlu diumumkan ulang (rekaman 30 Sep 2026, 67445218 → 67984573).
- Hasil revisi 1→N selalu berstatus Final Draft. Setiap paket hasil mendapat id baris anggaran/lokasi/jenis baru, walaupun form mengirim id lama, sehingga menyalin id dari form yang terisi otomatis aman.
- MAK paket = `id_komponen` (id node Komponen PKKR) + teks `SUB.AKUN`. Karena itu cabang PKKR harus ada terlebih dahulu.
- Node PKKR hasil integrasi terkunci (nama/kode/pagu readonly), hanya PPK-nya yang bisa diubah.

## Batasan / belum diuji di produksi

- POST tambah PKKR di bawah node **integrasi** belum pernah dicoba. Form-nya ter-render, tetapi tombolnya disembunyikan UI.
- Payload metode Dikecualikan disimpulkan dari script form (`metode_dikecualikan=-1`), belum dari rekaman. Periksa hasil revisi pertama.
- Paket swakelola hanya dibaca (satker 626402 tidak punya).
- Paket yang melebihi pagu DIPA (mis. modernisasi tahun jamak) tidak dipotong otomatis. Keputusannya ada di pengguna.

## Pengembangan

```
node build.js                      # gabung src/ → dist/
node test/test_analysis2.js        # uji sanding dengan data 626402 (butuh file scratchpad)
node test/survey_dipa.js           # parse + klasifikasi semua PDF satker
python test/anomali_lintas_satker.py
```
