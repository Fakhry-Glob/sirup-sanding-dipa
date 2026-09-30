// ==UserScript==
// @name         SiRUP Sanding DIPA ↔ RUP & Revisi Massal
// @namespace    https://github.com/Fakhry-Glob
// @version      1.0.0
// @description  Sanding PDF DIPA SAKTI (RKK / FA Detail 16 Segmen) dengan PKKR dan RUP terumumkan di SiRUP pasca-putus integrasi SAKTI (31 Juli 2026): tambah cabang PKKR, klasifikasi pengadaan/non-pengadaan, revisi satu-ke-banyak massal dari layar rekap, umumkan, dan samakan Struktur Anggaran.
// @author       Fakhry-Glob
// @match        https://sirup.inaproc.id/sirup/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
'use strict';
const APP_VERSION = '1.0.0';

const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ─────────────────────────────────────────────────────────────────── STYLE ──
const CSS = `
.sdr, .sdr *, .sdr *::before, .sdr *::after { box-sizing: border-box; }
.sdr { --b:#1F497D; --b2:#2E6DA4; --ink:#0f172a; --mut:#64748b; --line:#e2e8f0; --bg:#f8fafc; --ok:#15803d; --warn:#b45309; --bad:#b91c1c; --np:#7c3aed;
  font: 13px/1.45 "Segoe UI", system-ui, -apple-system, sans-serif; color: var(--ink); }
.sdr-fab { position: fixed; right: 24px; bottom: 84px; z-index: 99990; display: inline-flex; align-items: center; gap: 8px;
  padding: 11px 18px; border: 0; border-radius: 999px; cursor: pointer; font: 600 13.5px/1 "Segoe UI", system-ui, sans-serif; color: #fff;
  background: linear-gradient(135deg, #0f766e 0%, #0e9f8e 100%); box-shadow: 0 6px 18px rgba(15,118,110,.35); }
.sdr-fab:hover { transform: translateY(-2px); }
.sdr-ov { position: fixed; inset: 0; z-index: 99991; background: rgba(15,23,42,.55); display: flex; align-items: stretch; justify-content: center; padding: 18px; }
.sdr-win { background: #fff; border-radius: 12px; width: min(1480px, 100%); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.3); }
.sdr-hd { display: flex; align-items: center; gap: 12px; padding: 12px 18px; background: var(--b); color: #fff; }
.sdr-hd h2 { font-size: 16px; margin: 0; font-weight: 650; flex: 1; }
.sdr-hd .sdr-ctx { font-size: 12px; opacity: .9; }
.sdr-x { background: transparent; border: 0; color: #fff; font-size: 22px; cursor: pointer; line-height: 1; }
.sdr-steps { display: flex; gap: 0; border-bottom: 1px solid var(--line); background: var(--bg); overflow-x: auto; }
.sdr-step { padding: 10px 16px; cursor: pointer; border: 0; background: transparent; font: inherit; color: var(--mut); border-bottom: 3px solid transparent; white-space: nowrap; }
.sdr-step.on { color: var(--b); border-bottom-color: var(--b); font-weight: 650; background: #fff; }
.sdr-step.done::after { content: " ✓"; color: var(--ok); }
.sdr-body { flex: 1; overflow: auto; padding: 16px 18px; }
.sdr-foot { border-top: 1px solid var(--line); padding: 8px 18px; max-height: 150px; overflow: auto; background: #0b1220; color: #cbd5e1; font: 12px/1.5 Consolas, monospace; }
.sdr-foot .e { color: #fca5a5; } .sdr-foot .o { color: #86efac; } .sdr-foot .w { color: #fcd34d; }
.sdr h3 { font-size: 14.5px; margin: 14px 0 8px; } .sdr h3:first-child { margin-top: 0; }
.sdr p.note { color: var(--mut); margin: 4px 0 10px; }
.sdr .card { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; background: #fff; }
.sdr .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px; }
.sdr .kpi { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
.sdr .kpi b { display: block; font-size: 16px; font-variant-numeric: tabular-nums; } .sdr .kpi span { color: var(--mut); font-size: 12px; }
.sdr .btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: 8px; border: 1px solid var(--line); background: #fff; cursor: pointer; font: inherit; color: var(--ink); }
.sdr .btn:hover { border-color: var(--b2); } .sdr .btn[disabled] { opacity: .5; cursor: not-allowed; }
.sdr .btn.pri { background: var(--b); color: #fff; border-color: var(--b); } .sdr .btn.go { background: var(--ok); color: #fff; border-color: var(--ok); }
.sdr .btn.danger { background: var(--bad); color: #fff; border-color: var(--bad); } .sdr .btn.sm { padding: 3px 8px; font-size: 12px; }
.sdr .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.sdr .drop { border: 2px dashed #94a3b8; border-radius: 12px; padding: 22px; text-align: center; color: var(--mut); cursor: pointer; }
.sdr .drop.hover { border-color: var(--b2); background: #eff6ff; }
.sdr table.t { border-collapse: collapse; width: 100%; font-size: 12.5px; }
.sdr table.t th, .sdr table.t td { border-bottom: 1px solid var(--line); padding: 5px 7px; text-align: left; vertical-align: top; }
.sdr table.t th { position: sticky; top: 0; background: #f1f5f9; z-index: 1; font-weight: 650; white-space: nowrap; }
.sdr table.t td.n, .sdr table.t th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sdr table.t tr.sub td { background: #fafafa; }
.sdr .tbl { max-height: 60vh; overflow: auto; border: 1px solid var(--line); border-radius: 8px; }
.sdr .pill { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.sdr .p-ok { background: #dcfce7; color: var(--ok); } .sdr .p-warn { background: #fef3c7; color: var(--warn); } .sdr .p-bad { background: #fee2e2; color: var(--bad); }
.sdr .p-np { background: #ede9fe; color: var(--np); } .sdr .p-mut { background: #f1f5f9; color: var(--mut); } .sdr .p-info { background: #dbeafe; color: #1d4ed8; }
.sdr input[type=text], .sdr input[type=number], .sdr input[type=month], .sdr select, .sdr textarea { font: inherit; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: var(--ink); max-width: 100%; }
.sdr textarea { width: 100%; min-height: 54px; resize: vertical; font-size: 12px; }
.sdr .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sdr .muted { color: var(--mut); } .sdr .mono { font-family: Consolas, monospace; font-size: 12px; }
.sdr details > summary { cursor: pointer; }
.sdr .pk { border: 1px solid var(--line); border-radius: 10px; margin: 8px 0; }
.sdr .pk-hd { display: flex; gap: 8px; align-items: center; padding: 8px 10px; background: #f8fafc; border-radius: 10px 10px 0 0; flex-wrap: wrap; }
.sdr .pk-bd { padding: 8px 10px; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px 14px; }
.sdr .pk-bd label { display: block; font-size: 11.5px; color: var(--mut); margin-bottom: 2px; }
.sdr .pk-bd .wide { grid-column: 1 / -1; }
.sdr .bulk { position: sticky; top: -16px; z-index: 3; background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 10px; padding: 8px 10px; margin-bottom: 10px; }
.sdr .lok { display: grid; grid-template-columns: 1fr 1fr 1.4fr auto; gap: 4px; margin-bottom: 4px; }
.sdr .warnbox { border-left: 4px solid var(--warn); background: #fffbeb; padding: 8px 12px; border-radius: 6px; margin: 8px 0; }
.sdr .errbox { border-left: 4px solid var(--bad); background: #fef2f2; padding: 8px 12px; border-radius: 6px; margin: 8px 0; }
.sdr .okbox { border-left: 4px solid var(--ok); background: #f0fdf4; padding: 8px 12px; border-radius: 6px; margin: 8px 0; }
.sdr-modal { position: fixed; inset: 0; z-index: 99995; background: rgba(15,23,42,.5); display: flex; align-items: center; justify-content: center; padding: 20px; }
.sdr-modal > div { background: #fff; border-radius: 12px; max-width: 900px; width: 100%; max-height: 85vh; overflow: auto; padding: 16px 18px; }
.sdr .prog { height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; margin: 6px 0; } .sdr .prog > i { display: block; height: 100%; background: var(--b2); width: 0; transition: width .2s; }
`;


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
        for (const pg of pages) {
            const sc = pg.width / 842; // kolom dinormalisasi ke lebar 842pt
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
                    if (last && x >= 90) {
                        last.uraian += ' ' + left.map(i => i.s).join(' ');
                        if (last.pagu == null && pagu != null) Object.assign(last, { pagu, realisasi: realisasi || 0 });
                    }
                    continue;
                }
                rest = rest.trim();
                if (lvl === 'item') {
                    last = { key: keyOf(ctx, 'akun'), no: first.replace('.', ''), uraian: rest, pagu, realisasi: realisasi || 0, sisa };
                    items.push(last);
                    continue;
                }
                setLevel(ctx, lvl, code);
                const key = keyOf(ctx, lvl);
                nodes.set(key, { key, level: lvl, kode: code, uraian: rest, pagu });
                last = null;
            }
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
                    .replace(/\[Base Line\]/g, '').replace(/\s+/g, ' ').trim();
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



// ──────────────────────────────────────────────────────── KLASIFIKASI BELANJA ──
// Memutuskan tiap baris detail DIPA termasuk pengadaan (P), non-pengadaan (NP)
// atau perlu dicek (CEK). Aturan disusun dari akun + kata kunci uraian item.
// Keputusan pengguna: PJLP = pengadaan; honor PPNPN beserta iuran BPJS = non.
const Classify = (() => {
    const has = (re, ...s) => s.some(x => re.test(x || ''));

    const RE = {
        pjlp: /\bpjlp\b|jasa lainnya perorangan|penyedia jasa (lainnya )?perorangan|cleaning ?service|tenaga (kebersihan|keamanan|satpam|pramubakti|pengemudi|teknisi)|\bsatpam\b|satuan pengaman|pramubakti|outsourc/i,
        bpjs: /\bbpjs\b|iuran jaminan|jaminan (kesehatan|kecelakaan|kematian|hari tua|pensiun|sosial)|\bjkk\b|\bjkm\b|\bjht\b/i,
        ppnpn: /ppnpn|pppn|pegawai pemerintah non pegawai negeri|pegawai non asn|tenaga honorer|paruh waktu|tenaga kontrak|\bthr\b|tunjangan hari raya/i,
        honor: /honor|insentif|narasumber|narsum|pembahas|moderator|rohaniawan|\btunjangan\b|uang lembur|\blembur\b/i,
        uang: /uang (saku|harian|representasi|transport|makan (pns|pppk|lembur))|transport(asi)? lokal|lumpsum|lump sum|biaya transport(asi)? (peserta|narasumber)/i,
        pungutan: /\bpajak\b|\bpbb\b|\bstnk\b|retribusi|bea (materai|meterai)|biaya tol|\btol\b|e-?toll|\bparkir\b|biaya administrasi bank/i,
        natura: /makan (taruna|siswa|peserta didik|mahasiswa|kadet)|konsumsi (taruna|siswa|peserta didik)|ransum|(seragam|pakaian( dinas)?|perlengkapan) (taruna|siswa|peserta didik)/i,
        bantuan: /beasiswa|biaya pendidikan|\bspp\b|uang kuliah|tugas belajar|izin belajar|bantuan (pemerintah|biaya|uang|dana|sosial|langsung)|\bbanpem\b|hadiah (uang|lomba)/i,
        // paket meeting luar/dalam kota: penginapan hotel & ruang rapat direalisasikan sebagai pengadaan (metode Dikecualikan)
        meeting: /paket meeting|full ?board|full ?day|half ?day|fullboard|fullday|halfday|sewa (ruang|gedung|hall|aula)|ruang (rapat|pertemuan)|akomodasi|penginapan|\bhotel\b|\bkamar\b|paket (kegiatan|pertemuan)/i,
        // komponen khas EO: bila ada di RAB, paket diperlakukan sebagai jasa EO (bukan dikecualikan)
        eo: /hiburan|\bmc\b|master of ceremony|pembawa acara|dekorasi|sound ?system|dokumentasi|event organi[sz]er|\beo\b|panggung|lighting|backdrop/i,
        konsultan: /konsultan|pengawas(an)?\b|perencana(an)?\b|manajemen konstruksi|\bded\b|desain|kajian teknis|supervisi/i,
        pengelolaan: /pengelolaan kegiatan|manajemen proyek|biaya umum/i,
    };

    // akun → kelompok jenis belanja pada Struktur Anggaran SiRUP
    function jenisBelanja(akun) {
        const p2 = akun.slice(0, 2);
        if (p2 === '52') return 'barjas';
        if (p2 === '53') return 'modal';
        if (p2 === '57') return 'sosial';
        if (p2 === '56') return 'hibah';
        if (['54', '55', '58'].includes(p2)) return 'lainnya';
        return 'pegawai';
    }

    function saranJenis(akun, uraian) {
        if (/^53[34]/.test(akun)) return has(RE.konsultan, uraian) ? 'Jasa Konsultansi' : 'Pekerjaan Konstruksi';
        if (/^53/.test(akun)) return 'Barang';
        if (akun === '522131' || has(RE.konsultan, uraian) && /^52/.test(akun) && !/^5211/.test(akun)) return 'Jasa Konsultansi';
        if (akun === '523111' || akun === '523112') return 'Pekerjaan Konstruksi';
        if (/^52(2|3)/.test(akun) || /^5241/.test(akun) || has(RE.pjlp, uraian)) return 'Jasa Lainnya';
        return 'Barang';
    }

    // Satu baris detail → {kelas, alasan}
    function item(akun, akunNama, uraian, grup) {
        const u = `${grup || ''} ${uraian || ''}`;
        const A = akun || '';
        if (/^51/.test(A)) return { kelas: 'NP', alasan: 'Belanja pegawai (gaji/tunjangan)' };
        if (has(RE.bpjs, u)) return { kelas: 'NP', alasan: 'Iuran BPJS / jaminan sosial' };
        if (has(RE.ppnpn, u)) return { kelas: 'NP', alasan: 'Honor PPNPN' };
        if (has(RE.pjlp, u)) return { kelas: 'P', alasan: 'PJLP / jasa lainnya perorangan (pengadaan)' };
        if (/^5241/.test(A)) {
            if (/^52411[49]$/.test(A) && has(RE.meeting, u)) return { kelas: 'P', alasan: 'Paket meeting / penginapan hotel (pengadaan, metode Dikecualikan)' };
            if (/^52411[49]$/.test(A) && has(RE.eo, u)) return { kelas: 'P', alasan: 'Komponen EO pada paket meeting' };
            return { kelas: 'NP', alasan: 'Perjalanan dinas' };
        }
        if (['521115', '521213', '521214'].includes(A)) return { kelas: 'NP', alasan: 'Honorarium' };
        if (has(RE.honor, u)) return { kelas: 'NP', alasan: 'Honor / insentif' };
        if (has(RE.uang, u)) return { kelas: 'NP', alasan: 'Uang saku / uang harian / transport' };
        if (has(RE.pungutan, u)) return { kelas: 'NP', alasan: 'Pajak / retribusi / tol' };
        // "Bantuan uang makan/seragam taruna" di poltek sering direalisasikan lewat kontrak katering/seragam
        if (has(RE.natura, u)) return { kelas: 'CEK', alasan: 'Bantuan natura taruna/peserta (makan/seragam) — pengadaan bila lewat kontrak katering/penyedia' };
        if (has(RE.bantuan, u)) return { kelas: 'NP', alasan: 'Bantuan / beasiswa / biaya pendidikan' };
        if (A === '522151') return { kelas: 'CEK', alasan: 'Jasa profesi selain honor — cek apakah dikontrakkan' };
        if (/^526/.test(A)) return { kelas: 'CEK', alasan: 'Belanja barang untuk diserahkan — pengadaan bila berupa barang' };
        if (/^5[678]/.test(A) || /^5[45]/.test(A)) return { kelas: 'CEK', alasan: 'Bansos/hibah/lainnya — pengadaan hanya bila berupa barang/jasa' };
        if (/^53/.test(A) && has(RE.pengelolaan, u)) return { kelas: 'CEK', alasan: 'Biaya pengelolaan kegiatan pada belanja modal (umumnya honor/perjalanan)' };
        if (/^5[23]/.test(A)) return { kelas: 'P', alasan: /^53/.test(A) ? 'Belanja modal' : 'Belanja barang/jasa' };
        return { kelas: 'CEK', alasan: 'Akun tidak dikenali' };
    }

    // Saran metode pemilihan (ambang Perpres 46/2025; bisa diubah di Pengaturan)
    function saranMetode(jenis, pagu, akun, uraian, cfg) {
        const t = cfg || { plBarjas: 200e6, plKonstruksi: 400e6, plKonsultansi: 100e6 };
        // Paket meeting: hanya kamar/ruang rapat → Dikecualikan. Ada hiburan/MC/dekorasi → EO
        // (jasa lainnya: PL s.d. batas PL, di atasnya metode EO dari pengaturan; default Tender).
        if (/^52411[49]$/.test(akun || '')) return has(RE.eo, uraian) ? (pagu <= t.plBarjas ? 'Pengadaan Langsung' : (t.metodeEO || 'Tender')) : 'Dikecualikan';
        if (jenis === 'Jasa Konsultansi') return pagu <= t.plKonsultansi ? 'Pengadaan Langsung' : 'Seleksi';
        if (jenis === 'Pekerjaan Konstruksi') return pagu <= t.plKonstruksi ? 'Pengadaan Langsung' : 'Tender';
        return pagu <= t.plBarjas ? 'Pengadaan Langsung' : 'Tender';
    }

    return { item, jenisBelanja, saranJenis, saranMetode, RE };
})();



