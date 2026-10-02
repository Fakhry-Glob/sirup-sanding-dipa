// ──────────────────────────────────────────────────────── PENYESUAIAN PKKR ──
// Node PKKR hasil integrasi SAKTI terkunci (beku sejak 31 Juli 2026). Yang bisa
// disesuaikan hanya node Manual: pagu & nama diubah lewat form "Ubah", node yang
// tidak ada lagi di DIPA dinonaktifkan (bila tidak dipakai paket mana pun).
//  • node Manual "salinan" (kode sama dengan node Integrasi, mis. Program DL (Manual)):
//    pagu = jumlah pagu anak Manual-nya (rantai Manual paralel, cara BPPP Tegal);
//    bila tidak punya anak Manual (salinan penuh sampai daun) → pagu DIPA node itu.
//  • node Manual biasa (cabang baru): pagu = pagu DIPA node itu.
//  • salinan non-daun tanpa anak Manual (rantai belum selesai dibuat): pagunya dibiarkan.
// SiRUP diam-diam menolak node yang membuat jumlah pagu anak melebihi pagu induknya
// (redirect sama seperti berhasil, tanpa pesan), jadi induk harus dinaikkan lebih dulu.
const PkkrPlan = (() => {
    const TOL = 1000;
    const LVN = ['prog', 'keg', 'kro', 'ro', 'komp', 'sub'];
    const bersih = s => String(s || '').replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const normal = s => bersih(s).toLowerCase();

    // pkkr: Map key → node (crawlPkkr); dipaNodes: Map key → {uraian, pagu}; pakets: paket RUP (sumberDana: mak, idKomponen);
    // swakelola: daftar paket swakelola (detail anggarannya tidak dibaca; yang ada hanya jalur komponen di daftar paket)
    // tertunda: kunci node DIPA (pengadaan) yang belum ada di PKKR — salinan di atasnya jangan diturunkan dulu
    // paketTerbaca: false bila paket RUP belum dibaca (pemakaian node belum bisa dicek)
    function susun({ dipaNodes, pkkr, pakets, swakelola, tertunda, paketTerbaca = true }) {
        const manual = [];
        for (const [key, n] of pkkr) {
            if (n.manual) manual.push({ ...n, key, salinan: false, integrasi: null });
            else if (n.manualTwin) manual.push({ ...n.manualTwin, key, salinan: true, integrasi: n });
        }
        const anakDari = k => manual.filter(m => m.key.startsWith(k + '.') && m.key.split('.').length === k.split('.').length + 1);
        const memo = new Map();
        // salinan non-daun tanpa anak Manual: rantai Manual belum selesai (mis. gagal di tengah) → jangan diisi pagu DIPA penuh
        const kosong = m => m.salinan && m.level !== 'sub' && !anakDari(m.key).length;
        const target = m => {
            if (memo.has(m.key)) return memo.get(m.key);
            const d = dipaNodes.get(m.key);
            const anak = anakDari(m.key);
            let v;
            if (m.salinan && anak.length) {
                // anak yang tidak relevan tetapi tidak bisa dinonaktifkan (dipakai paket / belum dicek) tetap ada di SiRUP,
                // jadi pagunya tetap dihitung — SiRUP menolak induk yang lebih kecil dari jumlah anaknya
                v = 0;
                for (const c of anak) { const tc = target(c); v += relevanT(c, tc) ? tc : tetapAda(c) ? (+c.pagu || 0) : 0; }
            }
            else if (kosong(m)) v = d ? (+m.pagu || 0) : null;
            else v = d ? (+d.pagu || 0) : null;
            memo.set(m.key, v);
            return v;
        };
        // paket yang memakai node: baris anggaran ber-id komponen di bawah node, atau (untuk cabang baru) MAK berawalan kode node
        const komponenDi = m => manual.filter(x => x.level === 'komp' && (x.key === m.key || x.key.startsWith(m.key + '.'))).map(x => String(x.id));
        const relevanT = (m, t) => t != null && (dipaNodes.has(m.key) || t > 0);
        const tetapAda = c => !paketTerbaca || dipakai(c).length > 0;
        const aktif = (pakets || []).filter(p => p.status !== '51');
        const sw = (swakelola || []).filter(p => p.status !== '51' && p.aktif !== 'false' && p.aktif !== false);
        const dipakai = m => {
            const ids = new Set(komponenDi(m));
            if (m.level === 'sub' && m.parentId) ids.add(String(m.parentId));
            const out = aktif.filter(p => (p.sumberDana || []).some(r => ids.has(String(r.idKomponen)) || (!m.salinan && String(r.mak || '').startsWith(m.key + '.')))).map(p => p.id);
            // swakelola: cocokkan jalur komponen (konservatif — node Integrasi berkode sama ikut dianggap dipakai)
            for (const p of sw) { const j = p.jalur || ''; if (j && (j === m.key || j.startsWith(m.key + '.') || m.key.startsWith(j + '.'))) out.push(p.id + ' (swakelola)'); }
            return [...new Set(out)];
        };

        const ubah = [], nonaktif = [], ditahan = [];
        const masihDitambah = m => m.salinan && (tertunda || []).some(k => k.startsWith(m.key + '.'));
        for (const m of manual) {
            const t = target(m);
            const relevan = relevanT(m, t);
            if (!relevan) {
                const pakai = dipakai(m);
                nonaktif.push({ key: m.key, level: m.level, id: m.id, parentId: m.parentId, nama: m.nama, pagu: m.pagu, salinan: m.salinan, dipakai: pakai, bisa: !pakai.length,
                    alasan: m.salinan ? 'Node Integrasi aslinya tidak ada lagi di DIPA dan tidak punya cabang Manual yang masih berlaku' : 'Tidak ada di DIPA revisi terakhir' });
                continue;
            }
            const d = dipaNodes.get(m.key) || {};
            let namaBaru = m.salinan ? bersih((m.integrasi && m.integrasi.nama) || m.nama).replace(/\s*\(Manual\)$/i, '') + (['prog', 'keg'].includes(m.level) ? ' (Manual)' : '')
                : (bersih(d.uraian) || bersih(m.nama));
            if (!namaBaru) namaBaru = m.nama;
            const gantiNama = normal(namaBaru) !== normal(m.nama) || /\[[^\]]*\]/.test(m.nama || '');
            let gantiPagu = Math.abs((+m.pagu || 0) - t) > TOL;
            // cabang DIPA di bawahnya belum selesai dibuat (mis. "Tambahkan cabang" gagal di tengah): induk yang sudah
            // dinaikkan jangan diturunkan lagi, nanti tetap dibutuhkan
            if (gantiPagu && t < (+m.pagu || 0) && masihDitambah(m)) { ditahan.push({ key: m.key, level: m.level, nama: m.nama, pagu: +m.pagu || 0, paguBaru: t }); gantiPagu = false; }
            if (!gantiNama && !gantiPagu) continue;
            const ket = [];
            if (gantiPagu) ket.push(m.salinan ? 'pagu = jumlah cabang Manual di bawahnya' : 'pagu = pagu DIPA');
            if (gantiNama) ket.push(/\[[^\]]*\]/.test(m.nama || '') ? 'buang catatan [..] dari SAKTI' : 'nama sesuai DIPA');
            ubah.push({ key: m.key, level: m.level, id: m.id, parentId: m.parentId, salinan: m.salinan, nama: m.nama, namaBaru: gantiNama ? namaBaru : m.nama, pagu: +m.pagu || 0, paguBaru: t, ket: ket.join('; ') });
        }
        // nonaktifkan dari bawah ke atas: anak lebih dulu
        nonaktif.sort((a, b) => b.key.split('.').length - a.key.split('.').length || a.key.localeCompare(b.key));
        ubah.sort((a, b) => a.key.split('.').length - b.key.split('.').length || a.key.localeCompare(b.key));
        // node Integrasi yang berbeda dari DIPA: hanya informasi (terkunci)
        const terkunci = [];
        for (const [key, n] of pkkr) {
            if (n.manual) continue;
            const d = dipaNodes.get(key);
            if (!d) terkunci.push({ key, level: n.level, nama: n.nama, pagu: n.pagu, paguDipa: null });
            else if (Math.abs((+n.pagu || 0) - (+d.pagu || 0)) > TOL) terkunci.push({ key, level: n.level, nama: n.nama, pagu: n.pagu, paguDipa: +d.pagu || 0 });
        }
        terkunci.sort((a, b) => a.key.localeCompare(b.key));
        const tanpaCabang = manual.filter(m => kosong(m) && dipaNodes.has(m.key)).map(m => ({ key: m.key, level: m.level, nama: m.nama, pagu: +m.pagu || 0 }));
        return { ubah, nonaktif, terkunci, manual: manual.length, swTakTerbaca: sw.filter(p => !p.jalur).length, tanpaCabang, ditahan };
    }

    // Rencana menambah cabang DIPA baru dalam rantai PKKR Manual paralel (cara BPPP Tegal).
    // pilih: node DIPA terpilih yang belum ada di PKKR ({key, level, kode, nama, pagu, parentKey}).
    // → buat: node yang dibuat (salinan induk dari level Program bila belum ada; pagunya = jumlah cabang baru di bawahnya),
    //   naik: node Manual yang sudah ada dan pagunya harus dinaikkan dulu supaya muat anak lama + anak baru.
    function rencanaTambah({ pilih, pkkr, dipaNodes }) {
        const keys = new Set(pilih.map(n => n.key));
        const dalam = k => k.split('.').length;
        const manualDi = k => { const n = pkkr.get(k); return n ? (n.manual ? n : n.manualTwin) || null : null; };
        const plan = new Map();
        for (const top of pilih.filter(n => !keys.has(n.parentKey))) {
            const parts = top.key.split('.');
            for (let i = 1; i < parts.length; i++) {
                const k = parts.slice(0, i).join('.');
                if (manualDi(k)) continue;                       // rantai Manual sudah ada di level ini
                const ada = pkkr.get(k), d = (dipaNodes && dipaNodes.get(k)) || {};
                const x = plan.get(k) || { key: k, level: LVN[i - 1], kode: parts[i - 1], parentKey: parts.slice(0, i - 1).join('.'),
                    nama: bersih((ada && ada.nama) || d.uraian || '').replace(/\s*\(Manual\)$/, '') + (i <= 2 ? ' (Manual)' : ''), pagu: 0, salinan: true };
                x.pagu += +top.pagu || 0;
                plan.set(k, x);
            }
        }
        for (const n of pilih) plan.set(n.key, { ...n, salinan: false });
        const buat = [...plan.values()].sort((a, b) => dalam(a.key) - dalam(b.key) || a.key.localeCompare(b.key));
        // induk Manual yang sudah ada: hitung dari yang terdalam supaya kenaikan anak ikut terhitung di induknya
        const induk = new Set();
        for (const n of buat) { const p = n.key.split('.'); for (let i = 1; i < p.length; i++) { const k = p.slice(0, i).join('.'); if (!plan.has(k) && manualDi(k)) induk.add(k); } }
        const paguBaru = new Map(), naik = [];
        for (const k of [...induk].sort((a, b) => dalam(b) - dalam(a))) {
            const m = manualDi(k);
            let perlu = 0;
            for (const [ck, cn] of pkkr) {
                if (dalam(ck) !== dalam(k) + 1 || !ck.startsWith(k + '.') || plan.has(ck)) continue;
                const cm = cn.manual ? cn : cn.manualTwin;
                if (!cm || (cm.parentId && String(cm.parentId) !== String(m.id))) continue;
                perlu += paguBaru.has(ck) ? paguBaru.get(ck) : (+cm.pagu || 0);
            }
            for (const n of buat) if (n.parentKey === k) perlu += +n.pagu || 0;
            if (perlu > (+m.pagu || 0) + 1) { paguBaru.set(k, perlu); naik.push({ key: k, level: m.level, id: m.id, nama: m.nama, pagu: +m.pagu || 0, paguBaru: perlu }); }
        }
        naik.sort((a, b) => dalam(a.key) - dalam(b.key));       // induk dulu
        return { buat, naik };
    }
    return { susun, rencanaTambah, bersih, LVN };
})();

if (typeof module !== 'undefined') module.exports = PkkrPlan;
