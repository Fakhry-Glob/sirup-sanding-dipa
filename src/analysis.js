// ─────────────────────────────────────────────────────────────────── SANDING ──
// Menyandingkan DIPA (hasil parser) dengan PKKR dan paket RUP SiRUP per akun
// (MAK 7 segmen). Rencana perbaikannya disusun di src/rencana.js.
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
    function buildDipa(dipa, overrides, opts) {
        const cekSebagaiP = opts && opts.cekSebagai === 'P';
        const cekKep = (opts && opts.cekKeputusan) || {};   // alasan → 'P' | 'NP' (kartu "perlu dicek")
        const nodes = dipa.nodes instanceof Map ? dipa.nodes : new Map(dipa.nodes.map(n => [n.key, n]));
        const akun = new Map();
        dipa.items.forEach((it, idx) => {
            const code = it.key.split('.').pop();
            const node = nodes.get(it.key) || {};
            const iid = `${it.key}#${it.no || idx}`;
            let c = Classify.item(code, node.uraian, it.uraian, it.grup);
            const ov = overrides && overrides[iid];
            if (ov) c = { kelas: ov, alasan: 'Diubah manual', manual: true };
            else if (c.kelas === 'CEK' && cekKep[c.alasan]) c = { kelas: cekKep[c.alasan], alasan: c.alasan, cekAsal: c.alasan };
            else if (cekSebagaiP && c.kelas === 'CEK') c = { kelas: 'P', alasan: '(perlu cek → dihitung pengadaan) ' + c.alasan, cekAsal: c.alasan };
            let a = akun.get(it.key);
            if (!a) {
                a = { key: it.key, akun: code, nama: node.uraian || '', pagu: 0, P: 0, NP: 0, CEK: 0, items: [], rup: [], sd: node.sd || [] };
                akun.set(it.key, a);
            }
            const row = { iid, no: it.no, uraian: it.uraian, grup: it.grup || '', volume: it.volume || '', harga: it.harga ?? null, pagu: it.pagu || 0, realisasi: it.realisasi || 0,
                kelas: c.kelas, alasan: c.alasan, manual: !!c.manual, cekAsal: c.cekAsal || null };
            a.items.push(row);
            a.pagu += row.pagu;
            a[row.kelas] += row.pagu;
            if (row.kelas === 'P') { const sd = it.sd || (a.sd.length === 1 ? a.sd[0] : ''); a.PbySd = a.PbySd || {}; a.PbySd[sd] = (a.PbySd[sd] || 0) + row.pagu; }
        });
        return { nodes, akun };
    }

    // FA Detail (pagu revisi + realisasi) dilengkapi RKK pendamping: nama node, lokasi KRO,
    // sumber dana, serta volume & harga satuan item (dicocokkan per MAK + uraian).
    function gabungDipa(utama, pendamping) {
        const norm = s => String(s || '').toLowerCase().replace(/\[[^\]]*\]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
        let node = 0, item = 0;
        for (const [k, n] of utama.nodes) {
            const o = pendamping.nodes.get(k);
            if (!o) continue;
            if (!n.uraian && o.uraian) { n.uraian = o.uraian; node++; }
            if (!n.lokasi && o.lokasi) n.lokasi = o.lokasi;
            if ((!n.sd || !n.sd.length) && o.sd && o.sd.length) n.sd = o.sd;
        }
        const antre = new Map();
        for (const it of pendamping.items) { const k = it.key + '|' + norm(it.uraian); if (!antre.has(k)) antre.set(k, []); antre.get(k).push(it); }
        for (const it of utama.items) {
            const q = antre.get(it.key + '|' + norm(it.uraian));
            if (!q || !q.length) continue;
            const o = q.shift();
            if (!it.volume && o.volume) it.volume = o.volume;
            if (it.harga == null && o.harga != null) it.harga = o.harga;
            if (!it.sd && o.sd) it.sd = o.sd;
            item++;
        }
        return { node, item };
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
            const base = { mak: sd.mak, pagu: sd.pagu, danaApbn: sd.danaApbn, idLama: sd.id };
            const a = akunMap.get(sd.mak);
            if (!a) return { ...base, v: 'MAK_HILANG' };
            if (a.target === 0 && !a.CEK) return { ...base, v: 'NON_PENGADAAN', alasan: [...new Set(a.items.filter(i => i.kelas === 'NP').map(i => i.alasan))].join('; ') };
            // sumber dana paket harus salah satu SD akun di DIPA (hanya bisa dicek bila RKK diunggah)
            const danaDipa = (a.sd || []).map(x => SD_CODE[x]).filter(Boolean);
            const danaBeda = sd.danaApbn && danaDipa.length && !danaDipa.includes(sd.danaApbn) ? danaDipa[0] : null;
            if (a.status === 'LEBIH') return { ...base, v: 'LEBIH', selisih: a.selisih, danaBeda };
            return { ...base, v: danaBeda ? 'DANA_BEDA' : 'OK', danaBeda };
        });
        const all = v => rows.length && rows.every(r => r.v === v);
        const any = v => rows.some(r => r.v === v);
        let verdict = 'OK';
        if (p.status === '51') verdict = 'DIBATALKAN';
        else if (all('NON_PENGADAAN')) verdict = 'BATAL';
        else if (any('MAK_HILANG')) verdict = 'REVISI_MAK';
        else if (any('NON_PENGADAAN')) verdict = 'REVISI_KELUARKAN_NP';
        else if (any('LEBIH')) verdict = 'REVISI_LEBIH';
        else if (any('DANA_BEDA')) verdict = 'REVISI_DANA';
        if (p.status === '2' && verdict === 'OK') verdict = 'UMUMKAN';
        return { rows, verdict };
    }

    const BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
    function ym(s) {
        const m = String(s || '').trim().toLowerCase().match(/([a-z]+)\s+(\d{4})/);
        if (!m) return '';
        const i = BULAN.indexOf(m[1]);
        return i < 0 ? '' : `${m[2]}-${String(i + 1).padStart(2, '0')}`;
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

    return { SD_CODE, buildDipa, gabungDipa, diffPkkr, sanding, verdictPaket, strukturAnggaran, ym, ST, LV_SIRUP, levelOfKey, parentKey, TOL };
})();

if (typeof module !== 'undefined') module.exports = Analysis;
