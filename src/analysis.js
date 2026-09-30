// ─────────────────────────────────────────────────────────────────── SANDING ──
// Menyandingkan DIPA (hasil parser) dengan PKKR dan paket RUP SiRUP, lalu
// menyusun rencana aksi: tambah cabang PKKR, batalkan paket non-pengadaan,
// pindahkan MAK paket yang akunnya sudah tidak ada, dan paket baru untuk pagu
// pengadaan yang belum terumumkan.
const Analysis = (() => {
    const LV = ['prog', 'keg', 'kro', 'ro', 'komp', 'sub', 'akun'];
    const LV_SIRUP = { prog: 'program', keg: 'kegiatan', kro: 'kro', ro: 'ro', komp: 'komponen', sub: 'subkomponen' };
    const ST = { '11': 'Draft', '12': 'Draft', '2': 'Final Draft', '3': 'Terumumkan', '51': 'Dibatalkan' };
    const levelOfKey = k => LV[k.split('.').length - 1];
    const parentKey = k => k.split('.').slice(0, -1).join('.');
    const TOL = 1000; // selisih ≤ Rp1.000 dianggap sama (pembulatan)
    // kode SD di RKK → id_dana_apbn SiRUP (dipetakan dari paket nyata satker BPPSDMKP, Sep 2026)
    const SD_CODE = { RM: 'A', PLN: 'B', PNP: 'D', PNBP: 'D', BLU: 'F', SBSN: 'T' };

    // ── 1. DIPA per akun, dengan klasifikasi per item ────────────────────
    function buildDipa(dipa, overrides) {
        const nodes = dipa.nodes instanceof Map ? dipa.nodes : new Map(dipa.nodes.map(n => [n.key, n]));
        const akun = new Map();
        dipa.items.forEach((it, idx) => {
            const code = it.key.split('.').pop();
            const node = nodes.get(it.key) || {};
            const iid = `${it.key}#${it.no || idx}`;
            let c = Classify.item(code, node.uraian, it.uraian, it.grup);
            const ov = overrides && overrides[iid];
            if (ov) c = { kelas: ov, alasan: 'Diubah manual', manual: true };
            let a = akun.get(it.key);
            if (!a) {
                a = { key: it.key, akun: code, nama: node.uraian || '', pagu: 0, P: 0, NP: 0, CEK: 0, items: [], rup: [], sd: node.sd || [] };
                akun.set(it.key, a);
            }
            const row = { iid, no: it.no, uraian: it.uraian, grup: it.grup || '', volume: it.volume || '', pagu: it.pagu || 0, realisasi: it.realisasi || 0, kelas: c.kelas, alasan: c.alasan, manual: !!c.manual };
            a.items.push(row);
            a.pagu += row.pagu;
            a[row.kelas] += row.pagu;
            if (row.kelas === 'P') { const sd = it.sd || (a.sd.length === 1 ? a.sd[0] : ''); a.PbySd = a.PbySd || {}; a.PbySd[sd] = (a.PbySd[sd] || 0) + row.pagu; }
        });
        return { nodes, akun };
    }

    // ── 2. PKKR SiRUP vs DIPA ───────────────────────────────────────────
    // pkkr: Map key → {id, level, kode, nama, pagu, manual, ppk}
    function diffPkkr(dipaNodes, akunMap, pkkr) {
        // node DIPA yang di bawahnya ada pagu pengadaan (P/CEK)
        const pengadaanUnder = new Map();
        for (const a of akunMap.values()) {
            const v = a.P + a.CEK;
            if (!v) continue;
            const parts = a.key.split('.');
            for (let i = 1; i < parts.length; i++) {
                const k = parts.slice(0, i).join('.');
                pengadaanUnder.set(k, (pengadaanUnder.get(k) || 0) + v);
            }
        }
        const baru = [], hilang = [], beda = [];
        for (const n of dipaNodes.values()) {
            if (n.level === 'akun') continue;
            const s = pkkr.get(n.key);
            if (!s) {
                baru.push({ key: n.key, level: n.level, kode: n.kode, nama: n.uraian, pagu: n.pagu,
                    pengadaan: pengadaanUnder.get(n.key) || 0, parentKey: parentKey(n.key),
                    pilih: (pengadaanUnder.get(n.key) || 0) > 0 });
            } else if (Math.abs((s.pagu || 0) - (n.pagu || 0)) > TOL) {
                beda.push({ key: n.key, level: n.level, nama: n.uraian, paguDipa: n.pagu, paguSirup: s.pagu, manual: s.manual, id: s.id });
            }
        }
        for (const [k, s] of pkkr) if (!dipaNodes.has(k)) hilang.push({ key: k, level: s.level, nama: s.nama, pagu: s.pagu, manual: s.manual, id: s.id });
        const byDepth = (a, b) => a.key.split('.').length - b.key.split('.').length || a.key.localeCompare(b.key);
        baru.sort(byDepth);
        return { baru, hilang, beda };
    }

    // ── 3. RUP vs DIPA per akun ─────────────────────────────────────────
    function sanding(akunMap, pakets) {
        const orphans = [];
        for (const p of pakets) {
            p.verdicts = [];
            if (p.status === '51' || p.aktif === 'false' && p.status !== '3') continue;
            for (const sd of p.sumberDana || []) {
                const key = sd.mak;
                const a = akunMap.get(key);
                const ref = { paketId: p.id, nama: p.nama, status: p.status, pagu: sd.pagu, mak: key };
                if (a) a.rup.push(ref);
                else orphans.push(ref);
            }
        }
        for (const a of akunMap.values()) {
            const sum = st => a.rup.filter(r => st.includes(r.status)).reduce((s, r) => s + r.pagu, 0);
            a.rupU = sum(['3']);
            a.rupFD = sum(['2']);
            a.rupDraft = sum(['11', '12']);
            a.target = a.P;                 // pagu pengadaan yang semestinya terumumkan
            a.selisih = a.target - a.rupU;  // + kurang, − lebih
            if (a.rupU === 0 && a.target === 0) a.status = a.CEK ? 'CEK' : 'NP';
            else if (a.target === 0 && a.rupU > 0) a.status = a.CEK ? 'CEK' : 'NP_TERUMUMKAN';
            else if (Math.abs(a.selisih) <= TOL) a.status = 'SESUAI';
            else a.status = a.selisih > 0 ? 'KURANG' : 'LEBIH';
        }
        return { orphans };
    }

    // ── 4. Verdict per paket ────────────────────────────────────────────
    function verdictPaket(p, akunMap) {
        const rows = (p.sumberDana || []).map(sd => {
            const a = akunMap.get(sd.mak);
            if (!a) return { mak: sd.mak, pagu: sd.pagu, v: 'MAK_HILANG' };
            if (a.target === 0 && !a.CEK) return { mak: sd.mak, pagu: sd.pagu, v: 'NON_PENGADAAN', alasan: [...new Set(a.items.filter(i => i.kelas === 'NP').map(i => i.alasan))].join('; ') };
            if (a.status === 'LEBIH') return { mak: sd.mak, pagu: sd.pagu, v: 'LEBIH', selisih: a.selisih };
            return { mak: sd.mak, pagu: sd.pagu, v: 'OK' };
        });
        const all = v => rows.length && rows.every(r => r.v === v);
        const any = v => rows.some(r => r.v === v);
        let verdict = 'OK';
        if (p.status === '51') verdict = 'DIBATALKAN';
        else if (all('NON_PENGADAAN')) verdict = 'BATAL';
        else if (any('MAK_HILANG')) verdict = 'REVISI_MAK';
        else if (any('NON_PENGADAAN')) verdict = 'REVISI_KELUARKAN_NP';
        else if (any('LEBIH')) verdict = 'CEK_LEBIH';
        if (p.status === '2' && verdict === 'OK') verdict = 'UMUMKAN';
        return { rows, verdict };
    }

    // ── 5. Usulan pemindahan MAK untuk paket yang akunnya hilang ─────────
    // Hanya ke akun dengan kode sama DI KEGIATAN YANG SAMA (mis. FAN.ZZ1.ZZ1.GA.
    // 533121 → RBJ.725.301.GA.533121). Nilai paket tidak dipotong otomatis;
    // bila melebihi sisa pagu DIPA, baris ditandai agar diputuskan pengguna.
    function saranPindahMak(orphanRow, akunMap, sisa) {
        const parts = orphanRow.mak.split('.');
        const code = parts[6], keg = parts.slice(0, 2).join('.'), komp = parts.slice(0, 5).join('.'), sub = parts[5];
        const score = a => (a.key.startsWith(komp + '.') ? 4 : 0) + (a.key.split('.')[5] === sub ? 2 : 0) + ((sisa.get(a.key) || 0) > TOL ? 1 : 0);
        return [...akunMap.values()]
            .filter(a => a.akun === code && a.key.startsWith(keg + '.') && a.P > 0)
            .sort((x, y) => score(y) - score(x) || (sisa.get(y.key) || 0) - (sisa.get(x.key) || 0))
            .map(a => ({ key: a.key, sisa: sisa.get(a.key) || 0, nama: a.nama }));
    }

    // ── 6. Rencana aksi ─────────────────────────────────────────────────
    function plan(ctx) {
        const { akunMap, pakets, dipaNodes, pkkr, cfg } = ctx;
        const paketById = new Map(pakets.map(p => [p.id, p]));
        for (const p of pakets) Object.assign(p, verdictPaket(p, akunMap));
        const sisa = new Map([...akunMap.values()].map(a => [a.key, Math.max(0, a.selisih)]));
        const actions = [];

        // a. umumkan final draft yang sudah benar
        const fd = pakets.filter(p => p.verdict === 'UMUMKAN');
        if (fd.length) actions.push({ type: 'UMUMKAN', ids: fd.map(p => p.id), pagu: fd.reduce((s, p) => s + p.pagu, 0), pilih: true });

        // b. batalkan paket terumumkan yang seluruh MAK-nya non-pengadaan
        for (const p of pakets.filter(p => p.verdict === 'BATAL' && p.status === '3'))
            actions.push({ type: 'BATAL', paketId: p.id, nama: p.nama, pagu: p.pagu, pilih: true,
                alasan: 'Belanja non-pengadaan: ' + (p.rows.map(r => r.alasan).filter(Boolean)[0] || '') });

        // c. final draft bermasalah: hanya ditandai (bisa dikembalikan ke PPK)
        for (const p of pakets.filter(p => p.status === '2' && !['OK', 'UMUMKAN'].includes(p.verdict)))
            actions.push({ type: 'BATAL_FD', paketId: p.id, nama: p.nama, pagu: p.pagu, pilih: false, verdict: p.verdict,
                alasan: p.verdict === 'BATAL' ? 'Belanja non-pengadaan' : 'MAK tidak sesuai DIPA revisi terakhir' });

        // d. revisi paket terumumkan yang MAK-nya hilang / memuat akun NP
        for (const p of pakets.filter(p => ['REVISI_MAK', 'REVISI_KELUARKAN_NP'].includes(p.verdict) && p.status === '3')) {
            const anggaran = [], catatan = [];
            for (const r of p.rows) {
                if (!r.pagu) continue;
                if (r.v === 'NON_PENGADAAN') { catatan.push(`Baris ${r.mak} (Rp${fmt(r.pagu)}) dikeluarkan: ${r.alasan}`); continue; }
                if (r.v !== 'MAK_HILANG') { anggaran.push({ mak: r.mak, pagu: r.pagu }); continue; }
                const cands = saranPindahMak(r, akunMap, sisa);
                const tgt = cands[0];
                if (!tgt) { catatan.push(`Baris ${r.mak} (Rp${fmt(r.pagu)}) tidak punya padanan di DIPA — dihapus`); continue; }
                const s = sisa.get(tgt.key) || 0;
                const lebih = Math.max(0, r.pagu - s);
                sisa.set(tgt.key, Math.max(0, s - r.pagu));
                const row = { mak: tgt.key, pagu: r.pagu, dari: r.mak, kandidat: cands.slice(0, 6) };
                if (lebih > TOL) {
                    row.lebih = lebih;
                    catatan.push(`${tgt.key}: melebihi sisa pagu DIPA Rp${fmt(lebih)} (cek tahun jamak / nilai kontrak)`);
                }
                const same = anggaran.find(x => x.mak === row.mak && !x.lebih && !row.lebih);
                if (same) same.pagu += row.pagu; else anggaran.push(row);
            }
            const alasan = p.verdict === 'REVISI_MAK' ? 'Penyesuaian MAK dengan DIPA revisi terakhir' : 'Mengeluarkan akun non-pengadaan';
            if (!anggaran.length) {
                actions.push({ type: 'BATAL', paketId: p.id, nama: p.nama, pagu: p.pagu, pilih: true, alasan: alasan + '; tidak ada MAK DIPA yang tersisa' });
                continue;
            }
            actions.push({ type: 'REVISI', donorId: p.id, alasan, catatan, pilih: !anggaran.some(r => r.lebih),
                pakets: [paketDari(p, anggaran, akunMap, cfg)] });
        }

        // e. paket baru untuk sisa pagu pengadaan yang belum terumumkan,
        //    dititipkan ke revisi 1→N paket donor kecil yang sudah benar
        const baru = [];
        for (const a of [...akunMap.values()].sort((x, y) => x.key.localeCompare(y.key))) {
            const s = sisa.get(a.key) || 0;
            if (s <= Math.max(TOL, cfg.minPaketBaru || 0)) continue;
            baru.push(paketBaru(a, s, dipaNodes, cfg));
        }
        const donors = pakets.filter(p => p.status === '3' && p.verdict === 'OK' && p.aktif !== 'false').sort((x, y) => x.pagu - y.pagu);
        const per = cfg.maxPaketPerRevisi || 15;
        for (let i = 0; i < baru.length; i += per) {
            const donor = donors.shift();
            const chunk = baru.slice(i, i + per);
            if (!donor) { actions.push({ type: 'TANPA_DONOR', pilih: false, pakets: chunk }); continue; }
            actions.push({ type: 'REVISI', donorId: donor.id, alasan: 'Penambahan paket sesuai DIPA revisi terakhir', pilih: true,
                catatan: [`Paket #1 = paket donor ${donor.id} (isinya tidak diubah); paket #2 dst. adalah paket baru`],
                pakets: [paketDari(donor, donor.sumberDana.filter(s => s.pagu).map(s => ({ mak: s.mak, pagu: s.pagu })), akunMap, cfg), ...chunk] });
        }

        // f. cabang PKKR yang perlu ditambah (hanya yang memuat pagu pengadaan)
        const pk = diffPkkr(dipaNodes, akunMap, pkkr);
        const addNodes = pk.baru.filter(n => n.pilih);
        if (addNodes.length) actions.unshift({ type: 'PKKR_ADD', nodes: addNodes, pilih: true });

        return { actions, pkkrDiff: pk, paketById };
    }
    const fmt = n => Math.round(n).toLocaleString('id-ID');

    function namaCabang(key, dipaNodes) {
        const sub = dipaNodes.get(key.split('.').slice(0, 6).join('.'));
        const komp = dipaNodes.get(key.split('.').slice(0, 5).join('.'));
        return (sub && sub.uraian) || (komp && komp.uraian) || '';
    }

    function uraianItems(a, pagu) {
        const P = a.items.filter(i => i.kelas !== 'NP');
        const fmt = n => Math.round(n).toLocaleString('id-ID');
        return P.map((i, k) => `${k + 1}. ${i.grup ? i.grup + ' › ' : ''}${i.uraian}${i.volume ? ' (' + i.volume + ')' : ''} Rp${fmt(i.pagu)}`).join('\n')
            + (Math.abs(pagu - a.P) > TOL ? `\n(dialokasikan Rp${fmt(pagu)} dari Rp${fmt(a.P)})` : '');
    }

    // pecah pagu paket baru per sumber dana (RM/PNBP/BLU/SBSN) sesuai porsi item pengadaan
    function anggaranPerDana(a, pagu) {
        const parts = Object.entries(a.PbySd || { '': pagu }).filter(([, v]) => v > 0);
        const tot = parts.reduce((s, [, v]) => s + v, 0) || 1;
        let sisa = pagu;
        return parts.map(([sd, v], i) => {
            const x = i === parts.length - 1 ? sisa : Math.round(pagu * v / tot);
            sisa -= x;
            return { mak: a.key, pagu: x, danaApbn: SD_CODE[sd] || 'A', sd: sd || '' };
        });
    }

    function paketBaru(a, pagu, dipaNodes, cfg) {
        const jenis = Classify.saranJenis(a.akun, a.items.map(i => i.uraian).join(' '));
        const cab = namaCabang(a.key, dipaNodes);
        const kro = dipaNodes.get(a.key.split('.').slice(0, 3).join('.'));
        return {
            baru: true, pilih: true,
            nama: `${a.nama}${cab ? ' - ' + cab : ''}`.slice(0, 250),
            anggaran: anggaranPerDana(a, pagu),
            jenis, metode: Classify.saranMetode(jenis, pagu, a.akun, a.items.map(i => `${i.grup} ${i.uraian}`).join(' '), cfg),
            uraian: uraianItems(a, pagu), spesifikasi: uraianItems(a, pagu),
            volume: '1 Paket', praDipa: false, pdn: true, umkm: pagu <= 15e9,
            lokasiTeks: (kro && kro.lokasi) || '',
            jadwal: { ...cfg.jadwalDefault },
            spp: { ekonomi: true, sosial: true, lingkungan: false },
        };
    }

    function paketDari(p, anggaran, akunMap, cfg) {
        const pagu = anggaran.reduce((s, r) => s + r.pagu, 0);
        const jenis = (p.jenisPengadaan && p.jenisPengadaan[0] && p.jenisPengadaan[0].jenis) || 'Barang';
        return {
            baru: false, pilih: true, sumberId: p.id,
            nama: p.nama, anggaran, jenis, metode: p.metode || Classify.saranMetode(jenis, pagu, '', '', cfg),
            uraian: p.uraian || '', spesifikasi: p.spesifikasi || '', volume: p.volume || '1 Paket',
            praDipa: /ya/i.test(p.pradipa || ''), pdn: !/tidak/i.test(p.pdn || ''), umkm: /ya/i.test(p.ukm || ''),
            lokasi: p.lokasi || [], jadwal: jadwalDari(p) || { ...cfg.jadwalDefault },
            spp: { ekonomi: true, sosial: true, lingkungan: false },
        };
    }

    const BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
    function ym(s) {
        const m = String(s || '').trim().toLowerCase().match(/([a-z]+)\s+(\d{4})/);
        if (!m) return '';
        const i = BULAN.indexOf(m[1]);
        return i < 0 ? '' : `${m[2]}-${String(i + 1).padStart(2, '0')}`;
    }
    function jadwalDari(p) {
        if (!p.pemilihan) return null;
        return {
            awalPengadaan: ym(p.pemilihan.mulai), akhirPengadaan: ym(p.pemilihan.akhir),
            awalPekerjaan: ym(p.pelaksanaan && p.pelaksanaan.mulai), akhirPekerjaan: ym(p.pelaksanaan && p.pelaksanaan.akhir),
            awalKebutuhan: ym(p.pemanfaatan && p.pemanfaatan.mulai), kebutuhan: ym(p.pemanfaatan && p.pemanfaatan.akhir),
        };
    }

    // ── 7. Struktur anggaran yang direkomendasikan ───────────────────────
    // = total pagu paket terumumkan (setelah rencana dijalankan) per jenis belanja
    function strukturAnggaran(akunMap, extra) {
        const out = { barjas: 0, modal: 0, sosial: 0, hibah: 0, lainnya: 0 };
        for (const a of akunMap.values()) {
            const g = Classify.jenisBelanja(a.akun);
            if (g in out) out[g] += a.rupU;
        }
        for (const e of extra || []) {
            const g = Classify.jenisBelanja(e.mak.split('.').pop());
            if (g in out) out[g] += e.delta;
        }
        return out;
    }

    return { SD_CODE, buildDipa, diffPkkr, sanding, verdictPaket, plan, strukturAnggaran, ym, ST, LV_SIRUP, levelOfKey, parentKey, TOL };
})();

if (typeof module !== 'undefined') module.exports = Analysis;
