global.Classify = require('../src/classify.js');
const A = require('../src/analysis.js');
const fs = require('fs');
const SP = 'C:/Users/user/AppData/Local/Temp/claude/C--Users-user--claude/589e9048-9827-43f0-9bf8-5984b0c2c222/scratchpad/';
const dipa = JSON.parse(fs.readFileSync(SP + 'fa_js_626402.json', 'utf8'));
const tree = JSON.parse(fs.readFileSync(SP + 'pkkr_626402.json', 'utf8'));
const pakets = JSON.parse(fs.readFileSync(SP + 'rup_detail_626402.json', 'utf8'));
const pkkr = new Map();
const LV = ['prog', 'keg', 'kro', 'ro', 'komp', 'sub'];
(function walk(ns, pk, d) {
    for (const n of ns) {
        const key = pk ? pk + '.' + n.kode : n.kode;
        pkkr.set(key, { id: n.id, level: LV[d], kode: n.kode, nama: n.nama, pagu: +n.pagu || 0, manual: false });
        if (n.children) walk(n.children, key, d + 1);
    }
})(tree, '', 0);
const { nodes, akun } = A.buildDipa(dipa, {});
A.sanding(akun, pakets);
const cfg = { minPaketBaru: 0, maxPaketPerRevisi: 15, jadwalDefault: {}, plBarjas: 200e6, plKonstruksi: 400e6, plKonsultansi: 100e6 };
const r = A.plan({ akunMap: akun, pakets, dipaNodes: nodes, pkkr, cfg });
const f = n => Math.round(n).toLocaleString('id-ID');
const cnt = {};
for (const a of r.actions) cnt[a.type] = (cnt[a.type] || 0) + 1;
console.log(cnt);
for (const a of r.actions.filter(a => a.type === 'REVISI'))
    console.log(a.donorId, a.pilih ? 'Y' : 'N', a.pakets.length, 'paket |',
        a.pakets[0].anggaran.map(x => x.mak.split('.').slice(2).join('.') + '=' + f(x.pagu) + (x.dari ? '<-' + x.dari.split('.').slice(2, 6).join('.') : '') + (x.lebih ? ' LEBIH ' + f(x.lebih) : '')).join(' + ').slice(0, 170),
        '|', (a.catatan || []).join('; ').slice(0, 110));
for (const a of r.actions.filter(a => a.type !== 'REVISI' && a.type !== 'PKKR_ADD'))
    console.log(a.type, a.pilih ? 'Y' : 'N', a.paketId || a.ids, a.nama ? a.nama.slice(0, 50) : '', a.pagu ? f(a.pagu) : '', a.alasan || '');
fs.writeFileSync(SP + 'plan_626402.json', JSON.stringify(r.actions, null, 1));
