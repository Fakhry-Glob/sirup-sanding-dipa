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
// XQB (dipakai paket) dan XQC (dipakai swakelola) tidak bisa dinonaktifkan → pagunya tetap dihitung di induk; XQA tidak
const target = RAA.pagu + RBJ.pagu + 7000000 + 3000000;
assert.strictEqual(cari('DL').paguBaru, target, 'salinan Program = RAA + RBJ + node lama yang masih dipakai');
assert.strictEqual(cari('DL.2376').paguBaru, target, 'salinan Kegiatan = RAA + RBJ + node lama yang masih dipakai');
const rBelum = P.susun({ dipaNodes: dipa.nodes, pkkr, pakets: [], swakelola: [], paketTerbaca: false });
assert.strictEqual(rBelum.ubah.find(u => u.key === 'DL.2376').paguBaru, target + 5000000, 'paket belum dibaca → semua anak lama tetap dihitung');
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

// ── Salinan induk tanpa cabang Manual (rantai gagal di tengah, seperti WA 2 Okt 2026) → pagu dibiarkan ──
{
    const pk2 = D.pkkr();
    const ada = pk2.get('WA');
    ada.manualTwin = { id: '2975355', level: 'prog', kode: 'WA', nama: 'Program Dukungan Manajemen (Manual)', pagu: 237618000, key: 'WA', manual: true, parentId: null };
    const r2 = P.susun({ dipaNodes: dipa.nodes, pkkr: pk2, pakets: [] });
    assert(!r2.ubah.some(u => u.key === 'WA'), 'salinan tanpa cabang tidak dinaikkan ke pagu DIPA penuh');
    assert(!r2.nonaktif.some(u => u.key === 'WA'), 'salinan tanpa cabang yang masih ada di DIPA tidak dinonaktifkan');
    assert(r2.tanpaCabang.some(x => x.key === 'WA'), 'salinan tanpa cabang dilaporkan');
}

// ── Tambah cabang ke rantai Manual yang sudah ada (keadaan produksi 626402, 2 Okt 2026) ──
// Program DL (Manual) 64,59 M sudah penuh oleh Kegiatan 2376 (Manual); SiRUP menolak Kegiatan 2375 (24 M) di bawahnya
// tanpa pesan. Rencana harus menaikkan induk Manual dulu, dari atas ke bawah.
{
    const pk3 = D.pkkr();
    const twin = (key, level, id, parentId, nama, pagu) => {
        const n = { id: String(id), level, kode: key.split('.').pop(), nama, pagu, key, manual: true, parentId: parentId && String(parentId) };
        const ada = pk3.get(key); if (ada && !ada.manual) ada.manualTwin = n; else pk3.set(key, n);
    };
    twin('DL', 'prog', 2975030, null, 'Program Pendidikan dan Pelatihan Vokasi (Manual)', 64588069000);
    twin('DL.2376', 'keg', 14082821, 2975030, 'Pendidikan Kelautan dan Perikanan (Manual)', 64588069000);
    twin('DL.2376.RAA', 'kro', 2494727, 14082821, 'Sarana Bidang Pendidikan', 64588069000);
    twin('DL.2376.RAA.711', 'ro', 3380741, 2494727, 'Peralatan dan Mesin', 64588069000);
    twin('DL.2376.RAA.711.301', 'komp', 5422955, 3380741, 'Peralatan dan Mesin Pendidikan KP', 64588069000);
    twin('DL.2376.RAA.711.301.GA', 'sub', 12259865, 5422955, 'Peralatan Pendidikan (Tahap I)', 64588069000);
    twin('WA', 'prog', 2975355, null, 'Program Dukungan Manajemen (Manual)', 237618000);
    const { akun } = D.A.buildDipa(dipa, {}, {});
    const diff = D.A.diffPkkr(dipa.nodes, akun, pk3);
    const pilih = diff.baru.filter(n => n.pilih);
    const { buat, naik } = P.rencanaTambah({ pilih, pkkr: pk3, dipaNodes: dipa.nodes });
    const M = n => (n / 1e9).toFixed(2) + ' M';
    console.log(`\nTambah cabang: ${pilih.length} node DIPA terpilih → buat ${buat.length} node, naikkan ${naik.length} induk`);
    for (const x of naik) console.log('  NAIK', x.key, M(x.pagu), '→', M(x.paguBaru));
    for (const n of buat.filter(n => n.salinan)) console.log('  SALINAN', n.key, M(n.pagu));
    assert(!buat.some(n => ['DL', 'DL.2376', 'WA'].includes(n.key)), 'node Manual yang sudah ada tidak dibuat ulang');
    assert(naik.every((x, i) => i === 0 || naik[i - 1].key.split('.').length <= x.key.split('.').length), 'induk dinaikkan lebih dulu');
    // simulasikan hasilnya: setiap node Manual (lama + baru) harus muat anak-anaknya
    const pagu = new Map(), induk = new Map();
    for (const [k, n] of pk3) { const m = n.manual ? n : n.manualTwin; if (m) { pagu.set(k, +m.pagu); induk.set(k, k.split('.').slice(0, -1).join('.')); } }
    for (const x of naik) pagu.set(x.key, x.paguBaru);
    for (const n of buat) { pagu.set(n.key, +n.pagu); induk.set(n.key, n.parentKey); }
    const anak = new Map();
    for (const [k, p] of induk) if (p) anak.set(p, (anak.get(p) || 0) + pagu.get(k));
    const lewat = [...anak].filter(([p, t]) => pagu.has(p) && t > pagu.get(p) + 1);
    assert(!lewat.length, 'jumlah pagu anak melebihi induk: ' + lewat.map(([p, t]) => `${p} ${M(t)} > ${M(pagu.get(p))}`).join('; '));
    if (pilih.some(n => n.key.startsWith('DL.2376.') ) && pilih.some(n => n.key.startsWith('DL.') && !n.key.startsWith('DL.2376')))
        assert(naik.some(x => x.key === 'DL') && naik.some(x => x.key === 'DL.2376'), 'Program DL dan Kegiatan 2376 (Manual) dinaikkan');
    // gagal di tengah: induk sudah dinaikkan, cabang belum dibuat → penyesuaian tidak menurunkannya lagi
    for (const x of naik) { const n = pk3.get(x.key); (n.manual ? n : n.manualTwin).pagu = x.paguBaru; }
    const tertunda = diff.baru.filter(n => n.pengadaan > 0).map(n => n.key);
    const r4 = P.susun({ dipaNodes: dipa.nodes, pkkr: pk3, pakets: [], tertunda });
    assert(!r4.ubah.some(u => naik.some(x => x.key === u.key) && u.paguBaru < u.pagu), 'induk yang dinaikkan tidak diturunkan selama cabangnya belum dibuat');
    assert(naik.every(x => r4.ditahan.some(d => d.key === x.key)), 'penurunan yang ditahan dilaporkan');
    const r5 = P.susun({ dipaNodes: dipa.nodes, pkkr: pk3, pakets: [] });
    assert(naik.every(x => r5.ubah.some(u => u.key === x.key && u.paguBaru < u.pagu)), 'tanpa cabang tertunda, salinan kembali = jumlah anak');
}
console.log('\nSemua uji PKKR lulus.');
