// ──────────────────────────────────────────────────────── PENYESUAIAN PKKR ──
// Node PKKR hasil integrasi SAKTI terkunci (beku sejak 31 Juli 2026). Yang bisa
// disesuaikan hanya node Manual: pagu & nama diubah lewat form "Ubah", node yang
// tidak ada lagi di DIPA dinonaktifkan (bila tidak dipakai paket mana pun).
//  • node Manual "salinan" (kode sama dengan node Integrasi, mis. Program DL (Manual)):
//    pagu = jumlah pagu anak Manual-nya (rantai Manual paralel, cara BPPP Tegal);
//    bila tidak punya anak Manual (salinan penuh sampai daun) → pagu DIPA node itu.
//  • node Manual biasa (cabang baru): pagu = pagu DIPA node itu.
const PkkrPlan = (() => {
    const TOL = 1000;
    const LVN = ['prog', 'keg', 'kro', 'ro', 'komp', 'sub'];
    const bersih = s => String(s || '').replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const normal = s => bersih(s).toLowerCase();

    // pkkr: Map key → node (crawlPkkr); dipaNodes: Map key → {uraian, pagu}; pakets: paket RUP (sumberDana: mak, idKomponen);
    // swakelola: daftar paket swakelola (detail anggarannya tidak dibaca; yang ada hanya jalur komponen di daftar paket)
    function susun({ dipaNodes, pkkr, pakets, swakelola }) {
        const manual = [];
        for (const [key, n] of pkkr) {
            if (n.manual) manual.push({ ...n, key, salinan: false, integrasi: null });
            else if (n.manualTwin) manual.push({ ...n.manualTwin, key, salinan: true, integrasi: n });
        }
        const anakDari = k => manual.filter(m => m.key.startsWith(k + '.') && m.key.split('.').length === k.split('.').length + 1);
        const memo = new Map();
        const target = m => {
            if (memo.has(m.key)) return memo.get(m.key);
            const d = dipaNodes.get(m.key);
            const anak = anakDari(m.key);
            let v;
            if (m.salinan && anak.length) v = anak.reduce((s, c) => s + (target(c) || 0), 0);
            else v = d ? (+d.pagu || 0) : null;
            memo.set(m.key, v);
            return v;
        };
        // paket yang memakai node: baris anggaran ber-id komponen di bawah node, atau (untuk cabang baru) MAK berawalan kode node
        const komponenDi = m => manual.filter(x => x.level === 'komp' && (x.key === m.key || x.key.startsWith(m.key + '.'))).map(x => String(x.id));
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

        const ubah = [], nonaktif = [];
        for (const m of manual) {
            const t = target(m);
            const relevan = t != null && (dipaNodes.has(m.key) || t > 0);
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
            const gantiPagu = Math.abs((+m.pagu || 0) - t) > TOL;
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
        return { ubah, nonaktif, terkunci, manual: manual.length, swTakTerbaca: sw.filter(p => !p.jalur).length };
    }
    return { susun, bersih, LVN };
})();

if (typeof module !== 'undefined') module.exports = PkkrPlan;
