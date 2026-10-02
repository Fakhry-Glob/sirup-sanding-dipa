// ─────────────────────────────────────────────────────────────── RENCANA ──
// Menyusun rencana perbaikan RUP dari hasil sanding (Analysis):
//  • kartu keputusan per kelompok (MAK lama, kelebihan besar, non-pengadaan,
//    item "perlu dicek", final draft bermasalah) — bukan per paket;
//  • perubahan per paket existing: satu paket = satu revisi (tambah pagu, pindah
//    MAK, keluarkan baris non-pengadaan, potong kelebihan, batalkan);
//  • paket baru hanya untuk MAK yang belum punya paket, dititipkan lewat revisi
//    satu ke banyak ke paket di komponen yang sama;
//  • proyeksi RUP terumumkan.
// Fungsi murni tanpa akses SiRUP, supaya bisa diuji di Node untuk banyak satker.
// Semua isian satker-spesifik (lokasi satker, kode BA/eselon) datang dari ctx.
const Rencana = (() => {
    const TOL = 1000;
    const SD_CODE = { RM: 'A', PLN: 'B', PNP: 'D', PNBP: 'D', BLU: 'F', SBSN: 'T' };
    const SD_BELUM_DIUJI = new Set(['B', 'T']); // PLN / SBSN: butuh isian register yang belum pernah direkam
    const seg = (mak, n) => mak.split('.').slice(0, n).join('.');
    const akunOf = mak => mak.split('.').pop();
    const fmt = n => Math.round(n).toLocaleString('id-ID');
    const sum = (xs, f) => xs.reduce((s, x) => s + (f ? f(x) : x), 0);
    const aktif = p => p.aktif !== 'false' && p.aktif !== false;
    const penyedia = p => (p.jenisPaket || 'penyedia') === 'penyedia';
    const isU = p => p.status === '3' && aktif(p) && penyedia(p);
    const isFD = p => p.status === '2' && penyedia(p);
    const rowsOf = p => (p.sumberDana || []).filter(s => +s.pagu > 0);
    const MEETING = /^52411[49]$/;
    const LABEL_JENIS = { 'Barang': 'Pengadaan barang', 'Jasa Lainnya': 'Pengadaan jasa lainnya', 'Pekerjaan Konstruksi': 'Pekerjaan konstruksi', 'Jasa Konsultansi': 'Jasa konsultansi' };

    // ── kemiripan nama ──────────────────────────────────────────────────
    const STOP = new Set(['belanja', 'pengadaan', 'paket', 'dan', 'untuk', 'pada', 'di', 'ke', 'dari', 'yang', 'dengan', 'atau', 'tahun', 'anggaran',
        'serta', 'dalam', 'lainnya', 'lain', 'the', 'kab', 'kota']);
    const tokens = s => new Set(String(s || '').toLowerCase().replace(/\[[^\]]*\]/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ')
        .filter(t => t.length > 2 && !STOP.has(t) && !/^\d+$/.test(t)));
    const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let i = 0; for (const t of a) if (b.has(t)) i++; return i / (a.size + b.size - i); };
    const contain = (a, b) => { if (!a.size) return 0; let i = 0; for (const t of a) if (b.has(t)) i++; return i / a.size; };
    const bersih = s => { const t = String(s || '').replace(/\[[^\]]*\]/g, ' ').replace(/^\s*belanja\s+/i, '').replace(/\s+/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
    // untuk nama paket: buang juga rincian volume dalam kurung, mis. "(60 orang x 2 kegiatan)"
    const bersihNama = s => bersih(s).replace(/\s*\([^)]*\d[^)]*(\)|$)/g, ' ').replace(/\s+/g, ' ').trim();
    const potong = (s, n) => s.length <= n ? s : s.slice(0, n - 3).replace(/\s+\S*$/, '') + '...';

    // Paket "umum" untuk sebuah akun: namanya nama akun/komponen (mis. "Belanja Bahan",
    // "Langganan Daya dan Jasa", "Pelatihan Berbasis Kompetensi"), bukan pekerjaan spesifik
    // (mis. "Pengadaan Konsumsi Kegiatan Konsolidasi"). Kekurangan pagu ditambahkan ke paket umum.
    function isUmum(p, mak, akunMap, nodes) {
        const nm = String(p.nama || '').trim();
        // "Belanja …" saja tidak cukup: "Belanja Modal Peralatan Laboratorium …" itu paket spesifik.
        const tp = tokens(nm);
        if (!tp.size) return true;
        const namaAkun = [(akunMap.get(mak) || {}).nama, ...rowsOf(p).map(r => (akunMap.get(r.mak) || {}).nama)];
        for (const c of namaAkun) { const tc = tokens(c); if (tc.size && (jaccard(tp, tc) >= 0.5 || contain(tp, tc) >= 0.75)) return true; }
        for (const k of [seg(mak, 5), seg(mak, 6)]) { const n = nodes.get(k); if (n && n.uraian && jaccard(tp, tokens(n.uraian)) >= 0.6) return true; }
        return false;
    }

    // bagi total ke baris sebanding bobot; dibulatkan ke Rp1.000, sisa pembulatan ke baris terbesar
    function bagi(total, bobot) {
        const tb = sum(bobot);
        if (!tb || total <= 0) return bobot.map(() => 0);
        const out = bobot.map(w => Math.floor(total * w / tb / 1000) * 1000);
        const imax = bobot.indexOf(Math.max(...bobot));
        out[imax] += Math.round(total - sum(out));
        return out;
    }

    // ── bulan (YYYY-MM) ─────────────────────────────────────────────────
    const BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
    const BULAN_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    function ym(s) {
        const t = String(s || '').trim().toLowerCase();
        let m = t.match(/^(\d{4})-(\d{2})/);
        if (m) return `${m[1]}-${m[2]}`;
        m = t.match(/([a-z]+)\s+(\d{4})/);
        if (!m) return '';
        let i = BULAN.indexOf(m[1]); if (i < 0) i = BULAN_EN.indexOf(m[1]);
        return i < 0 ? '' : `${m[2]}-${String(i + 1).padStart(2, '0')}`;
    }
    const ymAdd = (y, d) => { const [a, b] = y.split('-').map(Number); const t = new Date(a, b - 1 + d, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; };
    const maxYm = (a, b) => (a > b ? a : b);

    // jadwal SiRUP: akhir pemilihan ≥ awal; awal kontrak ≥ akhir pemilihan; akhir kontrak ≥ awal kontrak;
    // akhir pemanfaatan ≥ awal pemanfaatan (aturan validasi form paket SiRUP)
    function rapikanJadwal(j) {
        const o = { ...j };
        o.akhirPengadaan = maxYm(o.akhirPengadaan || o.awalPengadaan, o.awalPengadaan);
        o.awalPekerjaan = maxYm(o.awalPekerjaan || o.akhirPengadaan, o.akhirPengadaan);
        o.akhirPekerjaan = maxYm(o.akhirPekerjaan || o.awalPekerjaan, o.awalPekerjaan);
        o.awalKebutuhan = o.awalKebutuhan || o.awalPekerjaan;
        o.kebutuhan = maxYm(o.kebutuhan || o.akhirPekerjaan, o.awalKebutuhan);
        return o;
    }
    function jadwalPaket(p) {
        const t = p.tanggal || {};
        const j = {
            awalPengadaan: ym(t.awalPengadaan) || ym(p.pemilihan && p.pemilihan.mulai), akhirPengadaan: ym(t.akhirPengadaan) || ym(p.pemilihan && p.pemilihan.akhir),
            awalPekerjaan: ym(t.awalPekerjaan) || ym(p.pelaksanaan && p.pelaksanaan.mulai), akhirPekerjaan: ym(t.akhirPekerjaan) || ym(p.pelaksanaan && p.pelaksanaan.akhir),
            awalKebutuhan: ym(p.pemanfaatan && p.pemanfaatan.mulai), kebutuhan: ym(p.pemanfaatan && p.pemanfaatan.akhir),
        };
        if (!j.awalPengadaan) return null;
        j.awalKebutuhan = j.awalKebutuhan || j.awalPekerjaan; j.kebutuhan = j.kebutuhan || j.akhirPekerjaan;
        return rapikanJadwal(j);
    }

    // ── objek paket siap kirim (dipakai payload revisi) ─────────────────
    const JENIS_ID = { 'Barang': 1, 'Pekerjaan Konstruksi': 2, 'Jasa Konsultansi': 3, 'Jasa Lainnya': 4 };
    const JENIS_NAMA = Object.fromEntries(Object.entries(JENIS_ID).map(([k, v]) => [v, k]));
    function jenisPaket(p) {
        const r = (p.jenisRaw || [])[0];
        if (r && JENIS_NAMA[r.jenisid]) return JENIS_NAMA[r.jenisid];
        return ((p.jenisPengadaan || [])[0] || {}).jenis || 'Barang';
    }
    function pkDari(p, rows, cfg) {
        const total = sum(rows, r => r.pagu);
        const jenisRaw = (p.jenisRaw || []).map(j => ({ ...j }));
        return {
            baru: false, sumberId: p.id, nama: p.nama,
            anggaran: rows.map(r => ({ ...r })),
            jenis: jenisPaket(p), jenisList: jenisRaw.length > 1 && Math.abs(sum(jenisRaw, j => +j.pagu) - total) <= 1 ? jenisRaw : null, jenisIdLama: (jenisRaw[0] || {}).id || '',
            metode: p.metode || Classify.saranMetode(jenisPaket(p), total, '', '', cfg),
            uraian: p.uraianRaw != null ? p.uraianRaw : (p.uraian || ''), spesifikasi: p.spesifikasiRaw != null ? p.spesifikasiRaw : (p.spesifikasi || ''),
            volume: p.volume || '1 Paket',
            praDipa: /^ya/i.test(p.pradipa || ''), pdn: !/tidak/i.test(p.pdn || ''), umkm: /^ya/i.test(p.ukm || '') || (p.ukm == null && total <= 15e9),
            lokasiRaw: (p.lokasiRaw || []).map(l => ({ ...l })),
            jadwal: jadwalPaket(p) || null,
            spp: p.spp ? { ...p.spp } : { ekonomi: true, sosial: true, lingkungan: false },
        };
    }

    // ── penyusun utama ──────────────────────────────────────────────────
    // ctx: { akunMap, pakets, dipaNodes, cfg, tahun, hariIni, keputusan, atur, lokasiSatker, lokasiRkk, komponenId }
    function susun(ctx) {
        const { akunMap, pakets, cfg } = ctx;
        const nodes = ctx.dipaNodes || new Map();
        const kep = ctx.keputusan || {};
        const atur = ctx.atur || {};
        const AMBANG = cfg.ambangSelisih != null ? +cfg.ambangSelisih : 1e6;
        const BESAR = cfg.ambangKeputusan != null ? +cfg.ambangKeputusan : 100e6;
        const TA = ctx.tahun || (ctx.hariIni || new Date()).getFullYear();
        const byId = new Map(pakets.map(p => [p.id, p]));
        const U = pakets.filter(isU), FD = pakets.filter(isFD);
        const kartu = [], peringatan = [];

        const kelasRow = r => {
            const a = akunMap.get(r.mak);
            if (!a) return 'HILANG';
            if (a.P > 0) return 'P';
            if (a.CEK > 0) return 'CEK';
            return 'NP';
        };
        // perubahan per paket (salinan baris yang bisa diubah)
        const ubah = new Map();
        const getUbah = p => {
            let u = ubah.get(p.id);
            if (!u) {
                u = { paket: p, rows: rowsOf(p).map(r => ({ idLama: r.id || '', mak: r.mak, pagu: +r.pagu, danaApbn: r.danaApbn || 'A', sumber: r.sumber, ta: r.ta, idKomponen: r.idKomponen,
                    asal: r.asal, asalSatker: r.asalSatker, kodeInstansi: r.kodeInstansi, kodeEselon: r.kodeEselon, kodeSatker: r.kodeSatker })),
                    sumber: new Set(), catatan: [], batal: false, umumkanDulu: p.status === '2', override: {} };
                ubah.set(p.id, u);
            }
            return u;
        };
        const rowOf = (u, r) => u.rows.find(x => x.idLama && x.idLama === r.id) || u.rows.find(x => x.mak === r.mak && x.pagu === +r.pagu) || u.rows.find(x => x.mak === r.mak);
        // RUP terumumkan per akun setelah rencana
        const rup = new Map([...akunMap.values()].map(a => [a.key, a.rupU]));
        const addRup = (mak, v) => { if (rup.has(mak)) rup.set(mak, rup.get(mak) + v); };
        const kartuBaru = (k, pilihanDefault) => {
            const d = kep[k.id] || {};
            k.pilihan = d.opsi !== undefined ? d.opsi : pilihanDefault;
            k.param = d;
            k.diputuskan = k.pilihan != null;
            k.otomatis = d.opsi === undefined && pilihanDefault != null;
            kartu.push(k);
            return k;
        };
        const blok = new Set();              // akun tujuan yang keputusannya belum/ditunda → jangan dibuatkan paket
        const paketTertahan = new Set();     // paket di kelompok yang belum diputuskan → jangan dijadikan titipan
        const batalFD = [];                  // {paketId, nama, pagu, alasan, sumber}

        // ── 1. Non-pengadaan yang terumumkan ─────────────────────────────
        const npList = [];
        for (const p of U) {
            const rows = rowsOf(p);
            const np = rows.filter(r => kelasRow(r) === 'NP');
            if (!np.length) continue;
            const alasan = [...new Set(np.flatMap(r => (akunMap.get(r.mak).items || []).filter(i => i.kelas === 'NP').map(i => i.alasan)))].slice(0, 2).join('; ');
            npList.push({ paketId: p.id, nama: p.nama, pagu: +p.pagu, np: sum(np, r => +r.pagu), semua: np.length === rows.length, alasan, rows: np });
        }
        if (npList.length) {
            const k = kartuBaru({ id: 'np', jenis: 'NP', judul: 'Non-pengadaan yang terumumkan',
                ringkas: `${npList.length} paket memuat akun non-pengadaan senilai Rp${fmt(sum(npList, x => x.np))}`,
                daftar: npList, opsi: [
                    { id: 'keluarkan', label: 'Keluarkan', ket: 'Paket yang seluruhnya non-pengadaan dibatalkan; paket campuran direvisi tanpa baris non-pengadaan', dampak: -sum(npList, x => x.np) },
                    { id: 'biarkan', label: 'Biarkan', ket: 'Tidak diubah', dampak: 0 }] }, 'keluarkan');
            if (k.pilihan === 'keluarkan') for (const x of npList) {
                const u = getUbah(byId.get(x.paketId));
                u.sumber.add('np');
                for (const r of x.rows) { const row = rowOf(u, { id: r.id, mak: r.mak, pagu: r.pagu }); if (row) { addRup(row.mak, -row.pagu); row.pagu = 0; } }
                u.catatan.push(`Baris non-pengadaan dikeluarkan (Rp${fmt(x.np)}): ${x.alasan}`);
            }
        }

        // ── 2. MAK lama (tidak ada di DIPA) → kelompok per akun tujuan ─────
        // Tujuan = akun berkode sama di kegiatan yang sama, diutamakan yang paling dekat strukturnya
        // (komponen > RO > KRO > kode sub-komponen). Padanan lemah (hanya sama kegiatan, kandidat >1)
        // selalu jadi kartu keputusan, sekecil apa pun nilainya.
        const kodeSub = mak => String(mak.split('.')[5] || '').toUpperCase().replace(/O/g, '0');
        const skorTujuan = (lama, a) => (seg(lama, 5) === seg(a.key, 5) ? 8 : 0) + (seg(lama, 4) === seg(a.key, 4) ? 4 : 0) + (seg(lama, 3) === seg(a.key, 3) ? 2 : 0) + (kodeSub(lama) === kodeSub(a.key) ? 3 : 0);
        const kandidatTujuan = mak => [...akunMap.values()].filter(a => a.akun === akunOf(mak) && a.key.startsWith(seg(mak, 2) + '.') && a.P > 0)
            .map(a => ({ a, skor: skorTujuan(mak, a), sisa: Math.max(0, a.P - a.rupU) })).sort((x, y) => y.skor - x.skor || y.sisa - x.sisa);
        const salahKetikO = (lama, tujuan) => /O/i.test(lama.split('.')[5] || '') && lama.split('.')[5] !== tujuan.split('.')[5] && kodeSub(lama) === kodeSub(tujuan);
        const grup = new Map();
        for (const p of [...U, ...FD]) for (const r of rowsOf(p)) {
            if (kelasRow(r) !== 'HILANG') continue;
            const kand = kandidatTujuan(r.mak);
            const key = `${seg(r.mak, 2)}|${akunOf(r.mak)}|${seg(r.mak, 6)}`;
            const pilihT = (kep['pindah:' + key] || {}).target;
            const best = (pilihT && kand.find(k => k.a.key === pilihT)) || kand[0];
            if (!grup.has(key)) grup.set(key, { key, rows: [], kand, best, lemah: !!best && best.skor < 4 && kand.length > 1 && !pilihT });
            grup.get(key).rows.push({ p, r, fd: p.status === '2' });
        }
        const itemTanpaPaket = new Map(); // akun → item yang belum punya paket (untuk nama/uraian paket baru)
        for (const g of [...grup.values()].sort((a, b) => a.key.localeCompare(b.key))) {
            const [keg, code] = g.key.split('|');
            const targets = g.best ? [g.best.a] : [];
            const rowsU = g.rows.filter(x => !x.fd), rowsFD = g.rows.filter(x => x.fd);
            const gU = sum(rowsU, x => +x.r.pagu), gFD = sum(rowsFD, x => +x.r.pagu);
            const makLama = [...new Set(g.rows.map(x => x.r.mak))];
            const namaAkun = (targets[0] && targets[0].nama) || code;
            const id = 'pindah:' + g.key;
            if (!targets.length) {
                const k = kartuBaru({ id, jenis: 'TANPA_PADANAN', judul: `MAK lama tanpa padanan · ${code}`, akun: code, makLama,
                    ringkas: `${new Set(g.rows.map(x => x.p.id)).size} paket (Rp${fmt(gU)} terumumkan${gFD ? `, Rp${fmt(gFD)} final draft` : ''}) memakai ${makLama.join(', ')} yang tidak ada di DIPA, dan kegiatan ${keg} tidak punya akun ${code}`,
                    paket: paketGrup(g.rows), opsi: [
                        { id: 'keluarkan', label: 'Keluarkan dari RUP', ket: 'Baris MAK ini dihapus; paket yang tidak punya baris lain dibatalkan', dampak: -gU },
                        { id: 'biarkan', label: 'Biarkan', ket: 'Tidak diubah', dampak: 0 }] }, gU + gFD < BESAR ? 'keluarkan' : null);
                if (k.pilihan === 'keluarkan') {
                    for (const x of rowsU) { const u = getUbah(x.p); const row = rowOf(u, x.r); if (row) row.pagu = 0; u.sumber.add('pindah'); u.catatan.push(`Baris ${x.r.mak} (Rp${fmt(x.r.pagu)}) dikeluarkan: MAK tidak ada di DIPA`); }
                    for (const p of new Set(rowsFD.map(x => x.p))) if (!batalFD.some(b => b.paketId === p.id)) batalFD.push({ paketId: p.id, nama: p.nama, pagu: +p.pagu, alasan: `MAK ${makLama.join(', ')} tidak ada di DIPA revisi terakhir`, sumber: id });
                }
                if (k.pilihan == null) for (const x of g.rows) paketTertahan.add(x.p.id);
                continue;
            }
            const buckets = bucketize(g.rows, targets, key => rup.get(key));
            const sisaTarget = sum(targets, a => Math.max(0, a.P - rup.get(a.key)));
            const lebih = gU + gFD - sisaTarget;
            const fdOpt = (kep[id] || {}).fd || 'biarkan';
            const saran = lebih <= TOL ? 'tetap' : 'sesuaikan';
            const def = g.lemah || lebih >= BESAR ? null : saran;
            const bucketInfo = buckets.map(b => ({ id: b.id, label: b.label, jenis: b.jenis, target: b.target.key, dipa: b.dipa, sisa: b.sisa, rup: sum(b.rows.filter(x => !x.fd), x => +x.r.pagu), fd: sum(b.rows.filter(x => x.fd), x => +x.r.pagu),
                paket: paketGrup(b.rows), items: b.items.map(i => i.uraian) }));
            const k = kartuBaru({ id, jenis: 'PINDAH', judul: `${bersih(namaAkun)} · ${code}`, akun: code, makLama, target: targets.map(t => t.key), saran, lemah: g.lemah,
                kandidatTujuan: g.kand.slice(0, 8).map(x => ({ mak: x.a.key, nama: x.a.nama, sisa: x.sisa, skor: x.skor })),
                ringkas: `${new Set(rowsU.map(x => x.p.id)).size} paket terumumkan Rp${fmt(gU)}${gFD ? ` + ${new Set(rowsFD.map(x => x.p.id)).size} final draft Rp${fmt(gFD)}` : ''} masih di MAK lama ${makLama.join(', ')}; usulan tujuan ${targets.map(t => t.key).join(', ')} (sisa pagu pengadaan Rp${fmt(sisaTarget)})${g.lemah ? '. Tujuan hanya sama kegiatan — pilih tujuan yang benar' : ''}${targets[0] && makLama.some(m => salahKetikO(m, targets[0].key)) ? '. Kode sub-komponen di RUP memakai huruf O, di DIPA angka 0' : ''}`,
                lebih, bucket: bucketInfo, adaFD: rowsFD.length > 0,
                opsi: [
                    { id: 'sesuaikan', label: 'Pindah ke MAK baru, pagu disesuaikan ke DIPA', ket: 'Pagu tiap paket dikali faktor per bagian (bisa diubah per paket)', dampak: -Math.max(0, gU - Math.min(gU, sisaTarget)) },
                    { id: 'tetap', label: 'Pindah ke MAK baru, pagu tetap', ket: gU - sisaTarget > AMBANG ? `RUP tetap lebih Rp${fmt(gU - sisaTarget)} dari DIPA (mis. tahun jamak)` : 'Nilai paket terumumkan muat di pagu DIPA', dampak: 0 },
                    { id: 'susun', label: 'Susun ulang', ket: 'Pilih paket yang dipertahankan per bagian (pagu dan metode diubah), sisanya dibatalkan', dampak: null },
                    { id: 'tunda', label: 'Tunda', ket: 'Paket tidak disentuh; MAK tujuan tidak dibuatkan paket baru agar tidak dobel', dampak: 0 }],
                opsiFD: rowsFD.length ? [
                    { id: 'biarkan', label: 'Biarkan final draft', ket: 'Tidak diumumkan, tidak dikembalikan' },
                    { id: 'kembalikan', label: 'Kembalikan ke PPK', ket: 'Batal final draft; PPK memperbaiki atau menghapus' },
                    { id: 'ikut', label: 'Umumkan lalu ikut disesuaikan', ket: 'Final draft diumumkan, lalu direvisi bersama paket lain di kelompok ini' }] : null,
                pilihanFD: fdOpt }, def);
            const pil = k.pilihan;
            if (pil == null || pil === 'tunda') {
                for (const t of targets) blok.add(t.key);
                for (const x of g.rows) paketTertahan.add(x.p.id);
                for (const b of buckets) if (!b.rows.length) continue;
                continue;
            }
            if (rowsFD.length && fdOpt === 'kembalikan' && pil !== 'susun')
                for (const p of new Set(rowsFD.map(x => x.p))) batalFD.push({ paketId: p.id, nama: p.nama, pagu: +p.pagu, alasan: 'MAK paket tidak ada di DIPA revisi terakhir', sumber: id });
            const ikutFD = x => !x.fd || fdOpt === 'ikut';
            const pindah = (x, mak, pagu, ket) => {
                const u = getUbah(x.p); const row = rowOf(u, x.r);
                if (!row) return;
                row.dari = row.dari || row.mak; row.mak = mak; row.pagu = pagu; row.idKomponen = null;
                u.sumber.add('pindah'); if (ket) u.catatan.push(ket);
                addRup(mak, pagu);
            };
            if (pil === 'tetap') {
                for (const b of buckets) for (const x of b.rows.filter(ikutFD)) pindah(x, b.target.key, +x.r.pagu, `MAK ${x.r.mak} → ${b.target.key}`);
            } else if (pil === 'sesuaikan') {
                for (const b of buckets) {
                    const rows = b.rows.filter(ikutFD);
                    const tot = sum(rows, x => +x.r.pagu);
                    const baru = Math.min(tot, Math.max(0, b.sisa));
                    const alok = baru >= tot - TOL ? rows.map(x => +x.r.pagu) : bagi(baru, rows.map(x => +x.r.pagu));
                    rows.forEach((x, i) => pindah(x, b.target.key, alok[i], `MAK ${x.r.mak} → ${b.target.key}${alok[i] !== +x.r.pagu ? `; pagu Rp${fmt(x.r.pagu)} → Rp${fmt(alok[i])} (${b.label}: DIPA Rp${fmt(b.dipa)})` : ''}`));
                }
            } else if (pil === 'susun') {
                const prm = (k.param && k.param.susun) || {};
                k.susun = {};
                for (const b of buckets) {
                    const cfgB = prm[b.id] || {};
                    const ids = [...new Set(b.rows.map(x => x.p.id))];
                    const besar = ids.slice().sort((a, c) => sum(b.rows.filter(x => x.p.id === c), x => +x.r.pagu) - sum(b.rows.filter(x => x.p.id === a), x => +x.r.pagu));
                    const simpan = (cfgB.simpan || (b.rows.length ? [besar.find(i => !byId.get(i) || byId.get(i).status === '3') || besar[0]] : [])).filter(i => ids.includes(i));
                    const target = Math.max(0, b.sisa);
                    const paguSimpan = simpan.length ? (cfgB.pagu && simpan.every(i => cfgB.pagu[i] != null) ? simpan.map(i => +cfgB.pagu[i]) : bagi(target, simpan.map(i => sum(b.rows.filter(x => x.p.id === i), x => +x.r.pagu)))) : [];
                    k.susun[b.id] = { simpan, pagu: Object.fromEntries(simpan.map((i, j) => [i, paguSimpan[j]])), metode: cfgB.metode || '', nama: cfgB.nama || {} };
                    for (const pid of ids) {
                        const rows = b.rows.filter(x => x.p.id === pid);
                        const j = simpan.indexOf(pid);
                        if (j >= 0) {
                            const alok = bagi(paguSimpan[j], rows.map(x => +x.r.pagu));
                            rows.forEach((x, i) => pindah(x, b.target.key, alok[i], `MAK ${x.r.mak} → ${b.target.key}; pagu disusun ulang Rp${fmt(alok[i])}`));
                            const u = getUbah(byId.get(pid)); u.sumber.add('susun');
                            if (cfgB.metode) u.override.metode = cfgB.metode;
                            if (cfgB.nama && cfgB.nama[pid]) u.override.nama = cfgB.nama[pid];
                            // lokasi paket yang digabung ikut ke paket yang dipertahankan
                            const lain = ids.filter(i => !simpan.includes(i)).map(i => byId.get(i));
                            const lok = [...(byId.get(pid).lokasiRaw || []), ...lain.flatMap(q => q.lokasiRaw || [])];
                            const uniq = []; const seen = new Set();
                            for (const l of lok) { const kk = `${l.id_provinsi}|${l.id_kabupaten}`; if (!seen.has(kk)) { seen.add(kk); uniq.push({ ...l, id: '' }); } }
                            if (uniq.length > (byId.get(pid).lokasiRaw || []).length) u.override.lokasiRaw = uniq;
                        } else {
                            const p = byId.get(pid);
                            if (p.status === '2') { if (fdOpt !== 'biarkan') batalFD.push({ paketId: p.id, nama: p.nama, pagu: +p.pagu, alasan: 'Disusun ulang sesuai DIPA revisi terakhir', sumber: id }); continue; }
                            const u = getUbah(p); u.sumber.add('susun');
                            for (const x of rows) { const row = rowOf(u, x.r); if (row) row.pagu = 0; }
                            u.catatan.push(`Digabung ke paket yang dipertahankan (${simpan.join(', ')})`);
                        }
                    }
                }
            }
            // item target yang belum punya paket (mis. "Perencanaan") → dipakai menamai paket baru
            for (const b of buckets) if (!b.rows.length) for (const i of b.items) {
                if (!itemTanpaPaket.has(b.target.key)) itemTanpaPaket.set(b.target.key, new Set());
                itemTanpaPaket.get(b.target.key).add(i.iid);
            }
        }

        // ── 3. Kelebihan pada MAK yang sama ──────────────────────────────
        const targetPindah = new Set(kartu.filter(k => k.jenis === 'PINDAH').flatMap(k => k.target));
        for (const a of [...akunMap.values()].sort((x, y) => x.key.localeCompare(y.key))) {
            if (a.P <= 0) continue;   // tujuan pindah MAK tetap dicek: kelebihan yang sudah ada sebelum pemindahan
            const lebih = a.rupU - a.P;
            // kelebihan sekecil apa pun dipotong: RUP di atas pagu DIPA membuat IKU > 100% (dikurangkan dari capaian)
            if (lebih <= TOL) continue;
            const refs = a.rup.filter(r => r.status === '3');
            const ids = [...new Set(refs.map(r => r.paketId))].filter(i => byId.has(i) && isU(byId.get(i)));
            if (!ids.length) continue;
            const paket = ids.map(i => { const p = byId.get(i); return { paketId: i, nama: p.nama, pagu: +p.pagu, diMak: sum(rowsOf(p).filter(r => r.mak === a.key), r => +r.pagu), umum: isUmum(p, a.key, akunMap, nodes) }; });
            const ganda = [];
            for (let i = 0; i < paket.length; i++) for (let j = i + 1; j < paket.length; j++)
                if (jaccard(tokens(paket[i].nama), tokens(paket[j].nama)) >= 0.6 || Math.abs(paket[i].diMak - paket[j].diMak) <= TOL) ganda.push([paket[i].paketId, paket[j].paketId]);
            const id = 'lebih:' + a.key;
            const k = kartuBaru({ id, jenis: 'LEBIH', judul: `${bersih(a.nama)} · ${a.key}`, akun: a.akun, mak: a.key,
                ringkas: `RUP terumumkan Rp${fmt(a.rupU)} di ${ids.length} paket, pagu pengadaan DIPA Rp${fmt(a.P)} (lebih Rp${fmt(lebih)})${ganda.length ? ' · kemungkinan paket ganda' : ''}`,
                lebih, paket, ganda,
                opsi: [
                    { id: 'potong', label: 'Potong kelebihan', ket: 'Dikurangi dari baris MAK terbesar lebih dulu', dampak: -lebih },
                    ...paket.map(x => ({ id: 'batal:' + x.paketId, label: `Batalkan ${x.paketId}`, ket: `${x.nama} (Rp${fmt(x.diMak)} di MAK ini)`, dampak: -x.diMak })),
                    { id: 'biarkan', label: 'Biarkan', ket: 'Tidak diubah', dampak: 0 }] }, lebih < BESAR ? 'potong' : null);
            if (k.pilihan === 'potong') {
                let sisa = lebih;
                const rows = ids.flatMap(i => { const u = getUbah(byId.get(i)); return u.rows.filter(r => r.mak === a.key && r.pagu > 0).map(r => ({ u, r })); }).sort((x, y) => y.r.pagu - x.r.pagu);
                for (const { u, r } of rows) {
                    if (sisa <= TOL) break;
                    const cut = Math.min(r.pagu, sisa);
                    r.pagu -= cut; sisa -= cut; addRup(a.key, -cut);
                    u.sumber.add('lebih'); u.catatan.push(`${a.key}: pagu dikurangi Rp${fmt(cut)} (RUP melebihi pagu pengadaan DIPA)`);
                }
            } else if (k.pilihan && k.pilihan.startsWith('batal:')) {
                const p = byId.get(k.pilihan.slice(6));
                if (p) {
                    const u = getUbah(p); u.sumber.add('lebih');
                    for (const r of u.rows) if (r.mak === a.key) { addRup(a.key, -r.pagu); r.pagu = 0; }
                    u.catatan.push(`Dikeluarkan dari ${a.key}: RUP melebihi pagu pengadaan DIPA (kemungkinan paket ganda)`);
                }
            } else if (k.pilihan == null) for (const i of ids) paketTertahan.add(i);
        }

        // ── 4. Item "perlu dicek" (keputusan diterapkan saat buildDipa) ──
        const cek = new Map();
        for (const a of akunMap.values()) for (const i of a.items) {
            const al = i.cekAsal || (i.kelas === 'CEK' ? i.alasan : null);
            if (!al) continue;
            if (!cek.has(al)) cek.set(al, { alasan: al, total: 0, n: 0, akun: new Set(), kelas: i.kelas });
            const c = cek.get(al); c.total += i.pagu; c.n++; c.akun.add(a.key);
        }
        for (const c of cek.values()) {
            const id = 'cek:' + c.alasan;
            const d = kep[id] || {};
            kartu.push({ id, jenis: 'CEK', judul: `Perlu dicek · ${c.alasan.split(' — ')[0].split(' (')[0]}`, ringkas: `${c.n} item di ${c.akun.size} akun, Rp${fmt(c.total)}. ${c.alasan}`,
                total: c.total, akun: [...c.akun], pilihan: d.opsi != null ? d.opsi : null, diputuskan: d.opsi != null, otomatis: false, param: d,
                opsi: [
                    { id: 'P', label: 'Hitung sebagai pengadaan', ket: 'Masuk pagu pengadaan; kekurangan RUP ikut diusulkan', dampak: null },
                    { id: 'NP', label: 'Non-pengadaan', ket: 'Tidak perlu RUP; paket yang memuatnya ikut dikeluarkan', dampak: null }] });
        }

        // ── 5. Final draft ───────────────────────────────────────────────
        const umumkan = [], fdMasalah = [];
        const dalamGrup = new Set([...grup.values()].flatMap(g => g.rows.map(x => x.p.id)));
        const kembar = new Map(); // MAK|pagu (dibulatkan Rp100 rb) → paket terumumkan
        for (const q of U) for (const r of rowsOf(q)) kembar.set(`${r.mak}|${Math.round(+r.pagu / 1e5)}`, q);
        for (const p of FD.slice().sort((a, b) => b.pagu - a.pagu)) {
            if (dalamGrup.has(p.id)) continue;
            const rows = rowsOf(p);
            const masalah = [];
            let ganda = null;   // hanya dianggap ganda bila MAK-nya juga sudah penuh (dua paket sah boleh bernilai sama)
            for (const r of rows) {
                const kls = kelasRow(r);
                if (kls === 'NP') masalah.push(`${r.mak} non-pengadaan`);
                else if (kls === 'CEK') masalah.push(`${r.mak} masih "perlu dicek"`);
                else if (kls === 'P') {
                    const a = akunMap.get(r.mak);
                    if (rup.get(r.mak) + +r.pagu > a.P + TOL) {
                        const q = kembar.get(`${r.mak}|${Math.round(+r.pagu / 1e5)}`);
                        if (q) { ganda = ganda || q; masalah.push(`${r.mak} sudah penuh dan kemungkinan ganda dengan paket terumumkan ${q.id} (${potong(q.nama, 40)})`); }
                        else masalah.push(`${r.mak} sudah penuh (RUP Rp${fmt(rup.get(r.mak))} dari pagu Rp${fmt(a.P)})`);
                    }
                }
            }
            if (!rows.length) masalah.push('tanpa baris anggaran');
            const tidakRelevan = !rows.length || !!ganda || rows.every(r => kelasRow(r) === 'NP');
            if (masalah.length) fdMasalah.push({ paketId: p.id, nama: p.nama, pagu: +p.pagu, masalah, saran: tidakRelevan ? 'kembalikan' : 'biarkan' });
            else { umumkan.push({ id: 'u:' + p.id, paketId: p.id, nama: p.nama, pagu: +p.pagu, pilih: true }); for (const r of rows) addRup(r.mak, +r.pagu); }
        }
        if (fdMasalah.length) {
            const d = kep.fd || {};
            const pil = d.pilih || {};
            kartu.push({ id: 'fd', jenis: 'FD', judul: 'Final draft bermasalah', ringkas: `${fdMasalah.length} final draft Rp${fmt(sum(fdMasalah, x => x.pagu))} tidak bisa diumumkan apa adanya`,
                daftar: fdMasalah.map(x => ({ ...x, pilihan: pil[x.paketId] || x.saran })), pilihan: 'per-paket', diputuskan: true, otomatis: d.pilih == null, param: d,
                opsi: [{ id: 'biarkan', label: 'Biarkan' }, { id: 'kembalikan', label: 'Kembalikan ke PPK' }] });
            for (const x of fdMasalah) if ((pil[x.paketId] || x.saran) === 'kembalikan') batalFD.push({ paketId: x.paketId, nama: x.nama, pagu: x.pagu, alasan: x.masalah.join('; '), sumber: 'fd' });
        }

        // ── 6. Kekurangan: tambah pagu paket umum, paket baru, atau abaikan ──
        const kekurangan = [], sisaKecil = [], tertahan = [], butuhBaru = [];
        const dibatalkan = id => { const u = ubah.get(id); return u && u.rows.every(r => r.pagu <= 0); };
        for (const a of [...akunMap.values()].sort((x, y) => x.key.localeCompare(y.key))) {
            if (a.P <= 0) continue;
            const sisa = a.P - rup.get(a.key);
            if (sisa <= TOL) continue;
            if (blok.has(a.key)) { tertahan.push({ mak: a.key, nama: a.nama, sisa, alasan: 'menunggu keputusan kartu MAK lama' }); continue; }
            const o = atur[a.key] || {};
            // paket terumumkan yang punya baris MAK ini (setelah rencana)
            const kand = U.filter(p => !dibatalkan(p.id) && !paketTertahan.has(p.id) && (ubah.has(p.id) ? ubah.get(p.id).rows : rowsOf(p)).some(r => r.mak === a.key && r.pagu > 0))
                .map(p => ({ paketId: p.id, nama: p.nama, pagu: +p.pagu, umum: isUmum(p, a.key, akunMap, nodes),
                    diMak: sum((ubah.has(p.id) ? ubah.get(p.id).rows : rowsOf(p)).filter(r => r.mak === a.key), r => +r.pagu) }))
                .sort((x, y) => (y.umum - x.umum) || (y.diMak - x.diMak));
            let cara = o.cara || (sisa <= AMBANG ? 'abaikan' : (kand.length && kand[0].umum ? 'tambah' : 'baru'));
            let paketId = o.paketId && kand.some(x => x.paketId === o.paketId) ? o.paketId : (kand[0] || {}).paketId;
            if (cara === 'tambah' && !paketId) cara = 'baru';
            const real = sum(a.items.filter(i => i.kelas === 'P'), i => i.realisasi || 0);
            const x = { id: 'k:' + a.key, mak: a.key, nama: a.nama, P: a.P, rup: rup.get(a.key), sisa, cara, paketId, kandidat: kand, realisasi: a.P ? real / a.P : 0 };
            kekurangan.push(x);
            if (cara === 'abaikan') { sisaKecil.push({ mak: a.key, nama: a.nama, sisa, alasan: sisa <= AMBANG ? `di bawah ambang Rp${fmt(AMBANG)}` : 'diabaikan' }); continue; }
            if (cara === 'tambah') {
                const u = getUbah(byId.get(paketId));
                const row = u.rows.filter(r => r.mak === a.key).sort((p, q) => q.pagu - p.pagu)[0];
                row.pagu += sisa; addRup(a.key, sisa);
                u.sumber.add('tambah'); u.catatan.push(`${a.key}: pagu ditambah Rp${fmt(sisa)} (DIPA pengadaan Rp${fmt(a.P)})`);
                continue;
            }
            butuhBaru.push({ a, sisa });
        }

        // ── 7. Paket baru (dikelompokkan) ────────────────────────────────
        const grupBaru = new Map();
        const modeGrup = cfg.grupPaketBaru || 'sub';
        for (const { a, sisa } of butuhBaru) {
            const teks = a.items.filter(i => i.kelas === 'P').map(i => `${i.grup} ${i.uraian}`).join(' ');
            const jenis = Classify.saranJenis(a.akun, teks);
            const khusus = MEETING.test(a.akun) ? '|meeting' : '';
            const key = modeGrup === 'akun' ? a.key : `${seg(a.key, modeGrup === 'komp' ? 5 : 6)}|${jenis}${khusus}`;
            if (!grupBaru.has(key)) grupBaru.set(key, { key, jenis, akun: [] });
            grupBaru.get(key).akun.push({ a, sisa });
        }
        const paketBaru = [];
        for (const g of [...grupBaru.values()].sort((x, y) => x.key.localeCompare(y.key))) paketBaru.push(buatPaketBaru(g));

        function buatPaketBaru(g) {
            const first = g.akun[0].a;
            const total = sum(g.akun, x => x.sisa);
            const anggaran = g.akun.flatMap(x => anggaranPerDana(x.a, x.sisa));
            // item yang diwakili: item pengadaan yang belum tercakup nama paket existing di MAK yang sama
            const items = [];
            for (const { a } of g.akun) {
                const P = a.items.filter(i => i.kelas === 'P');
                const khusus = itemTanpaPaket.get(a.key);
                let pilih = khusus ? P.filter(i => khusus.has(i.iid)) : P;
                if (!khusus) {
                    const nm = a.rup.filter(r => r.status === '3').map(r => tokens(r.nama));
                    const bebas = P.filter(i => { const ti = tokens(`${i.grup} ${i.uraian}`); return !nm.some(t => jaccard(t, ti) >= 0.5); });
                    if (bebas.length) pilih = bebas;
                }
                items.push(...pilih.map(i => ({ ...i, akun: a.key })));
            }
            items.sort((x, y) => y.pagu - x.pagu);
            const subK = seg(first.key, 6), kompK = seg(first.key, 5);
            const sub = nodes.get(subK) || {}, komp = nodes.get(kompK) || {};
            const tempat = modeGrup === 'komp' ? (komp.uraian || sub.uraian || '') : (sub.uraian || komp.uraian || '');
            const dom = items[0] ? bersihNama(items[0].uraian) : bersihNama(first.nama);
            const tempat2 = tempat || bersih(first.nama) || seg(first.key, 6);
            // tanda baca ASCII saja: teks RUP ikut diekspor ke sistem lain (SPSE, unduhan Excel)
            const nama = potong(`${dom}${tempat2 && tempat2 !== dom ? ' - ' + tempat2 : ''}`.trim(), 250);
            const daftar = items.map(i => `- ${i.grup ? bersih(i.grup) + ' > ' : ''}${bersih(i.uraian)}`);
            const uraian = potong(`${LABEL_JENIS[g.jenis] || 'Pengadaan'} untuk ${tempat || first.nama}${komp.uraian && komp.uraian !== tempat ? ' pada ' + komp.uraian : ''}.\n${daftar.join('\n')}`, 1000);
            const spekBaris = items.map(i => `- ${bersih(i.uraian)}${i.volume ? ': ' + i.volume.replace(/\s+/g, ' ') : ''}${i.harga ? ' x Rp' + fmt(i.harga) : ''}`);
            let spesifikasi = '';
            for (let n = 0; n < spekBaris.length; n++) {
                const next = spesifikasi + (spesifikasi ? '\n' : '') + spekBaris[n];
                const tail = n + 1 < spekBaris.length ? `\n(+${spekBaris.length - n - 1} item lain)` : '';
                if ((next + tail).length > 1000) { spesifikasi += `\n(+${spekBaris.length - n} item lain)`; break; }
                spesifikasi = next;
            }
            const akunUtama = g.akun.slice().sort((x, y) => y.sisa - x.sisa)[0].a.akun;
            const metode = Classify.saranMetode(g.jenis, total, akunUtama, items.map(i => `${i.grup} ${i.uraian}`).join(' '), cfg);
            const realP = sum(g.akun, x => sum(x.a.items.filter(i => i.kelas === 'P'), i => i.realisasi || 0));
            const paguP = sum(g.akun, x => x.a.P);
            const realisasi = paguP ? realP / paguP : 0;
            // paket saudara (terumumkan, sub-komponen lalu komponen yang sama) → lokasi & jadwal
            const saudara = cariSaudara(first.key, g.jenis);
            const jd = saudara.find(s => jadwalPaket(s));
            let jadwal, jadwalSumber;
            if (jd) { jadwal = jadwalPaket(jd); jadwalSumber = `ikut paket ${jd.id} (${potong(jd.nama, 50)})`; }
            else {
                const mulai = realisasi > 0 ? `${TA}-01` : clampYm(ymAdd(ymNow(), 1), TA);
                jadwal = rapikanJadwal({ awalPengadaan: mulai, akhirPengadaan: mulai, awalPekerjaan: mulai, akhirPekerjaan: `${TA}-12`, awalKebutuhan: mulai, kebutuhan: `${TA}-12` });
                jadwalSumber = realisasi > 0 ? 'mulai Januari karena sudah ada realisasi' : 'mulai bulan depan';
            }
            const lok = saranLokasi(first.key, saudara);
            const peringatanP = [];
            if (realisasi >= 0.5 && /Tender|Seleksi/.test(metode)) peringatanP.push(`Sudah terealisasi ${Math.round(realisasi * 100)}% tetapi metode ${metode} — cek cara pengadaan yang sudah berjalan`);
            if (anggaran.some(r => SD_BELUM_DIUJI.has(r.danaApbn))) peringatanP.push('Sumber dana PLN/SBSN belum pernah diuji lewat tool ini — isi manual di SiRUP');
            if (!lok.lokasiRaw.length) peringatanP.push('Lokasi belum bisa ditentukan — atur lokasi satker di Pengaturan');
            return {
                id: 'b:' + g.key, baru: true, grupKey: g.key, akun: g.akun.map(x => x.a.key), nama, anggaran, jenis: g.jenis, metode,
                uraian, spesifikasi, volume: '1 Paket', praDipa: false, pdn: true, umkm: total <= 15e9, spp: { ekonomi: true, sosial: true, lingkungan: false },
                lokasiRaw: lok.lokasiRaw, lokasiSumber: lok.sumber, lokasiTeks: lok.teks, jadwal, jadwalSumber, realisasi, items: items.length,
                total, pilih: !anggaran.some(r => SD_BELUM_DIUJI.has(r.danaApbn)), peringatan: peringatanP,
            };
        }
        function anggaranPerDana(a, pagu) {
            const parts = Object.entries(a.PbySd || { '': pagu }).filter(([, v]) => v > 0);
            const bobot = parts.map(([, v]) => v);
            const alok = parts.length > 1 ? bagi(pagu, bobot) : [pagu];
            return parts.map(([sd], i) => ({ mak: a.key, pagu: alok[i], danaApbn: SD_CODE[sd] || 'A', sd: sd || '', idLama: '' })).filter(r => r.pagu > 0);
        }
        function cariSaudara(mak, jenis) {
            const sub = seg(mak, 6) + '.', komp = seg(mak, 5) + '.', keg = seg(mak, 2) + '.';
            const skor = p => { const rs = rowsOf(p); const s = rs.some(r => r.mak.startsWith(sub)) ? 3 : rs.some(r => r.mak.startsWith(komp)) ? 2 : rs.some(r => r.mak.startsWith(keg)) ? 1 : 0; return s * 2 + (jenisPaket(p) === jenis ? 1 : 0); };
            return U.filter(p => skor(p) >= 4).sort((x, y) => skor(y) - skor(x) || (+y.pagu) - (+x.pagu));
        }
        function saranLokasi(mak, saudara) {
            const kro = nodes.get(seg(mak, 3)) || {};
            const teks = kro.lokasi || '';
            const satker = ctx.lokasiSatker && ctx.lokasiSatker.id_kabupaten ? ctx.lokasiSatker : null;
            if (teks && ctx.lokasiRkk && ctx.lokasiRkk[teks]) {
                const l = ctx.lokasiRkk[teks];
                const sdr = saudara.flatMap(s => s.lokasiRaw || []).find(x => +x.id_kabupaten === +l.id_kabupaten && x.detil);
                const detil = (satker && +satker.id_kabupaten === +l.id_kabupaten && satker.detil) || (sdr && sdr.detil) || (satker && satker.detil) || ctx.namaSatker || '';
                return { lokasiRaw: [{ id: '', id_provinsi: l.id_provinsi, id_kabupaten: l.id_kabupaten, detil, prov: l.prov, kab: l.kab }], sumber: `lokasi KRO di RKK (${teks})`, teks };
            }
            // lokasi paket saudara yang sama provinsi dengan satker (lokasi janggal tidak ditiru)
            for (const s of saudara) {
                const ls = (s.lokasiRaw || []).filter(l => l.id_kabupaten && l.detil);
                if (!ls.length) continue;
                if (satker && ls.some(l => +l.id_provinsi !== +satker.id_provinsi)) continue;
                return { lokasiRaw: ls.map(l => ({ ...l, id: '' })), sumber: `ikut paket ${s.id}`, teks };
            }
            if (satker) return { lokasiRaw: [{ id: '', id_provinsi: satker.id_provinsi, id_kabupaten: satker.id_kabupaten, detil: satker.detil, prov: satker.prov, kab: satker.kab }], sumber: 'lokasi satker (Pengaturan)', teks };
            return { lokasiRaw: [], sumber: '', teks };
        }
        function ymNow() { const d = ctx.hariIni || new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
        function clampYm(y, ta) { return y < `${ta}-01` ? `${ta}-01` : y > `${ta}-12` ? `${ta}-12` : y; }

        // peringatan pemecahan paket: ≥2 paket PL sejenis di satu sub-komponen, total > batas PL
        const batasPL = j => j === 'Pekerjaan Konstruksi' ? cfg.plKonstruksi : j === 'Jasa Konsultansi' ? cfg.plKonsultansi : cfg.plBarjas;
        for (const pb of paketBaru) {
            if (pb.metode !== 'Pengadaan Langsung') continue;
            const subs = new Set(pb.anggaran.map(r => seg(r.mak, 6)));
            const sejenis = [...paketBaru.filter(x => x !== pb && x.metode === 'Pengadaan Langsung' && x.jenis === pb.jenis && x.anggaran.some(r => subs.has(seg(r.mak, 6)))).map(x => x.total),
                ...U.filter(p => /Pengadaan Langsung/.test(p.metode || '') && jenisPaket(p) === pb.jenis && rowsOf(p).some(r => subs.has(seg(r.mak, 6)))).map(p => +p.pagu)];
            const tot = pb.total + sum(sejenis);
            if (sejenis.length && tot > batasPL(pb.jenis)) pb.peringatan.push(`Ada ${sejenis.length} paket Pengadaan Langsung ${pb.jenis.toLowerCase()} lain di sub-komponen ini (total Rp${fmt(tot)} > batas PL) — pastikan bukan pemecahan paket`);
        }

        // ── 8. Titipan: paket existing yang direvisi satu ke banyak ─────────
        const maxPer = cfg.maxPaketPerRevisi || 15;
        const eligible = p => isU(p) && !dibatalkan(p.id) && !paketTertahan.has(p.id) && !rowsOf(p).some(r => SD_BELUM_DIUJI.has(r.danaApbn))
            && !(ubah.get(p.id) && ubah.get(p.id).umumkanDulu && p.status !== '3');
        const muat = new Map();   // hostId → jumlah paket baru
        const titip = new Map();  // hostId → [paketBaru]
        const tier = (p, mak) => {
            const rs = (ubah.has(p.id) ? ubah.get(p.id).rows.filter(r => r.pagu > 0) : rowsOf(p));
            const lvl = rs.some(r => r.mak.startsWith(seg(mak, 5) + '.')) ? 0 : rs.some(r => r.mak.startsWith(seg(mak, 2) + '.')) ? 2 : rs.some(r => r.mak.startsWith(seg(mak, 1) + '.')) ? 4 : 6;
            return lvl + (ubah.has(p.id) ? 0 : 1) + (/Dikecualikan/.test(p.metode || '') ? 0.5 : 0);
        };
        for (const pb of paketBaru) {
            const mak = pb.anggaran[0] ? pb.anggaran[0].mak : pb.akun[0];
            const pilihan = U.filter(eligible).filter(p => (muat.get(p.id) || 0) < maxPer)
                .map(p => ({ p, t: tier(p, mak) })).sort((x, y) => x.t - y.t || (+x.p.pagu) - (+y.p.pagu));
            const o = (atur[pb.id] || {}).host;
            const host = (o && pilihan.find(x => x.p.id === o)) || pilihan[0];
            pb.kandidatHost = pilihan.slice(0, 8).map(x => ({ paketId: x.p.id, nama: x.p.nama, tier: x.t }));
            if (!host) { pb.hostId = null; pb.pilih = false; pb.peringatan.push('Tidak ada paket terumumkan yang bisa dititipi — minta PPK membuat satu paket dulu'); continue; }
            pb.hostId = host.p.id;
            pb.hostKet = host.t < 2 ? 'komponen yang sama' : host.t < 4 ? 'kegiatan yang sama' : host.t < 6 ? 'program yang sama' : 'komponen lain';
            muat.set(host.p.id, (muat.get(host.p.id) || 0) + 1);
            if (!titip.has(host.p.id)) titip.set(host.p.id, []);
            titip.get(host.p.id).push(pb);
        }

        // ── 9. Susun daftar perubahan ────────────────────────────────────
        const ALASAN = { np: 'mengeluarkan belanja non-pengadaan', pindah: 'penyesuaian MAK dengan DIPA revisi terakhir', lebih: 'penyesuaian pagu dengan pagu pengadaan DIPA',
            tambah: 'penambahan pagu sesuai DIPA revisi terakhir', susun: 'penyusunan ulang paket sesuai DIPA revisi terakhir', dana: 'penyesuaian sumber dana dengan DIPA' };
        const perubahan = [];
        for (const u of ubah.values()) {
            const p = u.paket;
            const sesudah = u.rows.filter(r => r.pagu > 0);
            const asal = rowsOf(p);
            const sig = rs => rs.map(r => `${r.mak}|${Math.round(r.pagu)}|${r.danaApbn || 'A'}`).sort().join(';');
            const tetap = sig(sesudah) === sig(asal.map(r => ({ mak: r.mak, pagu: +r.pagu, danaApbn: r.danaApbn || 'A' })));
            if (tetap && !u.sumber.has('susun') && !Object.keys(u.override).length) continue;
            const batal = !sesudah.length;
            if (batal && p.status === '2') { if (!batalFD.some(x => x.paketId === p.id)) batalFD.push({ paketId: p.id, nama: p.nama, pagu: +p.pagu, alasan: 'Tidak ada MAK DIPA yang tersisa', sumber: 'susun' }); continue; }
            const label = [...u.sumber].map(s => ({ np: 'keluarkan non-pengadaan', pindah: 'pindah MAK', lebih: 'potong kelebihan', tambah: 'tambah pagu', susun: 'susun ulang', dana: 'sumber dana' }[s]));
            const pk = batal ? null : Object.assign(pkDari(p, sesudah, cfg), u.override);
            const ch = {
                id: 'p:' + p.id, paketId: p.id, nama: p.nama, status: p.status, jenis: batal ? 'batal' : 'ubah', umumkanDulu: p.status === '2',
                label: batal ? ['batalkan', ...label] : label, catatan: u.catatan, sebelum: +p.pagu, sesudah: sum(sesudah, r => r.pagu),
                rowsSebelum: asal.map(r => ({ mak: r.mak, pagu: +r.pagu, danaApbn: r.danaApbn })), rowsSesudah: sesudah.map(r => ({ mak: r.mak, pagu: r.pagu, danaApbn: r.danaApbn, dari: r.dari })),
                alasan: 'Revisi: ' + [...u.sumber].map(s => ALASAN[s]).filter(Boolean).join('; '),
                pk, pilih: true, peringatan: [], titipanHost: titip.has(p.id),
            };
            if (asal.some(r => SD_BELUM_DIUJI.has(r.danaApbn))) { ch.pilih = false; ch.peringatan.push('Memuat sumber dana PLN/SBSN — belum pernah diuji lewat tool ini'); }
            if (pk) {
                if (pk.umkm && ch.sesudah > 15e9) { pk.umkm = false; ch.peringatan.push('Pagu > Rp15 M: penanda usaha kecil dilepas'); }
                const bj = batasPL(pk.jenis);
                if (/Pengadaan Langsung/.test(pk.metode) && ch.sesudah > bj && ch.sebelum <= bj) ch.peringatan.push(`Pagu naik melewati batas Pengadaan Langsung (Rp${fmt(bj)}) — cek metode`);
                if (!pk.jadwal) ch.peringatan.push('Jadwal paket tidak terbaca — isi manual');
                if ((p.jenisRaw || []).length > 1 && !pk.jenisList) ch.peringatan.push('Paket ini punya lebih dari satu jenis pengadaan; setelah pagu berubah dikirim sebagai satu jenis — cek');
                if (ctx.lokasiSatker && ctx.lokasiSatker.id_provinsi && (pk.lokasiRaw || []).length && pk.lokasiRaw.every(l => +l.id_provinsi !== +ctx.lokasiSatker.id_provinsi))
                    ch.lokasiLain = true;
            }
            perubahan.push(ch);
        }
        perubahan.sort((a, b) => a.paketId.localeCompare(b.paketId));

        const titipan = [...titip.entries()].map(([hostId, pbs]) => {
            const host = byId.get(hostId);
            const ch = perubahan.find(c => c.paketId === hostId && c.jenis === 'ubah');
            return { id: 't:' + hostId, hostId, nama: host.nama, pagu: +host.pagu, draft1: ch ? 'koreksi' : 'tetap', perubahanId: ch ? ch.id : null,
                paketBaru: pbs.map(x => x.id), pk1: Object.assign(pkDari(host, rowsOf(host).map(r => ({ idLama: r.id || '', mak: r.mak, pagu: +r.pagu, danaApbn: r.danaApbn || 'A', sumber: r.sumber, ta: r.ta, idKomponen: r.idKomponen,
                    asal: r.asal, asalSatker: r.asalSatker, kodeInstansi: r.kodeInstansi, kodeEselon: r.kodeEselon, kodeSatker: r.kodeSatker })), cfg), { pertahankan: true }), pilih: true };
        });

        if (U.some(p => rowsOf(p).some(r => r.danaApbn && r.danaApbn !== 'A')) && ![...akunMap.values()].some(a => (a.sd || []).length))
            peringatan.push('Satker ini memakai sumber dana selain RM, tetapi data DIPA tidak memuat sumber dana per akun (FA Detail). Unggah juga RKK supaya paket baru mendapat sumber dana yang benar; tanpa itu paket baru diisi RM.');

        const r = { kartu, perubahan, paketBaru, titipan, umumkan, batalFD, kekurangan, sisaKecil, tertahan, peringatan,
            target: sum([...akunMap.values()], a => a.P), sekarang: sum(U, p => +p.pagu), rupSetelah: Object.fromEntries(rup) };
        r.proyeksi = proyeksi(r);
        return r;
    }

    // Satu kelompok MAK lama → bagian (bucket) pembanding: per akun tujuan bila tujuannya >1;
    // bila tujuannya 1, per jenis pengadaan item DIPA, lalu dipadankan ke item lewat nama paket.
    function bucketize(rows, targets, rupNow) {
        const rupT = t => (rupNow ? rupNow(t.key) : t.rupU);
        const tokN = s => tokens(s);
        if (targets.length > 1) {
            const bs = targets.map((t, i) => ({ id: 'b' + i, label: t.key, jenis: '', target: t, items: t.items.filter(x => x.kelas === 'P'), dipa: t.P, sisa: Math.max(0, t.P - rupT(t)), rows: [] }));
            const isi = new Map(bs.map(b => [b, 0]));
            for (const x of rows.slice().sort((a, b) => b.r.pagu - a.r.pagu)) {
                const b = bs.slice().sort((p, q) => (q.sisa - isi.get(q)) - (p.sisa - isi.get(p)))[0];
                b.rows.push(x); isi.set(b, isi.get(b) + +x.r.pagu);
            }
            return bs;
        }
        const t = targets[0];
        const items = t.items.filter(i => i.kelas === 'P');
        const jenisItem = i => Classify.saranJenis(t.akun, `${i.grup || ''} ${i.uraian}`);
        const byJ = new Map();
        for (const i of items) { const j = jenisItem(i); if (!byJ.has(j)) byJ.set(j, { items: [], rows: [] }); byJ.get(j).items.push(i); }
        const semua = () => [{ id: 'b0', label: bersih(t.nama) || t.key, jenis: '', target: t, items, dipa: t.P, rows: rows.slice() }];
        let buckets;
        if (!rows.every(x => byJ.has(jenisPaket(x.p)))) buckets = semua();
        else {
            for (const x of rows) byJ.get(jenisPaket(x.p)).rows.push(x);
            buckets = [];
            for (const [j, g] of byJ) {
                if (g.items.length === 1 || !g.rows.length) { buckets.push({ jenis: j, items: g.items, rows: g.rows }); continue; }
                // Padankan paket ke item: kata yang membedakan antar-item (IDF antar-item), diberi bobot
                // menurut posisi di nama paket — kata jenis pekerjaan ada di depan ("Konsultan Pengawas …").
                const itemTok = g.items.map(i => tokN(`${i.grup || ''} ${i.uraian}`));
                const dfI = new Map(); for (const d of itemTok) for (const tk of d) dfI.set(tk, (dfI.get(tk) || 0) + 1);
                const idf = tk => Math.log((g.items.length + 1) / ((dfI.get(tk) || 0) + 0.5));
                const sub = new Map(g.items.map(i => [i.iid, { jenis: j, items: [i], rows: [] }]));
                const lepas = [];
                for (const x of g.rows) {
                    const urut = [...tokN(x.p.nama)];
                    const skor = g.items.map((i, n) => urut.reduce((s2, tk, pos) => s2 + (itemTok[n].has(tk) ? idf(tk) / (1 + pos) : 0), 0));
                    const order = skor.map((v, n) => [v, n]).sort((a, b) => b[0] - a[0]);
                    const [b1, b2] = [order[0], order[1] || [0, -1]];
                    if (b1[0] > 0 && b1[0] >= 1.5 * b2[0]) sub.get(g.items[b1[1]].iid).rows.push(x); else lepas.push(x);
                }
                if (lepas.length) buckets.push({ jenis: j, items: g.items, rows: g.rows }); // tak bisa dipadankan → satu bagian per jenis
                else buckets.push(...sub.values());
            }
        }
        const totalDipa = sum(buckets, b => sum(b.items, i => i.pagu));
        return buckets.map((b, i) => {
            const dipa = b.dipa != null ? b.dipa : sum(b.items, x => x.pagu);
            const ada = totalDipa ? rupT(t) * dipa / totalDipa : 0; // RUP yang sudah ada di akun tujuan, dibagi sebanding
            return { id: b.id || 'b' + i, label: b.label || (b.items.length === 1 ? bersih(b.items[0].uraian) : b.jenis), jenis: b.jenis, target: t, items: b.items, dipa, sisa: Math.max(0, dipa - ada), rows: b.rows };
        });
    }
    function paketGrup(rows) {
        const m = new Map();
        for (const x of rows) {
            const o = m.get(x.p.id) || { paketId: x.p.id, nama: x.p.nama, status: x.p.status, jenis: jenisPaket(x.p), metode: x.p.metode || '', pagu: +x.p.pagu, diGrup: 0 };
            o.diGrup += +x.r.pagu; m.set(x.p.id, o);
        }
        return [...m.values()].sort((a, b) => b.diGrup - a.diGrup);
    }

    // Proyeksi RUP terumumkan untuk pilihan saat ini (pilih = Map id→bool, default dari rencana)
    function proyeksi(r, pilih) {
        const on = x => (pilih && pilih.has(x.id)) ? pilih.get(x.id) : x.pilih !== false;
        let v = r.sekarang;
        const rinci = { ubah: 0, batal: 0, baru: 0, umumkan: 0 };
        for (const c of r.perubahan) {
            if (!on(c)) continue;
            if (c.jenis === 'batal') { v -= c.sebelum; rinci.batal -= c.sebelum; }
            else { const d = c.sesudah - (c.umumkanDulu ? 0 : c.sebelum); v += d; rinci.ubah += d; }
        }
        for (const pb of r.paketBaru) if (on(pb) && pb.hostId && (!pilih || !pilih.has('t:' + pb.hostId) || pilih.get('t:' + pb.hostId))) { v += pb.total; rinci.baru += pb.total; }
        for (const u of r.umumkan) if (on(u)) { v += u.pagu; rinci.umumkan += u.pagu; }
        return { sekarang: r.sekarang, setelah: v, target: r.target, rinci };
    }

    // Pemeriksaan isian sebelum dikirim (aturan form paket SiRUP)
    function periksa(pk, ctx) {
        const err = [];
        if (pk.pertahankan) return err;
        const ymOk = s => /^\d{4}-\d{2}$/.test(s || '');
        if (!pk.nama || !pk.nama.trim()) err.push('nama paket kosong');
        else if (pk.baru && pk.nama.trim().length < 5) err.push('nama paket terlalu pendek');
        const tot = sum(pk.anggaran, a => +a.pagu || 0);
        if (tot <= 0) err.push('pagu 0');
        for (const a of pk.anggaran) {
            // kode komponen bisa alfanumerik (mis. placeholder "ZZ1"), bukan hanya 3 angka
            if (!/^[A-Z]{2}\.\d{4}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\.[A-Z0-9]{1,2}\.\d{6}$/.test(a.mak)) err.push(`MAK ${a.mak} tidak 7 segmen`);
            if (!(+a.pagu > 0)) err.push(`pagu baris ${a.mak} kosong`);
            if (ctx && ctx.komponenId && !(a.idKomponen || ctx.komponenId(a.mak))) err.push(`komponen ${seg(a.mak, 5)} belum ada di PKKR`);
        }
        if (!pk.lokasiRaw || !pk.lokasiRaw.length) err.push('lokasi belum diisi');
        else if (pk.lokasiRaw.some(l => !l.id_provinsi || !l.id_kabupaten)) err.push('provinsi/kabupaten lokasi belum dipilih');
        else if (pk.lokasiRaw.some(l => !String(l.detil || '').trim())) err.push('detail lokasi kosong');
        else if (pk.lokasiRaw.some(l => String(l.detil || '').length > 1000)) err.push('detail lokasi > 1000 karakter');
        const j = pk.jadwal || {};
        const K = ['awalPengadaan', 'akhirPengadaan', 'awalPekerjaan', 'akhirPekerjaan', 'awalKebutuhan', 'kebutuhan'];
        if (K.some(k => !ymOk(j[k]))) err.push('jadwal belum lengkap');
        else {
            if (j.akhirPengadaan < j.awalPengadaan) err.push('akhir pemilihan sebelum awal pemilihan');
            if (j.awalPekerjaan < j.akhirPengadaan) err.push('awal kontrak sebelum akhir pemilihan');
            if (j.akhirPekerjaan < j.awalPekerjaan) err.push('akhir kontrak sebelum awal kontrak');
            if (j.kebutuhan < j.awalKebutuhan) err.push('akhir pemanfaatan sebelum awal pemanfaatan');
        }
        if (!String(pk.spesifikasi || '').trim()) err.push('spesifikasi kosong');
        else if (String(pk.spesifikasi).length > 1000) err.push(`spesifikasi ${String(pk.spesifikasi).length} karakter (maks. 1000)`);
        if (!String(pk.volume || '').trim()) err.push('volume kosong');
        if (!pk.metode) err.push('metode kosong');
        if (pk.metode === 'Seleksi' && pk.jenis !== 'Jasa Konsultansi') err.push('metode Seleksi hanya untuk jasa konsultansi');
        if (/^Tender/.test(pk.metode) && pk.jenis === 'Jasa Konsultansi') err.push('jasa konsultansi memakai Seleksi, bukan Tender');
        if (pk.umkm && tot > 15e9) err.push('paket > Rp15 M tidak bisa ditandai usaha kecil');
        if (pk.jenisList && Math.abs(sum(pk.jenisList, x => +x.pagu) - tot) > 1) err.push('jumlah pagu per jenis tidak sama dengan total');
        return err;
    }

    return { susun, proyeksi, periksa, isUmum, tokens, jaccard, bagi, ym, rapikanJadwal, jadwalPaket, pkDari, bucketize, SD_BELUM_DIUJI, TOL };
})();

if (typeof module !== 'undefined') module.exports = Rencana;
