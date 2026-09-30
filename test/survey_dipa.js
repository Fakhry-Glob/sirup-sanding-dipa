// Survei lintas satker: parse semua PDF DIPA, klasifikasi, dan kumpulkan pola anomali.
const pdfjs = require('C:/Users/user/AppData/Local/Temp/claude/C--Users-user--claude/589e9048-9827-43f0-9bf8-5984b0c2c222/scratchpad/pdfjs_test/node_modules/pdfjs-dist/legacy/build/pdf.js');
const P = require('../src/dipa_parser.js');
global.Classify = require('../src/classify.js');
const A = require('../src/analysis.js');
const fs = require('fs'), path = require('path');
const DIRS = { FA: 'C:/Users/user/OneDrive/DOWNLOAD/FA_Detail_16_Segmen_2026_09', RKK: 'C:/Users/user/OneDrive/DOWNLOAD/Rincian_Kertas_Kerja_Satker_2026_DIPA_Fix' };
const OUT = path.join(__dirname, 'survey');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
    const res = {};
    for (const [jenis, d] of Object.entries(DIRS)) for (const f of fs.readdirSync(d).filter(f => f.endsWith('.pdf'))) {
        const kode = (f.match(/_(\d{6})_/) || [])[1];
        try {
            const r = await P.parse(pdfjs, new Uint8Array(fs.readFileSync(path.join(d, f))));
            const { akun } = A.buildDipa(r, {});
            const s = { P: 0, NP: 0, CEK: 0, byGroup: {}, cek: [], akunCodes: {}, sd: {} };
            for (const a of akun.values()) {
                s.P += a.P; s.NP += a.NP; s.CEK += a.CEK;
                const g = Classify.jenisBelanja(a.akun);
                s.byGroup[g] = (s.byGroup[g] || 0) + a.P;
                s.akunCodes[a.akun] = (s.akunCodes[a.akun] || 0) + a.pagu;
                for (const x of a.sd || []) s.sd[x] = (s.sd[x] || 0) + a.pagu;
                for (const it of a.items) if (it.kelas === 'CEK') s.cek.push({ mak: a.key, akun: a.akun, uraian: it.uraian, pagu: it.pagu, alasan: it.alasan });
            }
            res[kode] = res[kode] || { nama: f.replace(/\.pdf$/, '') };
            res[kode][jenis] = { total: r.meta.total, items: r.items.length, ok: r.check.ok && !r.check.mismatches.length, periode: r.meta.periode, ...s,
                itemsSample: r.items.map(i => ({ key: i.key, uraian: i.uraian, pagu: i.pagu, sd: i.sd || '', grup: i.grup || '' })) };
        } catch (e) { res[kode] = res[kode] || {}; res[kode][jenis] = { err: e.message }; }
    }
    fs.writeFileSync(path.join(OUT, 'dipa_all.json'), JSON.stringify(res));
    const f = n => Math.round(n / 1e6).toLocaleString('id-ID');
    console.log('kode   | FA total(jt) | P(jt)   NP(jt)  CEK(jt) | modal(jt) | SD(RKK) | nama');
    for (const [k, v] of Object.entries(res).sort()) {
        const x = v.FA && !v.FA.err ? v.FA : v.RKK;
        if (!x || x.err) { console.log(k, 'ERR', (v.FA || v.RKK || {}).err); continue; }
        const sd = v.RKK && v.RKK.sd ? Object.keys(v.RKK.sd).join('/') : '';
        console.log(k, '|', f(x.total).padStart(10), '|', f(x.P).padStart(8), f(x.NP).padStart(8), f(x.CEK).padStart(7), '|', f(x.byGroup.modal || 0).padStart(8), '|', sd.padEnd(10), '|', (v.nama || '').slice(0, 55));
    }
})();