// ─────────────────────────────────────────────────────────────────── SANDING ──
// Menyandingkan DIPA (hasil parser) dengan PKKR dan paket RUP SiRUP, lalu
// menyusun rencana aksi: tambah cabang PKKR, batalkan paket non-pengadaan,
// pindahkan MAK paket yang akunnya sudah tidak ada, dan paket baru untuk pagu
// pengadaan yang belum terumumkan.
const Analysis = (() => {
    const LV = ['prog', 'keg', 'kro', 'ro', 'komp', 'sub', 'akun'];
    const LV_SIRUP = { prog: 'program', keg: 'kegiatan', kro: 'kro', ro: 'ro', komp: 'komponen', sub: 'subkomponen' };
    const ST = { '11': 'Draft', '12': 'Draft', '2': 'Final Draft', '3': 'Terumumkan', '51': 'Dibatalkan' };
    const levelOfKey = k => LV[k.split('.').length - 1];
    const parentKey = k => k.split('.').slice(0, -1).join('.');
    const TOL = 1000; // selisih ≤ Rp1.000 dianggap sama (pembulatan)
    // kode SD di RKK → id_dana_apbn SiRUP (dipetakan dari paket nyata satker BPPSDMKP, Sep 2026)
    const SD_CODE = { RM: 'A', PLN: 'B', PNP: 'D', PNBP: 'D', BLU: 'F', SBSN: 'T' };

    // ── 1. DIPA per akun, dengan klasifikasi per item ────────────────────
    function buildDipa(dipa, overrides, opts) {
        const cekSebagaiP = opts && opts.cekSebagai === 'P';
        const nodes = dipa.nodes instanceof Map ? dipa.nodes : new Map(dipa.nodes.map(n => [n.key, n]));
        const akun = new Map();
        dipa.items.forEach((it, idx) => {
            const code = it.key.split('.').pop();
            const node = nodes.get(it.key) || {};
            const iid = `${it.key}#${it.no || idx}`;
            let c = Classify.item(code, node.uraian, it.uraian, it.grup);
            const ov = overrides && overrides[iid];
            if (ov) c = { kelas: ov, alasan: 'Diubah manual', manual: true };
            else if (cekSebagaiP && c.kelas === 'CEK') c = { kelas: 'P', alasan: '(perlu cek → dihitung pengadaan) ' + c.alasan };
            let a = akun.get(it.key);
            if (!a) {
                a = { key: it.key, akun: code, nama: node.uraian || '', pagu: 0, P: 0, NP: 0, CEK: 0, items: [], rup: [], sd: node.sd || [] };
                akun.set(it.key, a);
            }
            const row = { iid, no: it.no, uraian: it.uraian, grup: it.grup || '', volume: it.volume || '', pagu: it.pagu || 0, realisasi: it.realisasi || 0, kelas: c.kelas, alasan: c.alasan, manual: !!c.manual };
            a.items.push(row);
            a.pagu += row.pagu;
            a[row.kelas] += row.pagu;
            if (row.kelas === 'P') { const sd = it.sd || (a.sd.length === 1 ? a.sd[0] : ''); a.PbySd = a.PbySd || {}; a.PbySd[sd] = (a.PbySd[sd] || 0) + row.pagu; }
        });
        return { nodes, akun };
    }

    // ── 2. PKKR SiRUP vs DIPA ───────────────────────────────────────────
    // pkkr: Map key → {id, level, kode, nama, pagu, manual, ppk}
    function diffPkkr(dipaNodes, akunMap, pkkr) {
        // node DIPA yang di bawahnya ada pagu pengadaan (P/CEK)
        const pengadaanUnder = new Map();
        for (const a of akunMap.values()) {
            const v = a.P + a.CEK;
            if (!v) continue;
            const parts = a.key.split('.');
            for (let i = 1; i < parts.length; i++) {
                const k = parts.slice(0, i).join('.');
                pengadaanUnder.set(k, (pengadaanUnder.get(k) || 0) + v);
            }
        }
        const baru = [], hilang = [], beda = [];
        for (const n of dipaNodes.values()) {
            if (n.level === 'akun') continue;
            const s = pkkr.get(n.key);
            if (!s) {
                baru.push({ key: n.key, level: n.level, kode: n.kode, nama: n.uraian, pagu: n.pagu,
                    pengadaan: pengadaanUnder.get(n.key) || 0, parentKey: parentKey(n.key),
                    pilih: (pengadaanUnder.get(n.key) || 0) > 0 });
            } else if (Math.abs((s.pagu || 0) - (n.pagu || 0)) > TOL) {
                beda.push({ key: n.key, level: n.level, nama: n.uraian, paguDipa: n.pagu, paguSirup: s.pagu, manual: s.manual, id: s.id });
            }
        }
        for (const [k, s] of pkkr) if (!dipaNodes.has(k)) hilang.push({ key: k, level: s.level, nama: s.nama, pagu: s.pagu, manual: s.manual, id: s.id });
        const byDepth = (a, b) => a.key.split('.').length - b.key.split('.').length || a.key.localeCompare(b.key);
        baru.sort(byDepth);
        return { baru, hilang, beda };
    }

    // ── 3. RUP vs DIPA per akun ─────────────────────────────────────────
    function sanding(akunMap, pakets) {
        const orphans = [];
        for (const p of pakets) {
            p.verdicts = [];
            if (p.status === '51' || p.aktif === 'false' && p.status !== '3') continue;
            for (const sd of p.sumberDana || []) {
                const key = sd.mak;
                const a = akunMap.get(key);
                const ref = { paketId: p.id, nama: p.nama, status: p.status, pagu: sd.pagu, mak: key };
                if (a) a.rup.push(ref);
                else orphans.push(ref);
            }
        }
        for (const a of akunMap.values()) {
            const sum = st => a.rup.filter(r => st.includes(r.status)).reduce((s, r) => s + r.pagu, 0);
            a.rupU = sum(['3']);
            a.rupFD = sum(['2']);
            a.rupDraft = sum(['11', '12']);
            a.target = a.P;                 // pagu pengadaan yang semestinya terumumkan
            a.selisih = a.target - a.rupU;  // + kurang, − lebih
            if (a.rupU === 0 && a.target === 0) a.status = a.CEK ? 'CEK' : 'NP';
            else if (a.target === 0 && a.rupU > 0) a.status = a.CEK ? 'CEK' : 'NP_TERUMUMKAN';
            else if (Math.abs(a.selisih) <= TOL) a.status = 'SESUAI';
            else a.status = a.selisih > 0 ? 'KURANG' : 'LEBIH';
        }
        return { orphans };
    }

    // ── 4. Verdict per paket ────────────────────────────────────────────
    function verdictPaket(p, akunMap) {
        const rows = (p.sumberDana || []).map(sd => {
            const base = { mak: sd.mak, pagu: sd.pagu, danaApbn: sd.danaApbn, idLama: sd.id };
            const a = akunMap.get(sd.mak);
            if (!a) return { ...base, v: 'MAK_HILANG' };
            if (a.target === 0 && !a.CEK) return { ...base, v: 'NON_PENGADAAN', alasan: [...new Set(a.items.filter(i => i.kelas === 'NP').map(i => i.alasan))].join('; ') };
            // sumber dana paket harus salah satu SD akun di DIPA (hanya bisa dicek bila RKK diunggah)
            const danaDipa = (a.sd || []).map(x => SD_CODE[x]).filter(Boolean);
            const danaBeda = sd.danaApbn && danaDipa.length && !danaDipa.includes(sd.danaApbn) ? danaDipa[0] : null;
            if (a.status === 'LEBIH') return { ...base, v: 'LEBIH', selisih: a.selisih, danaBeda };
            return { ...base, v: danaBeda ? 'DANA_BEDA' : 'OK', danaBeda };
        });
        const all = v => rows.length && rows.every(r => r.v === v);
        const any = v => rows.some(r => r.v === v);
        let verdict = 'OK';
        if (p.status === '51') verdict = 'DIBATALKAN';
        else if (all('NON_PENGADAAN')) verdict = 'BATAL';
        else if (any('MAK_HILANG')) verdict = 'REVISI_MAK';
        else if (any('NON_PENGADAAN')) verdict = 'REVISI_KELUARKAN_NP';
        else if (any('LEBIH')) verdict = 'REVISI_LEBIH';
        else if (any('DANA_BEDA')) verdict = 'REVISI_DANA';
        if (p.status === '2' && verdict === 'OK') verdict = 'UMUMKAN';
        return { rows, verdict };
    }

    // ── 5. Usulan pemindahan MAK untuk paket yang akunnya hilang ─────────
    // Hanya ke akun dengan kode sama DI KEGIATAN YANG SAMA (mis. FAN.ZZ1.ZZ1.GA.
    // 533121 → RBJ.725.301.GA.533121). Nilai paket tidak dipotong otomatis;
    // bila melebihi sisa pagu DIPA, baris ditandai agar diputuskan pengguna.
    function saranPindahMak(orphanRow, akunMap, sisa) {
        const parts = orphanRow.mak.split('.');
        const code = parts[6], keg = parts.slice(0, 2).join('.'), komp = parts.slice(0, 5).join('.'), sub = parts[5];
        const score = a => (a.key.startsWith(komp + '.') ? 4 : 0) + (a.key.split('.')[5] === sub ? 2 : 0) + ((sisa.get(a.key) || 0) > TOL ? 1 : 0);
        return [...akunMap.values()]
            .filter(a => a.akun === code && a.key.startsWith(keg + '.') && a.P > 0)
            .sort((x, y) => score(y) - score(x) || (sisa.get(y.key) || 0) - (sisa.get(x.key) || 0))
            .map(a => ({ key: a.key, sisa: sisa.get(a.key) || 0, nama: a.nama }));
    }

    // ── 6. Rencana aksi ─────────────────────────────────────────────────
    function plan(ctx) {
        const { akunMap, pakets, dipaNodes, pkkr, cfg } = ctx;
        const paketById = new Map(pakets.map(p => [p.id, p]));
        for (const p of pakets) Object.assign(p, verdictPaket(p, akunMap));
        const sisa = new Map([...akunMap.values()].map(a => [a.key, Math.max(0, a.selisih)]));
        const actions = [];

        // a. umumkan final draft yang sudah benar
        const fd = pakets.filter(p => p.verdict === 'UMUMKAN');
        if (fd.length) actions.push({ type: 'UMUMKAN', ids: fd.map(p => p.id), pagu: fd.reduce((s, p) => s + p.pagu, 0), pilih: true });

        // b. batalkan paket terumumkan yang seluruh MAK-nya non-pengadaan
        for (const p of pakets.filter(p => p.verdict === 'BATAL' && p.status === '3'))
            actions.push({ type: 'BATAL', paketId: p.id, nama: p.nama, pagu: p.pagu, pilih: true,
                alasan: 'Belanja non-pengadaan: ' + (p.rows.map(r => r.alasan).filter(Boolean)[0] || '') });

        // c. final draft bermasalah: hanya ditandai (bisa dikembalikan ke PPK)
        // (paket FD yang MAK+pagu-nya sama persis dengan paket terumumkan = kemungkinan ganda)
        const umumByMak = new Map();
        for (const q of pakets.filter(q => q.status === '3')) for (const sd of q.sumberDana || []) umumByMak.set(`${sd.mak}|${Math.round(sd.pagu / 1e5)}`, q);
        const ALASAN_FD = { BATAL: 'Belanja non-pengadaan', REVISI_MAK: 'MAK tidak ada di DIPA revisi terakhir', REVISI_KELUARKAN_NP: 'Memuat akun non-pengadaan',
            REVISI_LEBIH: 'Akun sudah penuh terumumkan — mengumumkan paket ini membuat RUP melebihi pagu', REVISI_DANA: 'Sumber dana tidak sesuai DIPA' };
        for (const p of pakets.filter(p => p.status === '2' && !['OK', 'UMUMKAN'].includes(p.verdict))) {
            const twin = (p.sumberDana || []).map(sd => umumByMak.get(`${sd.mak}|${Math.round(sd.pagu / 1e5)}`)).find(Boolean);
            actions.push({ type: 'BATAL_FD', paketId: p.id, nama: p.nama, pagu: p.pagu, pilih: false, verdict: p.verdict,
                alasan: (ALASAN_FD[p.verdict] || 'Perlu dicek') + (twin ? ` · kemungkinan ganda dengan paket terumumkan ${twin.id} (${twin.nama.slice(0, 40)})` : '') });
        }

        // d. revisi paket terumumkan: MAK hilang, akun NP, RUP melebihi pagu akun, dana beda.
        //    Kelebihan di satu akun dipindah ke akun berkode sama di kegiatan yang sama yang
        //    masih kurang (kasus subkomponen dirombak saat revisi DIPA); sisanya dikurangi.
        const lebihSisa = new Map([...akunMap.values()].filter(a => a.status === 'LEBIH').map(a => [a.key, a.rupU - a.P]));
        const JENIS_REV = ['REVISI_MAK', 'REVISI_KELUARKAN_NP', 'REVISI_LEBIH', 'REVISI_DANA'];
        const kandidat = pakets.filter(p => JENIS_REV.includes(p.verdict) && p.status === '3').sort((x, y) => y.pagu - x.pagu);
        for (const p of kandidat) {
            const anggaran = [], catatan = [];
            let perluKeputusan = false;
            const push = row => {
                const same = anggaran.find(x => x.mak === row.mak && x.danaApbn === row.danaApbn && !x.lebih && !row.lebih);
                if (same) same.pagu += row.pagu; else anggaran.push(row);
            };
            for (const r of p.rows) {
                if (!r.pagu) continue;
                const dana = r.danaBeda || r.danaApbn || 'A';
                if (r.danaBeda) catatan.push(`${r.mak}: sumber dana ${r.danaApbn} → ${r.danaBeda} (sesuai DIPA)`);
                if (r.v === 'NON_PENGADAAN') { catatan.push(`Baris ${r.mak} (Rp${fmt(r.pagu)}) dikeluarkan: ${r.alasan}`); continue; }
                if (r.v === 'MAK_HILANG') {
                    const cands = saranPindahMak(r, akunMap, sisa);
                    const tgt = cands[0];
                    if (!tgt) { catatan.push(`Baris ${r.mak} (Rp${fmt(r.pagu)}) tidak punya padanan di DIPA — dihapus`); continue; }
                    const s = sisa.get(tgt.key) || 0;
                    const lebih = Math.max(0, r.pagu - s);
                    sisa.set(tgt.key, Math.max(0, s - r.pagu));
                    const row = { mak: tgt.key, pagu: r.pagu, dari: r.mak, kandidat: cands.slice(0, 6), danaApbn: dana };
                    if (lebih > TOL) { row.lebih = lebih; perluKeputusan = true; catatan.push(`${tgt.key}: melebihi sisa pagu DIPA Rp${fmt(lebih)} (cek tahun jamak / nilai kontrak)`); }
                    push(row);
                    continue;
                }
                if (r.v === 'LEBIH') {
                    const ex = lebihSisa.get(r.mak) || 0;
                    const mv = Math.min(r.pagu, ex);
                    if (mv <= TOL) { push({ mak: r.mak, pagu: r.pagu, danaApbn: dana, idLama: r.idLama }); continue; }
                    lebihSisa.set(r.mak, ex - mv);
                    if (r.pagu - mv > TOL) push({ mak: r.mak, pagu: r.pagu - mv, danaApbn: dana, idLama: r.idLama });
                    const cands = saranPindahMak(r, akunMap, sisa).filter(c => c.key !== r.mak && c.sisa > TOL);
                    let rest = mv;
                    if (cands[0]) {
                        const amt = Math.min(mv, cands[0].sisa);
                        sisa.set(cands[0].key, cands[0].sisa - amt);
                        push({ mak: cands[0].key, pagu: amt, dari: r.mak, kandidat: cands.slice(0, 6), danaApbn: dana });
                        catatan.push(`Kelebihan ${r.mak} Rp${fmt(amt)} dipindah ke ${cands[0].key} (akun sama, masih kurang terumumkan)`);
                        rest -= amt;
                    }
                    if (rest > TOL) { perluKeputusan = true; catatan.push(`${r.mak}: pagu paket dikurangi Rp${fmt(rest)} agar tidak melebihi pagu pengadaan DIPA`); }
                    continue;
                }
                push({ mak: r.mak, pagu: r.pagu, danaApbn: dana, idLama: r.idLama });
            }
            const alasan = { REVISI_MAK: 'Penyesuaian MAK dengan DIPA revisi terakhir', REVISI_KELUARKAN_NP: 'Mengeluarkan akun non-pengadaan',
                REVISI_LEBIH: 'Menyesuaikan pagu paket dengan pagu DIPA revisi terakhir', REVISI_DANA: 'Penyesuaian sumber dana dengan DIPA' }[p.verdict];
            if (!anggaran.length) {
                actions.push({ type: 'BATAL', paketId: p.id, nama: p.nama, pagu: p.pagu, pilih: true, alasan: alasan + '; tidak ada MAK DIPA yang tersisa' });
                continue;
            }
            // tidak ada yang berubah (kelebihan akun sudah habis ditangani paket lain) → lewati
            const sig = xs => xs.map(r => `${r.mak}|${Math.round(r.pagu)}|${r.danaApbn || 'A'}`).sort().join(';');
            if (!catatan.length && sig(anggaran) === sig((p.sumberDana || []).filter(x => x.pagu))) continue;
            actions.push({ type: 'REVISI', donorId: p.id, alasan, catatan, pilih: !perluKeputusan, pakets: [paketDari(p, anggaran, akunMap, cfg)] });
        }

        // e. paket baru untuk sisa pagu pengadaan yang belum terumumkan,
        //    dititipkan ke revisi 1→N paket donor kecil yang sudah benar
        const baru = [];
        for (const a of [...akunMap.values()].sort((x, y) => x.key.localeCompare(y.key))) {
            const s = sisa.get(a.key) || 0;
            if (s <= Math.max(TOL, cfg.minPaketBaru || 0)) continue;
            baru.push(paketBaru(a, s, dipaNodes, cfg));
        }
        const donors = pakets.filter(p => p.status === '3' && p.verdict === 'OK' && p.aktif !== 'false').sort((x, y) => x.pagu - y.pagu);
        const per = cfg.maxPaketPerRevisi || 15;
        for (let i = 0; i < baru.length; i += per) {
            const donor = donors.shift();
            const chunk = baru.slice(i, i + per);
            if (!donor) { actions.push({ type: 'TANPA_DONOR', pilih: false, pakets: chunk }); continue; }
            actions.push({ type: 'REVISI', donorId: donor.id, alasan: 'Penambahan paket sesuai DIPA revisi terakhir', pilih: true,
                catatan: [`Paket #1 = paket donor ${donor.id} (isinya tidak diubah); paket #2 dst. adalah paket baru`],
                pakets: [paketDari(donor, donor.sumberDana.filter(s => s.pagu).map(s => ({ mak: s.mak, pagu: s.pagu })), akunMap, cfg), ...chunk] });
        }

        // f. cabang PKKR yang perlu ditambah (hanya yang memuat pagu pengadaan)
        const pk = diffPkkr(dipaNodes, akunMap, pkkr);
        const addNodes = pk.baru.filter(n => n.pilih);
        if (addNodes.length) actions.unshift({ type: 'PKKR_ADD', nodes: addNodes, pilih: true });

        return { actions, pkkrDiff: pk, paketById };
    }
    const fmt = n => Math.round(n).toLocaleString('id-ID');

    function namaCabang(key, dipaNodes) {
        const sub = dipaNodes.get(key.split('.').slice(0, 6).join('.'));
        const komp = dipaNodes.get(key.split('.').slice(0, 5).join('.'));
        return (sub && sub.uraian) || (komp && komp.uraian) || '';
    }

    function uraianItems(a, pagu) {
        const P = a.items.filter(i => i.kelas !== 'NP');
        const fmt = n => Math.round(n).toLocaleString('id-ID');
        return P.map((i, k) => `${k + 1}. ${i.grup ? i.grup + ' › ' : ''}${i.uraian}${i.volume ? ' (' + i.volume + ')' : ''} Rp${fmt(i.pagu)}`).join('\n')
            + (Math.abs(pagu - a.P) > TOL ? `\n(dialokasikan Rp${fmt(pagu)} dari Rp${fmt(a.P)})` : '');
    }

    // pecah pagu paket baru per sumber dana (RM/PNBP/BLU/SBSN) sesuai porsi item pengadaan
    function anggaranPerDana(a, pagu) {
        const parts = Object.entries(a.PbySd || { '': pagu }).filter(([, v]) => v > 0);
        const tot = parts.reduce((s, [, v]) => s + v, 0) || 1;
        let sisa = pagu;
        return parts.map(([sd, v], i) => {
            const x = i === parts.length - 1 ? sisa : Math.round(pagu * v / tot);
            sisa -= x;
            return { mak: a.key, pagu: x, danaApbn: SD_CODE[sd] || 'A', sd: sd || '' };
        });
    }

    function paketBaru(a, pagu, dipaNodes, cfg) {
        const jenis = Classify.saranJenis(a.akun, a.items.map(i => i.uraian).join(' '));
        const cab = namaCabang(a.key, dipaNodes);
        const kro = dipaNodes.get(a.key.split('.').slice(0, 3).join('.'));
        return {
            baru: true, pilih: true,
            nama: `${a.nama}${cab ? ' - ' + cab : ''}`.slice(0, 250),
            anggaran: anggaranPerDana(a, pagu),
            jenis, metode: Classify.saranMetode(jenis, pagu, a.akun, a.items.map(i => `${i.grup} ${i.uraian}`).join(' '), cfg),
            uraian: uraianItems(a, pagu), spesifikasi: uraianItems(a, pagu),
            volume: '1 Paket', praDipa: false, pdn: true, umkm: pagu <= 15e9,
            lokasiTeks: (kro && kro.lokasi) || '',
            jadwal: { ...cfg.jadwalDefault },
            spp: { ekonomi: true, sosial: true, lingkungan: false },
        };
    }

    function paketDari(p, anggaran, akunMap, cfg) {
        const pagu = anggaran.reduce((s, r) => s + r.pagu, 0);
        const jenis = (p.jenisPengadaan && p.jenisPengadaan[0] && p.jenisPengadaan[0].jenis) || 'Barang';
        return {
            baru: false, pilih: true, sumberId: p.id,
            nama: p.nama, anggaran, jenis, metode: p.metode || Classify.saranMetode(jenis, pagu, '', '', cfg),
            uraian: p.uraian || '', spesifikasi: p.spesifikasi || '', volume: p.volume || '1 Paket',
            praDipa: /ya/i.test(p.pradipa || ''), pdn: !/tidak/i.test(p.pdn || ''), umkm: /ya/i.test(p.ukm || ''),
            lokasi: p.lokasi || [], jadwal: jadwalDari(p) || { ...cfg.jadwalDefault },
            spp: { ekonomi: true, sosial: true, lingkungan: false },
        };
    }

    const BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
    function ym(s) {
        const m = String(s || '').trim().toLowerCase().match(/([a-z]+)\s+(\d{4})/);
        if (!m) return '';
        const i = BULAN.indexOf(m[1]);
        return i < 0 ? '' : `${m[2]}-${String(i + 1).padStart(2, '0')}`;
    }
    function jadwalDari(p) {
        if (!p.pemilihan) return null;
        return {
            awalPengadaan: ym(p.pemilihan.mulai), akhirPengadaan: ym(p.pemilihan.akhir),
            awalPekerjaan: ym(p.pelaksanaan && p.pelaksanaan.mulai), akhirPekerjaan: ym(p.pelaksanaan && p.pelaksanaan.akhir),
            awalKebutuhan: ym(p.pemanfaatan && p.pemanfaatan.mulai), kebutuhan: ym(p.pemanfaatan && p.pemanfaatan.akhir),
        };
    }

    // ── 7. Struktur anggaran yang direkomendasikan ───────────────────────
    // = total pagu paket terumumkan (setelah rencana dijalankan) per jenis belanja
    function strukturAnggaran(akunMap, extra) {
        const out = { barjas: 0, modal: 0, sosial: 0, hibah: 0, lainnya: 0 };
        for (const a of akunMap.values()) {
            const g = Classify.jenisBelanja(a.akun);
            if (g in out) out[g] += a.rupU;
        }
        for (const e of extra || []) {
            const g = Classify.jenisBelanja(e.mak.split('.').pop());
            if (g in out) out[g] += e.delta;
        }
        return out;
    }

    return { SD_CODE, buildDipa, diffPkkr, sanding, verdictPaket, plan, strukturAnggaran, ym, ST, LV_SIRUP, levelOfKey, parentKey, TOL };
})();



