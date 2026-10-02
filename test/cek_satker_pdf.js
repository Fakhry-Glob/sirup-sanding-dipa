// node test/cek_satker_pdf.js <pdf> [rup.json] : pagu pengadaan DIPA per jenis belanja + sanding per akun dengan RUP (data JSON dari SiRUP)
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const P = require('../src/dipa_parser.js');
global.Classify = require('../src/classify.js');
const A = require('../src/analysis.js');
const fs = require('fs');
const f = n => Math.round(n).toLocaleString('id-ID');
(async () => {
    const r = await P.parse(pdfjs, new Uint8Array(fs.readFileSync(process.argv[2])));
    console.log(`DIPA ${r.meta.jenis} ${r.meta.satker} ${r.meta.namaSatker} periode "${r.meta.periode}" total ${f(r.meta.total)} · item ${r.items.length} · rekonsiliasi ${r.check.ok && !r.check.mismatches.length ? 'lolos' : 'GAGAL ' + JSON.stringify(r.check.mismatches.slice(0, 3))}`);
    const { akun } = A.buildDipa(r, {});
    const g = {};
    for (const a of akun.values()) { const j = Classify.jenisBelanja(a.akun); g[j] = g[j] || { pagu: 0, P: 0, NP: 0, CEK: 0 }; g[j].pagu += a.pagu; g[j].P += a.P; g[j].NP += a.NP; g[j].CEK += a.CEK; }
    console.log('Per jenis belanja (pagu | pengadaan | non | cek):');
    for (const [k, v] of Object.entries(g)) console.log(`  ${k.padEnd(8)} ${f(v.pagu).padStart(16)} | ${f(v.P).padStart(15)} | ${f(v.NP).padStart(15)} | ${f(v.CEK).padStart(13)}`);
    const cek = [...akun.values()].flatMap(a => a.items.filter(i => i.kelas === 'CEK').map(i => `${a.key} ${i.uraian} Rp${f(i.pagu)} (${i.alasan})`));
    if (cek.length) console.log('Item perlu dicek:\n  ' + cek.join('\n  '));
    if (process.argv[3]) {
        const d = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
        const pakets = d.penyedia.filter(p => ['2', '3'].includes(p.status)).map(p => ({ ...p, sumberDana: (d.det[p.id] || []).map(x => ({ mak: x.mak, pagu: x.pagu, danaApbn: x.dana })) }));
        A.sanding(akun, pakets);
        const orph = pakets.flatMap(p => p.sumberDana.filter(s => !akun.has(s.mak)).map(s => ({ ...s, id: p.id, nama: p.nama, status: p.status })));
        console.log('\nSanding per akun (hanya yang tidak sesuai):');
        for (const a of [...akun.values()].sort((x, y) => x.key.localeCompare(y.key)))
            if (a.status !== 'SESUAI' && a.status !== 'NP') console.log(`  ${a.status.padEnd(13)} ${a.key} ${a.nama.slice(0, 34).padEnd(34)} pengadaan ${f(a.P).padStart(13)} · RUP ${f(a.rupU).padStart(13)} · selisih ${f(a.selisih).padStart(13)} · paket ${a.rup.map(x => x.paketId).join(',')}`);
        if (orph.length) { console.log('Baris RUP ber-MAK di luar DIPA:'); orph.forEach(o => console.log(`  ${o.mak} Rp${f(o.pagu)} · ${o.id} ${o.nama.slice(0, 50)} (status ${o.status})`)); }
        const P2 = [...akun.values()].reduce((s, a) => s + a.P, 0), U = pakets.filter(p => p.status === '3').reduce((s, p) => s + p.pagu, 0);
        console.log(`\nTotal pagu pengadaan DIPA Rp${f(P2)} · RUP terumumkan Rp${f(U)} · selisih Rp${f(U - P2)}`);
    }
})().catch(e => { console.error('GAGAL', e.message); process.exit(1); });
