// Uji rencana penyesuaian PKKR Manual (src/pkkr.js) dengan PKKR 626402 + rantai Manual tiruan.
const D = require('./data626402.js');
const P = require('../src/pkkr.js');
const assert = require('assert');
const dipa = D.dipa();
const pkkr = D.pkkr();
// rantai Manual seperti yang dibuat tool pada 30 Sep 2026 (cara BPPP Tegal)
const tambah = (key, level, id, parentId, nama, pagu) => {
    const n = { id: String(id), level, kode: key.split('.').pop(), nama, pagu, key, manual: true, parentId: parentId && String(parentId) };
    const ada = pkkr.get(key);
    if (ada) ada.manualTwin = n; else pkkr.set(key, n);
};
const RAA = dipa.nodes.get('DL.2376.RAA');
tambah('DL', 'prog', 2975030, null, 'Program Pendidikan dan Pelatihan Vokasi (Manual)', 64588069000);
tambah('DL.2376', 'keg', 14082821, 2975030, 'Pendidikan Kelautan dan Perikanan (Manual)', 64588069000);
tambah('DL.2376.RAA', 'kro', 2494727, 14082821, 'Sarana Bidang Pendidikan[Penambahan alokasi dari SABA 999.08 ke 9A]', 64588069000);
tambah('DL.2376.RAA.711', 'ro', 3380741, 2494727, 'Peralatan dan Mesin Pendidikan Kelautan dan Perikanan', 64588069000);
tambah('DL.2376.RAA.711.301', 'komp', 5422955, 3380741, 'Peralatan dan Mesin Pendidikan KP', 64588069000);
tambah('DL.2376.RAA.711.301.GA', 'sub', 12259865, 5422955, 'Peralatan Pendidikan (Tahap I)', 64588069000);
// RBJ sudah dibuat Manual, tetapi salinan DL/2376 belum ikut dinaikkan
const RBJ = dipa.nodes.get('DL.2376.RBJ');
tambah('DL.2376.RBJ', 'kro', 2500001, 14082821, RBJ.uraian, RBJ.pagu);
// node Manual yang sudah tidak ada di DIPA: satu tidak dipakai, satu dipakai paket
tambah('DL.2376.XQA', 'kro', 2500002, 14082821, 'KRO lama', 5000000);
tambah('DL.2376.XQA.001', 'ro', 3500002, 2500002, 'RO lama', 5000000);
tambah('DL.2376.XQB', 'kro', 2500003, 14082821, 'KRO lama dipakai', 7000000);
tambah('DL.2376.XQB.001', 'ro', 3500003, 2500003, 'RO', 7000000);
tambah('DL.2376.XQB.001.051', 'komp', 5500003, 3500003, 'Komp', 7000000);
tambah('DL.2376.XQC', 'kro', 2500004, 14082821, 'KRO lama swakelola', 3000000);
tambah('DL.2376.XQC.002', 'ro', 3500004, 2500004, 'RO', 3000000);
tambah('DL.2376.XQC.002.051', 'komp', 5500004, 3500004, 'Komp', 3000000);
const pakets = [{ id: '99000001', status: '3', sumberDana: [{ mak: 'DL.2376.XQB.001.051.AA.521211', pagu: 7000000, idKomponen: 5500003 }] }];
// paket swakelola hanya punya jalur komponen dari daftar paket; satu lagi tanpa jalur (tidak bisa dicek)
const swakelola = [{ id: '99000002', status: '3', aktif: 'true', jalur: 'DL.2376.XQC.002.051' }, { id: '99000003', status: '3', aktif: 'true', jalur: '' }, { id: '99000004', status: '51', aktif: 'false', jalur: 'DL.2376.XQA.001.051' }];

const r = P.susun({ dipaNodes: dipa.nodes, pkkr, pakets, swakelola });
const f = n => Math.round(n).toLocaleString('id-ID');
for (const u of r.ubah) console.log('UBAH', u.key, u.level, `"${u.nama}" → "${u.namaBaru}"`, f(u.pagu), '→', f(u.paguBaru), '|', u.ket);
for (const n of r.nonaktif) console.log('NONAKTIF', n.key, n.bisa ? 'bisa' : 'DIPAKAI ' + n.dipakai.join(','), '|', n.alasan);
console.log('terkunci (Integrasi beda/hilang):', r.terkunci.length);

const cari = k => r.ubah.find(u => u.key === k);
const target = RAA.pagu + RBJ.pagu;
assert.strictEqual(cari('DL').paguBaru, target, 'salinan Program = RAA + RBJ');
assert.strictEqual(cari('DL.2376').paguBaru, target, 'salinan Kegiatan = RAA + RBJ');
assert.strictEqual(cari('DL.2376.RAA').namaBaru, 'Sarana Bidang Pendidikan', 'catatan [..] dibuang');
assert(!r.ubah.some(u => u.key === 'DL.2376.RAA.711.301.GA'), 'node yang sudah sesuai tidak diubah');
const xqa = r.nonaktif.filter(n => n.key.startsWith('DL.2376.XQA'));
assert(xqa.length === 2 && xqa.every(n => n.bisa), 'node Manual tak terpakai bisa dinonaktifkan');
assert(r.nonaktif.findIndex(n => n.key === 'DL.2376.XQA.001') < r.nonaktif.findIndex(n => n.key === 'DL.2376.XQA'), 'anak dinonaktifkan lebih dulu');
assert(r.nonaktif.filter(n => n.key.startsWith('DL.2376.XQB')).every(n => !n.bisa && n.dipakai.includes('99000001')), 'node yang dipakai paket tidak boleh dinonaktifkan');
assert(!r.ubah.some(u => !pkkr.get(u.key).manual && !pkkr.get(u.key).manualTwin), 'node Integrasi tidak pernah diubah');
assert(r.nonaktif.filter(n => n.key.startsWith('DL.2376.XQC')).every(n => !n.bisa && n.dipakai.includes('99000002 (swakelola)')), 'node yang dipakai swakelola tidak boleh dinonaktifkan');
assert(xqa.every(n => !n.dipakai.length), 'swakelola yang sudah dibatalkan tidak menghalangi');
assert.strictEqual(r.swTakTerbaca, 1, 'swakelola tanpa jalur komponen dihitung');
console.log('\nSemua uji PKKR lulus.');
