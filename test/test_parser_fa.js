// Uji parser FA Detail 16 Segmen pada semua PDF di satu folder (PDF tidak ikut git).
// SDR_FA_DIR="C:/…/FA_Detail_16_Segmen_2026_09" node test/test_parser_fa.js
const fs = require('fs'), path = require('path');
const assert = require('assert');
const DIR = process.env.SDR_FA_DIR || path.join(__dirname, 'pdf', 'FA');
if (!fs.existsSync(DIR)) { console.log(`Folder PDF FA tidak ada (${DIR}) — uji parser FA dilewati.`); process.exit(0); }
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const P = require('../src/dipa_parser.js');
// nama yang terbungkus dua-empat baris (potongan di atas dan di bawah baris kodenya)
const NAMA = {
    '626402': { 'DL.2376.RBJ.725': 'Gedung, Bangunan dan Prasarana Pendidikan Tinggi yang Ditingkatkan Kapasitasnya',
        'WA.2378': 'Dukungan Manajemen Internal Lingkup Badan Penyuluhan dan Pengembangan Sumber Daya Manusia Kelautan dan Perikanan' },
    '622035': { 'DL.2376.ABW.121.301': 'Penelitian Terapan KP' },
};
(async () => {
    let n = 0, node = 0;
    for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.pdf'))) {
        const kode = (f.match(/_(\d{6})_/) || [])[1];
        let r;
        try { r = await P.parse(pdfjs, new Uint8Array(fs.readFileSync(path.join(DIR, f)))); } catch (e) { console.log(`  ${kode}: ${e.message} (dilewati)`); continue; }
        if (r.meta.jenis !== 'FA') continue;
        n++;
        const ns = [...r.nodes.values()];
        node += ns.length;
        const kosong = ns.filter(x => !x.uraian).map(x => x.key);
        assert(!kosong.length, `${kode}: nama node kosong ${kosong.join(', ')}`);
        const kepala = r.items.filter(i => / Uraian$/.test(i.uraian)).map(i => i.key);
        assert(!kepala.length, `${kode}: kepala tabel "Uraian" tertempel ke item ${kepala.slice(0, 5).join(', ')}`);
        for (const [k, v] of Object.entries(NAMA[kode] || {})) assert.strictEqual((r.nodes.get(k) || {}).uraian, v, `${kode} ${k}`);
    }
    assert(n > 0, 'tidak ada PDF FA yang terbaca');
    console.log(`${n} PDF FA · ${node} node · semua nama node terisi · uji parser FA lulus.`);
})().catch(e => { console.error(e.message); process.exit(1); });
