// ─────────────────────────────────────────────────────────────── PARSER DIPA ──
// Membaca PDF SAKTI "Rincian Kertas Kerja Satker" (RKK) atau "Laporan FA Detail
// 16 Segmen" (FA) menjadi pohon Program › Kegiatan › KRO › RO › Komponen ›
// SubKomponen › Akun › Item. Kolom dikenali dari posisi x teks (pdf.js), bukan
// dari urutan kata, karena uraian panjang sering terbungkus ke baris berikutnya.
const DipaParser = (() => {
    const NUM = /^-?\d{1,3}(,\d{3})*(\.\d+)?$/;
    const toNum = s => Math.round(parseFloat(String(s).replace(/,/g, '')) || 0);
    const LEVELS = ['prog', 'keg', 'kro', 'ro', 'komp', 'sub', 'akun'];

    async function pageLines(pdfjsLib, page) {
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        const items = [];
        for (const it of tc.items) {
            const s = it.str.replace(/\s+/g, ' ').trim();
            if (!s) continue;
            const t = pdfjsLib.Util.transform(vp.transform, it.transform);
            items.push({ x0: t[4], x1: t[4] + it.width, y: t[5], s });
        }
        items.sort((a, b) => a.y - b.y || a.x0 - b.x0);
        const lines = [];
        for (const it of items) {
            const ln = lines[lines.length - 1];
            if (ln && Math.abs(ln.y - it.y) <= 1.5) ln.items.push(it);
            else lines.push({ y: it.y, items: [it] });
        }
        for (const ln of lines) {
            ln.items.sort((a, b) => a.x0 - b.x0);
            ln.text = ln.items.map(i => i.s).join(' ');
        }
        return { width: vp.width, height: vp.height, lines };
    }

    function keyOf(ctx, upto) {
        const parts = [];
        for (const l of LEVELS) {
            if (!ctx[l]) break;
            parts.push(ctx[l]);
            if (l === upto) break;
        }
        return parts.join('.');
    }
    function setLevel(ctx, level, code) {
        const i = LEVELS.indexOf(level);
        ctx[level] = code;
        for (const l of LEVELS.slice(i + 1)) ctx[l] = '';
    }

    // ── FA Detail 16 Segmen (landscape) ────────────────────────────────────
    function parseFA(pages) {
        const meta = { jenis: 'FA', satker: '', namaSatker: '', periode: '', total: 0 };
        const nodes = new Map(), items = [];
        const ctx = {};
        let last = null;
        const rapikan = s => s.replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim(); // buang catatan [..] SAKTI
        for (const pg of pages) {
            const sc = pg.width / 842; // kolom dinormalisasi ke lebar 842pt
            // Nama node yang terbungkus: SAKTI menaruh potongan nama DI ATAS dan DI BAWAH baris kodenya, sedangkan baris
            // kodenya sendiri tanpa nama (mis. RBJ.725 "Gedung, … Ditingkatkan" / "Kapasitasnya"). Potongan di kolom
            // uraian node (x 55-95) ditampung, lalu dipasangkan ke baris node terdekat (sebelum atau sesudahnya).
            // Tiap level punya kolom nama sendiri, jadi potongan hanya dipasangkan ke node yang kolomnya cocok
            // (Sub Komponen 622035 301.GA: potongan pertamanya lebih dekat ke Komponen 301 di atasnya).
            let nodeAkhir = null;
            const yatim = [];
            const KOLOM = { keg: [53, 62], komp: [53, 62], ro: [62, 75], sub: [75, 88], akun: [88, 95] };
            const cocok = (f, lvl) => !!KOLOM[lvl] && f.x >= KOLOM[lvl][0] && f.x < KOLOM[lvl][1];
            const lepas = () => {
                for (const f of yatim.splice(0)) if (nodeAkhir && cocok(f, nodeAkhir.node.level) && f.y - nodeAkhir.y <= 16) nodeAkhir.node.uraian = rapikan(nodeAkhir.node.uraian + ' ' + f.teks);
            };
            for (const ln of pg.lines) {
                const t = ln.text;
                if (!meta.satker) {
                    const m = t.match(/Satuan Kerja\s*:\s*(\d{6})\s+(.+?)(\s+Hal\s+\d+.*)?$/);
                    if (m) { meta.satker = m[1]; meta.namaSatker = m[2].trim(); }
                }
                if (!meta.periode) {
                    const m = t.match(/^Periode\s+(\w+\s+\d{4})/);
                    if (m) meta.periode = m[1];
                }
                const X = it => it.x0 / sc, X1 = it => it.x1 / sc;
                const left = ln.items.filter(it => X1(it) < 345);
                const nums = ln.items.filter(it => X(it) >= 340 && NUM.test(it.s.replace(/\s*%$/, '')));
                const col = (a, b) => { const w = nums.find(it => X1(it) >= a && X1(it) <= b); return w ? toNum(w.s) : null; };
                const pagu = col(395, 420), realisasi = col(700, 716), sisa = col(800, 830);
                if (/^JUMLAH SELURUHNYA/.test(t) || (!left.length && !meta.total && pagu && ln.y < 200)) {
                    if (pagu) meta.total = pagu;
                    continue;
                }
                if (!left.length) {
                    if (last && last.pagu == null && pagu != null) Object.assign(last, { pagu, realisasi: realisasi || 0 });
                    continue;
                }
                let first = left[0].s, x = X(left[0]);
                let rest = left.slice(1).map(i => i.s).join(' ');
                const sp = first.indexOf(' ');
                if (sp > 0) { rest = (first.slice(sp + 1) + ' ' + rest).trim(); first = first.slice(0, sp); }
                let lvl = null, code = first;
                if (x < 26 && /^[A-Z]{2}$/.test(first)) lvl = 'prog';
                else if (x < 26 && /^[A-Z]{2}[A-Z]/.test(first) && !first.includes('.')) { lvl = 'prog'; rest = first.slice(2) + ' ' + rest; code = first.slice(0, 2); }
                else if (x < 26 && /^[A-Z]{2}\.\d{4}$/.test(first)) { lvl = 'keg'; code = first.split('.')[1]; }
                else if (x >= 26 && x < 34 && /^[A-Z0-9]{3}\.[A-Z0-9]{3}$/.test(first)) { lvl = 'ro'; code = first.split('.')[1]; }
                else if (x >= 26 && x < 34 && /^[A-Z0-9]{3}/.test(first)) { lvl = 'kro'; code = first.slice(0, 3); if (first.length > 3) rest = first.slice(3) + ' ' + rest; }
                else if (x >= 34 && x < 42 && /^\d{3}$/.test(first)) lvl = 'komp';
                else if (x >= 42 && x < 48 && /^\d{3}\.[A-Z0-9]{1,2}$/.test(first)) { lvl = 'sub'; code = first.split('.')[1]; }
                else if (x >= 48 && x < 62 && /^\d{6}$/.test(first)) lvl = 'akun';
                else if (x >= 90 && /^\d{6}\.$/.test(first)) lvl = 'item';
                if (!lvl) {
                    if (x >= 53 && x < 95) { yatim.push({ y: ln.y, x, teks: left.map(i => i.s).join(' ') }); continue; }
                    // sambungan uraian item hanya dari kolom item (x 95-110); kepala tabel "Uraian" (x ±165) di awal
                    // halaman berikutnya dulu ikut tertempel ke item terakhir
                    if (last && x >= 95 && x < 110) {
                        last.uraian += ' ' + left.map(i => i.s).join(' ');
                        if (last.pagu == null && pagu != null) Object.assign(last, { pagu, realisasi: realisasi || 0 });
                    }
                    continue;
                }
                rest = rest.trim();
                if (lvl === 'item') {
                    lepas(); nodeAkhir = null;
                    last = { key: keyOf(ctx, 'akun'), no: first.replace('.', ''), uraian: rest, pagu, realisasi: realisasi || 0, sisa };
                    items.push(last);
                    continue;
                }
                setLevel(ctx, lvl, code);
                const key = keyOf(ctx, lvl);
                // potongan di antara node sebelumnya dan node ini masuk ke yang lebih dekat
                const depan = [];
                for (const f of yatim.splice(0)) {
                    const keSini = ln.y - f.y, keSana = nodeAkhir ? f.y - nodeAkhir.y : Infinity;
                    const okSini = cocok(f, lvl) && keSini <= 16, okSana = !!nodeAkhir && cocok(f, nodeAkhir.node.level) && keSana <= 16;
                    if (okSini && (!okSana || keSini <= keSana)) depan.push(f.teks);
                    else if (okSana) nodeAkhir.node.uraian = rapikan(nodeAkhir.node.uraian + ' ' + f.teks);
                }
                const node = { key, level: lvl, kode: code, uraian: rapikan([...depan, rest].join(' ')), pagu };
                nodes.set(key, node);
                nodeAkhir = { node, y: ln.y };
                last = null;
            }
            lepas();
        }
        return { meta, nodes, items };
    }

    // ── Rincian Kertas Kerja Satker (portrait) ─────────────────────────────
    // Baris RKK tidak rapi: uraian yang terbungkus diletakkan di tengah secara
    // vertikal (teks bisa di atas tanda "-" dan angkanya). Karena itu setiap kode
    // atau tanda "-" dijadikan jangkar, lalu teks/volume/jumlah ditempelkan ke
    // jangkar terdekat di halaman yang sama.
    function parseRKK(pages) {
        const meta = { jenis: 'RKK', satker: '', namaSatker: '', periode: '', total: 0 };
        const nodes = new Map(), items = [];
        const ctx = {};
        let curKro = null;
        const CODE = [
            ['prog', /^\d{3}\.\d{2}\.([A-Z]{2})$/],
            ['keg', /^(\d{4})$/],
            ['kro', /^\d{4}\.([A-Z0-9]{3})$/],
            ['ro', /^\d{4}\.[A-Z0-9]{3}\.([A-Z0-9]{3})$/],
            ['akun', /^(\d{6})$/],
            ['komp', /^(\d{3})$/],
            ['sub', /^([A-Z0-9]{1,2})$/],
        ];
        for (const pg of pages) {
            const sc = pg.width / 595, sy = pg.height / 842;
            const all = pg.lines.flatMap(l => l.items);
            for (const ln of pg.lines) {
                const t = ln.text;
                let m;
                if (!meta.satker && (m = t.match(/^UNIT KERJA\s*\((\d{6})\)\s*(.*)$/))) { meta.satker = m[1]; meta.namaSatker = m[2].trim(); }
                if (!meta.total && (m = t.match(/^ALOKASI\s+Rp\.?\s*([\d,]+)/))) meta.total = toNum(m[1]);
            }
            const X = it => it.x0 / sc, X1 = it => it.x1 / sc;
            const body = all.filter(it => it.y > 145 * sy);
            const anchors = [];
            for (const it of body) {
                if (X(it) < 80) {
                    const tok = it.s.split(' ')[0];
                    for (const [lvl, re] of CODE) {
                        const mm = tok.match(re);
                        if (mm) { anchors.push({ kind: 'code', lvl, code: mm[1], y: it.y, it, text: [], rest: it.s.slice(tok.length).trim() }); break; }
                    }
                } else if (X(it) >= 84 && X(it) < 96 && /^>+/.test(it.s)) {
                    // baris kelompok detil (">" / ">>") membawa subtotal; bukan item
                    const depth = it.s.match(/^>+/)[0].length;
                    const rest = it.s.replace(/^>+\s*/, '');
                    anchors.push({ kind: 'group', depth, y: it.y, it, text: rest ? [{ y: it.y, x: X(it), s: rest }] : [] });
                } else if (X(it) >= 86 && X(it) < 96 && /^-/.test(it.s)) {
                    anchors.push({ kind: 'item', y: it.y, it, text: it.s.length > 1 ? [{ y: it.y, x: X(it), s: it.s.replace(/^-\s*/, '') }] : [] });
                }
            }
            anchors.sort((a, b) => a.y - b.y);
            if (!anchors.length) continue;
            const nearest = y => {
                let best = null, bd = 1e9;
                for (const a of anchors) { const d = Math.abs(a.y - y); if (d < bd) { bd = d; best = a; } }
                return { a: best, d: bd };
            };
            const lokasi = [];
            for (const it of body) {
                if (anchors.some(a => a.it === it)) continue;
                const x = X(it), x1 = X1(it);
                if (x >= 78 && x1 < 288) {
                    if (/^Lokasi\s*:/.test(it.s)) { lokasi.push(it); continue; }
                    if (/^\(KPPN/.test(it.s)) continue;
                    const { a, d } = nearest(it.y);
                    if (a && d < 14) a.text.push({ y: it.y, x, s: it.s });
                } else if (x >= 280 && x1 <= 342) {
                    const { a, d } = nearest(it.y);
                    if (a && a.kind === 'item' && d < 14) a.volume = ((a.volume || '') + ' ' + it.s).trim();
                } else if (x1 >= 405 && x1 <= 420 && NUM.test(it.s)) {
                    const { a, d } = nearest(it.y);
                    if (a && a.kind === 'item' && d < 14 && a.harga == null) a.harga = toNum(it.s);
                } else if (x1 >= 500 && x1 <= 530 && NUM.test(it.s)) {
                    const { a, d } = nearest(it.y);
                    if (a && d < 14 && a.jumlah == null) a.jumlah = toNum(it.s);
                } else if (x >= 545 && /^[A-Z]{1,4}$/.test(it.s)) {
                    const { a, d } = nearest(it.y);
                    if (a && a.kind === 'code' && a.lvl === 'akun' && d < 4) a.sd = it.s;
                }
            }
            for (const lk of lokasi) {
                const prev = anchors.filter(a => a.kind === 'code' && a.lvl === 'kro' && a.y <= lk.y).pop();
                if (prev) prev.lokasi = lk.s.replace(/^Lokasi\s*:\s*/, '');
                else if (curKro) curKro.lokasi = lk.s.replace(/^Lokasi\s*:\s*/, '');
            }
            for (const a of anchors) {
                const txt = [a.rest, ...a.text.sort((p, q) => p.y - q.y || p.x - q.x).map(t => t.s)].filter(Boolean).join(' ')
                    .replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
                if (a.kind === 'group') {
                    ctx._grp = (ctx._grp || []).slice(0, a.depth - 1);
                    ctx._grp[a.depth - 1] = txt;
                    continue;
                }
                if (a.kind === 'code') {
                    ctx._grp = [];
                    setLevel(ctx, a.lvl, a.code);
                    const key = keyOf(ctx, a.lvl);
                    ctx._sd = a.sd || '';
                    const dup = nodes.get(key);
                    if (dup && a.lvl === 'akun') {
                        // akun yang sama dipecah per sumber dana (RM/PNP/BLU...)
                        dup.pagu = (dup.pagu || 0) + (a.jumlah || 0);
                        if (a.sd && !dup.sd.includes(a.sd)) dup.sd.push(a.sd);
                        continue;
                    }
                    const node = { key, level: a.lvl, kode: a.code, uraian: txt, pagu: a.jumlah ?? null };
                    if (a.lvl === 'akun') node.sd = a.sd ? [a.sd] : [];
                    if (a.lvl === 'kro') { node.lokasi = a.lokasi || ''; curKro = node; }
                    nodes.set(key, node);
                } else if (ctx.akun) {
                    items.push({ key: keyOf(ctx, 'akun'), no: String(items.length + 1), uraian: txt, volume: a.volume || '', harga: a.harga ?? null, pagu: a.jumlah ?? null, realisasi: 0, sd: ctx._sd || '', grup: (ctx._grp || []).filter(Boolean).join(' › ') });
                }
            }
        }
        return { meta, nodes, items };
    }

    async function parse(pdfjsLib, data, onProgress) {
        const doc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
        const pages = [];
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            pages.push(await pageLines(pdfjsLib, page));
            if (onProgress) onProgress(i, doc.numPages);
        }
        const head = pages[0].lines.slice(0, 25).map(l => l.text).join('\n');
        let res;
        if (/KETERSEDIAAN DANA DETAIL/i.test(head)) res = parseFA(pages);
        else if (/UNIT KERJA\s*\(\d{6}\)/.test(head) && /SUBKOMP/.test(head)) res = parseRKK(pages);
        else throw new Error('Format PDF tidak dikenali (bukan FA Detail 16 Segmen / Rincian Kertas Kerja Satker).');
        res.meta.halaman = doc.numPages;
        // Pagu tiap node dihitung ulang dari item: angka header bisa hilang
        // saat uraiannya terbungkus, sementara jumlah item selalu utuh.
        const sum = new Map();
        for (const it of res.items) {
            const parts = it.key.split('.');
            for (let i = 1; i <= parts.length; i++) {
                const k = parts.slice(0, i).join('.');
                sum.set(k, (sum.get(k) || 0) + (it.pagu || 0));
            }
        }
        res.check = { itemTotal: sum.size ? [...res.nodes.values()].filter(n => n.level === 'prog').reduce((a, n) => a + (sum.get(n.key) || 0), 0) : 0, mismatches: [] };
        for (const n of res.nodes.values()) {
            const s = sum.get(n.key) || 0;
            if (n.pagu != null && n.pagu !== s) res.check.mismatches.push({ key: n.key, header: n.pagu, items: s });
            n.paguHeader = n.pagu;
            n.pagu = s;
        }
        res.check.ok = res.meta.total ? res.check.itemTotal === res.meta.total : res.check.mismatches.length === 0;
        return res;
    }

    return { parse };
})();

if (typeof module !== 'undefined') module.exports = DipaParser;