// ─────────────────────────────────────────────────────────────── API SiRUP ──
// Semua akses ke SiRUP lewat sesi login pengguna (same-origin). Pembacaan
// memakai endpoint DataTables/selfservice; penulisan meniru persis payload
// form yang direkam dari UI SiRUP (lihat rekaman Dual-Control 2026-09-30).
const Sirup = (() => {
    const BASE = '/sirup';
    const JENIS_ID = { 'Barang': 1, 'Pekerjaan Konstruksi': 2, 'Jasa Konsultansi': 3, 'Jasa Lainnya': 4 };
    const METODE_ID = { 'E-Purchasing': 9, 'Pengadaan Langsung': 8, 'Penunjukan Langsung': 7, 'Seleksi': 15, 'Tender': 13, 'Tender Cepat': 14 };
    // id provinsi SiRUP (urutan lama LPSE); nama diverifikasi dari data paket
    const PROVINSI = ['', 'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Jambi', 'Sumatera Selatan', 'Bengkulu', 'Lampung',
        'Kepulauan Bangka Belitung', 'Kepulauan Riau', 'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur', 'Banten',
        'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur',
        'Sulawesi Utara', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Gorontalo', 'Sulawesi Barat', 'Maluku', 'Maluku Utara',
        'Papua Barat', 'Papua', 'Kalimantan Utara', 'Papua Selatan', 'Papua Tengah', 'Papua Pegunungan', 'Papua Barat Daya'];

    let log = () => { };
    const setLogger = fn => { log = fn; };
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    async function get(url) {
        const r = await fetch(url, { credentials: 'same-origin' });
        if (!r.ok) throw new Error(`GET ${url} → HTTP ${r.status}`);
        return r;
    }
    const getText = async url => (await get(url)).text();
    async function post(url, body, { json = false } = {}) {
        const r = await fetch(url, {
            method: 'POST', credentials: 'same-origin', redirect: 'follow',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', ...(json ? { 'X-Requested-With': 'XMLHttpRequest' } : {}) },
            body: body instanceof URLSearchParams ? body.toString() : body,
        });
        if (!r.ok) throw new Error(`POST ${url} → HTTP ${r.status}`);
        return json ? r.json() : r;
    }
    async function dt(url, extra = '') {
        const sep = url.includes('?') ? '&' : '?';
        const t = await getText(`${url}${sep}sEcho=1&iColumns=12&iDisplayStart=0&iDisplayLength=2000&sSearch=${extra}`);
        return JSON.parse(t).aaData;
    }
    const isLoginPage = html => /name="txtUsername"/.test(html) && !/id="user-logout"/.test(html);

    // ── konteks login ────────────────────────────────────────────────────
    async function context() {
        const html = document.documentElement.outerHTML;
        const ctx = { login: /id="user-logout"/.test(html) };
        if (!ctx.login) return ctx;
        const dd = [...document.querySelectorAll('#modalPengguna dt')].reduce((o, dt) => {
            o[dt.textContent.replace(/:\s*$/, '').trim()] = (dt.nextElementSibling ? dt.nextElementSibling.textContent : '').replace(/ /g, ' ').trim();
            return o;
        }, {});
        ctx.nama = dd['Nama Lengkap'] || '';
        ctx.role = dd['Role User'] || '';
        ctx.satkerNama = dd['Satker'] || '';
        const userLink = [...document.querySelectorAll('a.dropdown-toggle')].map(a => a.textContent.trim()).filter(Boolean);
        ctx.username = (document.querySelector('#user-logout') ? userLink.find(t => !/^\d{4}$/.test(t) && !/Rekap|RUP|Cari|Kelola|Unduh|Moner|FAQ|Berita|Dashboard|Ketentuan|Kontak/.test(t)) : '') || '';
        const tahun = (document.querySelector('a[href="#"] .fa-calendar') || {}).parentElement;
        ctx.tahun = +(html.match(/tahunAnggaran\s*[:=]\s*(20\d\d)/) || [])[1] || +(userLink.find(t => /^20\d\d$/.test(t)) || new Date().getFullYear());
        // id internal & kode satker dari form Program (hidden input) dan halaman integrasi
        const fp = await getText(`${BASE}/programctr/formprogram`);
        ctx.idSatker = (fp.match(/name="program\.id_satker" value="(\d+)"/) || [])[1] || '';
        const ta = (fp.match(/name="program\.tahun_anggaran"[^>]*value="(\d{4})"/) || [])[1];
        if (ta) ctx.tahun = +ta;
        const ig = await getText(`${BASE}/integrasimonsaktictr/index`);
        ctx.kodeSatker = (ig.match(/name="satker\.id_satker"[^>]*value="(\d{6})"/) || [])[1] || '';
        ctx.isKPA = /^(PAKPA|KPA|KPAD)$/i.test(ctx.role);
        return ctx;
    }

    // ── PKKR ─────────────────────────────────────────────────────────────
    const PKKR_LV = [
        ['prog', 'datatablelistprogram', null],
        ['keg', 'datatablelistkegiatan', 'idProgram'],
        ['kro', 'datatablelistoutput', 'idKegiatan'],
        ['ro', 'datatablelistsuboutput', 'idOutput'],
        ['komp', 'datatablelistkomponen', 'idSubOutput'],
        ['sub', 'datatablelistsubkomponen', 'idKomponen'],
    ];
    // Kolom pagu & PPK berbeda per level; baris manual ditandai kolom id_client 'N/A'
    function rowToNode(row, lvl, parentKey) {
        const kode = String(row[2]).trim();
        const pagu = +(lvl === 'prog' ? row[4] : lvl === 'keg' ? row[3] : row[4]) || 0;
        const idClient = row[row.length - 1];
        return { id: String(row[0]), level: lvl, kode, nama: row[1], pagu, key: parentKey ? `${parentKey}.${kode}` : kode, manual: !idClient || idClient === 'N/A' };
    }
    async function crawlPkkr(tahun, onProgress) {
        const map = new Map();
        let n = 0;
        async function walk(depth, parent) {
            const [lvl, ep, param] = PKKR_LV[depth];
            const url = param ? `${BASE}/datatablectr/${ep}?tahun=${tahun}&${param}=${parent.id}` : `${BASE}/datatablectr/${ep}`;
            const rows = await dt(url);
            for (const r of rows) {
                const node = rowToNode(r, lvl, parent && parent.key);
                node.parentId = parent ? parent.id : null;
                map.set(node.key, node);
                if (onProgress) onProgress(++n, node.key);
                if (depth + 1 < PKKR_LV.length) await walk(depth + 1, node);
            }
        }
        await walk(0, null);
        return map;
    }

    // Simpan node PKKR baru. parentId = id node induk di SiRUP.
    async function tambahPkkr(ctx, node, parentId, idPpk) {
        const T = ctx.tahun, S = ctx.idSatker;
        const f = new URLSearchParams();
        const add = (k, v) => f.append(k, v == null ? '' : v);
        switch (node.level) {
            case 'prog':
                add('program.id', ''); add('program.tahun_anggaran', T); add('program.id_satker', S);
                add('program.id', ''); add('program.nama', node.nama); add('program.kode_programs', node.kode); add('program.pagu', node.pagu); add('isEdit', '');
                return post(`${BASE}/programctr/simpanprogram`, f);
            case 'keg':
                add('kegiatan.tahun_anggaran', T); add('isEdit', ''); add('kegiatan.id_satker', S); add('kegiatan.id_program', parentId); add('kegiatan.id', '');
                add('kegiatan.nama', node.nama); add('kegiatan.kode_kegiatans', node.kode); add('kegiatan.pagu', node.pagu); add('kegiatan.id_ppk', idPpk || '');
                return post(`${BASE}/programctr/simpankegiatan`, f);
            case 'kro':
                add('output.id', ''); add('output.tahun_anggaran', T); add('output.id_kegiatan', parentId); add('isEdit', ''); add('output.id_satker', S);
                add('output.nama', node.nama); add('output.kode_output_string', node.kode); add('output.pagu', node.pagu); add('output.id_ppk', idPpk || '');
                return post(`${BASE}/programctr/simpanoutput`, f);
            case 'ro':
                add('suboutput.id', ''); add('suboutput.tahun_anggaran', T); add('suboutput.id_output', parentId); add('isEdit', ''); add('suboutput.id_satker', S);
                add('suboutput.nama', node.nama); add('suboutput.kode_suboutput_string', node.kode); add('suboutput.pagu', node.pagu); add('suboutput.id_ppk', idPpk || '');
                return post(`${BASE}/programctr/simpansuboutput`, f);
            case 'komp':
                add('komponen.id', ''); add('komponen.tahun_anggaran', T); add('komponen.id_suboutput', parentId); add('komponen.satkerID', S);
                add('komponen.nama', node.nama); add('komponen.kode_komponen_string', node.kode); add('komponen.pagu', node.pagu); add('komponen.id_ppk', idPpk || '');
                return post(`${BASE}/programctr/simpankomponen`, f);
            case 'sub':
                add('subkomponen.id', ''); add('subkomponen.tahun_anggaran', T); add('subkomponen.id_komponen', parentId); add('subkomponen.satkerID', S);
                add('subkomponen.nama', node.nama); add('subkomponen.kode_subkomponen_string', node.kode); add('subkomponen.pagu', node.pagu); add('subkomponen.id_ppk', idPpk || '');
                return post(`${BASE}/programctr/simpansubkomponen`, f);
        }
        throw new Error('Level PKKR tidak dikenal: ' + node.level);
    }
    // cari id node yang baru dibuat (berdasarkan kode di bawah induk)
    async function cariNodeBaru(ctx, level, parentId, kode) {
        const i = PKKR_LV.findIndex(l => l[0] === level);
        const [, ep, param] = PKKR_LV[i];
        const url = param ? `${BASE}/datatablectr/${ep}?tahun=${ctx.tahun}&${param}=${parentId}` : `${BASE}/datatablectr/${ep}`;
        const rows = await dt(url);
        const r = rows.find(x => String(x[2]).trim() === kode);
        return r ? String(r[0]) : null;
    }
    async function daftarPpk() {
        const h = await getText(`${BASE}/programctr/formsubkomponen?idKomponen=0`).catch(() => '');
        return [...h.matchAll(/<option value="(\d+)"\s*>([^<]+)<\/option>/g)].map(m => ({ id: m[1], nama: m[2].trim() }));
    }

    // ── RUP ──────────────────────────────────────────────────────────────
    async function daftarPaket(tahun, jenis = 'penyedia') {
        const ep = jenis === 'penyedia' ? 'dataruppenyedia2018' : 'datarupswakelola2018';
        const rows = await dt(`${BASE}/datatablectr/${ep}?tahun=${tahun}`, '&status=');
        return rows.map(r => ({ id: String(r[0]), jenisPaket: jenis, kegiatan: r[1] === 'N/A' ? r[11] : r[1], nama: r[2], pagu: +r[3] || 0, waktu: r[4],
            sumber: r[5], aktif: r[6], fd: r[7], umumkan: r[8], status: String(r[9]), idClient: r[13], manual: r[13] === 'N/A' }));
    }
    async function denorm(id, tahun) {
        return post(`${BASE}/selfservice/paketpenyediadenormalisasibyid`, `id=${id}&tahunAnggaran=${tahun}`, { json: true });
    }
    // Detail HTML (PDN, UKM, pra-DIPA, metode, nama lokasi) — tidak ada di JSON
    async function detailHtml(id) {
        const html = await getText(`${BASE}/penyedia/${id}`);
        const d = new DOMParser().parseFromString(html, 'text/html');
        const txt = el => (el ? el.textContent : '').replace(/[ \t\r]+/g, ' ').replace(/\n\s*/g, '\n').trim();
        const o = {};
        for (const td of d.querySelectorAll('#detil td.label-left')) {
            const v = td.nextElementSibling; if (!v) continue;
            const t = v.querySelector('table');
            o[txt(td)] = t ? [...t.querySelectorAll('tr')].map(tr => [...tr.children].map(txt)) : txt(v);
        }
        return o;
    }
    const rows = (t, n) => (Array.isArray(t) ? t : []).filter(x => x.length === n && /^\d+\.$/.test(x[0]));
    async function detailPaket(p, tahun) {
        const [j, h] = await Promise.all([denorm(p.id, tahun), detailHtml(p.id)]);
        const lokNama = rows(h['Lokasi Pekerjaan'], 4);
        const jd = k => { const t = h[k]; return Array.isArray(t) && t[1] ? { mulai: t[1][0], akhir: t[1][1] } : null; };
        return Object.assign(p, {
            nama: j.nama || p.nama,
            uraian: (j.keterangan || '').replace(/\t+/g, ' ').replace(/ {2,}/g, ' ').trim(),
            spesifikasi: (j.spesifikasi || '').replace(/\t+/g, ' ').replace(/ {2,}/g, ' ').trim(),
            volume: j.volume || '1 Paket',
            sumberDana: (j.paket_anggaran_json || []).map(a => ({ id: a.id, mak: a.mak, pagu: a.pagu, idKomponen: a.id_komponen, sumber: a.sumber_dana, danaApbn: a.id_dana_apbn, asal: a.asal_dana, asalSatker: a.asal_dana_satker, ta: a.tahun_anggaran_dana, kodeInstansi: a.kode_instansi, kodeEselon: a.kode_esselon, kodeSatker: a.kode_satker })),
            lokasiRaw: (j.paket_lokasi_json || []).map((l, i) => ({ id: l.id, id_provinsi: l.id_provinsi, id_kabupaten: l.id_kabupaten, detil: l.detil_lokasi, prov: lokNama[i] ? lokNama[i][1] : '', kab: lokNama[i] ? lokNama[i][2] : '' })),
            lokasi: lokNama.map(x => ({ prov: x[1], kab: x[2], detail: x[3] })),
            jenisRaw: (j.paket_jenis_json || []).map(x => ({ id: x.id, jenisid: x.jenisid, pagu: x.jumlah_pagu })),
            jenisPengadaan: rows(h['Jenis Pengadaan'], 3).map(x => ({ jenis: x[1], pagu: +x[2] })),
            tanggal: { awalPengadaan: (j.tanggal_awal_pengadaan || '').slice(0, 7), akhirPengadaan: (j.tanggal_akhir_pengadaan || '').slice(0, 7), awalPekerjaan: (j.tanggal_awal_pekerjaan || '').slice(0, 7), akhirPekerjaan: (j.tanggal_akhir_pekerjaan || '').slice(0, 7) },
            pemanfaatan: jd('Pemanfaatan Barang/Jasa'), pelaksanaan: jd('Jadwal Pelaksanaan Kontrak'), pemilihan: jd('Jadwal Pemilihan Penyedia'),
            metode: h['Metode Pemilihan'] || '', pradipa: h['Pra DIPA / DPA'] || '', pdn: h['Produk Dalam Negeri'] || '', ukm: h['Usaha Kecil/Koperasi'] || '',
            spp: (() => { const t = h['Pengadaan Berkelanjutan atau Sustainable Public Procurement (SPP)']; const g = k => Array.isArray(t) && (t.find(r => r[0] === k) || [])[1] === 'Ya'; return { ekonomi: g('Aspek Ekonomi'), sosial: g('Aspek Sosial'), lingkungan: g('Aspek Lingkungan') }; })(),
            tglUmumkan: h['Tanggal Umumkan Paket'] || '',
        });
    }

    const kabCache = new Map();
    async function kabupaten(idProv) {
        // simpan promise-nya supaya puluhan editor tidak memicu request yang sama berkali-kali
        if (!kabCache.has(idProv)) kabCache.set(idProv, post(`${BASE}/selfservice/daftarkabupaten`, `id_provinsi=${idProv}`, { json: true }).then(a => a.map(k => ({ id: k.kbp_id, nama: k.kbp_nama }))).catch(() => []));
        return kabCache.get(idProv);
    }
    async function alasanUmkm(tahun) {
        return post(`${BASE}/selfservice/daftaralasanumkm`, `tahunAnggaran=${tahun}`, { json: true }).then(a => a.map(x => x.alasan_umkm)).catch(() => []);
    }

    // ── Struktur anggaran ───────────────────────────────────────────────
    async function strukturAnggaran() {
        const h = await getText(`${BASE}/strukturanggaranctr/strukturanggarannew`);
        const v = n => +((h.match(new RegExp(`name="strukturAnggaranPusat\\.${n}"[\\s\\S]*?value="(\\d*)"`)) || [])[1] || 0);
        return {
            id: (h.match(/name="strukturAnggaranPusat\.id" value="(\d+)"/) || [])[1] || '',
            idSatker: (h.match(/name="strukturAnggaranPusat\.id_satker"\s*value="(\d+)"/) || [])[1] || '',
            barjas: v('belanja_barjas'), modal: v('belanja_modal'), sosial: v('belanja_pengadaan_sosial'), hibah: v('belanja_pengadaan_hibah'), lainnya: v('belanja_pengadaan_lainnya'),
            diperbarui: (h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').match(/diperbarui pada tanggal\s*([\d-]+\s*[\d:]*)/i) || [])[1] || '',
        };
    }
    async function simpanStrukturAnggaran(sa, val, tahun) {
        const f = new URLSearchParams();
        f.append('strukturAnggaranPusat.id', sa.id);
        f.append('strukturAnggaranPusat.id_satker', sa.idSatker);
        f.append('strukturAnggaranPusat.tahun_anggaran', tahun);
        f.append('strukturAnggaranPusat.belanja_barjas', Math.round(val.barjas));
        f.append('strukturAnggaranPusat.belanja_modal', Math.round(val.modal));
        f.append('strukturAnggaranPusat.belanja_pengadaan_sosial', Math.round(val.sosial));
        f.append('strukturAnggaranPusat.belanja_pengadaan_hibah', Math.round(val.hibah));
        f.append('strukturAnggaranPusat.belanja_pengadaan_lainnya', Math.round(val.lainnya));
        return post(`${BASE}/strukturanggaranctr/simpanstrukturanggaranpusat`, f);
    }

    // ── Umumkan / batal ─────────────────────────────────────────────────
    async function umumkan(ids, jenis = 'penyedia') {
        const f = new URLSearchParams();
        f.append('sData', ids.map(id => `${id}=on`).join('&'));
        f.append('penyediaAtauSwakelola', jenis);
        return post(`${BASE}/rup/umumkan`, f);
    }
    async function batalFinalDraft(id, alasan, jenis = 'penyedia') {
        const f = new URLSearchParams({ alasan, idPaket: id, penyediaAtauSwakelola: jenis });
        return post(`${BASE}/rup/submitbatalkanfinaldraft`, f);
    }
    async function batalkanPaket(id, alasan, jenis = 'penyedia') {
        await getText(`${BASE}/rup/kajiulangpaket?id=${id}&penyediaAtauSwakelola=${jenis}&jenisMtl=&jenis=batal`);
        const f = new URLSearchParams({ alasan, id, penyediaAtauSwakelola: jenis });
        return post(`${BASE}/revisictr/simpanrevisi${jenis}batal`, f);
    }

    // ── Revisi satu ke banyak ───────────────────────────────────────────
    // Satu POST per paket hasil revisi; paket terakhir isSelesai=true. Paket
    // asal hilang dari daftar dan semua paket hasil lahir sebagai Final Draft.
    function payloadPaket(ctx, donor, pk, count, isSelesai, alasan) {
        const f = new URLSearchParams();
        const add = (k, v) => f.append(k, v == null ? '' : String(v));
        add('jenis', 1); add('is_edit', ''); add('paket.id_swakelola', ''); add('idTerkaji', donor.id);
        add('paket.kode_kldi', ctx.kodeKldi || 'K8'); add('paket.id_swakelola', '');
        // K/L: dikecualikan=true → form SiRUP menyembunyikan metode dan mengisi metode_dikecualikan=-1
        add('metode_dikecualikan', pk.metode === 'Dikecualikan' ? '-1' : '');
        add('idAwal', donor.id); add('count', count); add('alasan', alasan || 'Penyesuaian dengan DIPA'); add('paket.id_swakelola', '');
        add('paket.tahun_anggaran', ctx.tahun); add('paket.id_satker', ctx.idSatker); add('paket.nama', pk.nama);
        pk.lokasiRaw.forEach((l, i) => {
            add(`paketLokasi[${i}].id`, pk.baru ? '' : (l.id || '')); add(`paketLokasi[${i}].id_provinsi`, l.id_provinsi);
            add(`paketLokasi[${i}].id_kabupaten`, l.id_kabupaten); add(`paketLokasi[${i}].detil_lokasi`, l.detil || '');
        });
        add('paket.volume', pk.volume || '1 Paket'); add('paket.keterangan', pk.uraian); add('paket.spesifikasi', pk.spesifikasi);
        if (pk.praDipa) add('isPraDipa', 'on');
        add('paket.no_renja', '');
        let total = 0;
        pk.anggaran.forEach((a, i) => {
            const parts = a.mak.split('.');
            add(`paketAnggaran[${i}].id`, pk.baru ? '' : (a.idLama || ''));
            add(`paketAnggaran[${i}].tahun_anggaran_dana`, ctx.tahun); add(`paketAnggaran[${i}].sumber_dana`, a.sumber || 2);
            add(`paketAnggaran[${i}].asal_dana`, ctx.kodeKldi || 'K8'); add(`paketAnggaran[${i}].asal_dana_satker`, ctx.idSatker);
            add(`paketAnggaran[${i}].id_dana_apbn`, a.danaApbn || 'A');
            add(`paketAnggaran[${i}].mak1`, `${ctx.kodeBA}.${ctx.kodeEselon}.${ctx.kodeSatker}`);
            add(`paketAnggaran[${i}].mak`, parts.slice(5).join('.'));          // SUB.AKUN
            add(`paketAnggaran[${i}].id_komponen`, a.idKomponen);               // id Komponen PKKR
            add(`paketAnggaran[${i}].pagu`, Math.round(a.pagu));
            total += Math.round(a.pagu);
        });
        add('totalPaguBersih', total);
        const jenis = pk.jenisList && pk.jenisList.length ? pk.jenisList : [{ jenisid: JENIS_ID[pk.jenis] || 1, pagu: total }];
        jenis.forEach((j, i) => { add(`paketJenis[${i}].id`, pk.baru ? '' : (j.id || '')); add(`paketJenis[${i}].jenisid`, j.jenisid); add(`paketJenis[${i}].jumlah_pagu`, Math.round(j.pagu)); });
        add('isTKDN', pk.pdn ? 'true' : 'false');
        add('isUMKM', pk.umkm ? 'true' : 'false');
        if (!pk.umkm) add('alasan_umkm', pk.alasanUmkm || (total > 15e9 ? 'Paket pengadaan Barang/Pekerjaan Konstuksi/Jasa Lainnya memiliki nilai Pagu Anggaran > Rp. 15 miliar.' : 'Kompetensi tidak sesuai dengan usaha kecil'));
        if (pk.spp && pk.spp.ekonomi) add('sppEkonomi', 'on');
        if (pk.spp && pk.spp.sosial) add('sppSosial', 'on');
        if (pk.spp && pk.spp.lingkungan) add('sppLingkungan', 'on');
        add('paket.dikecualikan', pk.metode === 'Dikecualikan' ? 'true' : 'false');
        add('paket.metode_pengadaan', pk.metode === 'Dikecualikan' ? '' : (METODE_ID[pk.metode] || ''));
        const t = pk.jadwal;
        add('tanggalKebutuhan', t.kebutuhan); add('tanggalAwalKebutuhan', t.awalKebutuhan);
        add('tanggalAkhirPekerjaan', t.akhirPekerjaan); add('tanggalAwalPekerjaan', t.awalPekerjaan);
        add('tanggalAkhirPengadaan', t.akhirPengadaan); add('tanggalAwalPengadaan', t.awalPengadaan);
        add('isSelesai', isSelesai ? 'true' : 'false');
        return f;
    }

    async function revisiSatuKeBanyak(ctx, donor, pakets, alasan, { onStep, dryRun } = {}) {
        const payloads = pakets.map((pk, i) => payloadPaket(ctx, donor, pk, i + 1, i === pakets.length - 1, alasan));
        if (dryRun) return { payloads };
        const before = new Set((await daftarPaket(ctx.tahun)).map(p => p.id));
        const r0 = await get(`${BASE}/rup/kajiulangpaket?id=${donor.id}&penyediaAtauSwakelola=penyedia&jenisMtl=&jenis=satukebanyak`);
        if (!/formkajiulangsatukebanyak/.test(r0.url)) throw new Error('SiRUP tidak membuka form revisi satu ke banyak (URL: ' + r0.url + ')');
        for (let i = 0; i < payloads.length; i++) {
            const r = await post(`${BASE}/revisictr/simpankajiulangonetomanypenyedia`, payloads[i]);
            const expect = i === payloads.length - 1 ? /\/rup\/penyedia/ : new RegExp(`count=${i + 2}`);
            if (!expect.test(r.url)) {
                const body = await r.text();
                const msg = (body.match(/class="alert[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1];
                throw new Error(`Paket #${i + 1} ditolak SiRUP${msg ? ': ' + msg.replace(/<[^>]+>/g, ' ').trim() : ''} (URL ${r.url})`);
            }
            if (onStep) onStep(i + 1, payloads.length);
            await sleep(400);
        }
        const after = await daftarPaket(ctx.tahun);
        const baru = after.filter(p => !before.has(p.id));
        return { baru, donorHilang: !after.some(p => p.id === donor.id) };
    }

    return {
        context, crawlPkkr, tambahPkkr, cariNodeBaru, daftarPpk, daftarPaket, detailPaket, denorm, kabupaten, alasanUmkm,
        strukturAnggaran, simpanStrukturAnggaran, umumkan, batalFinalDraft, batalkanPaket, revisiSatuKeBanyak, payloadPaket,
        setLogger, JENIS_ID, METODE_ID, PROVINSI, isLoginPage, sleep,
    };
})();


// ───────────────────────────────────────────────────────────────────── UI ──
const UI = (() => {
    const APP = 'Sanding DIPA ↔ RUP';
    const fmt = n => (n == null || isNaN(n)) ? '–' : Math.round(n).toLocaleString('id-ID');
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const nowYM = (d = 0) => { const t = new Date(); t.setMonth(t.getMonth() + d); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; };
    const store = {
        get(k, def) { try { const v = localStorage.getItem('sdr:' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
        set(k, v) { try { localStorage.setItem('sdr:' + k, JSON.stringify(v)); } catch (e) { /* storage penuh/diblokir */ } },
    };

    const S = {
        step: 0, ctx: null, dipa: null, dipaFile: '', overrides: {}, pkkr: null, ppk: [], pakets: null, swakelola: [],
        an: null, plan: null, sa: null, busy: false, stop: false,
        cfg: Object.assign({
            plBarjas: 200e6, plKonstruksi: 400e6, plKonsultansi: 100e6, metodeEO: 'Tender', cekSebagai: 'CEK', minPaketBaru: 1000, maxPaketPerRevisi: 15,
            jadwalDefault: { awalPengadaan: nowYM(1), akhirPengadaan: nowYM(1), awalPekerjaan: nowYM(1), akhirPekerjaan: `${new Date().getFullYear()}-12`, awalKebutuhan: nowYM(1), kebutuhan: `${new Date().getFullYear()}-12` },
            jeda: 500,
        }, store.get('cfg', {})),
    };
    const STEPS = ['1. Data & Login', '2. Struktur PKKR', '3. Sanding RUP', '4. Rekap & Eksekusi', '5. Struktur Anggaran'];
    let root, body, foot, stepsEl, ctxEl;

    // ── helpers DOM ──────────────────────────────────────────────────────
    function h(tag, attrs, ...kids) {
        const el = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs || {})) {
            if (v == null || v === false) continue;
            if (k === 'class') el.className = v;
            else if (k === 'html') el.innerHTML = v;
            else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
            else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
            else el.setAttribute(k, v === true ? '' : v);
        }
        for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
        return el;
    }
    function log(msg, cls) {
        if (!foot) return;
        const t = new Date().toTimeString().slice(0, 8);
        foot.append(h('div', { class: cls || '' }, `[${t}] ${msg}`));
        foot.scrollTop = foot.scrollHeight;
    }
    function modal(title, content, buttons) {
        return new Promise(res => {
            const box = h('div', { class: 'sdr-modal sdr' });
            const close = v => { box.remove(); res(v); };
            box.append(h('div', {}, h('h3', {}, title), content,
                h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '12px' } },
                    ...(buttons || [['Batal', false, ''], ['Lanjutkan', true, 'pri']]).map(([l, v, c]) => h('button', { class: 'btn ' + c, onclick: () => close(v) }, l)))));
            document.body.append(box);
        });
    }
    const confirmBox = (title, html, ok = 'Ya, jalankan') => modal(title, h('div', { html }), [['Batal', false, ''], [ok, true, 'go']]);
    const pill = (txt, cls) => h('span', { class: 'pill ' + cls }, txt);
    const STATUS_PILL = {
        SESUAI: ['Sesuai', 'p-ok'], KURANG: ['Kurang', 'p-warn'], LEBIH: ['Lebih', 'p-bad'], NP: ['Non-pengadaan', 'p-np'],
        NP_TERUMUMKAN: ['NP terumumkan', 'p-bad'], CEK: ['Perlu cek', 'p-info'],
    };
    const progress = () => { const i = h('i'); const el = h('div', { class: 'prog' }, i); el.set = (a, b) => { i.style.width = (b ? Math.round(a / b * 100) : 0) + '%'; }; return el; };

    // ── kerangka jendela ─────────────────────────────────────────────────
    function open() {
        if (root) { root.style.display = 'flex'; return; }
        root = h('div', { class: 'sdr-ov sdr' });
        const win = h('div', { class: 'sdr-win' });
        ctxEl = h('span', { class: 'sdr-ctx' }, 'memeriksa login…');
        stepsEl = h('div', { class: 'sdr-steps' });
        body = h('div', { class: 'sdr-body' });
        foot = h('div', { class: 'sdr-foot' });
        win.append(h('div', { class: 'sdr-hd' }, h('h2', {}, APP), ctxEl,
            h('button', { class: 'btn sm', onclick: exportExcel, title: 'Unduh kertas kerja Excel' }, '⬇ Excel'),
            h('button', { class: 'btn sm', onclick: settings }, '⚙'),
            h('button', { class: 'sdr-x', title: 'Tutup', onclick: () => { root.style.display = 'none'; } }, '×')), stepsEl, body, foot);
        root.append(win);
        document.body.append(root);
        Sirup.setLogger(log);
        renderSteps();
        go(0);
    }
    function renderSteps() {
        stepsEl.innerHTML = '';
        const done = [!!S.dipa && !!S.ctx && S.ctx.login, !!S.pkkr, !!S.an, false, false];
        STEPS.forEach((s, i) => stepsEl.append(h('button', { class: `sdr-step${i === S.step ? ' on' : ''}${done[i] ? ' done' : ''}`, onclick: () => go(i) }, s)));
    }
    function go(i) {
        S.step = i; renderSteps(); body.innerHTML = '';
        [stepData, stepPkkr, stepSanding, stepRekap, stepStruktur][i]();
    }
    async function guard(fn) {
        if (S.busy) return;
        S.busy = true; S.stop = false;
        try { await fn(); } catch (e) { log('GAGAL: ' + e.message, 'e'); console.error(e); await modal('Terjadi kesalahan', h('div', { class: 'errbox' }, e.message), [['Tutup', false, 'pri']]); }
        finally { S.busy = false; renderSteps(); }
    }

    // ── 1. Data & login ─────────────────────────────────────────────────
    function stepData() {
        const ctxCard = h('div', { class: 'card' }, h('h3', {}, 'Akun SiRUP'), h('p', { class: 'note' }, 'Memeriksa sesi login…'));
        body.append(ctxCard);
        guard(async () => {
            S.ctx = await Sirup.context();
            ctxCard.innerHTML = '';
            ctxCard.append(h('h3', {}, 'Akun SiRUP'));
            if (!S.ctx.login) {
                ctxCard.append(h('div', { class: 'errbox' }, 'Anda belum login di SiRUP. Login dulu dengan akun KPA satker, lalu buka lagi panel ini.'));
                ctxEl.textContent = 'belum login';
                return;
            }
            ctxEl.textContent = `${S.ctx.username || ''} · ${S.ctx.role} · ${S.ctx.kodeSatker} · TA ${S.ctx.tahun}`;
            ctxCard.append(h('div', { class: 'kpis' },
                kpi(S.ctx.nama || '–', 'Nama pengguna'), kpi(S.ctx.role || '–', 'Role'), kpi(S.ctx.kodeSatker || '–', 'Kode satker'), kpi(String(S.ctx.tahun), 'Tahun anggaran')),
                h('div', {}, S.ctx.satkerNama),
                S.ctx.isKPA ? h('div', { class: 'okbox' }, 'Login sebagai KPA — fitur tambah PKKR, revisi, umumkan, dan struktur anggaran tersedia.')
                    : h('div', { class: 'warnbox' }, `Role "${S.ctx.role}" bukan KPA. Sanding tetap bisa dilihat, tetapi eksekusi (PKKR, revisi, umumkan) hanya bisa oleh akun KPA.`));
            const saved = store.get('ov:' + S.ctx.kodeSatker, null);
            if (saved) S.overrides = saved;
        });

        const input = h('input', { type: 'file', accept: '.pdf', multiple: true, style: { display: 'none' }, onchange: e => onFiles([...e.target.files]) });
        const dirInput = h('input', { type: 'file', webkitdirectory: true, style: { display: 'none' }, onchange: e => onFiles([...e.target.files]) });
        const drop = h('div', { class: 'drop', onclick: () => input.click() },
            h('div', { style: { fontSize: '15px', fontWeight: 600, color: '#1F497D' } }, 'Unggah PDF Rincian Kertas Kerja Satker (RKK) atau FA Detail 16 Segmen'),
            h('div', {}, 'Klik atau seret file ke sini. Boleh banyak file sekaligus — yang dipakai hanya milik satker yang sedang login.'));
        drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('hover'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('hover'));
        drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('hover'); onFiles([...e.dataTransfer.files]); });
        const info = h('div', {});
        body.append(h('div', { class: 'card' }, h('h3', {}, 'Data anggaran (DIPA terbaru)'),
            h('p', { class: 'note' }, 'Sejak integrasi SAKTI–SiRUP diputus (31 Juli 2026), RKA di SiRUP tidak ikut revisi DIPA. Tool ini membaca DIPA langsung dari PDF SAKTI.'),
            drop, input, dirInput, h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onclick: () => dirInput.click() }, '📁 Pilih folder'), h('span', { class: 'muted' }, 'FA Detail lebih disarankan: memuat Pagu Revisi terkini (termasuk revisi POK).')),
            info));
        if (S.dipa) showDipaInfo(info);

        async function onFiles(files) {
            files = files.filter(f => /\.pdf$/i.test(f.name));
            if (!files.length) return;
            await guard(async () => {
                const kode = S.ctx && S.ctx.kodeSatker;
                let cand = kode ? files.filter(f => f.name.includes(kode)) : files;
                if (!cand.length) cand = files.length <= 3 ? files : [];
                if (!cand.length) throw new Error(`Tidak ada file yang namanya memuat kode satker ${kode}. Pilih file satker ini saja.`);
                cand.sort((a, b) => (/FA_Detail/i.test(b.name) - /FA_Detail/i.test(a.name)) || b.lastModified - a.lastModified);
                const f = cand[0];
                if (cand.length > 1) log(`${cand.length} file cocok; dipakai ${f.name} (FA Detail diutamakan).`, 'w');
                info.innerHTML = ''; const pg = progress(); info.append(h('div', {}, 'Membaca ' + f.name), pg);
                if (typeof pdfjsLib === 'undefined') throw new Error('pdf.js belum termuat. Muat ulang halaman.');
                pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
                const res = await DipaParser.parse(pdfjsLib, new Uint8Array(await f.arrayBuffer()), (a, b) => pg.set(a, b));
                if (kode && res.meta.satker && res.meta.satker !== kode) throw new Error(`PDF ini milik satker ${res.meta.satker}, sedangkan login Anda satker ${kode}.`);
                // RKK ikut diunggah? pakai untuk melengkapi nama node & lokasi KRO yang tidak ada di FA
                const pendamping = cand.find(x => x !== f && /FA_Detail/i.test(x.name) !== /FA_Detail/i.test(f.name));
                if (pendamping) {
                    const r2 = await DipaParser.parse(pdfjsLib, new Uint8Array(await pendamping.arrayBuffer()));
                    let n = 0;
                    for (const [k, node] of res.nodes) {
                        const o = r2.nodes.get(k);
                        if (!o) continue;
                        if (!node.uraian && o.uraian) { node.uraian = o.uraian; n++; }
                        if (!node.lokasi && o.lokasi) node.lokasi = o.lokasi;
                        if ((!node.sd || !node.sd.length) && o.sd && o.sd.length) node.sd = o.sd;
                    }
                    log(`${pendamping.name} dipakai untuk melengkapi ${n} nama node dan lokasi KRO.`, 'o');
                }
                S.dipa = res; S.dipaFile = f.name; S.an = null; S.plan = null;
                log(`DIPA terbaca: ${res.meta.jenis} ${res.meta.satker}, ${res.items.length} baris detail, total Rp${fmt(res.check.itemTotal)}.`, 'o');
                showDipaInfo(info);
            });
        }
    }
    function kpi(v, l) { return h('div', { class: 'kpi' }, h('b', {}, v), h('span', {}, l)); }
    function showDipaInfo(el) {
        const d = S.dipa; el.innerHTML = '';
        const byProg = [...d.nodes.values()].filter(n => n.level === 'prog');
        el.append(h('div', { class: 'kpis', style: { marginTop: '10px' } },
            kpi(d.meta.jenis === 'FA' ? 'FA Detail 16 Segmen' : 'Rincian Kertas Kerja', 'Jenis dokumen'),
            kpi(d.meta.satker + (d.meta.periode ? ' · ' + d.meta.periode : ''), 'Satker / periode'),
            kpi('Rp' + fmt(d.check.itemTotal), 'Total pagu (jumlah item)'),
            kpi(`${d.items.length} item · ${d.meta.halaman} hlm`, 'Baris detail')),
            d.check.ok && !d.check.mismatches.length ? h('div', { class: 'okbox' }, `Rekonsiliasi lolos: jumlah seluruh item = total alokasi${d.meta.total ? ' Rp' + fmt(d.meta.total) : ''}, dan setiap subtotal cocok.`)
                : h('div', { class: 'warnbox' }, `Ada ${d.check.mismatches.length} subtotal yang tidak cocok dengan jumlah itemnya (total dokumen Rp${fmt(d.meta.total)}, jumlah item Rp${fmt(d.check.itemTotal)}). Periksa PDF sumber sebelum eksekusi.`),
            h('div', { class: 'muted' }, 'Program: ' + byProg.map(p => `${p.kode} Rp${fmt(p.pagu)}`).join(' · ')),
            h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn pri', onclick: () => go(1) }, 'Lanjut: cek struktur PKKR →')));
    }

    // ── 2. PKKR ─────────────────────────────────────────────────────────
    function needDipa() { if (!S.dipa || !S.ctx || !S.ctx.login) { body.append(h('div', { class: 'warnbox' }, 'Selesaikan langkah 1 (login + unggah PDF) terlebih dahulu.')); return true; } return false; }
    function stepPkkr() {
        if (needDipa()) return;
        const box = h('div', {});
        body.append(h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => guard(async () => { await loadPkkr(true); go(1); }) }, '↻ Baca ulang PKKR SiRUP')), box);
        guard(async () => {
            await loadPkkr(false);
            ensureAnalysis();
            const diff = Analysis.diffPkkr(S.dipa.nodes, S.an.akun, S.pkkr);
            const lvName = { prog: 'Program', keg: 'Kegiatan', kro: 'KRO', ro: 'RO', komp: 'Komponen', sub: 'Sub Komponen' };
            box.append(h('div', { class: 'kpis', style: { marginTop: '10px' } },
                kpi(String(S.pkkr.size), 'Node PKKR di SiRUP'), kpi(String(diff.baru.length), 'Cabang DIPA belum ada di PKKR'),
                kpi(String(diff.baru.filter(n => n.pilih).length), '…yang memuat pagu pengadaan'), kpi(String(diff.beda.length), 'Pagu berbeda')));
            if (!diff.baru.length) box.append(h('div', { class: 'okbox' }, 'Semua cabang DIPA sudah ada di PKKR SiRUP.'));
            else {
                const ppkSel = h('select', {}, h('option', { value: '' }, '— tanpa delegasi PPK —'), ...S.ppk.map(p => h('option', { value: p.id }, p.nama)));
                diff.baru.sort((a, b) => a.key.localeCompare(b.key));
                const rows = diff.baru.map(n => {
                    const cb = h('input', { type: 'checkbox', checked: n.pilih });
                    cb.addEventListener('change', () => { n.pilih = cb.checked; });
                    const depth = n.key.split('.').length - 1;
                    return h('tr', {}, h('td', {}, cb), h('td', {}, lvName[n.level]),
                        h('td', { class: 'mono', style: { paddingLeft: 7 + depth * 12 + 'px' } }, n.key),
                        h('td', {}, (() => { const i = h('input', { type: 'text', value: n.nama || '', placeholder: 'nama tidak terbaca — isi sesuai DIPA', style: { width: '100%', minWidth: '260px', borderColor: n.nama ? '' : '#b91c1c' } }); i.addEventListener('input', () => { n.nama = i.value.trim(); }); return i; })()),
                        h('td', { class: 'n' }, fmt(n.pagu)), h('td', { class: 'n' }, n.pengadaan ? fmt(n.pengadaan) : pill('non-pengadaan', 'p-np')));
                });
                box.append(h('h3', {}, 'Cabang baru di DIPA'),
                    h('p', { class: 'note' }, 'Default: hanya cabang yang memuat belanja pengadaan yang dicentang (cabang gaji/non-pengadaan dilewati). Cabang ditambahkan sebagai PKKR Manual dari atas ke bawah.'),
                    h('div', { class: 'tbl' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Level'), h('th', {}, 'Kode'), h('th', {}, 'Uraian'), h('th', { class: 'n' }, 'Pagu DIPA'), h('th', { class: 'n' }, 'Pagu pengadaan'))), h('tbody', {}, rows))),
                    h('div', { class: 'row', style: { marginTop: '8px' } }, h('span', {}, 'Delegasikan ke PPK:'), ppkSel,
                        h('button', { class: 'btn go', disabled: !S.ctx.isKPA, onclick: () => guard(() => runPkkr(diff.baru.filter(n => n.pilih), ppkSel.value)) }, 'Tambahkan cabang terpilih ke PKKR')));
            }
            if (diff.beda.length) box.append(h('details', { style: { marginTop: '12px' } }, h('summary', {}, `Pagu berbeda (${diff.beda.length}) — node integrasi terkunci, hanya informasi`),
                h('div', { class: 'tbl' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, 'Kode'), h('th', {}, 'Uraian'), h('th', { class: 'n' }, 'DIPA'), h('th', { class: 'n' }, 'SiRUP'), h('th', {}, 'Jenis'))),
                    h('tbody', {}, diff.beda.map(b => h('tr', {}, h('td', { class: 'mono' }, b.key), h('td', {}, b.nama), h('td', { class: 'n' }, fmt(b.paguDipa)), h('td', { class: 'n' }, fmt(b.paguSirup)), h('td', {}, b.manual ? 'Manual' : 'Integrasi'))))))));
            if (diff.hilang.length) box.append(h('details', {}, h('summary', {}, `Ada di PKKR SiRUP tetapi tidak ada di DIPA (${diff.hilang.length})`),
                h('div', { class: 'tbl' }, h('table', { class: 't' }, h('tbody', {}, diff.hilang.map(b => h('tr', {}, h('td', { class: 'mono' }, b.key), h('td', {}, b.nama), h('td', { class: 'n' }, fmt(b.pagu)))))))));
            box.append(h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn pri', onclick: () => go(2) }, 'Lanjut: sanding RUP →')));
        });
    }
    async function loadPkkr(force) {
        if (S.pkkr && !force) return;
        log('Membaca pohon PKKR SiRUP…');
        S.pkkr = await Sirup.crawlPkkr(S.ctx.tahun);
        if (!S.ppk.length) S.ppk = await Sirup.daftarPpk();
        log(`PKKR terbaca: ${S.pkkr.size} node.`, 'o');
        S.an = null;
    }
    async function runPkkr(nodes, idPpk) {
        if (!nodes.length) return;
        const ok = await confirmBox('Tambah cabang PKKR', `<p>${nodes.length} node akan ditambahkan sebagai PKKR <b>Manual</b>:</p><div class="tbl"><table class="t">${nodes.map(n => `<tr><td class="mono">${esc(n.key)}</td><td>${esc(n.nama)}</td><td class="n">${fmt(n.pagu)}</td></tr>`).join('')}</table></div><p class="note">Tindakan ini mengubah data SiRUP. Tidak ada tombol hapus otomatis — hapus manual lewat Kelola PKKR bila salah.</p>`);
        if (!ok) return;
        for (const n of nodes) {
            if (S.stop) break;
            const parent = n.parentKey ? S.pkkr.get(n.parentKey) : null;
            if (n.parentKey && !parent) { log(`Lewati ${n.key}: induk ${n.parentKey} belum ada.`, 'e'); continue; }
            if (!n.nama) { log(`Lewati ${n.key}: nama kosong.`, 'e'); continue; }
            await Sirup.tambahPkkr(S.ctx, n, parent && parent.id, idPpk);
            const id = await Sirup.cariNodeBaru(S.ctx, n.level, parent && parent.id, n.kode);
            if (!id) throw new Error(`SiRUP tidak menyimpan ${n.key} (tidak ditemukan setelah simpan).`);
            S.pkkr.set(n.key, { id, level: n.level, kode: n.kode, nama: n.nama, pagu: n.pagu, key: n.key, manual: true, parentId: parent && parent.id });
            log(`PKKR + ${n.key} (id ${id})`, 'o');
            await Sirup.sleep(S.cfg.jeda);
        }
        S.an = null;
        go(1);
    }

    // ── 3. Sanding ─────────────────────────────────────────────────────
    function ensureAnalysis() {
        if (S.an) return;
        const { nodes, akun } = Analysis.buildDipa(S.dipa, S.overrides, { cekSebagai: S.cfg.cekSebagai });
        S.an = { nodes, akun, orphans: [] };
        if (S.pakets) {
            const r = Analysis.sanding(akun, S.pakets);
            S.an.orphans = r.orphans;
            S.plan = Analysis.plan({ akunMap: akun, pakets: S.pakets, dipaNodes: nodes, pkkr: S.pkkr || new Map(), cfg: S.cfg });
            decoratePlan();
        }
    }
    async function loadPakets(force) {
        if (S.pakets && !force) return;
        const list = await Sirup.daftarPaket(S.ctx.tahun, 'penyedia');
        S.swakelola = await Sirup.daftarPaket(S.ctx.tahun, 'swakelola').catch(() => []);
        log(`Paket penyedia: ${list.length}, swakelola: ${S.swakelola.length}. Membaca detail…`);
        const pg = progress(); body.prepend(pg);
        let i = 0;
        for (const p of list) {
            if (S.stop) throw new Error('Dihentikan.');
            await Sirup.detailPaket(p, S.ctx.tahun);
            pg.set(++i, list.length);
        }
        pg.remove();
        const sd = list.find(p => p.sumberDana.length);
        if (sd) Object.assign(S.ctx, { kodeBA: sd.sumberDana[0].kodeInstansi || '032', kodeEselon: sd.sumberDana[0].kodeEselon || '', kodeKldi: sd.sumberDana[0].asal || 'K8' });
        S.pakets = list; S.an = null;
        log('Detail paket selesai dibaca.', 'o');
    }
    function stepSanding() {
        if (needDipa()) return;
        const box = h('div', {});
        body.append(h('div', { class: 'row' },
            h('button', { class: 'btn', onclick: () => guard(async () => { await loadPakets(true); go(2); }) }, '↻ Baca ulang paket RUP'),
            h('button', { class: 'btn', onclick: () => { S.overrides = {}; store.set('ov:' + S.ctx.kodeSatker, {}); S.an = null; go(2); } }, 'Reset klasifikasi manual')), box);
        guard(async () => {
            await loadPkkr(false);
            await loadPakets(false);
            ensureAnalysis();
            const A = [...S.an.akun.values()];
            const sum = f => A.reduce((s, a) => s + f(a), 0);
            const P = sum(a => a.P), NP = sum(a => a.NP), CEK = sum(a => a.CEK), U = sum(a => a.rupU);
            const orphU = S.an.orphans.filter(o => o.status === '3').reduce((s, o) => s + o.pagu, 0);
            box.append(h('div', { class: 'kpis', style: { marginTop: '10px' } },
                kpi('Rp' + fmt(P), 'Pagu pengadaan DIPA'), kpi('Rp' + fmt(NP), 'Non-pengadaan'), kpi('Rp' + fmt(CEK), 'Perlu dicek'),
                kpi('Rp' + fmt(U), 'RUP terumumkan pada MAK DIPA'), kpi('Rp' + fmt(orphU), 'RUP terumumkan ber-MAK di luar DIPA'),
                kpi(P ? (U / P * 100).toFixed(1).replace('.', ',') + '%' : '–', 'Terumumkan ÷ pagu pengadaan')));
            const flt = h('select', {}, ...[['', 'Semua status'], ['KURANG', 'Kurang'], ['LEBIH', 'Lebih'], ['NP_TERUMUMKAN', 'NP terumumkan'], ['CEK', 'Perlu cek'], ['SESUAI', 'Sesuai'], ['NP', 'Non-pengadaan']].map(([v, t]) => h('option', { value: v }, t)));
            const q = h('input', { type: 'text', placeholder: 'cari MAK / uraian…' });
            const tb = h('tbody', {});
            const draw = () => {
                tb.innerHTML = '';
                const fv = flt.value, qv = q.value.toLowerCase();
                for (const a of A.sort((x, y) => x.key.localeCompare(y.key))) {
                    if (fv && a.status !== fv) continue;
                    if (qv && !(a.key.toLowerCase().includes(qv) || a.nama.toLowerCase().includes(qv))) continue;
                    const [st, cls] = STATUS_PILL[a.status] || [a.status, 'p-mut'];
                    const tr = h('tr', { style: { cursor: 'pointer' } }, h('td', { class: 'mono' }, a.key), h('td', {}, a.nama), h('td', { class: 'n' }, fmt(a.pagu)),
                        h('td', { class: 'n' }, fmt(a.P)), h('td', { class: 'n' }, fmt(a.NP)), h('td', { class: 'n' }, a.CEK ? fmt(a.CEK) : ''),
                        h('td', { class: 'n' }, fmt(a.rupU)), h('td', { class: 'n' }, a.rupFD ? fmt(a.rupFD) : ''), h('td', { class: 'n' }, fmt(a.selisih)), h('td', {}, pill(st, cls)));
                    const sub = h('tr', { class: 'sub', style: { display: 'none' } }, h('td', { colspan: 10 }, detailAkun(a)));
                    tr.addEventListener('click', () => { sub.style.display = sub.style.display === 'none' ? '' : 'none'; });
                    tb.append(tr, sub);
                }
            };
            flt.addEventListener('change', draw); q.addEventListener('input', draw);
            box.append(h('h3', {}, 'Sanding per akun (MAK 7 segmen)'),
                h('p', { class: 'note' }, 'Klik baris untuk melihat item DIPA dan paket RUP-nya. Klasifikasi item bisa diubah; rencana aksi dihitung ulang otomatis.'),
                h('div', { class: 'row' }, flt, q), h('div', { class: 'tbl', style: { marginTop: '6px' } }, h('table', { class: 't' },
                    h('thead', {}, h('tr', {}, ...['MAK', 'Akun', 'Pagu', 'Pengadaan', 'Non', 'Cek', 'RUP umum', 'RUP FD', 'Selisih', 'Status'].map((t, i) => h('th', { class: i >= 2 && i <= 8 ? 'n' : '' }, t)))), tb)));
            draw();
            if (S.an.orphans.length) {
                const byPrefix = {};
                for (const o of S.an.orphans) { const k = o.mak.split('.').slice(0, 6).join('.'); byPrefix[k] = byPrefix[k] || { n: 0, pagu: 0 }; byPrefix[k].n++; if (o.status === '3') byPrefix[k].pagu += o.pagu; }
                box.append(h('details', { style: { marginTop: '10px' } }, h('summary', {}, `Baris MAK paket yang tidak ada di DIPA terbaru (${S.an.orphans.length})`),
                    h('table', { class: 't' }, h('tbody', {}, Object.entries(byPrefix).map(([k, v]) => h('tr', {}, h('td', { class: 'mono' }, k), h('td', {}, v.n + ' baris'), h('td', { class: 'n' }, 'terumumkan Rp' + fmt(v.pagu))))))));
            }
            box.append(h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn pri', onclick: () => go(3) }, 'Lanjut: rekap & eksekusi →')));
        });
    }
    function detailAkun(a) {
        const items = h('table', { class: 't' }, h('tbody', {}, a.items.map(it => {
            const sel = h('select', {}, ...['P', 'NP', 'CEK'].map(k => h('option', { value: k, selected: it.kelas === k }, { P: 'Pengadaan', NP: 'Non-pengadaan', CEK: 'Perlu cek' }[k])));
            sel.addEventListener('change', () => {
                S.overrides[it.iid] = sel.value; store.set('ov:' + S.ctx.kodeSatker, S.overrides);
                S.an = null; log(`Klasifikasi ${it.uraian.slice(0, 40)} → ${sel.value}`); go(2);
            });
            sel.addEventListener('click', e => e.stopPropagation());
            return h('tr', {}, h('td', {}, (it.grup ? it.grup + ' › ' : '') + it.uraian), h('td', { class: 'n' }, fmt(it.pagu)), h('td', {}, sel), h('td', { class: 'muted' }, it.alasan));
        })));
        const rup = a.rup.length ? h('table', { class: 't' }, h('tbody', {}, a.rup.map(r => h('tr', {}, h('td', { class: 'mono' }, r.paketId), h('td', {}, r.nama), h('td', {}, Analysis.ST[r.status] || r.status), h('td', { class: 'n' }, fmt(r.pagu))))))
            : h('div', { class: 'muted' }, 'Belum ada paket RUP pada MAK ini.');
        return h('div', { class: 'grid2' }, h('div', {}, h('b', {}, 'Item DIPA'), items), h('div', {}, h('b', {}, 'Paket RUP'), rup));
    }

    // ── 4. Rekap & eksekusi ────────────────────────────────────────────
    // Lengkapi rencana: id komponen PKKR, lokasi default, data donor
    function decoratePlan() {
        const donorLok = (() => {
            const c = {};
            for (const p of S.pakets || []) for (const l of p.lokasiRaw || []) { const k = `${l.id_provinsi}|${l.id_kabupaten}|${l.detil}`; c[k] = (c[k] || 0) + 1; }
            const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
            if (!top) return [];
            const [pv, kb, dt] = top[0].split('|');
            return [{ id_provinsi: +pv, id_kabupaten: +kb, detil: dt }];
        })();
        for (const act of S.plan.actions) {
            if (act.type !== 'REVISI' && act.type !== 'TANPA_DONOR') continue;
            const donor = act.donorId ? S.pakets.find(p => p.id === act.donorId) : null;
            act.donor = donor;
            act.pakets.forEach((pk, i) => {
                pk.uid = pk.uid || `${act.donorId || 'x'}-${i}-${Math.random().toString(36).slice(2, 7)}`;
                if (!pk.baru && donor) {
                    pk.lokasiRaw = donor.lokasiRaw.map(l => ({ ...l }));
                    pk.jenisList = donor.jenisRaw.length === 1 ? null : donor.jenisRaw.map(j => ({ ...j }));
                    pk.jenis = Object.keys(Sirup.JENIS_ID).find(k => Sirup.JENIS_ID[k] === (donor.jenisRaw[0] || {}).jenisid) || pk.jenis;
                    pk.spp = donor.spp; pk.volume = donor.volume;
                    pk.jadwal = { awalPengadaan: donor.tanggal.awalPengadaan, akhirPengadaan: donor.tanggal.akhirPengadaan, awalPekerjaan: donor.tanggal.awalPekerjaan, akhirPekerjaan: donor.tanggal.akhirPekerjaan,
                        awalKebutuhan: Analysis.ym(donor.pemanfaatan && donor.pemanfaatan.mulai) || donor.tanggal.awalPekerjaan, kebutuhan: Analysis.ym(donor.pemanfaatan && donor.pemanfaatan.akhir) || donor.tanggal.akhirPekerjaan };
                    const used = new Set();
                    for (const a of pk.anggaran) {
                        const old = donor.sumberDana.find(s => s.mak === a.mak && !used.has(s.id));
                        if (old && !a.dari) { a.idLama = old.id; used.add(old.id); a.sumber = old.sumber; a.danaApbn = a.danaApbn || old.danaApbn; }
                        else a.idLama = '';
                    }
                } else {
                    pk.lokasiRaw = pk.lokasiRaw || donorLok.map(l => ({ ...l }));
                    pk.jadwal = Object.assign({}, S.cfg.jadwalDefault, pk.jadwal || {});
                    pk.spp = pk.spp || { ekonomi: true, sosial: true, lingkungan: false };
                }
            });
        }
    }
    function komponenId(mak) {
        const k = mak.split('.').slice(0, 5).join('.');
        const n = S.pkkr && S.pkkr.get(k);
        return n ? n.id : null;
    }

    function stepRekap() {
        if (needDipa()) return;
        if (!S.pakets) { body.append(h('div', { class: 'warnbox' }, 'Jalankan langkah 3 (sanding RUP) dulu.')); return; }
        ensureAnalysis();
        const acts = S.plan.actions;
        const T = t => acts.filter(a => a.type === t);
        const revisi = T('REVISI');
        const nBaru = revisi.reduce((s, a) => s + a.pakets.filter(p => p.baru).length, 0);
        body.append(h('div', { class: 'kpis' },
            kpi(String(T('PKKR_ADD').reduce((s, a) => s + a.nodes.length, 0)), 'Cabang PKKR baru'), kpi(String((T('UMUMKAN')[0] || { ids: [] }).ids.length), 'Final draft siap diumumkan'),
            kpi(String(T('BATAL').length), 'Paket perlu dibatalkan'), kpi(String(revisi.filter(a => !a.pakets.some(p => p.baru)).length), 'Paket perlu direvisi'),
            kpi(String(nBaru), 'Paket baru (via revisi 1→N)'), kpi(String(T('BATAL_FD').length), 'Final draft bermasalah')));
        const danaRup = new Set((S.pakets || []).flatMap(p => (p.sumberDana || []).map(x => x.danaApbn)));
        if (S.dipa.meta.jenis === 'FA' && [...danaRup].some(d => d && d !== 'A')) body.append(h('div', { class: 'warnbox' }, `Satker ini memakai sumber dana selain RM (${[...danaRup].join(', ')}). FA Detail tidak memuat sumber dana per akun — unggah juga RKK agar paket baru mendapat sumber dana yang benar (default: RM).`));
        if (T('PKKR_ADD').length) body.append(h('div', { class: 'warnbox' }, 'Masih ada cabang DIPA yang belum ada di PKKR. Paket yang MAK-nya ke cabang itu baru bisa disimpan setelah cabangnya ditambah di langkah 2.'));

        // bulk editor
        const bulk = bulkBar();
        body.append(bulk);

        // A. umumkan FD
        for (const a of T('UMUMKAN')) {
            const list = a.ids.map(id => S.pakets.find(p => p.id === id));
            a.pilihIds = a.pilihIds || new Set(a.ids);
            body.append(section(`Umumkan final draft (${a.ids.length})`, 'Final draft yang MAK-nya sudah sesuai DIPA.',
                h('table', { class: 't' }, h('tbody', {}, list.map(p => h('tr', {}, h('td', {}, chk(a.pilihIds.has(p.id), v => v ? a.pilihIds.add(p.id) : a.pilihIds.delete(p.id))), h('td', { class: 'mono' }, p.id), h('td', {}, p.nama), h('td', { class: 'n' }, fmt(p.pagu))))))));
        }
        // B. batalkan
        if (T('BATAL').length) body.append(section(`Batalkan paket terumumkan (${T('BATAL').length})`, 'Seluruh MAK paket ini adalah belanja non-pengadaan (atau tidak lagi ada di DIPA).',
            h('table', { class: 't' }, h('tbody', {}, T('BATAL').map(a => {
                const al = h('input', { type: 'text', value: a.alasan, style: { width: '100%' } }); al.addEventListener('input', () => { a.alasan = al.value; });
                return h('tr', {}, h('td', {}, chk(a.pilih, v => { a.pilih = v; })), h('td', { class: 'mono' }, a.paketId), h('td', {}, a.nama), h('td', { class: 'n' }, fmt(a.pagu)), h('td', { style: { minWidth: '280px' } }, al));
            })))));
        // C. FD bermasalah
        if (T('BATAL_FD').length) body.append(section(`Final draft bermasalah (${T('BATAL_FD').length})`, 'Tidak diumumkan. Centang untuk mengembalikan ke PPK (batal final draft) agar diperbaiki.',
            h('table', { class: 't' }, h('tbody', {}, T('BATAL_FD').map(a => h('tr', {}, h('td', {}, chk(a.pilih, v => { a.pilih = v; })), h('td', { class: 'mono' }, a.paketId), h('td', {}, a.nama), h('td', { class: 'n' }, fmt(a.pagu)), h('td', { class: 'muted' }, a.alasan)))))));
        // D. revisi
        if (revisi.length) {
            const wrap = h('div', {});
            for (const a of revisi) wrap.append(revisiCard(a));
            body.append(section(`Revisi paket (${revisi.length} revisi, ${revisi.reduce((s, a) => s + a.pakets.length, 0)} paket hasil)`,
                'Setiap revisi memakai metode Satu ke Banyak: paket asal digantikan paket hasil, lalu paket hasil langsung diumumkan. Paket dengan catatan "melebihi pagu DIPA" tidak dicentang — putuskan dulu nilainya.', wrap));
        }
        if (T('TANPA_DONOR').length) body.append(h('div', { class: 'errbox' }, `${T('TANPA_DONOR')[0].pakets.length} paket baru tidak punya paket donor (tidak ada paket terumumkan yang bersih). Minta PPK membuat satu paket, umumkan, lalu jalankan ulang.`));

        body.append(h('div', { class: 'row', style: { position: 'sticky', bottom: '-16px', background: '#fff', padding: '10px 0', borderTop: '1px solid #e2e8f0' } },
            h('button', { class: 'btn', onclick: previewPayload }, 'Pratinjau payload revisi'),
            h('button', { class: 'btn go', disabled: !S.ctx.isKPA, onclick: () => guard(runRekap) }, '▶ Jalankan aksi terpilih'),
            h('button', { class: 'btn danger', onclick: () => { S.stop = true; log('Permintaan berhenti diterima; proses berhenti setelah langkah berjalan selesai.', 'w'); } }, '■ Hentikan')));
    }
    function chk(v, fn) { const c = h('input', { type: 'checkbox', checked: v }); c.addEventListener('change', () => fn(c.checked)); return c; }
    function section(title, note, content) { return h('div', { class: 'card' }, h('h3', {}, title), h('p', { class: 'note' }, note), content); }

    function revisiCard(a) {
        const donor = a.donor;
        const box = h('div', { class: 'pk', style: { borderColor: a.pilih ? '#94a3b8' : '#fcd34d' } });
        box.append(h('div', { class: 'pk-hd' }, chk(a.pilih, v => { a.pilih = v; box.style.borderColor = v ? '#94a3b8' : '#fcd34d'; }),
            h('b', {}, `Donor ${a.donorId}`), h('span', {}, donor ? donor.nama : ''), pill(donor ? Analysis.ST[donor.status] : '', 'p-mut'), h('span', { class: 'muted' }, a.alasan),
            h('span', { style: { marginLeft: 'auto' } }, `${a.pakets.length} paket hasil · Rp${fmt(a.pakets.reduce((s, p) => s + p.anggaran.reduce((t, x) => t + x.pagu, 0), 0))}`)));
        if (a.catatan && a.catatan.length) box.append(h('div', { class: 'warnbox', style: { margin: '6px 10px' } }, ...a.catatan.map(c => h('div', {}, '• ' + c))));
        a.pakets.forEach((pk, i) => box.append(paketEditor(a, pk, i)));
        return box;
    }

    const JENIS = Object.keys(Sirup.JENIS_ID);
    const METODE = [...Object.keys(Sirup.METODE_ID), 'Dikecualikan'];
    function paketEditor(act, pk, idx) {
        const el = h('div', { style: { borderTop: '1px dashed #e2e8f0' } });
        const sel = h('input', { type: 'checkbox', class: 'sdr-bulk-sel' }); sel._pk = pk;
        const title = h('input', { type: 'text', value: pk.nama, style: { flex: 1, minWidth: '300px' } }); title.addEventListener('input', () => { pk.nama = title.value; });
        const total = h('b', {});
        const refreshTotal = () => { total.textContent = 'Rp' + fmt(pk.anggaran.reduce((s, x) => s + (+x.pagu || 0), 0)); };
        const hd = h('div', { class: 'pk-hd', style: { background: pk.baru ? '#f0fdfa' : '#f8fafc', borderRadius: 0 } }, sel,
            pill(idx === 0 ? (pk.baru ? 'Paket #1' : 'Paket #1 (menggantikan donor)') : `Paket baru #${idx + 1}`, pk.baru ? 'p-ok' : 'p-info'), title, total);
        const ringkas = h('span', { class: 'muted', style: { fontSize: '12px' } });
        const upd = () => { ringkas.textContent = `${pk.jenis} · ${pk.metode} · pemilihan ${pk.jadwal.awalPengadaan || '?'} · ${pk.lokasiRaw.length} lokasi · ${pk.anggaran.length} MAK`; };
        upd();
        const tog = h('button', { class: 'btn sm' }, '▸ isian');
        hd.append(ringkas, tog);
        if (idx > 0) hd.append(h('button', { class: 'btn sm', title: 'Buang paket ini dari revisi', onclick: () => { act.pakets.splice(idx, 1); go(3); } }, '✕'));
        const bd = h('div', { class: 'pk-bd', style: { display: 'none' } });
        let built = false;
        tog.addEventListener('click', () => {
            if (!built) { buildBody(); built = true; }
            const show = bd.style.display === 'none';
            bd.style.display = show ? '' : 'none'; tog.textContent = show ? '▾ isian' : '▸ isian'; upd();
        });
        el.append(hd, bd);
        if (validatePaket(pk).length) { tog.style.borderColor = '#b91c1c'; tog.title = validatePaket(pk).join(', '); }
        return el;
        function buildBody() {
        // MAK
        const makBox = h('div', { class: 'wide' });
        const drawMak = () => {
            makBox.innerHTML = ''; makBox.append(h('label', {}, 'Sumber dana / MAK (Komponen PKKR + SubKomponen.Akun) dan pagu'));
            pk.anggaran.forEach((a, j) => {
                const opts = [...new Set([a.mak, ...(a.kandidat || []).map(k => k.key)])];
                const ms = h('select', { class: 'mono' }, ...opts.map(o => h('option', { value: o, selected: o === a.mak }, o)));
                const extra = h('input', { type: 'text', class: 'mono', placeholder: 'atau ketik MAK 7 segmen', style: { width: '220px' } });
                const pg = h('input', { type: 'number', value: Math.round(a.pagu), style: { width: '150px' } });
                const dana = h('select', { title: 'Sumber dana' }, ...[['A', 'RM'], ['D', 'PNBP'], ['F', 'BLU'], ['T', 'SBSN'], ['B', 'PLN']].map(([v, t]) => h('option', { value: v, selected: (a.danaApbn || 'A') === v }, t)));
                dana.addEventListener('change', () => { a.danaApbn = dana.value; });
                const kid = komponenId(a.mak);
                const warn = h('span', {}, kid ? pill('komponen ' + kid, 'p-mut') : pill('komponen belum ada di PKKR', 'p-bad'));
                const akun = S.an.akun.get(a.mak);
                const info = h('span', { class: 'muted' }, akun ? `DIPA pengadaan Rp${fmt(akun.P)} · RUP Rp${fmt(akun.rupU)}` : 'MAK tidak ada di DIPA');
                ms.addEventListener('change', () => { a.mak = ms.value; drawMak(); });
                extra.addEventListener('change', () => { if (/^[A-Z]{2}\.\d{4}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\.\d{3}\.[A-Z0-9]{1,2}\.\d{6}$/.test(extra.value.trim())) { a.mak = extra.value.trim(); drawMak(); } else extra.style.borderColor = 'red'; });
                pg.addEventListener('input', () => { a.pagu = +pg.value || 0; refreshTotal(); });
                makBox.append(h('div', { class: 'row', style: { marginBottom: '4px' } }, ms, extra, dana, pg, warn, info, a.lebih ? pill('melebihi DIPA Rp' + fmt(a.lebih), 'p-bad') : null,
                    pk.anggaran.length > 1 ? h('button', { class: 'btn sm', onclick: () => { pk.anggaran.splice(j, 1); drawMak(); refreshTotal(); } }, '✕') : null));
            });
            makBox.append(h('button', { class: 'btn sm', onclick: () => { pk.anggaran.push({ mak: pk.anggaran[0].mak, pagu: 0 }); drawMak(); } }, '+ baris MAK'));
            refreshTotal();
        };
        drawMak();
        bd.append(makBox);
        // jenis / metode / flags
        const js = h('select', {}, ...JENIS.map(j => h('option', { selected: j === pk.jenis }, j))); js.addEventListener('change', () => { pk.jenis = js.value; pk.jenisList = null; });
        const mt = h('select', {}, ...METODE.map(m => h('option', { selected: m === pk.metode }, m))); mt.addEventListener('change', () => { pk.metode = mt.value; });
        bd.append(h('div', {}, h('label', {}, 'Jenis pengadaan'), js), h('div', {}, h('label', {}, 'Metode pemilihan'), mt),
            h('div', {}, h('label', {}, 'Penanda'), h('div', { class: 'row' },
                h('label', { style: { display: 'inline' } }, chk(pk.praDipa, v => { pk.praDipa = v; }), ' Pra-DIPA'),
                h('label', { style: { display: 'inline' } }, chk(pk.pdn, v => { pk.pdn = v; }), ' PDN'),
                h('label', { style: { display: 'inline' } }, chk(pk.umkm, v => { pk.umkm = v; }), ' Usaha kecil'),
                h('label', { style: { display: 'inline' } }, chk(pk.spp.ekonomi, v => { pk.spp.ekonomi = v; }), ' SPP-eko'),
                h('label', { style: { display: 'inline' } }, chk(pk.spp.sosial, v => { pk.spp.sosial = v; }), ' SPP-sos'),
                h('label', { style: { display: 'inline' } }, chk(pk.spp.lingkungan, v => { pk.spp.lingkungan = v; }), ' SPP-ling'))));
        // jadwal
        const mon = (k) => { const i = h('input', { type: 'month', value: pk.jadwal[k] || '' }); i.addEventListener('change', () => { pk.jadwal[k] = i.value; }); return i; };
        bd.append(h('div', {}, h('label', {}, 'Pemilihan penyedia (awal – akhir)'), h('div', { class: 'row' }, mon('awalPengadaan'), '–', mon('akhirPengadaan'))),
            h('div', {}, h('label', {}, 'Pelaksanaan kontrak (awal – akhir)'), h('div', { class: 'row' }, mon('awalPekerjaan'), '–', mon('akhirPekerjaan'))),
            h('div', {}, h('label', {}, 'Pemanfaatan barang/jasa (awal – akhir)'), h('div', { class: 'row' }, mon('awalKebutuhan'), '–', mon('kebutuhan'))));
        // lokasi
        bd.append(lokasiEditor(pk));
        // uraian/spesifikasi
        const ur = h('textarea', {}, pk.uraian || ''); ur.addEventListener('input', () => { pk.uraian = ur.value; });
        const sp = h('textarea', {}, pk.spesifikasi || ''); sp.addEventListener('input', () => { pk.spesifikasi = sp.value; });
        const vol = h('input', { type: 'text', value: pk.volume || '1 Paket' }); vol.addEventListener('input', () => { pk.volume = vol.value; });
        bd.append(h('div', {}, h('label', {}, 'Volume'), vol), h('div', { class: 'wide grid2' }, h('div', {}, h('label', {}, 'Uraian pekerjaan (dari item DIPA)'), ur), h('div', {}, h('label', {}, 'Spesifikasi pekerjaan'), sp)));
        }
    }
    function lokasiEditor(pk) {
        const box = h('div', { class: 'wide' });
        const draw = () => {
            box.innerHTML = ''; box.append(h('label', {}, 'Lokasi pekerjaan (boleh lebih dari satu)'));
            pk.lokasiRaw.forEach((l, j) => {
                const pv = h('select', {}, h('option', { value: '' }, '— provinsi —'), ...Sirup.PROVINSI.map((n, i) => n ? h('option', { value: i, selected: +l.id_provinsi === i }, n) : null));
                const kb = h('select', {}, h('option', { value: '' }, '— kab/kota —'));
                const fillKab = async () => {
                    kb.innerHTML = ''; kb.append(h('option', { value: '' }, '— kab/kota —'));
                    if (!pv.value) return;
                    for (const k of await Sirup.kabupaten(+pv.value)) kb.append(h('option', { value: k.id, selected: +l.id_kabupaten === k.id }, k.nama));
                };
                pv.addEventListener('change', () => { l.id_provinsi = +pv.value; l.id_kabupaten = ''; fillKab(); });
                kb.addEventListener('change', () => { l.id_kabupaten = +kb.value; });
                const dt = h('input', { type: 'text', value: l.detil || '', placeholder: 'detail lokasi' }); dt.addEventListener('input', () => { l.detil = dt.value; });
                fillKab();
                box.append(h('div', { class: 'lok' }, pv, kb, dt, h('button', { class: 'btn sm', onclick: () => { pk.lokasiRaw.splice(j, 1); draw(); } }, '✕')));
            });
            box.append(h('button', { class: 'btn sm', onclick: () => { pk.lokasiRaw.push({ id_provinsi: '', id_kabupaten: '', detil: '' }); draw(); } }, '+ lokasi'));
        };
        draw();
        return box;
    }
    function bulkBar() {
        const f = {};
        const js = h('select', {}, h('option', { value: '' }, '(jenis)'), ...JENIS.map(j => h('option', {}, j)));
        const mt = h('select', {}, h('option', { value: '' }, '(metode)'), ...METODE.map(j => h('option', {}, j)));
        const pd = h('select', {}, h('option', { value: '' }, '(pra-DIPA)'), h('option', { value: '1' }, 'Pra-DIPA: ya'), h('option', { value: '0' }, 'Pra-DIPA: tidak'));
        const months = ['awalPengadaan', 'akhirPengadaan', 'awalPekerjaan', 'akhirPekerjaan', 'awalKebutuhan', 'kebutuhan'].map(k => { const i = h('input', { type: 'month', title: k }); f[k] = i; return i; });
        const copyLok = h('button', { class: 'btn sm', title: 'Salin lokasi paket terpilih pertama ke paket terpilih lain' }, 'Samakan lokasi');
        const apply = h('button', { class: 'btn sm pri' }, 'Terapkan ke paket terpilih');
        const all = h('button', { class: 'btn sm' }, 'Pilih semua paket baru');
        const selected = () => [...document.querySelectorAll('.sdr-bulk-sel')].filter(c => c.checked).map(c => c._pk);
        all.addEventListener('click', () => document.querySelectorAll('.sdr-bulk-sel').forEach(c => { if (c._pk.baru) c.checked = true; }));
        apply.addEventListener('click', () => {
            const ps = selected(); if (!ps.length) return;
            for (const pk of ps) {
                if (js.value) { pk.jenis = js.value; pk.jenisList = null; }
                if (mt.value) pk.metode = mt.value;
                if (pd.value) pk.praDipa = pd.value === '1';
                for (const [k, i] of Object.entries(f)) if (i.value) pk.jadwal[k] = i.value;
            }
            log(`Isian massal diterapkan ke ${ps.length} paket.`); go(3);
        });
        copyLok.addEventListener('click', () => {
            const ps = selected(); if (ps.length < 2) return;
            for (const pk of ps.slice(1)) pk.lokasiRaw = ps[0].lokasiRaw.map(l => ({ ...l, id: '' }));
            log(`Lokasi disalin ke ${ps.length - 1} paket.`); go(3);
        });
        return h('div', { class: 'bulk' }, h('div', { class: 'row' }, h('b', {}, 'Isian massal:'), js, mt, pd,
            h('span', { class: 'muted' }, 'pemilihan'), months[0], months[1], h('span', { class: 'muted' }, 'kontrak'), months[2], months[3], h('span', { class: 'muted' }, 'pemanfaatan'), months[4], months[5],
            apply, copyLok, all));
    }

    function validatePaket(pk) {
        const err = [];
        if (!pk.nama || pk.nama.length < 5) err.push('nama paket terlalu pendek');
        const tot = pk.anggaran.reduce((s, a) => s + (+a.pagu || 0), 0);
        if (tot <= 0) err.push('pagu 0');
        for (const a of pk.anggaran) { a.idKomponen = komponenId(a.mak); if (!a.idKomponen) err.push(`komponen ${a.mak.split('.').slice(0, 5).join('.')} belum ada di PKKR`); }
        if (!pk.lokasiRaw.length || pk.lokasiRaw.some(l => !l.id_provinsi || !l.id_kabupaten)) err.push('lokasi belum lengkap');
        const j = pk.jadwal;
        for (const k of ['awalPengadaan', 'akhirPengadaan', 'awalPekerjaan', 'akhirPekerjaan', 'awalKebutuhan', 'kebutuhan']) if (!/^\d{4}-\d{2}$/.test(j[k] || '')) err.push('jadwal ' + k + ' kosong');
        if (j.akhirPengadaan < j.awalPengadaan || j.akhirPekerjaan < j.awalPekerjaan || j.kebutuhan < j.awalKebutuhan) err.push('jadwal akhir sebelum awal');
        if (pk.jenisList && Math.abs(pk.jenisList.reduce((s, x) => s + x.pagu, 0) - tot) > 1) pk.jenisList = null; // pagu berubah → satu jenis
        if (!pk.metode) err.push('metode kosong');
        return err;
    }
    async function previewPayload() {
        const a = S.plan.actions.find(x => x.type === 'REVISI' && x.pilih);
        if (!a) return;
        const pay = await Sirup.revisiSatuKeBanyak(S.ctx, a.donor, a.pakets.map(p => { validatePaket(p); return p; }), a.alasan, { dryRun: true });
        await modal(`Payload revisi donor ${a.donorId} (tidak dikirim)`, h('div', {}, ...pay.payloads.map((f, i) => h('details', { open: i === 0 }, h('summary', {}, `POST #${i + 1}`), h('pre', { class: 'mono', style: { whiteSpace: 'pre-wrap' } }, [...f.entries()].map(([k, v]) => `${k} = ${v}`).join('\n'))))), [['Tutup', false, 'pri']]);
    }

    async function runRekap() {
        const acts = S.plan.actions;
        const umum = acts.find(a => a.type === 'UMUMKAN');
        const umumIds = umum ? [...(umum.pilihIds || [])] : [];
        const batal = acts.filter(a => a.type === 'BATAL' && a.pilih);
        const batalFd = acts.filter(a => a.type === 'BATAL_FD' && a.pilih);
        const revisi = acts.filter(a => a.type === 'REVISI' && a.pilih);
        const problems = [];
        for (const a of revisi) a.pakets.forEach((p, i) => { const e = validatePaket(p); if (e.length) problems.push(`Donor ${a.donorId} paket #${i + 1}: ${e.join(', ')}`); });
        if (problems.length) { await modal('Isian belum lengkap', h('div', { class: 'errbox' }, ...problems.slice(0, 40).map(p => h('div', {}, p))), [['Perbaiki', false, 'pri']]); return; }
        const nPaket = revisi.reduce((s, a) => s + a.pakets.length, 0);
        const ok = await confirmBox('Jalankan aksi di SiRUP', `<ul>
            <li>Batalkan ${batal.length} paket terumumkan (non-pengadaan)</li>
            <li>Kembalikan ${batalFd.length} final draft ke PPK</li>
            <li>${revisi.length} revisi satu-ke-banyak → ${nPaket} paket hasil, langsung diumumkan</li>
            <li>Umumkan ${umumIds.length} final draft</li></ul>
            <p class="note">Semua langkah mengubah data SiRUP dan tercatat atas nama akun KPA ini. Proses berjalan berurutan; bila satu langkah gagal, proses berhenti dan rinciannya tampil di log.</p>`);
        if (!ok) return;
        for (const a of batalFd) { if (S.stop) break; await Sirup.batalFinalDraft(a.paketId, a.alasan); log(`Batal FD ${a.paketId}`, 'o'); await Sirup.sleep(S.cfg.jeda); }
        for (const a of batal) { if (S.stop) break; await Sirup.batalkanPaket(a.paketId, a.alasan); log(`Dibatalkan ${a.paketId} (${a.nama.slice(0, 50)})`, 'o'); await Sirup.sleep(S.cfg.jeda); }
        for (const a of revisi) {
            if (S.stop) break;
            log(`Revisi donor ${a.donorId}: ${a.pakets.length} paket…`);
            const r = await Sirup.revisiSatuKeBanyak(S.ctx, a.donor, a.pakets, a.alasan, { onStep: (i, n) => log(`  simpan paket ${i}/${n}`) });
            log(`  ${r.baru.length} paket baru: ${r.baru.map(p => p.id).join(', ')}${r.donorHilang ? '' : ' — PERHATIAN: paket donor masih ada'}`, r.donorHilang ? 'o' : 'w');
            const fd = r.baru.filter(p => p.status === '2').map(p => p.id);
            if (fd.length) { await Sirup.umumkan(fd); log(`  diumumkan: ${fd.join(', ')}`, 'o'); }
            a.pilih = false; a.selesai = true;
            await Sirup.sleep(S.cfg.jeda);
        }
        if (umumIds.length && !S.stop) { await Sirup.umumkan(umumIds); log(`Diumumkan final draft: ${umumIds.join(', ')}`, 'o'); }
        log('Selesai. Membaca ulang paket RUP…', 'o');
        await loadPakets(true);
        S.an = null;
        go(4);
    }

    // ── 5. Struktur anggaran ───────────────────────────────────────────
    function stepStruktur() {
        if (needDipa()) return;
        if (!S.pakets) { body.append(h('div', { class: 'warnbox' }, 'Jalankan langkah 3 dulu.')); return; }
        guard(async () => {
            ensureAnalysis();
            S.sa = await Sirup.strukturAnggaran();
            const rup = { barjas: 0, modal: 0, sosial: 0, hibah: 0, lainnya: 0 };
            for (const p of S.pakets) if (p.status === '3' && p.aktif !== 'false') for (const s of p.sumberDana) { const g = Classify.jenisBelanja(s.mak.split('.').pop()); if (g in rup) rup[g] += s.pagu; }
            const dipa = { barjas: 0, modal: 0, sosial: 0, hibah: 0, lainnya: 0 };
            for (const a of S.an.akun.values()) { const g = Classify.jenisBelanja(a.akun); if (g in dipa) dipa[g] += a.P; }
            const rows = [['barjas', 'Barang/Jasa (52)'], ['modal', 'Modal (53)'], ['sosial', 'Bantuan Sosial (57)'], ['hibah', 'Hibah (56)'], ['lainnya', 'Lainnya (54,55,58)']];
            const target = { ...rup };
            const inputs = {};
            const mode = h('select', {}, h('option', { value: 'rup' }, 'Samakan dengan RUP terumumkan (target IKU 100%)'), h('option', { value: 'dipa' }, 'Samakan dengan pagu pengadaan DIPA'), h('option', { value: 'manual' }, 'Isi manual'));
            const tb = h('tbody', {});
            const draw = () => {
                tb.innerHTML = '';
                for (const [k, l] of rows) {
                    if (mode.value !== 'manual') target[k] = mode.value === 'rup' ? rup[k] : dipa[k];
                    const inp = h('input', { type: 'number', value: Math.round(target[k]), style: { width: '170px' }, disabled: mode.value !== 'manual' });
                    inp.addEventListener('input', () => { target[k] = +inp.value || 0; });
                    inputs[k] = inp;
                    tb.append(h('tr', {}, h('td', {}, l), h('td', { class: 'n' }, fmt(S.sa[k])), h('td', { class: 'n' }, fmt(rup[k])), h('td', { class: 'n' }, fmt(dipa[k])), h('td', { class: 'n' }, inp),
                        h('td', {}, rup[k] > dipa[k] + 1000 ? pill('RUP > pagu pengadaan DIPA', 'p-warn') : Math.abs(S.sa[k] - rup[k]) <= 1000 ? pill('sudah sama', 'p-ok') : pill('beda', 'p-bad'))));
                }
                const tot = o => rows.reduce((s, [k]) => s + (o[k] || 0), 0);
                tb.append(h('tr', {}, h('td', {}, h('b', {}, 'Total belanja pengadaan')), h('td', { class: 'n' }, h('b', {}, fmt(tot(S.sa)))), h('td', { class: 'n' }, h('b', {}, fmt(tot(rup)))), h('td', { class: 'n' }, h('b', {}, fmt(tot(dipa)))), h('td', {}), h('td', {},
                    h('b', {}, tot(S.sa) ? `IKU saat ini ${(tot(rup) / tot(S.sa) * 100).toFixed(1).replace('.', ',')}%` : ''))));
            };
            mode.addEventListener('change', draw);
            draw();
            body.append(h('div', { class: 'card' }, h('h3', {}, 'Struktur Anggaran (penyebut IKU RUP terumumkan)'),
                h('p', { class: 'note' }, `Terakhir diperbarui di SiRUP: ${S.sa.diperbarui || '–'}. Nilai RUP diambil dari paket berstatus Terumumkan saat ini (baca ulang di langkah 3 setelah eksekusi).`),
                h('div', { class: 'row' }, h('span', {}, 'Rekomendasi:'), mode),
                h('div', { class: 'tbl', style: { marginTop: '8px' } }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, ...['Jenis belanja', 'Saat ini di SiRUP', 'RUP terumumkan', 'Pagu pengadaan DIPA', 'Akan disimpan', ''].map((t, i) => h('th', { class: i && i < 5 ? 'n' : '' }, t)))), tb)),
                h('div', { class: 'warnbox' }, 'Struktur anggaran seharusnya mencerminkan pagu belanja pengadaan DIPA. Bila RUP terumumkan melebihi DIPA (mis. paket tahun jamak dicatat nilai kontrak penuh), menyamakan dengan RUP akan membuat struktur anggaran lebih besar dari DIPA — pastikan ini sesuai arahan pembina.'),
                h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => guard(async () => { await loadPakets(true); S.an = null; go(4); }) }, '↻ Baca ulang RUP'),
                    h('button', { class: 'btn go', disabled: !S.ctx.isKPA, onclick: () => guard(async () => {
                        const ok = await confirmBox('Perbarui Struktur Anggaran', `<table class="t">${rows.map(([k, l]) => `<tr><td>${l}</td><td class="n">${fmt(S.sa[k])} → <b>${fmt(target[k])}</b></td></tr>`).join('')}</table>`, 'Simpan ke SiRUP');
                        if (!ok) return;
                        await Sirup.simpanStrukturAnggaran(S.sa, target, S.ctx.tahun);
                        log('Struktur anggaran disimpan.', 'o');
                        go(4);
                    }) }, 'Simpan ke Struktur Anggaran'))));
        });
    }

    // ── pengaturan & ekspor ─────────────────────────────────────────────
    async function settings() {
        const c = S.cfg;
        const num = (k, l) => { const i = h('input', { type: 'number', value: c[k] }); i.addEventListener('input', () => { c[k] = +i.value; }); return h('div', {}, h('label', {}, l), i); };
        const mon = (k, l) => { const i = h('input', { type: 'month', value: c.jadwalDefault[k] }); i.addEventListener('change', () => { c.jadwalDefault[k] = i.value; }); return h('div', {}, h('label', {}, l), i); };
        await modal('Pengaturan', h('div', { class: 'grid2' },
            num('plBarjas', 'Batas PL barang/jasa lainnya (Rp)'), num('plKonstruksi', 'Batas PL konstruksi (Rp)'), num('plKonsultansi', 'Batas PL konsultansi (Rp)'),
            (() => { const sl = h('select', {}, ...['Tender', 'Seleksi', 'Tender Cepat', 'E-Purchasing'].map(m => h('option', { selected: c.metodeEO === m }, m))); sl.addEventListener('change', () => { c.metodeEO = sl.value; }); return h('div', {}, h('label', {}, 'Metode paket EO di atas batas PL'), sl); })(),
            (() => { const sl = h('select', {}, h('option', { value: 'CEK', selected: c.cekSebagai !== 'P' }, 'Tidak dihitung (hanya ditandai)'), h('option', { value: 'P', selected: c.cekSebagai === 'P' }, 'Dihitung sebagai pengadaan')); sl.addEventListener('change', () => { c.cekSebagai = sl.value; }); return h('div', {}, h('label', {}, "Item 'Perlu cek' (mis. makan/seragam taruna via katering)"), sl); })(),
            num('minPaketBaru', 'Selisih minimum untuk usul paket baru (Rp)'), num('maxPaketPerRevisi', 'Maks. paket baru per revisi'), num('jeda', 'Jeda antar-permintaan (ms)'),
            mon('awalPengadaan', 'Default awal pemilihan'), mon('akhirPengadaan', 'Default akhir pemilihan'), mon('awalPekerjaan', 'Default awal kontrak'), mon('akhirPekerjaan', 'Default akhir kontrak'),
            mon('awalKebutuhan', 'Default awal pemanfaatan'), mon('kebutuhan', 'Default akhir pemanfaatan')), [['Simpan', true, 'pri']]);
        store.set('cfg', c);
        S.an = null;
        if (S.step >= 2) go(S.step);
    }

    async function exportExcel() {
        if (!S.an && S.dipa) ensureAnalysis();
        if (!S.an) return;
        if (typeof ExcelJS === 'undefined') { log('ExcelJS belum termuat.', 'e'); return; }
        const wb = new ExcelJS.Workbook();
        const add = (name, cols, rows) => {
            const ws = wb.addWorksheet(name);
            ws.columns = cols.map(([header, key, width, numFmt]) => ({ header, key, width, style: numFmt ? { numFmt } : {} }));
            ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F497D' } };
            ws.views = [{ state: 'frozen', ySplit: 1 }];
            rows.forEach(r => ws.addRow(r));
            ws.autoFilter = { from: 'A1', to: { row: 1, column: cols.length } };
        };
        const N = '#,##0';
        const A = [...S.an.akun.values()].sort((x, y) => x.key.localeCompare(y.key));
        add('Sanding Akun', [['MAK', 'key', 34], ['Akun', 'nama', 40], ['Pagu DIPA', 'pagu', 16, N], ['Pengadaan', 'P', 16, N], ['Non-pengadaan', 'NP', 16, N], ['Perlu cek', 'CEK', 14, N], ['RUP terumumkan', 'rupU', 16, N], ['RUP final draft', 'rupFD', 16, N], ['Selisih', 'selisih', 16, N], ['Status', 'status', 16], ['Paket', 'paket', 60]],
            A.map(a => ({ ...a, paket: a.rup.map(r => `${r.paketId} (${Analysis.ST[r.status] || r.status}) ${fmt(r.pagu)}`).join('; ') })));
        add('Item DIPA', [['MAK', 'key', 34], ['Grup', 'grup', 30], ['Uraian', 'uraian', 60], ['Volume', 'volume', 12], ['Pagu', 'pagu', 16, N], ['Kelas', 'kelas', 8], ['Alasan', 'alasan', 40]],
            A.flatMap(a => a.items.map(i => ({ key: a.key, ...i }))));
        if (S.pakets) add('Paket RUP', [['Kode RUP', 'id', 11], ['Nama', 'nama', 60], ['Status', 'st', 12], ['Pagu', 'pagu', 16, N], ['Metode', 'metode', 18], ['MAK', 'mak', 60], ['Verdict', 'verdict', 20]],
            S.pakets.map(p => ({ id: p.id, nama: p.nama, st: Analysis.ST[p.status] || p.status, pagu: p.pagu, metode: p.metode, mak: (p.sumberDana || []).map(s => `${s.mak}=${fmt(s.pagu)}`).join('; '), verdict: p.verdict })));
        if (S.plan) add('Rencana Aksi', [['Aksi', 'type', 12], ['Paket/donor', 'id', 12], ['Nama', 'nama', 60], ['Pagu', 'pagu', 16, N], ['MAK', 'mak', 60], ['Keterangan', 'ket', 60], ['Dipilih', 'pilih', 8]],
            S.plan.actions.flatMap(a => a.type === 'REVISI' ? a.pakets.map((p, i) => ({ type: 'REVISI', id: a.donorId, nama: `#${i + 1} ${p.nama}`, pagu: p.anggaran.reduce((s, x) => s + x.pagu, 0), mak: p.anggaran.map(x => x.mak).join('; '), ket: i === 0 ? (a.catatan || []).join(' | ') : 'paket baru', pilih: a.pilih ? 'ya' : 'tidak' }))
                : a.type === 'PKKR_ADD' ? a.nodes.map(n => ({ type: 'PKKR', id: '', nama: n.nama, pagu: n.pagu, mak: n.key, ket: n.level, pilih: n.pilih ? 'ya' : 'tidak' }))
                    : a.type === 'UMUMKAN' ? a.ids.map(id => ({ type: 'UMUMKAN', id, nama: (S.pakets.find(p => p.id === id) || {}).nama, pilih: 'ya' }))
                        : [{ type: a.type, id: a.paketId, nama: a.nama, pagu: a.pagu, ket: a.alasan, pilih: a.pilih ? 'ya' : 'tidak' }]));
        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = h('a', { href: URL.createObjectURL(blob), download: `Sanding_DIPA_RUP_${S.ctx.kodeSatker}_${new Date().toISOString().slice(0, 10)}.xlsx` });
        document.body.append(a); a.click(); a.remove();
        log('Kertas kerja Excel diunduh.', 'o');
    }

    function mount() {
        if (document.querySelector('.sdr-fab')) return;
        const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
        document.body.append(h('button', { class: 'sdr-fab', onclick: open, title: APP }, '⇄ ', APP));
    }
    return { mount, open, S };
})();


if (/\/sirup\//.test(location.pathname) && !/loginctr|public\//.test(location.pathname)) UI.mount();
})();
