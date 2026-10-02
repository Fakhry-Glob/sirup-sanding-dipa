// node test/debug_satker.js <kode> : rincian rencana satu satker dari data survei (untuk menelusuri pelanggaran invarian)
global.Classify = require('../src/classify.js');
const A = require('../src/analysis.js'); const R = require('../src/rencana.js'); const fs = require('fs');
const SP = require('path').join(__dirname, 'data') + '/'; // data uji lokal (tidak ikut git)
const kode = process.argv[2];
const dipaAll = require('./survey/dipa_all.json'); const dn = JSON.parse(fs.readFileSync(SP + 'denorm_bp.json', 'utf8'));
const pakets = Object.entries(dn).filter(([, j]) => ((j.paket_anggaran_json || [])[0] || {}).kode_satker === kode).map(([id, j]) => ({ id, status: '3', aktif: 'true', jenisPaket: 'penyedia', nama: j.nama, pagu: j.pagu, metode: '', jenisPengadaan: [{ jenis: 'Barang' }],
    sumberDana: j.paket_anggaran_json.map(a => ({ id: String(a.id), mak: a.mak, pagu: a.pagu, danaApbn: a.id_dana_apbn })), lokasiRaw: (j.paket_lokasi_json || []).map(l => ({ id_provinsi: l.id_provinsi, id_kabupaten: l.id_kabupaten, detil: l.detil_lokasi })) }));
const d = dipaAll[kode]; const x = d.FA && !d.FA.err ? d.FA : d.RKK;
const cfg = { maxPaketPerRevisi: 15, plBarjas: 200e6, plKonstruksi: 400e6, plKonsultansi: 100e6, ambangSelisih: 1e6, ambangKeputusan: 100e6 };
const run = kep => { const { nodes, akun } = A.buildDipa({ nodes: [], items: x.itemsSample.map((it, i) => ({ ...it, no: String(i + 1) })) }, {}, { cekKeputusan: Object.fromEntries(Object.entries(kep).filter(([k]) => k.startsWith('cek:')).map(([k, v]) => [k.slice(4), v.opsi])) });
    const ps = JSON.parse(JSON.stringify(pakets)); A.sanding(akun, ps); return { akun, ps, r: R.susun({ akunMap: akun, pakets: ps, dipaNodes: nodes, cfg, tahun: 2026, hariIni: new Date('2026-09-30'), keputusan: kep, atur: {} }) }; };
