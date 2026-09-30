// Uji ketahanan: jalankan rencana aksi untuk semua satker (paket terumumkan publik + detail JSON).
global.Classify = require('../src/classify.js');
const A = require('../src/analysis.js');
const fs = require('fs');
const SP = 'C:/Users/user/AppData/Local/Temp/claude/C--Users-user--claude/589e9048-9827-43f0-9bf8-5984b0c2c222/scratchpad/';
const dipaAll = require('./survey/dipa_all.json');
const dn = JSON.parse(fs.readFileSync(SP + 'denorm_bp.json', 'utf8'));
const pub = JSON.parse(fs.readFileSync(SP + 'kkp_pub_2026.json', 'utf8'));
const moner = JSON.parse(fs.readFileSync(SP + 'moner_tw1.json', 'utf8'));
const pubById = new Map(pub.P.map(p => [String(p.id), p]));
const bySatker = {};
for (const [id, j] of Object.entries(dn)) {
    const ag = j.paket_anggaran_json || [];
    const kode = (ag[0] || {}).kode_satker;
    if (!kode) continue;
    const pp = pubById.get(id) || {};
    (bySatker[kode] = bySatker[kode] || []).push({
        id, status: '3', aktif: 'true', nama: j.nama, pagu: j.pagu, metode: pp.metode, jenisPengadaan: [{ jenis: pp.jenisPengadaan }],
        sumberDana: ag.map(a => ({ id: a.id, mak: a.mak, pagu: a.pagu, danaApbn: a.id_dana_apbn, idKomponen: a.id_komponen })),
    });
}
const f = n => (n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 0 });
const cfg = { maxPaketPerRevisi: 15, jadwalDefault: {}, plBarjas: 200e6, plKonstruksi: 400e6, plKonsultansi: 100e6 };
console.log('kode   | P DIPA  | RUP umum | Moner TW1 | umum/P | batal | revisi | lebih→user | paket baru | tanpa donor | status akun');
let err = 0;
for (const kode of Object.keys(bySatker).sort()) {
    const d = dipaAll[kode];
    const x = d && (d.FA && !d.FA.err ? d.FA : d.RKK && !d.RKK.err ? d.RKK : null);
    if (!x) continue;
    try {
        // bangun ulang struktur parse dari itemsSample (key/uraian/pagu/sd/grup)
        const dipa = { nodes: [], items: x.itemsSample.map((it, i) => ({ ...it, no: String(i + 1) })) };
        const { akun } = A.buildDipa(dipa, {});
        const pakets = bySatker[kode];
        A.sanding(akun, pakets);
        const r = A.plan({ akunMap: akun, pakets, dipaNodes: new Map(), pkkr: new Map(), cfg });
        const T = t => r.actions.filter(a => a.type === t);
        const P = [...akun.values()].reduce((s, a) => s + a.P, 0);
        const U = pakets.reduce((s, p) => s + p.pagu, 0);
        const st = {}; for (const a of akun.values()) st[a.status] = (st[a.status] || 0) + 1;
        const rev = T('REVISI');
        console.log(kode, '|', f(P).padStart(7), '|', f(U).padStart(8), '|', (moner[kode] ? f(moner[kode].pagu) : '-').padStart(9), '|',
            (P ? (U / P * 100).toFixed(0) + '%' : '-').padStart(6), '|', String(T('BATAL').length).padStart(5), '|', String(rev.filter(a => !a.pakets.some(p => p.baru)).length).padStart(6), '|',
            String(rev.filter(a => !a.pilih).length).padStart(10), '|', String(rev.reduce((s, a) => s + a.pakets.filter(p => p.baru).length, 0)).padStart(10), '|',
            String(T('TANPA_DONOR').length).padStart(11), '|', Object.entries(st).map(([k, v]) => `${k}:${v}`).join(' '));
    } catch (e) { err++; console.log(kode, 'ERROR', e.stack.split('\n').slice(0, 3).join(' | ')); }
}
console.log('error:', err);
