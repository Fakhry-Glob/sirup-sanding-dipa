// Uji rencana perbaikan (src/rencana.js) dengan data nyata 626402.
// node test/test_rencana.js [--rinci]
const D = require('./data626402.js');
const R = require('../src/rencana.js');
const assert = require('assert');
const A = D.A;
const f = n => Math.round(n).toLocaleString('id-ID');
const M = n => (n / 1e9).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' M';
const rinci = process.argv.includes('--rinci');

const pkkr = D.pkkr();
const komponenId = mak => { const p = mak.split('.'); const sub = pkkr.get(p.slice(0, 6).join('.')); if (sub && sub.parentId) return sub.parentId; const k = pkkr.get(p.slice(0, 5).join('.')); return k ? k.id : null; };
const cfg = { plBarjas: 200e6, plKonstruksi: 400e6, plKonsultansi: 100e6, metodeEO: 'Tender', ambangSelisih: 1e6, ambangKeputusan: 100e6, grupPaketBaru: 'sub', maxPaketPerRevisi: 15 };
function jalan(keputusan, atur, opsi = {}) {
    const dipa = D.dipa();
    const cekKep = {};
    for (const [k, v] of Object.entries(keputusan || {})) if (k.startsWith('cek:') && v.opsi) cekKep[k.slice(4)] = v.opsi;
    const { nodes, akun } = A.buildDipa(dipa, {}, { cekKeputusan: cekKep });
    const pakets = D.pakets();
    A.sanding(akun, pakets);
    return R.susun({ akunMap: akun, pakets, dipaNodes: nodes, cfg: { ...cfg, ...opsi }, tahun: 2026, hariIni: new Date('2026-09-30'), keputusan, atur,
        lokasiSatker: D.LOKASI_SATKER, lokasiRkk: { 'KOTA JAKARTA PUSAT': { id_provinsi: 11, id_kabupaten: 14748, prov: 'DKI Jakarta', kab: 'Jakarta Pusat (Kota)' } }, komponenId });
}
function laporan(judul, r) {
    const p = r.proyeksi;
    console.log(`\n== ${judul}`);
    console.log(`Proyeksi: sekarang ${M(p.sekarang)} → setelah ${M(p.setelah)} (target ${M(p.target)}) · rinci ubah ${M(p.rinci.ubah)}, batal ${M(p.rinci.batal)}, baru ${M(p.rinci.baru)}, umumkan ${M(p.rinci.umumkan)}`);
    console.log(`Kartu: ${r.kartu.length} (${r.kartu.filter(k => !k.diputuskan).length} belum diputuskan) · perubahan ${r.perubahan.length} (${r.perubahan.filter(c => c.jenis === 'batal').length} batal) · paket baru ${r.paketBaru.length} di ${r.titipan.length} titipan · umumkan FD ${r.umumkan.length} · batal FD ${r.batalFD.length} · sisa kecil ${r.sisaKecil.length} (Rp${f(r.sisaKecil.reduce((s, x) => s + x.sisa, 0))})`);
    for (const k of r.kartu) console.log(`  [${k.diputuskan ? (k.otomatis ? 'otomatis' : 'diputuskan') : 'BELUM'}] ${k.id} :: ${k.judul} → ${k.pilihan}${k.lebih != null ? ` (lebih Rp${f(k.lebih)})` : ''}`);
    if (rinci) {
        for (const c of r.perubahan) console.log(`  ${c.jenis} ${c.paketId} ${c.nama.slice(0, 40)} ${f(c.sebelum)}→${f(c.sesudah)} [${c.label.join(', ')}] ${c.peringatan.join(' | ')}`);
        for (const b of r.paketBaru) console.log(`  BARU ${b.id} "${b.nama.slice(0, 60)}" Rp${f(b.total)} ${b.jenis}/${b.metode} host ${b.hostId} (${b.hostKet}) lokasi[${b.lokasiSumber}] jadwal[${b.jadwalSumber}] ${b.peringatan.join(' | ')}`);
    }
}