let { r } = run({}); const kep = {};
for (const k of r.kartu) { if (k.jenis === 'PINDAH') kep[k.id] = { opsi: k.saran || 'sesuaikan', fd: 'biarkan' }; else if (k.jenis === 'LEBIH') kep[k.id] = { opsi: 'potong' }; else if (k.jenis === 'CEK') kep[k.id] = { opsi: 'NP' }; else if (k.jenis === 'TANPA_PADANAN') kep[k.id] = { opsi: 'keluarkan' }; }
const o = run(kep); r = o.r; const f = n => Math.round(n).toLocaleString('id-ID');
const after = new Map(Object.entries(r.rupSetelah)); for (const b of r.paketBaru) for (const a of b.anggaran) after.set(a.mak, (after.get(a.mak) || 0) + a.pagu);
for (const a of o.akun.values()) { const v = after.get(a.key) || 0; if (a.P > 0 && Math.abs(v - a.P) > 1e6 && !r.sisaKecil.some(s => s.mak === a.key)) console.log('AKUN', a.key, 'P', f(a.P), 'rupU awal', f(a.rupU), 'setelah', f(v)); }
for (const k of r.kartu.filter(k => k.jenis === 'PINDAH')) console.log('KARTU', k.id, k.pilihan, 'tujuan', k.target.join(','), 'lebih', f(k.lebih));
for (const b of r.paketBaru) console.log('BARU', b.id, f(b.total), 'host', b.hostId, b.hostKet, 'kand', (b.kandidatHost || []).slice(0, 3).map(c => c.paketId + ':' + c.tier).join(' '));
if (process.argv[3]) { const komp = process.argv[3]; for (const p of o.ps.filter(p => p.sumberDana.some(s => s.mak.startsWith(komp)))) console.log('SEKOMP', p.id, p.nama.slice(0, 40), p.sumberDana.map(s => s.mak + '=' + f(s.pagu)).join(' '), r.perubahan.find(c => c.paketId === p.id) ? r.perubahan.find(c => c.paketId === p.id).jenis : '-'); }
// RUP setelah rencana per baris: mana yang tersisa di luar akun pengadaan DIPA?
const sisaLuar = {};
for (const p of o.ps.filter(p => p.status === '3')) {
    const c = r.perubahan.find(y => y.paketId === p.id);
    const rows = c ? (c.jenis === 'batal' ? [] : c.rowsSesudah) : p.sumberDana;
    for (const s of rows) { const a = o.akun.get(s.mak); const kls = !a ? 'MAK-lama' : a.P > 0 ? 'P' : a.CEK > 0 ? 'CEK' : 'NP'; if (kls !== 'P') { const k = `${kls} ${s.mak}`; sisaLuar[k] = (sisaLuar[k] || 0) + s.pagu; } }
}
console.log('RUP tersisa di luar akun pengadaan:', Object.entries(sisaLuar).map(([k, v]) => `${k}=${f(v)}`).join(' | ') || '-');
console.log('proyeksi', f(r.proyeksi.setelah), 'target', f(r.target), 'kartu belum:', r.kartu.filter(k => !k.diputuskan).map(k => k.id).join(', '));
let fin = 0; const perAkun = new Map();
for (const p of o.ps.filter(p => p.status === '3')) { const c = r.perubahan.find(y => y.paketId === p.id); const rows = c ? (c.jenis === 'batal' ? [] : c.rowsSesudah) : p.sumberDana; for (const s of rows) { fin += s.pagu; perAkun.set(s.mak, (perAkun.get(s.mak) || 0) + s.pagu); } }
for (const b of r.paketBaru) for (const a of b.anggaran) { fin += a.pagu; perAkun.set(a.mak, (perAkun.get(a.mak) || 0) + a.pagu); }
console.log('Σ baris akhir', f(fin), 'vs proyeksi', f(r.proyeksi.setelah));
for (const a of o.akun.values()) { const v = perAkun.get(a.key) || 0; const l = (r.rupSetelah[a.key] || 0) + r.paketBaru.reduce((s, b) => s + b.anggaran.filter(x => x.mak === a.key).reduce((t, x) => t + x.pagu, 0), 0); if (Math.abs(v - l) > 1000) console.log('beda ledger', a.key, 'baris', f(v), 'ledger', f(l), 'P', f(a.P)); }
for (const b of r.paketBaru) { const s = b.anggaran.reduce((t, x) => t + x.pagu, 0); if (Math.abs(s - b.total) > 1) console.log('BARU total≠anggaran', b.id, f(b.total), f(s), JSON.stringify(b.anggaran)); }
for (const c of r.perubahan) { const p = o.ps.find(q => q.id === c.paketId); const s0 = p.sumberDana.reduce((t, x) => t + x.pagu, 0); if (Math.abs(s0 - c.sebelum) > 1) console.log('sebelum≠', c.paketId, c.sebelum, s0); }
console.log('rinci', JSON.stringify(r.proyeksi.rinci));
let dRow = 0, dProj = 0;
for (const p of o.ps.filter(p => p.status === '3')) {
    const c = r.perubahan.find(y => y.paketId === p.id);
    const s0 = p.sumberDana.reduce((t, x) => t + x.pagu, 0);
    const s1 = c ? (c.jenis === 'batal' ? 0 : c.rowsSesudah.reduce((t, x) => t + x.pagu, 0)) : s0;
    const pj = c ? (c.jenis === 'batal' ? -c.sebelum : c.sesudah - c.sebelum) : 0;
    dRow += s1 - s0; dProj += pj;
    if (Math.abs((s1 - s0) - pj) > 1) console.log('DELTA beda', p.id, 'row', f(s1 - s0), 'proj', f(pj), c && c.jenis);
}
console.log('dRow', f(dRow), 'dProj', f(dProj), 'U count', o.ps.filter(p => p.status === '3').length, 'perubahan', r.perubahan.length, 'uniq', new Set(r.perubahan.map(c => c.paketId)).size);
