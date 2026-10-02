// Uji ketahanan rencana untuk semua satker BPPSDMKP (paket terumumkan publik + JSON denormalisasi).
// Memeriksa invarian yang harus berlaku di satker mana pun, bukan hanya 626402.
global.Classify = require('../src/classify.js');
const A = require('../src/analysis.js');
const R = require('../src/rencana.js');
const fs = require('fs');
const SP = require('path').join(__dirname, 'data') + '/'; // data uji lokal (tidak ikut git)
const dipaAll = require('./survey/dipa_all.json');
const dn = JSON.parse(fs.readFileSync(SP + 'denorm_bp.json', 'utf8'));
const pub = JSON.parse(fs.readFileSync(SP + 'kkp_pub_2026.json', 'utf8'));
const pubById = new Map(pub.P.map(p => [String(p.id), p]));
const bySatker = {};
for (const [id, j] of Object.entries(dn)) {
    const ag = j.paket_anggaran_json || [];
    const kode = (ag[0] || {}).kode_satker;
    if (!kode) continue;
    const pp = pubById.get(id) || {};
    const lokNama = String(pp.lokasi || '').split(/;\s*/).map(x => x.split(', '));
    (bySatker[kode] = bySatker[kode] || []).push({
        id, status: '3', aktif: 'true', jenisPaket: 'penyedia', nama: j.nama, pagu: j.pagu, metode: pp.metode || '', jenisPengadaan: [{ jenis: pp.jenisPengadaan }],
        sumberDana: ag.map(a => ({ id: String(a.id), mak: a.mak, pagu: a.pagu, danaApbn: a.id_dana_apbn, idKomponen: a.id_komponen, sumber: a.sumber_dana, ta: a.tahun_anggaran_dana,
            asal: a.asal_dana, asalSatker: a.asal_dana_satker, kodeInstansi: a.kode_instansi, kodeEselon: a.kode_esselon, kodeSatker: a.kode_satker })),
        lokasiRaw: (j.paket_lokasi_json || []).map((l, i) => ({ id: String(l.id), id_provinsi: l.id_provinsi, id_kabupaten: l.id_kabupaten, detil: l.detil_lokasi, prov: (lokNama[i] || [])[0] || '', kab: (lokNama[i] || [])[1] || '' })),
        jenisRaw: (j.paket_jenis_json || []).map(x => ({ id: String(x.id), jenisid: x.jenisid, pagu: x.jumlah_pagu })),
        tanggal: { awalPengadaan: (j.tanggal_awal_pengadaan || '').slice(0, 7), akhirPengadaan: (j.tanggal_akhir_pengadaan || '').slice(0, 7), awalPekerjaan: (j.tanggal_awal_pekerjaan || '').slice(0, 7), akhirPekerjaan: (j.tanggal_akhir_pekerjaan || '').slice(0, 7) },
        uraianRaw: j.keterangan || '', spesifikasiRaw: j.spesifikasi || '', volume: j.volume || '1 Paket',
    });
}
const M = n => (n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 0 });
const cfg = { maxPaketPerRevisi: 15, plBarjas: 200e6, plKonstruksi: 400e6, plKonsultansi: 100e6, ambangSelisih: 1e6, ambangKeputusan: 100e6, grupPaketBaru: 'sub' };
let err = 0, n = 0;
const langgar = [];
const cekInv = (kode, nama, ok, pesan) => { if (!ok) langgar.push(`${kode} ${nama}: ${pesan}`); };
console.log('kode   | P DIPA  | RUP umum | kartu (wajib) | ubah | batal | baru/titip | tertahan | proyeksi ikut-saran vs target');
for (const kode of Object.keys(bySatker).sort()) {
    const d = dipaAll[kode];
    const x = d && (d.FA && !d.FA.err ? d.FA : d.RKK && !d.RKK.err ? d.RKK : null);
    if (!x) continue;
    n++;
    try {
        const jalan = kep => {
            const cekKep = {}; for (const [k, v] of Object.entries(kep)) if (k.startsWith('cek:') && v.opsi) cekKep[k.slice(4)] = v.opsi;
            const dipa = { nodes: [], items: x.itemsSample.map((it, i) => ({ ...it, no: String(i + 1) })) };
            const { nodes, akun } = A.buildDipa(dipa, {}, { cekKeputusan: cekKep });
            const pakets = JSON.parse(JSON.stringify(bySatker[kode]));
            A.sanding(akun, pakets);
            return { akun, pakets, r: R.susun({ akunMap: akun, pakets, dipaNodes: nodes, cfg, tahun: 2026, hariIni: new Date('2026-09-30'), keputusan: kep, atur: {} }) };
        };
        const a0 = jalan({});
        // semua kartu mengikuti saran (yang wajib: sesuaikan / potong / keluarkan / non-pengadaan)
        const kep = {};
        for (const k of a0.r.kartu) {
            if (k.jenis === 'PINDAH') kep[k.id] = { opsi: k.saran || 'sesuaikan', fd: 'biarkan' };
            else if (k.jenis === 'LEBIH') kep[k.id] = { opsi: 'potong' };
            else if (k.jenis === 'CEK') kep[k.id] = { opsi: 'NP' };
            else if (k.jenis === 'TANPA_PADANAN') kep[k.id] = { opsi: 'keluarkan' };
        }
        const { r, pakets } = jalan(kep);
        const wajib = a0.r.kartu.filter(k => !k.diputuskan).length;
        // ── invarian ──
        const sisa = r.sisaKecil.reduce((s, y) => s + y.sisa, 0);
        const tetapLebih = r.kartu.filter(k => k.jenis === 'PINDAH' && k.pilihan === 'tetap').reduce((s, k) => s + Math.max(0, k.lebih), 0);
        // perubahan/paket yang sengaja tidak dicentang (mis. sumber dana SBSN/PLN) tidak ikut proyeksi
        const tak = r.perubahan.filter(c => c.pilih === false).reduce((s2, c) => s2 + Math.abs(c.jenis === 'batal' ? c.sebelum : c.sesudah - c.sebelum), 0)
            + r.paketBaru.filter(b => b.pilih === false).reduce((s2, b) => s2 + b.total, 0);
        const gap = r.proyeksi.setelah - (r.target - sisa);
        cekInv(kode, 'proyeksi', gap >= -5e6 - tak && gap <= tetapLebih + tak + 5e6, `proyeksi ${M(r.proyeksi.setelah)} vs target−sisa ${M(r.target - sisa)} (tetap +${M(tetapLebih)}, tak dicentang ${M(tak)})`);
        cekInv(kode, 'ambang', r.paketBaru.every(b => b.total > cfg.ambangSelisih), 'paket baru di bawah ambang');
        const ids = r.perubahan.map(c => c.paketId);
        cekInv(kode, 'unik', new Set(ids).size === ids.length, 'paket muncul di dua perubahan');
        for (const c of r.perubahan) {
            cekInv(kode, c.paketId, c.rowsSesudah.every(y => y.pagu > 0), 'baris pagu ≤ 0');
            cekInv(kode, c.paketId, Math.abs(c.rowsSesudah.reduce((s, y) => s + y.pagu, 0) - c.sesudah) < 1, 'jumlah baris ≠ total');
            if (c.pk) { const e = R.periksa(c.pk, {}).filter(y => !/jadwal|lokasi|spesifikasi kosong|Seleksi|Tender/.test(y)); cekInv(kode, c.paketId, !e.length, e.join(', ')); }
        }
        for (const t of r.titipan) {
            const c = r.perubahan.find(y => y.paketId === t.hostId);
            cekInv(kode, t.hostId, !c || c.jenis !== 'batal', 'paket yang dibatalkan dijadikan titipan');
            cekInv(kode, t.hostId, t.paketBaru.length <= cfg.maxPaketPerRevisi, 'titipan > batas per revisi');
        }
        const U = pakets.filter(p => p.status === '3');
        for (const b of r.paketBaru) {
            const komp = b.anggaran[0].mak.split('.').slice(0, 5).join('.') + '.';
            if (b.hostId && U.some(p => p.sumberDana.some(s => s.mak.startsWith(komp)) && !p.sumberDana.some(s => R.SD_BELUM_DIUJI.has(s.danaApbn)) && r.titipan.some(t => t.hostId === p.id) === false && !r.perubahan.some(c => c.paketId === p.id && c.jenis === 'batal')))
                cekInv(kode, b.id, b.hostKet === 'komponen yang sama', `titipan ke ${b.hostKet} padahal ada paket sekomponen`);
            const e = R.periksa(b, {}).filter(y => !/lokasi|provinsi/.test(y));
            cekInv(kode, b.id, !e.length, e.join(', '));
            cekInv(kode, b.id, b.nama.length >= 5 && b.nama.length <= 250 && b.spesifikasi.length <= 1000, 'panjang nama/spesifikasi');
        }
        console.log(kode, '|', M(r.target).padStart(7), '|', M(r.sekarang).padStart(8), '|', `${String(a0.r.kartu.length).padStart(5)} (${wajib})`.padEnd(13), '|',
            String(r.perubahan.filter(c => c.jenis === 'ubah').length).padStart(4), '|', String(r.perubahan.filter(c => c.jenis === 'batal').length).padStart(5), '|',
            `${r.paketBaru.length}/${r.titipan.length}`.padStart(10), '|', String(a0.r.tertahan.length).padStart(8), '|', `${M(r.proyeksi.setelah)} vs ${M(r.target)}`);
    } catch (e) { err++; console.log(kode, 'ERROR', e.stack.split('\n').slice(0, 4).join(' | ')); }
}
console.log(`\n${n} satker diuji · error ${err} · pelanggaran invarian ${langgar.length}`);
langgar.slice(0, 40).forEach(l => console.log('  ✗', l));
process.exitCode = err || langgar.length ? 1 : 0;