// ── Skenario A: tanpa keputusan pengguna (default) ──
const r0 = jalan({}, {});
laporan('Default (belum ada keputusan)', r0);
const kart = id => r0.kartu.find(k => k.id === id || k.id.startsWith(id + '|'));
assert(kart('pindah:DL.2376|533121') && kart('pindah:DL.2376|533121').pilihan === null, 'modernisasi 533121 wajib diputuskan');
assert(kart('pindah:DL.2376|532111') && kart('pindah:DL.2376|532111').pilihan === null, '532111 (dengan final draft Rp188 M) wajib diputuskan');
assert(kart('pindah:DL.2375|524119') && kart('pindah:DL.2375|524119').pilihan === null, '524119 0A→0B wajib diputuskan');
assert(kart('np') && kart('np').pilihan === 'keluarkan', 'non-pengadaan default dikeluarkan');
// target kartu yang belum diputuskan tidak boleh dibuatkan paket baru / tambah pagu
for (const t of ['DL.2376.RBJ.725.301.GA.533121', 'DL.2376.RAA.711.301.GA.532111', 'DL.2375.SCC.831.101.0B.524119']) {
    assert(!r0.paketBaru.some(b => b.akun.includes(t)), 'paket baru untuk tujuan kartu tertunda ' + t);
    assert(!r0.perubahan.some(c => c.rowsSesudah.some(x => x.mak === t) && c.label.includes('tambah pagu')), 'tambah pagu untuk tujuan tertunda ' + t);
}
// tidak ada paket baru di bawah ambang
assert(r0.paketBaru.every(b => b.total > cfg.ambangSelisih), 'paket baru di bawah ambang');
// titipan satu komponen bila ada paket satu komponen
const U = D.pakets().filter(p => p.status === '3');
for (const b of r0.paketBaru) {
    const komp = b.anggaran[0].mak.split('.').slice(0, 5).join('.') + '.';
    const adaSekomp = U.some(p => (p.sumberDana || []).some(s => s.mak.startsWith(komp)));
    if (adaSekomp && b.hostId) assert.strictEqual(b.hostKet, 'komponen yang sama', `titipan ${b.id} lintas komponen padahal ada paket sekomponen`);
    assert(!/Aceh/i.test(b.lokasiRaw.map(l => l.prov).join(' ')), 'paket baru berlokasi Aceh ' + b.id);
    assert(!/dialokasikan/.test(b.uraian + b.spesifikasi), 'catatan internal di uraian');
}
// tambah pagu hanya ke paket umum
for (const k of r0.kekurangan.filter(k => k.cara === 'tambah')) assert(k.kandidat.find(x => x.paketId === k.paketId).umum, 'tambah pagu ke paket spesifik ' + k.mak);
// semua isian lolos pemeriksaan
const semuaPk = [...r0.perubahan.filter(c => c.pk).map(c => ['ubah ' + c.paketId, c.pk]), ...r0.paketBaru.map(b => ['baru ' + b.id, b])];
const gagal = semuaPk.map(([n, pk]) => [n, R.periksa(pk, { komponenId })]).filter(([, e]) => e.length);
if (gagal.length) console.log('Isian bermasalah:', gagal.slice(0, 12).map(([n, e]) => `${n}: ${e.join(', ')}`));
assert(gagal.every(([n, e]) => e.every(x => /komponen .* belum ada di PKKR|jadwal belum lengkap|Pengadaan Langsung/.test(x))), 'isian gagal diperiksa');

// ── Skenario B: semua kartu diputuskan "sesuaikan ke DIPA" ──
const kepB = {};
for (const k of r0.kartu) {
    if (k.jenis === 'PINDAH') kepB[k.id] = { opsi: k.saran === 'tetap' ? 'tetap' : 'sesuaikan', fd: 'biarkan' };
    if (k.jenis === 'LEBIH') kepB[k.id] = { opsi: 'potong' };
    if (k.jenis === 'CEK') kepB[k.id] = { opsi: 'NP' };
    if (k.jenis === 'TANPA_PADANAN') kepB[k.id] = { opsi: 'keluarkan' };
}
const rB = jalan(kepB, {});
laporan('Semua kartu → ikuti DIPA', rB);
const sisaB = rB.sisaKecil.reduce((s, x) => s + x.sisa, 0);
assert(Math.abs(rB.proyeksi.setelah - (rB.target - sisaB)) < 5e6, `proyeksi ${M(rB.proyeksi.setelah)} ≠ target − sisa kecil ${M(rB.target - sisaB)}`);
const modern = rB.kartu.find(k => k.id.startsWith('pindah:DL.2376|533121|'));
console.log('Bagian modernisasi:', modern.bucket.map(b => `${b.label} [${b.jenis}] RUP ${M(b.rup)} vs DIPA ${M(b.dipa)} (${b.paket.length} paket)`).join(' | '));
assert(modern.bucket.some(b => /Pengawas/i.test(b.label) && b.paket.length === 11), 'paket pengawas dipadankan ke item Pengawas');
assert(rB.paketBaru.some(b => /Perencanaan/i.test(b.nama)), 'bagian Perencanaan tanpa paket → paket baru');

// ── Skenario C: modernisasi pagu tetap (tahun jamak) ──
const ID533 = r0.kartu.find(k => k.id.startsWith('pindah:DL.2376|533121|')).id;
const rC = jalan({ ...kepB, [ID533]: { opsi: 'tetap', fd: 'biarkan' } }, {});
laporan('Modernisasi pagu tetap', rC);
assert(rC.proyeksi.setelah > rB.proyeksi.setelah + 150e9, 'pagu tetap harus menyisakan kelebihan ±Rp164 M');

// ── Skenario D: susun ulang modernisasi, pertahankan 1 paket per bagian ──
const rD = jalan({ ...kepB, [ID533]: { opsi: 'susun', fd: 'kembalikan' } }, {});
laporan('Modernisasi disusun ulang', rD);
const kd = rD.kartu.find(k => k.id === ID533);
const simpan = Object.values(kd.susun).flatMap(s => s.simpan);
assert(rD.perubahan.filter(c => c.jenis === 'batal' && c.label.includes('susun ulang')).length >= 18, 'paket yang tidak dipertahankan dibatalkan');
assert(simpan.every(id => rD.perubahan.some(c => c.paketId === id && c.jenis === 'ubah')), 'paket yang dipertahankan direvisi');
assert(rD.batalFD.some(x => x.sumber === ID533), 'final draft kelompok dikembalikan ke PPK');

// ── Skenario E: pengguna memilih paket baru (bukan tambah pagu) untuk satu akun ──
const k1 = r0.kekurangan.find(k => k.cara === 'tambah');
const rE = jalan({}, { [k1.mak]: { cara: 'baru' } });
assert(rE.paketBaru.some(b => b.akun.includes(k1.mak)), 'override cara=baru dihormati');
console.log('\nSemua uji rencana lulus.');
