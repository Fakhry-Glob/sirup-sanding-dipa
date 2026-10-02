// Data uji 626402 (Sekretariat BPPSDMKP) dalam format yang sama dengan hasil UI:
// FA Detail dilengkapi RKK, paket RUP diperkaya JSON denormalisasi (id baris, lokasi, jenis, tanggal).
global.Classify = require('../src/classify.js');
const A = require('../src/analysis.js');
const fs = require('fs');
const SP = require('path').join(__dirname, 'data') + '/'; // data uji lokal (tidak ikut git)
const baca = f => JSON.parse(fs.readFileSync(SP + f, 'utf8'));

function dipa() {
    const toMap = x => ({ ...x, nodes: new Map((x.nodes instanceof Array ? x.nodes : Object.values(x.nodes)).map(n => [n.key, { ...n }])), items: x.items.map(i => ({ ...i })) });
    const fa = toMap(baca('fa_js_626402.json')), rkk = toMap(baca('rkk_js_626402.json'));
    A.gabungDipa(fa, rkk);
    return fa;
}
function pkkr() {
    const tree = baca('pkkr_626402.json');
    const m = new Map(); const LV = ['prog', 'keg', 'kro', 'ro', 'komp', 'sub'];
    (function walk(ns, pk, d, parentId) {
        for (const n of ns) {
            const key = pk ? pk + '.' + n.kode : n.kode;
            m.set(key, { id: String(n.id), level: LV[d], kode: n.kode, nama: n.nama, pagu: +n.pagu || 0, manual: false, parentId });
            if (n.children) walk(n.children, key, d + 1, String(n.id));
        }
    })(tree, '', 0, null);
    return m;
}
function pakets() {
    const dn = new Map(baca('denorm_626402.json').map(j => [String(j.id), j]));
    return baca('rup_detail_626402.json').map(p0 => {
        const p = JSON.parse(JSON.stringify(p0));
        p.jenisPaket = 'penyedia';
        const j = dn.get(String(p.id));
        if (!j) return p;
        p.sumberDana = (j.paket_anggaran_json || []).map(a => ({ id: String(a.id), mak: a.mak, pagu: a.pagu, idKomponen: a.id_komponen, sumber: a.sumber_dana, danaApbn: a.id_dana_apbn,
            asal: a.asal_dana, asalSatker: a.asal_dana_satker, ta: a.tahun_anggaran_dana, kodeInstansi: a.kode_instansi, kodeEselon: a.kode_esselon, kodeSatker: a.kode_satker }));
        p.lokasiRaw = (j.paket_lokasi_json || []).map((l, i) => ({ id: String(l.id), id_provinsi: l.id_provinsi, id_kabupaten: l.id_kabupaten, detil: l.detil_lokasi,
            prov: (p.lokasi[i] || {}).prov || '', kab: (p.lokasi[i] || {}).kab || '' }));
        p.jenisRaw = (j.paket_jenis_json || []).map(x => ({ id: String(x.id), jenisid: x.jenisid, pagu: x.jumlah_pagu }));
        p.tanggal = { awalPengadaan: (j.tanggal_awal_pengadaan || '').slice(0, 7), akhirPengadaan: (j.tanggal_akhir_pengadaan || '').slice(0, 7),
            awalPekerjaan: (j.tanggal_awal_pekerjaan || '').slice(0, 7), akhirPekerjaan: (j.tanggal_akhir_pekerjaan || '').slice(0, 7) };
        p.uraianRaw = j.keterangan || p.uraian || ''; p.spesifikasiRaw = j.spesifikasi || p.spesifikasi || '';
        return p;
    });
}
const LOKASI_SATKER = { id_provinsi: 11, id_kabupaten: 14748, prov: 'DKI Jakarta', kab: 'Jakarta Pusat (Kota)', detil: 'Sekretariat BPPSDM KP, Jl. Medan Merdeka Timur No. 16, Jakarta Pusat' };
module.exports = { dipa, pkkr, pakets, LOKASI_SATKER, A };
