// ==UserScript==
// @name         SiRUP Sanding DIPA ↔ RUP & Revisi Massal
// @namespace    https://github.com/Fakhry-Glob
// @version      1.3.2
// @description  Sanding PDF DIPA SAKTI (RKK / FA Detail 16 Segmen) dengan PKKR dan RUP terumumkan di SiRUP pasca-putus integrasi SAKTI (31 Juli 2026): tambah cabang PKKR, klasifikasi pengadaan/non-pengadaan, kartu keputusan per kelompok, revisi satu-ke-satu/satu-ke-banyak lewat antrean yang bisa dilanjutkan, umumkan, dan samakan Struktur Anggaran.
// @author       Fakhry-Glob
// @homepageURL  https://github.com/Fakhry-Glob/sirup-sanding-dipa
// @supportURL   https://github.com/Fakhry-Glob/sirup-sanding-dipa/issues
// @updateURL    https://raw.githubusercontent.com/Fakhry-Glob/sirup-sanding-dipa/main/dist/sirup_sanding_dipa.meta.js
// @downloadURL  https://raw.githubusercontent.com/Fakhry-Glob/sirup-sanding-dipa/main/dist/sirup_sanding_dipa.user.js
// @match        https://sirup.inaproc.id/sirup/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
'use strict';
const APP_VERSION = '1.3.2';

const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ─────────────────────────────────────────────────────────────────── STYLE ──
const CSS = `
.sdr, .sdr *, .sdr *::before, .sdr *::after { box-sizing: border-box; }
.sdr { --b:#1F497D; --b2:#2E6DA4; --b-soft:#eaf1fa; --ink:#0f172a; --ink2:#334155; --mut:#64748b; --line:#e2e8f0; --bg:#f4f6fa;
  --ok:#15803d; --ok-soft:#ecfdf3; --warn:#b45309; --warn-soft:#fffbeb; --bad:#b91c1c; --bad-soft:#fef2f2; --np:#7c3aed; --teal:#0f766e;
  font: 14px/1.55 "Segoe UI", system-ui, -apple-system, sans-serif; color: var(--ink); }
.sdr-fab { position: fixed; right: 24px; bottom: 84px; z-index: 99990; display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 20px; border: 0; border-radius: 999px; cursor: pointer; font: 600 14px/1 "Segoe UI", system-ui, sans-serif; color: #fff;
  background: linear-gradient(135deg, #0f766e 0%, #0e9f8e 100%); box-shadow: 0 6px 18px rgba(15,118,110,.35); }
.sdr-fab:hover { transform: translateY(-2px); }

/* jendela */
.sdr-ov { position: fixed; inset: 0; z-index: 99991; background: rgba(15,23,42,.55); display: flex; justify-content: center; padding: 20px; }
.sdr-win { background: var(--bg); border-radius: 14px; width: min(1320px, 100%); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.3); }
.sdr-hd { display: flex; align-items: center; gap: 12px; padding: 14px 22px; background: var(--b); color: #fff; }
.sdr-hd h2 { font-size: 17px; margin: 0; font-weight: 650; }
.sdr-hd .sdr-ctx { flex: 1; font-size: 12.5px; opacity: .92; display: flex; gap: 6px; flex-wrap: wrap; }
.sdr-hd .sdr-ctx span { background: rgba(255,255,255,.14); padding: 3px 10px; border-radius: 999px; }
.sdr-hd .btn { background: rgba(255,255,255,.12); color: #fff; border-color: rgba(255,255,255,.3); }
.sdr-x { background: transparent; border: 0; color: #fff; font-size: 24px; cursor: pointer; line-height: 1; padding: 0 4px; }

/* stepper */
.sdr-steps { display: flex; gap: 4px; padding: 10px 18px; background: #fff; border-bottom: 1px solid var(--line); overflow-x: auto; }
.sdr-step { display: flex; align-items: center; gap: 8px; padding: 8px 14px; cursor: pointer; border: 0; background: transparent; font: inherit; color: var(--mut); border-radius: 10px; white-space: nowrap; }
.sdr-step .no { width: 24px; height: 24px; border-radius: 50%; display: inline-grid; place-items: center; font-size: 12px; font-weight: 700; background: #e2e8f0; color: var(--ink2); }
.sdr-step.on { background: var(--b-soft); color: var(--b); font-weight: 650; }
.sdr-step.on .no { background: var(--b); color: #fff; }
.sdr-step.done .no { background: var(--ok); color: #fff; }
.sdr-body { flex: 1; overflow: auto; padding: 22px 26px 0; }

/* laci log */
.sdr-log { border-top: 1px solid #1e293b; background: #0b1220; color: #cbd5e1; font: 12.5px/1.55 Consolas, monospace; }
.sdr-log-bar { display: flex; align-items: center; gap: 10px; padding: 7px 18px; cursor: pointer; user-select: none; }
.sdr-log-bar b { color: #e2e8f0; font-family: "Segoe UI", system-ui, sans-serif; font-weight: 600; }
.sdr-log-bar .last { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; opacity: .85; }
.sdr-log-body { max-height: 0; overflow: auto; padding: 0 18px; transition: max-height .2s; }
.sdr-log.open .sdr-log-body { max-height: 240px; padding-bottom: 10px; }
.sdr-log .e { color: #fca5a5; } .sdr-log .o { color: #86efac; } .sdr-log .w { color: #fcd34d; }

/* tipografi & kartu */
.sdr h3 { font-size: 16px; margin: 0 0 6px; font-weight: 650; }
.sdr h4 { font-size: 13px; margin: 0 0 10px; font-weight: 700; color: var(--ink2); text-transform: uppercase; letter-spacing: .04em; }
.sdr p.note { color: var(--mut); margin: 0 0 14px; max-width: 900px; }
.sdr .card { border: 1px solid var(--line); border-radius: 12px; padding: 20px 22px; margin-bottom: 18px; background: #fff; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.sdr .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 18px; }
.sdr .kpi { border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; background: #fff; }
.sdr .kpi b { display: block; font-size: 20px; font-variant-numeric: tabular-nums; margin-bottom: 2px; }
.sdr .kpi span { color: var(--mut); font-size: 12.5px; }
.sdr .kpi.link { cursor: pointer; } .sdr .kpi.link:hover { border-color: var(--b2); box-shadow: 0 2px 8px rgba(46,109,164,.12); }

/* tombol & input */
.sdr .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 9px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font: inherit; color: var(--ink); white-space: nowrap; }
.sdr .btn:hover { border-color: var(--b2); } .sdr .btn[disabled] { opacity: .5; cursor: not-allowed; }
.sdr .btn.pri { background: var(--b); color: #fff; border-color: var(--b); } .sdr .btn.go { background: var(--ok); color: #fff; border-color: var(--ok); font-weight: 600; }
.sdr .btn.danger { background: #fff; color: var(--bad); border-color: #fca5a5; } .sdr .btn.sm { padding: 5px 11px; font-size: 13px; border-radius: 8px; }
.sdr .btn.ghost { border-color: transparent; background: transparent; color: var(--b2); }
.sdr .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.sdr input[type=text], .sdr input[type=number], .sdr input[type=month], .sdr select, .sdr textarea { font: inherit; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: var(--ink); max-width: 100%; min-height: 38px; }
.sdr input:focus, .sdr select:focus, .sdr textarea:focus { outline: 2px solid #bfdbfe; border-color: var(--b2); }
.sdr textarea { width: 100%; min-height: 96px; resize: vertical; font-size: 13px; line-height: 1.5; }
.sdr input[type=checkbox] { width: 17px; height: 17px; accent-color: var(--b); cursor: pointer; }
.sdr .drop { border: 2px dashed #94a3b8; border-radius: 14px; padding: 32px; text-align: center; color: var(--mut); cursor: pointer; background: #fff; }
.sdr .drop.hover { border-color: var(--b2); background: #eff6ff; }

/* tabel */
.sdr table.t { border-collapse: collapse; width: 100%; font-size: 13.5px; }
.sdr table.t th, .sdr table.t td { border-bottom: 1px solid var(--line); padding: 9px 12px; text-align: left; vertical-align: top; }
.sdr table.t th { position: sticky; top: 0; background: #f1f5f9; z-index: 1; font-weight: 650; white-space: nowrap; color: var(--ink2); }
.sdr table.t tbody tr:hover td { background: #f8fafc; }
.sdr table.t td.n, .sdr table.t th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sdr table.t tr.sub td { background: #fafbfd; }
.sdr .tbl { max-height: 62vh; overflow: auto; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
.sdr .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.sdr .p-ok { background: #dcfce7; color: var(--ok); } .sdr .p-warn { background: #fef3c7; color: var(--warn); } .sdr .p-bad { background: #fee2e2; color: var(--bad); }
.sdr .p-np { background: #ede9fe; color: var(--np); } .sdr .p-mut { background: #f1f5f9; color: var(--mut); } .sdr .p-info { background: #dbeafe; color: #1d4ed8; }
.sdr .muted { color: var(--mut); } .sdr .mono { font-family: Consolas, monospace; font-size: 13px; }
.sdr .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.sdr details > summary { cursor: pointer; padding: 6px 0; font-weight: 600; color: var(--ink2); }
.sdr .warnbox, .sdr .errbox, .sdr .okbox, .sdr .infobox { padding: 12px 16px; border-radius: 10px; margin: 0 0 14px; }
.sdr .warnbox { border-left: 4px solid var(--warn); background: var(--warn-soft); }
.sdr .errbox { border-left: 4px solid var(--bad); background: var(--bad-soft); }
.sdr .okbox { border-left: 4px solid var(--ok); background: var(--ok-soft); }
.sdr .infobox { border-left: 4px solid var(--b2); background: var(--b-soft); }
.sdr .prog { height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; margin: 8px 0; } .sdr .prog > i { display: block; height: 100%; background: var(--b2); width: 0; transition: width .2s; }

/* langkah 4: tab segmen, daftar baris, editor */
.sdr .seg { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 18px; padding: 6px; background: #fff; border: 1px solid var(--line); border-radius: 12px; }
.sdr .seg button { border: 0; background: transparent; padding: 9px 14px; border-radius: 9px; font: inherit; color: var(--ink2); cursor: pointer; display: inline-flex; gap: 8px; align-items: center; }
.sdr .seg button .cnt { background: #e2e8f0; color: var(--ink2); border-radius: 999px; padding: 1px 8px; font-size: 12px; font-weight: 700; }
.sdr .seg button.on { background: var(--b); color: #fff; } .sdr .seg button.on .cnt { background: rgba(255,255,255,.25); color: #fff; }
.sdr .flow { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 6px 0 4px; }
.sdr .flow > div { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }
.sdr .flow .no { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--b-soft); color: var(--b); font-weight: 700; margin-bottom: 6px; }
.sdr .list { display: flex; flex-direction: column; gap: 10px; }
.sdr .item { background: #fff; border: 1px solid var(--line); border-radius: 12px; }
.sdr .item.off { opacity: .72; border-style: dashed; }
.sdr .item.warn { border-color: #fcd34d; }
.sdr .item-hd { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: start; padding: 14px 16px; }
.sdr .item-title { font-weight: 600; line-height: 1.4; }
.sdr .item-sub { color: var(--mut); font-size: 12.5px; margin-top: 3px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.sdr .item-side { text-align: right; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
.sdr .item-side b { font-variant-numeric: tabular-nums; font-size: 15px; }
.sdr .notes { margin: 0 16px 12px 47px; padding: 10px 14px; background: var(--warn-soft); border-radius: 8px; font-size: 13px; color: #78350f; }
.sdr .notes div + div { margin-top: 3px; }
.sdr .sub-items { border-top: 1px solid var(--line); padding: 8px 16px 12px 47px; display: flex; flex-direction: column; gap: 8px; }
.sdr .sub-item { border: 1px solid var(--line); border-radius: 10px; background: #fcfdff; }
.sdr .sub-item .item-hd { padding: 10px 12px; }
.sdr .editor { border-top: 1px solid var(--line); padding: 18px 20px; background: #fbfcfe; border-radius: 0 0 12px 12px; display: flex; flex-direction: column; gap: 18px; }
.sdr .fs { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
.sdr .formgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px 18px; }
.sdr .field label { display: block; font-size: 12.5px; color: var(--ink2); font-weight: 600; margin-bottom: 5px; }
.sdr .field .hint { font-size: 12px; color: var(--mut); margin-top: 4px; }
.sdr .range { display: flex; align-items: center; gap: 8px; } .sdr .range span { color: var(--mut); } .sdr .range input { flex: 1; min-width: 140px; }
.sdr .rangegrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 14px 18px; margin-bottom: 12px; }
.sdr .checks { display: flex; flex-wrap: wrap; gap: 8px 18px; } .sdr .checks label { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; cursor: pointer; }
.sdr .mak-t { width: 100%; border-collapse: collapse; } .sdr .mak-t th { font-size: 12px; color: var(--mut); text-align: left; padding: 0 8px 6px 0; font-weight: 600; }
.sdr .mak-t td { padding: 4px 8px 4px 0; vertical-align: middle; }
.sdr .lok { display: grid; grid-template-columns: 1fr 1fr 1.5fr auto; gap: 8px; margin-bottom: 8px; }
.sdr .bulk { background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 12px; padding: 16px 18px; margin-bottom: 16px; }
.sdr .bulk .formgrid { margin: 10px 0 12px; }
.sdr-body::after { content: ""; display: block; height: 22px; }
.sdr .actionbar { padding: 14px 26px; background: #fff; border-top: 1px solid var(--line); box-shadow: 0 -4px 14px rgba(15,23,42,.06); display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.sdr .actionbar .sum { flex: 1; color: var(--ink2); font-size: 13.5px; }
.sdr .empty { text-align: center; color: var(--mut); padding: 34px; background: #fff; border: 1px dashed var(--line); border-radius: 12px; }

/* langkah 4 v1.3: proyeksi, kartu keputusan, perubahan, antrean */
.sdr .proj .kpi b { font-size: 21px; } .sdr .proj .kpi .ket { display: block; margin-top: 3px; font-size: 12px; color: var(--mut); }
.sdr .proj .kpi.ok { border-color: #86efac; background: var(--ok-soft); } .sdr .proj .kpi.ok b { color: var(--ok); }
.sdr .proj .kpi.warn { border-color: #fcd34d; background: var(--warn-soft); } .sdr .proj .kpi.warn b { color: var(--warn); }
.sdr .kartu { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; margin-bottom: 12px; }
.sdr .kartu.belum { border-color: #fcd34d; box-shadow: inset 4px 0 0 #f59e0b; }
.sdr .kartu-hd { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; margin-bottom: 8px; }
.sdr .opsi { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 8px; margin-top: 10px; }
.sdr .op { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; cursor: pointer; background: #fff; }
.sdr .op:hover { border-color: var(--b2); } .sdr .op.on { border-color: var(--b2); background: var(--b-soft); }
.sdr .op input { margin-top: 4px; accent-color: var(--b); } .sdr .op b { font-weight: 600; }
.sdr .op small { display: block; color: var(--mut); font-size: 12.5px; margin-top: 2px; line-height: 1.45; } .sdr .op small.dampak { color: var(--ink2); font-weight: 600; }
.sdr .sublabel { margin-top: 12px; font-size: 12.5px; font-weight: 700; color: var(--ink2); text-transform: uppercase; letter-spacing: .04em; }
.sdr .grp-hd { display: flex; gap: 10px; align-items: baseline; margin: 18px 0 8px; color: var(--ink2); font-weight: 600; }
.sdr .delta { font-size: 12.5px; font-variant-numeric: tabular-nums; } .sdr .delta.up { color: var(--ok); } .sdr .delta.down { color: var(--bad); }
.sdr .sumber { margin-top: 6px; font-size: 12.5px; color: var(--mut); }
.sdr .cek div { padding: 3px 0; } .sdr .cek .ok { color: var(--ok); } .sdr .cek .warn { color: var(--warn); } .sdr .cek .bad { color: var(--bad); font-weight: 600; }
.sdr details.bulk > summary { font-weight: 650; color: var(--ink); }
.sdr .cb2 { display: flex; flex-direction: column; gap: 6px; } .sdr .cb2 label { display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--mut); cursor: pointer; }

.sdr-modal { position: fixed; inset: 0; z-index: 99995; background: rgba(15,23,42,.5); display: flex; align-items: center; justify-content: center; padding: 20px; }
.sdr-modal > div { background: #fff; border-radius: 14px; max-width: 940px; width: 100%; max-height: 86vh; overflow: auto; padding: 22px 24px; }
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
                nodes.set(key, { key, level: lvl, kode: code, uraian: rest.replace(/\s*\[[^\]]*\]\s*/g, ' ').trim(), pagu }); // buang catatan [..] SAKTI
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
// Menyandingkan DIPA (hasil parser) dengan PKKR dan paket RUP SiRUP per akun
// (MAK 7 segmen). Rencana perbaikannya disusun di src/rencana.js.
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
        const cekKep = (opts && opts.cekKeputusan) || {};   // alasan → 'P' | 'NP' (kartu "perlu dicek")
        const nodes = dipa.nodes instanceof Map ? dipa.nodes : new Map(dipa.nodes.map(n => [n.key, n]));
        const akun = new Map();
        dipa.items.forEach((it, idx) => {
            const code = it.key.split('.').pop();
            const node = nodes.get(it.key) || {};
            const iid = `${it.key}#${it.no || idx}`;
            let c = Classify.item(code, node.uraian, it.uraian, it.grup);
            const ov = overrides && overrides[iid];
            if (ov) c = { kelas: ov, alasan: 'Diubah manual', manual: true };
            else if (c.kelas === 'CEK' && cekKep[c.alasan]) c = { kelas: cekKep[c.alasan], alasan: c.alasan, cekAsal: c.alasan };
            else if (cekSebagaiP && c.kelas === 'CEK') c = { kelas: 'P', alasan: '(perlu cek → dihitung pengadaan) ' + c.alasan, cekAsal: c.alasan };
            let a = akun.get(it.key);
            if (!a) {
                a = { key: it.key, akun: code, nama: node.uraian || '', pagu: 0, P: 0, NP: 0, CEK: 0, items: [], rup: [], sd: node.sd || [] };
                akun.set(it.key, a);
            }
            const row = { iid, no: it.no, uraian: it.uraian, grup: it.grup || '', volume: it.volume || '', harga: it.harga ?? null, pagu: it.pagu || 0, realisasi: it.realisasi || 0,
                kelas: c.kelas, alasan: c.alasan, manual: !!c.manual, cekAsal: c.cekAsal || null };
            a.items.push(row);
            a.pagu += row.pagu;
            a[row.kelas] += row.pagu;
            if (row.kelas === 'P') { const sd = it.sd || (a.sd.length === 1 ? a.sd[0] : ''); a.PbySd = a.PbySd || {}; a.PbySd[sd] = (a.PbySd[sd] || 0) + row.pagu; }
        });
        return { nodes, akun };
    }

    // FA Detail (pagu revisi + realisasi) dilengkapi RKK pendamping: nama node, lokasi KRO,
    // sumber dana, serta volume & harga satuan item (dicocokkan per MAK + uraian).
    function gabungDipa(utama, pendamping) {
        const norm = s => String(s || '').toLowerCase().replace(/\[[^\]]*\]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
        let node = 0, item = 0;
        for (const [k, n] of utama.nodes) {
            const o = pendamping.nodes.get(k);
            if (!o) continue;
            if (!n.uraian && o.uraian) { n.uraian = o.uraian; node++; }
            if (!n.lokasi && o.lokasi) n.lokasi = o.lokasi;
            if ((!n.sd || !n.sd.length) && o.sd && o.sd.length) n.sd = o.sd;
        }
        const antre = new Map();
        for (const it of pendamping.items) { const k = it.key + '|' + norm(it.uraian); if (!antre.has(k)) antre.set(k, []); antre.get(k).push(it); }
        for (const it of utama.items) {
            const q = antre.get(it.key + '|' + norm(it.uraian));
            if (!q || !q.length) continue;
            const o = q.shift();
            if (!it.volume && o.volume) it.volume = o.volume;
            if (it.harga == null && o.harga != null) it.harga = o.harga;
            if (!it.sd && o.sd) it.sd = o.sd;
            item++;
        }
        return { node, item };
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

    const BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
    function ym(s) {
        const m = String(s || '').trim().toLowerCase().match(/([a-z]+)\s+(\d{4})/);
        if (!m) return '';
        const i = BULAN.indexOf(m[1]);
        return i < 0 ? '' : `${m[2]}-${String(i + 1).padStart(2, '0')}`;
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

    return { SD_CODE, buildDipa, gabungDipa, diffPkkr, sanding, verdictPaket, strukturAnggaran, ym, ST, LV_SIRUP, levelOfKey, parentKey, TOL };
})();



// ─────────────────────────────────────────────────────────────── RENCANA ──
// Menyusun rencana perbaikan RUP dari hasil sanding (Analysis):
//  • kartu keputusan per kelompok (MAK lama, kelebihan besar, non-pengadaan,
//    item "perlu dicek", final draft bermasalah) — bukan per paket;
//  • perubahan per paket existing: satu paket = satu revisi (tambah pagu, pindah
//    MAK, keluarkan baris non-pengadaan, potong kelebihan, batalkan);
//  • paket baru hanya untuk MAK yang belum punya paket, dititipkan lewat revisi
//    satu ke banyak ke paket di komponen yang sama;
//  • proyeksi RUP terumumkan.
// Fungsi murni tanpa akses SiRUP, supaya bisa diuji di Node untuk banyak satker.
// Semua isian satker-spesifik (lokasi satker, kode BA/eselon) datang dari ctx.
const Rencana = (() => {
    const TOL = 1000;
    const SD_CODE = { RM: 'A', PLN: 'B', PNP: 'D', PNBP: 'D', BLU: 'F', SBSN: 'T' };
    const SD_BELUM_DIUJI = new Set(['B', 'T']); // PLN / SBSN: butuh isian register yang belum pernah direkam
    const seg = (mak, n) => mak.split('.').slice(0, n).join('.');
    const akunOf = mak => mak.split('.').pop();
    const fmt = n => Math.round(n).toLocaleString('id-ID');
    const sum = (xs, f) => xs.reduce((s, x) => s + (f ? f(x) : x), 0);
    const aktif = p => p.aktif !== 'false' && p.aktif !== false;
    const penyedia = p => (p.jenisPaket || 'penyedia') === 'penyedia';
    const isU = p => p.status === '3' && aktif(p) && penyedia(p);
    const isFD = p => p.status === '2' && penyedia(p);
    const rowsOf = p => (p.sumberDana || []).filter(s => +s.pagu > 0);
    const MEETING = /^52411[49]$/;
    const LABEL_JENIS = { 'Barang': 'Pengadaan barang', 'Jasa Lainnya': 'Pengadaan jasa lainnya', 'Pekerjaan Konstruksi': 'Pekerjaan konstruksi', 'Jasa Konsultansi': 'Jasa konsultansi' };

    // ── kemiripan nama ──────────────────────────────────────────────────
    const STOP = new Set(['belanja', 'pengadaan', 'paket', 'dan', 'untuk', 'pada', 'di', 'ke', 'dari', 'yang', 'dengan', 'atau', 'tahun', 'anggaran',
        'serta', 'dalam', 'lainnya', 'lain', 'the', 'kab', 'kota']);
    const tokens = s => new Set(String(s || '').toLowerCase().replace(/\[[^\]]*\]/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ')
        .filter(t => t.length > 2 && !STOP.has(t) && !/^\d+$/.test(t)));
    const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let i = 0; for (const t of a) if (b.has(t)) i++; return i / (a.size + b.size - i); };
    const contain = (a, b) => { if (!a.size) return 0; let i = 0; for (const t of a) if (b.has(t)) i++; return i / a.size; };
    const bersih = s => { const t = String(s || '').replace(/\[[^\]]*\]/g, ' ').replace(/^\s*belanja\s+/i, '').replace(/\s+/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
    // untuk nama paket: buang juga rincian volume dalam kurung, mis. "(60 orang x 2 kegiatan)"
    const bersihNama = s => bersih(s).replace(/\s*\([^)]*\d[^)]*(\)|$)/g, ' ').replace(/\s+/g, ' ').trim();
    const potong = (s, n) => s.length <= n ? s : s.slice(0, n - 3).replace(/\s+\S*$/, '') + '...';

    // Paket "umum" untuk sebuah akun: namanya nama akun/komponen (mis. "Belanja Bahan",
    // "Langganan Daya dan Jasa", "Pelatihan Berbasis Kompetensi"), bukan pekerjaan spesifik
    // (mis. "Pengadaan Konsumsi Kegiatan Konsolidasi"). Kekurangan pagu ditambahkan ke paket umum.
    function isUmum(p, mak, akunMap, nodes) {
        const nm = String(p.nama || '').trim();
        // "Belanja …" saja tidak cukup: "Belanja Modal Peralatan Laboratorium …" itu paket spesifik.
        const tp = tokens(nm);
        if (!tp.size) return true;
        const namaAkun = [(akunMap.get(mak) || {}).nama, ...rowsOf(p).map(r => (akunMap.get(r.mak) || {}).nama)];
        for (const c of namaAkun) { const tc = tokens(c); if (tc.size && (jaccard(tp, tc) >= 0.5 || contain(tp, tc) >= 0.75)) return true; }
        for (const k of [seg(mak, 5), seg(mak, 6)]) { const n = nodes.get(k); if (n && n.uraian && jaccard(tp, tokens(n.uraian)) >= 0.6) return true; }
        return false;
    }

    // bagi total ke baris sebanding bobot; dibulatkan ke Rp1.000, sisa pembulatan ke baris terbesar
    function bagi(total, bobot) {
        const tb = sum(bobot);
        if (!tb || total <= 0) return bobot.map(() => 0);
        const out = bobot.map(w => Math.floor(total * w / tb / 1000) * 1000);
        const imax = bobot.indexOf(Math.max(...bobot));
        out[imax] += Math.round(total - sum(out));
        return out;
    }

    // ── bulan (YYYY-MM) ─────────────────────────────────────────────────
    const BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
    const BULAN_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    function ym(s) {
        const t = String(s || '').trim().toLowerCase();
        let m = t.match(/^(\d{4})-(\d{2})/);
        if (m) return `${m[1]}-${m[2]}`;
        m = t.match(/([a-z]+)\s+(\d{4})/);
        if (!m) return '';
        let i = BULAN.indexOf(m[1]); if (i < 0) i = BULAN_EN.indexOf(m[1]);
        return i < 0 ? '' : `${m[2]}-${String(i + 1).padStart(2, '0')}`;
    }
    const ymAdd = (y, d) => { const [a, b] = y.split('-').map(Number); const t = new Date(a, b - 1 + d, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; };
    const maxYm = (a, b) => (a > b ? a : b);

    // jadwal SiRUP: akhir pemilihan ≥ awal; awal kontrak ≥ akhir pemilihan; akhir kontrak ≥ awal kontrak;
    // akhir pemanfaatan ≥ awal pemanfaatan (aturan validasi form paket SiRUP)
    function rapikanJadwal(j) {
        const o = { ...j };
        o.akhirPengadaan = maxYm(o.akhirPengadaan || o.awalPengadaan, o.awalPengadaan);
        o.awalPekerjaan = maxYm(o.awalPekerjaan || o.akhirPengadaan, o.akhirPengadaan);
        o.akhirPekerjaan = maxYm(o.akhirPekerjaan || o.awalPekerjaan, o.awalPekerjaan);
        o.awalKebutuhan = o.awalKebutuhan || o.awalPekerjaan;
        o.kebutuhan = maxYm(o.kebutuhan || o.akhirPekerjaan, o.awalKebutuhan);
        return o;
    }
    function jadwalPaket(p) {
        const t = p.tanggal || {};
        const j = {
            awalPengadaan: ym(t.awalPengadaan) || ym(p.pemilihan && p.pemilihan.mulai), akhirPengadaan: ym(t.akhirPengadaan) || ym(p.pemilihan && p.pemilihan.akhir),
            awalPekerjaan: ym(t.awalPekerjaan) || ym(p.pelaksanaan && p.pelaksanaan.mulai), akhirPekerjaan: ym(t.akhirPekerjaan) || ym(p.pelaksanaan && p.pelaksanaan.akhir),
            awalKebutuhan: ym(p.pemanfaatan && p.pemanfaatan.mulai), kebutuhan: ym(p.pemanfaatan && p.pemanfaatan.akhir),
        };
        if (!j.awalPengadaan) return null;
        j.awalKebutuhan = j.awalKebutuhan || j.awalPekerjaan; j.kebutuhan = j.kebutuhan || j.akhirPekerjaan;
        return rapikanJadwal(j);
    }

    // ── objek paket siap kirim (dipakai payload revisi) ─────────────────
    const JENIS_ID = { 'Barang': 1, 'Pekerjaan Konstruksi': 2, 'Jasa Konsultansi': 3, 'Jasa Lainnya': 4 };
    const JENIS_NAMA = Object.fromEntries(Object.entries(JENIS_ID).map(([k, v]) => [v, k]));
    function jenisPaket(p) {
        const r = (p.jenisRaw || [])[0];
        if (r && JENIS_NAMA[r.jenisid]) return JENIS_NAMA[r.jenisid];
        return ((p.jenisPengadaan || [])[0] || {}).jenis || 'Barang';
    }
    function pkDari(p, rows, cfg) {
        const total = sum(rows, r => r.pagu);
        const jenisRaw = (p.jenisRaw || []).map(j => ({ ...j }));
        return {
            baru: false, sumberId: p.id, nama: p.nama,
            anggaran: rows.map(r => ({ ...r })),
            jenis: jenisPaket(p), jenisList: jenisRaw.length > 1 && Math.abs(sum(jenisRaw, j => +j.pagu) - total) <= 1 ? jenisRaw : null, jenisIdLama: (jenisRaw[0] || {}).id || '',
            metode: p.metode || Classify.saranMetode(jenisPaket(p), total, '', '', cfg),
            uraian: p.uraianRaw != null ? p.uraianRaw : (p.uraian || ''), spesifikasi: p.spesifikasiRaw != null ? p.spesifikasiRaw : (p.spesifikasi || ''),
            volume: p.volume || '1 Paket',
            praDipa: /^ya/i.test(p.pradipa || ''), pdn: !/tidak/i.test(p.pdn || ''), umkm: /^ya/i.test(p.ukm || '') || (p.ukm == null && total <= 15e9),
            lokasiRaw: (p.lokasiRaw || []).map(l => ({ ...l })),
            jadwal: jadwalPaket(p) || null,
            spp: p.spp ? { ...p.spp } : { ekonomi: true, sosial: true, lingkungan: false },
        };
    }

    // ── penyusun utama ──────────────────────────────────────────────────
    // ctx: { akunMap, pakets, dipaNodes, cfg, tahun, hariIni, keputusan, atur, lokasiSatker, lokasiRkk, komponenId }
    function susun(ctx) {
        const { akunMap, pakets, cfg } = ctx;
        const nodes = ctx.dipaNodes || new Map();
        const kep = ctx.keputusan || {};
        const atur = ctx.atur || {};
        const AMBANG = cfg.ambangSelisih != null ? +cfg.ambangSelisih : 1e6;
        const BESAR = cfg.ambangKeputusan != null ? +cfg.ambangKeputusan : 100e6;
        const TA = ctx.tahun || (ctx.hariIni || new Date()).getFullYear();
        const byId = new Map(pakets.map(p => [p.id, p]));
        const U = pakets.filter(isU), FD = pakets.filter(isFD);
        const kartu = [], peringatan = [];

        const kelasRow = r => {
            const a = akunMap.get(r.mak);
            if (!a) return 'HILANG';
            if (a.P > 0) return 'P';
            if (a.CEK > 0) return 'CEK';
            return 'NP';
        };
        // perubahan per paket (salinan baris yang bisa diubah)
        const ubah = new Map();
        const getUbah = p => {
            let u = ubah.get(p.id);
            if (!u) {
                u = { paket: p, rows: rowsOf(p).map(r => ({ idLama: r.id || '', mak: r.mak, pagu: +r.pagu, danaApbn: r.danaApbn || 'A', sumber: r.sumber, ta: r.ta, idKomponen: r.idKomponen,
                    asal: r.asal, asalSatker: r.asalSatker, kodeInstansi: r.kodeInstansi, kodeEselon: r.kodeEselon, kodeSatker: r.kodeSatker })),
                    sumber: new Set(), catatan: [], batal: false, umumkanDulu: p.status === '2', override: {} };
                ubah.set(p.id, u);
            }
            return u;
        };
        const rowOf = (u, r) => u.rows.find(x => x.idLama && x.idLama === r.id) || u.rows.find(x => x.mak === r.mak && x.pagu === +r.pagu) || u.rows.find(x => x.mak === r.mak);
        // RUP terumumkan per akun setelah rencana
        const rup = new Map([...akunMap.values()].map(a => [a.key, a.rupU]));
        const addRup = (mak, v) => { if (rup.has(mak)) rup.set(mak, rup.get(mak) + v); };
        const kartuBaru = (k, pilihanDefault) => {
            const d = kep[k.id] || {};
            k.pilihan = d.opsi !== undefined ? d.opsi : pilihanDefault;
            k.param = d;
            k.diputuskan = k.pilihan != null;
            k.otomatis = d.opsi === undefined && pilihanDefault != null;
            kartu.push(k);
            return k;
        };
        const blok = new Set();              // akun tujuan yang keputusannya belum/ditunda → jangan dibuatkan paket
        const paketTertahan = new Set();     // paket di kelompok yang belum diputuskan → jangan dijadikan titipan
        const batalFD = [];                  // {paketId, nama, pagu, alasan, sumber}

        // ── 1. Non-pengadaan yang terumumkan ─────────────────────────────
        const npList = [];
        for (const p of U) {
            const rows = rowsOf(p);
            const np = rows.filter(r => kelasRow(r) === 'NP');
            if (!np.length) continue;
            const alasan = [...new Set(np.flatMap(r => (akunMap.get(r.mak).items || []).filter(i => i.kelas === 'NP').map(i => i.alasan)))].slice(0, 2).join('; ');
            npList.push({ paketId: p.id, nama: p.nama, pagu: +p.pagu, np: sum(np, r => +r.pagu), semua: np.length === rows.length, alasan, rows: np });
        }
        if (npList.length) {
            const k = kartuBaru({ id: 'np', jenis: 'NP', judul: 'Non-pengadaan yang terumumkan',
                ringkas: `${npList.length} paket memuat akun non-pengadaan senilai Rp${fmt(sum(npList, x => x.np))}`,
                daftar: npList, opsi: [
                    { id: 'keluarkan', label: 'Keluarkan', ket: 'Paket yang seluruhnya non-pengadaan dibatalkan; paket campuran direvisi tanpa baris non-pengadaan', dampak: -sum(npList, x => x.np) },
                    { id: 'biarkan', label: 'Biarkan', ket: 'Tidak diubah', dampak: 0 }] }, 'keluarkan');
            if (k.pilihan === 'keluarkan') for (const x of npList) {
                const u = getUbah(byId.get(x.paketId));
                u.sumber.add('np');
                for (const r of x.rows) { const row = rowOf(u, { id: r.id, mak: r.mak, pagu: r.pagu }); if (row) { addRup(row.mak, -row.pagu); row.pagu = 0; } }
                u.catatan.push(`Baris non-pengadaan dikeluarkan (Rp${fmt(x.np)}): ${x.alasan}`);
            }
        }

        // ── 2. MAK lama (tidak ada di DIPA) → kelompok per akun tujuan ─────
        // Tujuan = akun berkode sama di kegiatan yang sama, diutamakan yang paling dekat strukturnya
        // (komponen > RO > KRO > kode sub-komponen). Padanan lemah (hanya sama kegiatan, kandidat >1)
        // selalu jadi kartu keputusan, sekecil apa pun nilainya.
        const kodeSub = mak => String(mak.split('.')[5] || '').toUpperCase().replace(/O/g, '0');
        const skorTujuan = (lama, a) => (seg(lama, 5) === seg(a.key, 5) ? 8 : 0) + (seg(lama, 4) === seg(a.key, 4) ? 4 : 0) + (seg(lama, 3) === seg(a.key, 3) ? 2 : 0) + (kodeSub(lama) === kodeSub(a.key) ? 3 : 0);
        const kandidatTujuan = mak => [...akunMap.values()].filter(a => a.akun === akunOf(mak) && a.key.startsWith(seg(mak, 2) + '.') && a.P > 0)
            .map(a => ({ a, skor: skorTujuan(mak, a), sisa: Math.max(0, a.P - a.rupU) })).sort((x, y) => y.skor - x.skor || y.sisa - x.sisa);
        const salahKetikO = (lama, tujuan) => /O/i.test(lama.split('.')[5] || '') && lama.split('.')[5] !== tujuan.split('.')[5] && kodeSub(lama) === kodeSub(tujuan);
        const grup = new Map();
        for (const p of [...U, ...FD]) for (const r of rowsOf(p)) {
            if (kelasRow(r) !== 'HILANG') continue;
            const kand = kandidatTujuan(r.mak);
            const key = `${seg(r.mak, 2)}|${akunOf(r.mak)}|${seg(r.mak, 6)}`;
            const pilihT = (kep['pindah:' + key] || {}).target;
            const best = (pilihT && kand.find(k => k.a.key === pilihT)) || kand[0];
            if (!grup.has(key)) grup.set(key, { key, rows: [], kand, best, lemah: !!best && best.skor < 4 && kand.length > 1 && !pilihT });
            grup.get(key).rows.push({ p, r, fd: p.status === '2' });
        }
        const itemTanpaPaket = new Map(); // akun → item yang belum punya paket (untuk nama/uraian paket baru)
        for (const g of [...grup.values()].sort((a, b) => a.key.localeCompare(b.key))) {
            const [keg, code] = g.key.split('|');
            const targets = g.best ? [g.best.a] : [];
            const rowsU = g.rows.filter(x => !x.fd), rowsFD = g.rows.filter(x => x.fd);
            const gU = sum(rowsU, x => +x.r.pagu), gFD = sum(rowsFD, x => +x.r.pagu);
            const makLama = [...new Set(g.rows.map(x => x.r.mak))];
            const namaAkun = (targets[0] && targets[0].nama) || code;
            const id = 'pindah:' + g.key;
            if (!targets.length) {
                const k = kartuBaru({ id, jenis: 'TANPA_PADANAN', judul: `MAK lama tanpa padanan · ${code}`, akun: code, makLama,
                    ringkas: `${new Set(g.rows.map(x => x.p.id)).size} paket (Rp${fmt(gU)} terumumkan${gFD ? `, Rp${fmt(gFD)} final draft` : ''}) memakai ${makLama.join(', ')} yang tidak ada di DIPA, dan kegiatan ${keg} tidak punya akun ${code}`,
                    paket: paketGrup(g.rows), opsi: [
                        { id: 'keluarkan', label: 'Keluarkan dari RUP', ket: 'Baris MAK ini dihapus; paket yang tidak punya baris lain dibatalkan', dampak: -gU },
                        { id: 'biarkan', label: 'Biarkan', ket: 'Tidak diubah', dampak: 0 }] }, null);
                if (k.pilihan === 'keluarkan') for (const x of rowsU) { const u = getUbah(x.p); const row = rowOf(u, x.r); if (row) row.pagu = 0; u.sumber.add('pindah'); u.catatan.push(`Baris ${x.r.mak} (Rp${fmt(x.r.pagu)}) dikeluarkan: MAK tidak ada di DIPA`); }
                if (k.pilihan == null) for (const x of g.rows) paketTertahan.add(x.p.id);
                continue;
            }
            const buckets = bucketize(g.rows, targets, key => rup.get(key));
            const sisaTarget = sum(targets, a => Math.max(0, a.P - rup.get(a.key)));
            const lebih = gU + gFD - sisaTarget;
            const fdOpt = (kep[id] || {}).fd || 'biarkan';
            const saran = lebih <= TOL ? 'tetap' : 'sesuaikan';
            const def = g.lemah || lebih >= BESAR ? null : saran;
            const bucketInfo = buckets.map(b => ({ id: b.id, label: b.label, jenis: b.jenis, target: b.target.key, dipa: b.dipa, sisa: b.sisa, rup: sum(b.rows.filter(x => !x.fd), x => +x.r.pagu), fd: sum(b.rows.filter(x => x.fd), x => +x.r.pagu),
                paket: paketGrup(b.rows), items: b.items.map(i => i.uraian) }));
            const k = kartuBaru({ id, jenis: 'PINDAH', judul: `${bersih(namaAkun)} · ${code}`, akun: code, makLama, target: targets.map(t => t.key), saran, lemah: g.lemah,
                kandidatTujuan: g.kand.slice(0, 8).map(x => ({ mak: x.a.key, nama: x.a.nama, sisa: x.sisa, skor: x.skor })),
                ringkas: `${new Set(rowsU.map(x => x.p.id)).size} paket terumumkan Rp${fmt(gU)}${gFD ? ` + ${new Set(rowsFD.map(x => x.p.id)).size} final draft Rp${fmt(gFD)}` : ''} masih di MAK lama ${makLama.join(', ')}; usulan tujuan ${targets.map(t => t.key).join(', ')} (sisa pagu pengadaan Rp${fmt(sisaTarget)})${g.lemah ? '. Tujuan hanya sama kegiatan — pilih tujuan yang benar' : ''}${targets[0] && makLama.some(m => salahKetikO(m, targets[0].key)) ? '. Kode sub-komponen di RUP memakai huruf O, di DIPA angka 0' : ''}`,
                lebih, bucket: bucketInfo, adaFD: rowsFD.length > 0,
                opsi: [
                    { id: 'sesuaikan', label: 'Pindah ke MAK baru, pagu disesuaikan ke DIPA', ket: 'Pagu tiap paket dikali faktor per bagian (bisa diubah per paket)', dampak: -Math.max(0, gU - Math.min(gU, sisaTarget)) },
                    { id: 'tetap', label: 'Pindah ke MAK baru, pagu tetap', ket: gU - sisaTarget > AMBANG ? `RUP tetap lebih Rp${fmt(gU - sisaTarget)} dari DIPA (mis. tahun jamak)` : 'Nilai paket terumumkan muat di pagu DIPA', dampak: 0 },
                    { id: 'susun', label: 'Susun ulang', ket: 'Pilih paket yang dipertahankan per bagian (pagu dan metode diubah), sisanya dibatalkan', dampak: null },
                    { id: 'tunda', label: 'Tunda', ket: 'Paket tidak disentuh; MAK tujuan tidak dibuatkan paket baru agar tidak dobel', dampak: 0 }],
                opsiFD: rowsFD.length ? [
                    { id: 'biarkan', label: 'Biarkan final draft', ket: 'Tidak diumumkan, tidak dikembalikan' },
                    { id: 'kembalikan', label: 'Kembalikan ke PPK', ket: 'Batal final draft; PPK memperbaiki atau menghapus' },
                    { id: 'ikut', label: 'Umumkan lalu ikut disesuaikan', ket: 'Final draft diumumkan, lalu direvisi bersama paket lain di kelompok ini' }] : null,
                pilihanFD: fdOpt }, def);
            const pil = k.pilihan;
            if (pil == null || pil === 'tunda') {
                for (const t of targets) blok.add(t.key);
                for (const x of g.rows) paketTertahan.add(x.p.id);
                for (const b of buckets) if (!b.rows.length) continue;
                continue;
            }
            if (rowsFD.length && fdOpt === 'kembalikan' && pil !== 'susun')
                for (const p of new Set(rowsFD.map(x => x.p))) batalFD.push({ paketId: p.id, nama: p.nama, pagu: +p.pagu, alasan: 'MAK paket tidak ada di DIPA revisi terakhir', sumber: id });
            const ikutFD = x => !x.fd || fdOpt === 'ikut';
            const pindah = (x, mak, pagu, ket) => {
                const u = getUbah(x.p); const row = rowOf(u, x.r);
                if (!row) return;
                row.dari = row.dari || row.mak; row.mak = mak; row.pagu = pagu; row.idKomponen = null;
                u.sumber.add('pindah'); if (ket) u.catatan.push(ket);
                addRup(mak, pagu);
            };
            if (pil === 'tetap') {
                for (const b of buckets) for (const x of b.rows.filter(ikutFD)) pindah(x, b.target.key, +x.r.pagu, `MAK ${x.r.mak} → ${b.target.key}`);
            } else if (pil === 'sesuaikan') {
                for (const b of buckets) {
                    const rows = b.rows.filter(ikutFD);
                    const tot = sum(rows, x => +x.r.pagu);
                    const baru = Math.min(tot, Math.max(0, b.sisa));
                    const alok = baru >= tot - TOL ? rows.map(x => +x.r.pagu) : bagi(baru, rows.map(x => +x.r.pagu));
                    rows.forEach((x, i) => pindah(x, b.target.key, alok[i], `MAK ${x.r.mak} → ${b.target.key}${alok[i] !== +x.r.pagu ? `; pagu Rp${fmt(x.r.pagu)} → Rp${fmt(alok[i])} (${b.label}: DIPA Rp${fmt(b.dipa)})` : ''}`));
                }
            } else if (pil === 'susun') {
                const prm = (k.param && k.param.susun) || {};
                k.susun = {};
                for (const b of buckets) {
                    const cfgB = prm[b.id] || {};
                    const ids = [...new Set(b.rows.map(x => x.p.id))];
                    const besar = ids.slice().sort((a, c) => sum(b.rows.filter(x => x.p.id === c), x => +x.r.pagu) - sum(b.rows.filter(x => x.p.id === a), x => +x.r.pagu));
                    const simpan = (cfgB.simpan || (b.rows.length ? [besar.find(i => !byId.get(i) || byId.get(i).status === '3') || besar[0]] : [])).filter(i => ids.includes(i));
                    const target = Math.max(0, b.sisa);
                    const paguSimpan = simpan.length ? (cfgB.pagu && simpan.every(i => cfgB.pagu[i] != null) ? simpan.map(i => +cfgB.pagu[i]) : bagi(target, simpan.map(i => sum(b.rows.filter(x => x.p.id === i), x => +x.r.pagu)))) : [];
                    k.susun[b.id] = { simpan, pagu: Object.fromEntries(simpan.map((i, j) => [i, paguSimpan[j]])), metode: cfgB.metode || '', nama: cfgB.nama || {} };
                    for (const pid of ids) {
                        const rows = b.rows.filter(x => x.p.id === pid);
                        const j = simpan.indexOf(pid);
                        if (j >= 0) {
                            const alok = bagi(paguSimpan[j], rows.map(x => +x.r.pagu));
                            rows.forEach((x, i) => pindah(x, b.target.key, alok[i], `MAK ${x.r.mak} → ${b.target.key}; pagu disusun ulang Rp${fmt(alok[i])}`));
                            const u = getUbah(byId.get(pid)); u.sumber.add('susun');
                            if (cfgB.metode) u.override.metode = cfgB.metode;
                            if (cfgB.nama && cfgB.nama[pid]) u.override.nama = cfgB.nama[pid];
                            // lokasi paket yang digabung ikut ke paket yang dipertahankan
                            const lain = ids.filter(i => !simpan.includes(i)).map(i => byId.get(i));
                            const lok = [...(byId.get(pid).lokasiRaw || []), ...lain.flatMap(q => q.lokasiRaw || [])];
                            const uniq = []; const seen = new Set();
                            for (const l of lok) { const kk = `${l.id_provinsi}|${l.id_kabupaten}`; if (!seen.has(kk)) { seen.add(kk); uniq.push({ ...l, id: '' }); } }
                            if (uniq.length > (byId.get(pid).lokasiRaw || []).length) u.override.lokasiRaw = uniq;
                        } else {
                            const p = byId.get(pid);
                            if (p.status === '2') { if (fdOpt !== 'biarkan') batalFD.push({ paketId: p.id, nama: p.nama, pagu: +p.pagu, alasan: 'Disusun ulang sesuai DIPA revisi terakhir', sumber: id }); continue; }
                            const u = getUbah(p); u.sumber.add('susun');
                            for (const x of rows) { const row = rowOf(u, x.r); if (row) row.pagu = 0; }
                            u.catatan.push(`Digabung ke paket yang dipertahankan (${simpan.join(', ')})`);
                        }
                    }
                }
            }
            // item target yang belum punya paket (mis. "Perencanaan") → dipakai menamai paket baru
            for (const b of buckets) if (!b.rows.length) for (const i of b.items) {
                if (!itemTanpaPaket.has(b.target.key)) itemTanpaPaket.set(b.target.key, new Set());
                itemTanpaPaket.get(b.target.key).add(i.iid);
            }
        }

        // ── 3. Kelebihan pada MAK yang sama ──────────────────────────────
        const targetPindah = new Set(kartu.filter(k => k.jenis === 'PINDAH').flatMap(k => k.target));
        for (const a of [...akunMap.values()].sort((x, y) => x.key.localeCompare(y.key))) {
            if (a.P <= 0) continue;   // tujuan pindah MAK tetap dicek: kelebihan yang sudah ada sebelum pemindahan
            const lebih = a.rupU - a.P;
            // kelebihan sekecil apa pun dipotong: RUP di atas pagu DIPA membuat IKU > 100% (dikurangkan dari capaian)
            if (lebih <= TOL) continue;
            const refs = a.rup.filter(r => r.status === '3');
            const ids = [...new Set(refs.map(r => r.paketId))].filter(i => byId.has(i) && isU(byId.get(i)));
            if (!ids.length) continue;
            const paket = ids.map(i => { const p = byId.get(i); return { paketId: i, nama: p.nama, pagu: +p.pagu, diMak: sum(rowsOf(p).filter(r => r.mak === a.key), r => +r.pagu), umum: isUmum(p, a.key, akunMap, nodes) }; });
            const ganda = [];
            for (let i = 0; i < paket.length; i++) for (let j = i + 1; j < paket.length; j++)
                if (jaccard(tokens(paket[i].nama), tokens(paket[j].nama)) >= 0.6 || Math.abs(paket[i].diMak - paket[j].diMak) <= TOL) ganda.push([paket[i].paketId, paket[j].paketId]);
            const id = 'lebih:' + a.key;
            const k = kartuBaru({ id, jenis: 'LEBIH', judul: `${bersih(a.nama)} · ${a.key}`, akun: a.akun, mak: a.key,
                ringkas: `RUP terumumkan Rp${fmt(a.rupU)} di ${ids.length} paket, pagu pengadaan DIPA Rp${fmt(a.P)} (lebih Rp${fmt(lebih)})${ganda.length ? ' · kemungkinan paket ganda' : ''}`,
                lebih, paket, ganda,
                opsi: [
                    { id: 'potong', label: 'Potong kelebihan', ket: 'Dikurangi dari baris MAK terbesar lebih dulu', dampak: -lebih },
                    ...paket.map(x => ({ id: 'batal:' + x.paketId, label: `Batalkan ${x.paketId}`, ket: `${x.nama} (Rp${fmt(x.diMak)} di MAK ini)`, dampak: -x.diMak })),
                    { id: 'biarkan', label: 'Biarkan', ket: 'Tidak diubah', dampak: 0 }] }, lebih < BESAR ? 'potong' : null);
            if (k.pilihan === 'potong') {
                let sisa = lebih;
                const rows = ids.flatMap(i => { const u = getUbah(byId.get(i)); return u.rows.filter(r => r.mak === a.key && r.pagu > 0).map(r => ({ u, r })); }).sort((x, y) => y.r.pagu - x.r.pagu);
                for (const { u, r } of rows) {
                    if (sisa <= TOL) break;
                    const cut = Math.min(r.pagu, sisa);
                    r.pagu -= cut; sisa -= cut; addRup(a.key, -cut);
                    u.sumber.add('lebih'); u.catatan.push(`${a.key}: pagu dikurangi Rp${fmt(cut)} (RUP melebihi pagu pengadaan DIPA)`);
                }
            } else if (k.pilihan && k.pilihan.startsWith('batal:')) {
                const p = byId.get(k.pilihan.slice(6));
                if (p) {
                    const u = getUbah(p); u.sumber.add('lebih');
                    for (const r of u.rows) if (r.mak === a.key) { addRup(a.key, -r.pagu); r.pagu = 0; }
                    u.catatan.push(`Dikeluarkan dari ${a.key}: RUP melebihi pagu pengadaan DIPA (kemungkinan paket ganda)`);
                }
            } else if (k.pilihan == null) for (const i of ids) paketTertahan.add(i);
        }

        // ── 4. Item "perlu dicek" (keputusan diterapkan saat buildDipa) ──
        const cek = new Map();
        for (const a of akunMap.values()) for (const i of a.items) {
            const al = i.cekAsal || (i.kelas === 'CEK' ? i.alasan : null);
            if (!al) continue;
            if (!cek.has(al)) cek.set(al, { alasan: al, total: 0, n: 0, akun: new Set(), kelas: i.kelas });
            const c = cek.get(al); c.total += i.pagu; c.n++; c.akun.add(a.key);
        }
        for (const c of cek.values()) {
            const id = 'cek:' + c.alasan;
            const d = kep[id] || {};
            kartu.push({ id, jenis: 'CEK', judul: `Perlu dicek · ${c.alasan.split(' — ')[0].split(' (')[0]}`, ringkas: `${c.n} item di ${c.akun.size} akun, Rp${fmt(c.total)}. ${c.alasan}`,
                total: c.total, akun: [...c.akun], pilihan: d.opsi != null ? d.opsi : null, diputuskan: d.opsi != null, otomatis: false, param: d,
                opsi: [
                    { id: 'P', label: 'Hitung sebagai pengadaan', ket: 'Masuk pagu pengadaan; kekurangan RUP ikut diusulkan', dampak: null },
                    { id: 'NP', label: 'Non-pengadaan', ket: 'Tidak perlu RUP; paket yang memuatnya ikut dikeluarkan', dampak: null }] });
        }

        // ── 5. Final draft ───────────────────────────────────────────────
        const umumkan = [], fdMasalah = [];
        const dalamGrup = new Set([...grup.values()].flatMap(g => g.rows.map(x => x.p.id)));
        for (const p of FD.slice().sort((a, b) => b.pagu - a.pagu)) {
            if (dalamGrup.has(p.id)) continue;
            const rows = rowsOf(p);
            const masalah = [];
            for (const r of rows) {
                const kls = kelasRow(r);
                if (kls === 'NP') masalah.push(`${r.mak} non-pengadaan`);
                else if (kls === 'CEK') masalah.push(`${r.mak} masih "perlu dicek"`);
                else if (kls === 'P') { const a = akunMap.get(r.mak); if (rup.get(r.mak) + +r.pagu > a.P + TOL) masalah.push(`${r.mak} sudah penuh (RUP Rp${fmt(rup.get(r.mak))} dari pagu Rp${fmt(a.P)})`); }
            }
            if (!rows.length) masalah.push('tanpa baris anggaran');
            if (masalah.length) fdMasalah.push({ paketId: p.id, nama: p.nama, pagu: +p.pagu, masalah });
            else { umumkan.push({ id: 'u:' + p.id, paketId: p.id, nama: p.nama, pagu: +p.pagu, pilih: true }); for (const r of rows) addRup(r.mak, +r.pagu); }
        }
        if (fdMasalah.length) {
            const d = kep.fd || {};
            const pil = d.pilih || {};
            kartu.push({ id: 'fd', jenis: 'FD', judul: 'Final draft bermasalah', ringkas: `${fdMasalah.length} final draft Rp${fmt(sum(fdMasalah, x => x.pagu))} tidak bisa diumumkan apa adanya`,
                daftar: fdMasalah.map(x => ({ ...x, pilihan: pil[x.paketId] || 'biarkan' })), pilihan: 'per-paket', diputuskan: true, otomatis: d.pilih == null, param: d,
                opsi: [{ id: 'biarkan', label: 'Biarkan' }, { id: 'kembalikan', label: 'Kembalikan ke PPK' }] });
            for (const x of fdMasalah) if (pil[x.paketId] === 'kembalikan') batalFD.push({ paketId: x.paketId, nama: x.nama, pagu: x.pagu, alasan: x.masalah.join('; '), sumber: 'fd' });
        }

        // ── 6. Kekurangan: tambah pagu paket umum, paket baru, atau abaikan ──
        const kekurangan = [], sisaKecil = [], tertahan = [], butuhBaru = [];
        const dibatalkan = id => { const u = ubah.get(id); return u && u.rows.every(r => r.pagu <= 0); };
        for (const a of [...akunMap.values()].sort((x, y) => x.key.localeCompare(y.key))) {
            if (a.P <= 0) continue;
            const sisa = a.P - rup.get(a.key);
            if (sisa <= TOL) continue;
            if (blok.has(a.key)) { tertahan.push({ mak: a.key, nama: a.nama, sisa, alasan: 'menunggu keputusan kartu MAK lama' }); continue; }
            const o = atur[a.key] || {};
            // paket terumumkan yang punya baris MAK ini (setelah rencana)
            const kand = U.filter(p => !dibatalkan(p.id) && !paketTertahan.has(p.id) && (ubah.has(p.id) ? ubah.get(p.id).rows : rowsOf(p)).some(r => r.mak === a.key && r.pagu > 0))
                .map(p => ({ paketId: p.id, nama: p.nama, pagu: +p.pagu, umum: isUmum(p, a.key, akunMap, nodes),
                    diMak: sum((ubah.has(p.id) ? ubah.get(p.id).rows : rowsOf(p)).filter(r => r.mak === a.key), r => +r.pagu) }))
                .sort((x, y) => (y.umum - x.umum) || (y.diMak - x.diMak));
            let cara = o.cara || (sisa <= AMBANG ? 'abaikan' : (kand.length && kand[0].umum ? 'tambah' : 'baru'));
            let paketId = o.paketId && kand.some(x => x.paketId === o.paketId) ? o.paketId : (kand[0] || {}).paketId;
            if (cara === 'tambah' && !paketId) cara = 'baru';
            const real = sum(a.items.filter(i => i.kelas === 'P'), i => i.realisasi || 0);
            const x = { id: 'k:' + a.key, mak: a.key, nama: a.nama, P: a.P, rup: rup.get(a.key), sisa, cara, paketId, kandidat: kand, realisasi: a.P ? real / a.P : 0 };
            kekurangan.push(x);
            if (cara === 'abaikan') { sisaKecil.push({ mak: a.key, nama: a.nama, sisa, alasan: sisa <= AMBANG ? `di bawah ambang Rp${fmt(AMBANG)}` : 'diabaikan' }); continue; }
            if (cara === 'tambah') {
                const u = getUbah(byId.get(paketId));
                const row = u.rows.filter(r => r.mak === a.key).sort((p, q) => q.pagu - p.pagu)[0];
                row.pagu += sisa; addRup(a.key, sisa);
                u.sumber.add('tambah'); u.catatan.push(`${a.key}: pagu ditambah Rp${fmt(sisa)} (DIPA pengadaan Rp${fmt(a.P)})`);
                continue;
            }
            butuhBaru.push({ a, sisa });
        }

        // ── 7. Paket baru (dikelompokkan) ────────────────────────────────
        const grupBaru = new Map();
        const modeGrup = cfg.grupPaketBaru || 'sub';
        for (const { a, sisa } of butuhBaru) {
            const teks = a.items.filter(i => i.kelas === 'P').map(i => `${i.grup} ${i.uraian}`).join(' ');
            const jenis = Classify.saranJenis(a.akun, teks);
            const khusus = MEETING.test(a.akun) ? '|meeting' : '';
            const key = modeGrup === 'akun' ? a.key : `${seg(a.key, modeGrup === 'komp' ? 5 : 6)}|${jenis}${khusus}`;
            if (!grupBaru.has(key)) grupBaru.set(key, { key, jenis, akun: [] });
            grupBaru.get(key).akun.push({ a, sisa });
        }
        const paketBaru = [];
        for (const g of [...grupBaru.values()].sort((x, y) => x.key.localeCompare(y.key))) paketBaru.push(buatPaketBaru(g));

        function buatPaketBaru(g) {
            const first = g.akun[0].a;
            const total = sum(g.akun, x => x.sisa);
            const anggaran = g.akun.flatMap(x => anggaranPerDana(x.a, x.sisa));
            // item yang diwakili: item pengadaan yang belum tercakup nama paket existing di MAK yang sama
            const items = [];
            for (const { a } of g.akun) {
                const P = a.items.filter(i => i.kelas === 'P');
                const khusus = itemTanpaPaket.get(a.key);
                let pilih = khusus ? P.filter(i => khusus.has(i.iid)) : P;
                if (!khusus) {
                    const nm = a.rup.filter(r => r.status === '3').map(r => tokens(r.nama));
                    const bebas = P.filter(i => { const ti = tokens(`${i.grup} ${i.uraian}`); return !nm.some(t => jaccard(t, ti) >= 0.5); });
                    if (bebas.length) pilih = bebas;
                }
                items.push(...pilih.map(i => ({ ...i, akun: a.key })));
            }
            items.sort((x, y) => y.pagu - x.pagu);
            const subK = seg(first.key, 6), kompK = seg(first.key, 5);
            const sub = nodes.get(subK) || {}, komp = nodes.get(kompK) || {};
            const tempat = modeGrup === 'komp' ? (komp.uraian || sub.uraian || '') : (sub.uraian || komp.uraian || '');
            const dom = items[0] ? bersihNama(items[0].uraian) : bersihNama(first.nama);
            const tempat2 = tempat || bersih(first.nama) || seg(first.key, 6);
            // tanda baca ASCII saja: teks RUP ikut diekspor ke sistem lain (SPSE, unduhan Excel)
            const nama = potong(`${dom}${tempat2 && tempat2 !== dom ? ' - ' + tempat2 : ''}`.trim(), 250);
            const daftar = items.map(i => `- ${i.grup ? bersih(i.grup) + ' > ' : ''}${bersih(i.uraian)}`);
            const uraian = potong(`${LABEL_JENIS[g.jenis] || 'Pengadaan'} untuk ${tempat || first.nama}${komp.uraian && komp.uraian !== tempat ? ' pada ' + komp.uraian : ''}.\n${daftar.join('\n')}`, 1000);
            const spekBaris = items.map(i => `- ${bersih(i.uraian)}${i.volume ? ': ' + i.volume.replace(/\s+/g, ' ') : ''}${i.harga ? ' x Rp' + fmt(i.harga) : ''}`);
            let spesifikasi = '';
            for (let n = 0; n < spekBaris.length; n++) {
                const next = spesifikasi + (spesifikasi ? '\n' : '') + spekBaris[n];
                const tail = n + 1 < spekBaris.length ? `\n(+${spekBaris.length - n - 1} item lain)` : '';
                if ((next + tail).length > 1000) { spesifikasi += `\n(+${spekBaris.length - n} item lain)`; break; }
                spesifikasi = next;
            }
            const akunUtama = g.akun.slice().sort((x, y) => y.sisa - x.sisa)[0].a.akun;
            const metode = Classify.saranMetode(g.jenis, total, akunUtama, items.map(i => `${i.grup} ${i.uraian}`).join(' '), cfg);
            const realP = sum(g.akun, x => sum(x.a.items.filter(i => i.kelas === 'P'), i => i.realisasi || 0));
            const paguP = sum(g.akun, x => x.a.P);
            const realisasi = paguP ? realP / paguP : 0;
            // paket saudara (terumumkan, sub-komponen lalu komponen yang sama) → lokasi & jadwal
            const saudara = cariSaudara(first.key, g.jenis);
            const jd = saudara.find(s => jadwalPaket(s));
            let jadwal, jadwalSumber;
            if (jd) { jadwal = jadwalPaket(jd); jadwalSumber = `ikut paket ${jd.id} (${potong(jd.nama, 50)})`; }
            else {
                const mulai = realisasi > 0 ? `${TA}-01` : clampYm(ymAdd(ymNow(), 1), TA);
                jadwal = rapikanJadwal({ awalPengadaan: mulai, akhirPengadaan: mulai, awalPekerjaan: mulai, akhirPekerjaan: `${TA}-12`, awalKebutuhan: mulai, kebutuhan: `${TA}-12` });
                jadwalSumber = realisasi > 0 ? 'mulai Januari karena sudah ada realisasi' : 'mulai bulan depan';
            }
            const lok = saranLokasi(first.key, saudara);
            const peringatanP = [];
            if (realisasi >= 0.5 && /Tender|Seleksi/.test(metode)) peringatanP.push(`Sudah terealisasi ${Math.round(realisasi * 100)}% tetapi metode ${metode} — cek cara pengadaan yang sudah berjalan`);
            if (anggaran.some(r => SD_BELUM_DIUJI.has(r.danaApbn))) peringatanP.push('Sumber dana PLN/SBSN belum pernah diuji lewat tool ini — isi manual di SiRUP');
            if (!lok.lokasiRaw.length) peringatanP.push('Lokasi belum bisa ditentukan — atur lokasi satker di Pengaturan');
            return {
                id: 'b:' + g.key, baru: true, grupKey: g.key, akun: g.akun.map(x => x.a.key), nama, anggaran, jenis: g.jenis, metode,
                uraian, spesifikasi, volume: '1 Paket', praDipa: false, pdn: true, umkm: total <= 15e9, spp: { ekonomi: true, sosial: true, lingkungan: false },
                lokasiRaw: lok.lokasiRaw, lokasiSumber: lok.sumber, lokasiTeks: lok.teks, jadwal, jadwalSumber, realisasi, items: items.length,
                total, pilih: !anggaran.some(r => SD_BELUM_DIUJI.has(r.danaApbn)), peringatan: peringatanP,
            };
        }
        function anggaranPerDana(a, pagu) {
            const parts = Object.entries(a.PbySd || { '': pagu }).filter(([, v]) => v > 0);
            const bobot = parts.map(([, v]) => v);
            const alok = parts.length > 1 ? bagi(pagu, bobot) : [pagu];
            return parts.map(([sd], i) => ({ mak: a.key, pagu: alok[i], danaApbn: SD_CODE[sd] || 'A', sd: sd || '', idLama: '' })).filter(r => r.pagu > 0);
        }
        function cariSaudara(mak, jenis) {
            const sub = seg(mak, 6) + '.', komp = seg(mak, 5) + '.', keg = seg(mak, 2) + '.';
            const skor = p => { const rs = rowsOf(p); const s = rs.some(r => r.mak.startsWith(sub)) ? 3 : rs.some(r => r.mak.startsWith(komp)) ? 2 : rs.some(r => r.mak.startsWith(keg)) ? 1 : 0; return s * 2 + (jenisPaket(p) === jenis ? 1 : 0); };
            return U.filter(p => skor(p) >= 4).sort((x, y) => skor(y) - skor(x) || (+y.pagu) - (+x.pagu));
        }
        function saranLokasi(mak, saudara) {
            const kro = nodes.get(seg(mak, 3)) || {};
            const teks = kro.lokasi || '';
            const satker = ctx.lokasiSatker && ctx.lokasiSatker.id_kabupaten ? ctx.lokasiSatker : null;
            if (teks && ctx.lokasiRkk && ctx.lokasiRkk[teks]) {
                const l = ctx.lokasiRkk[teks];
                const sdr = saudara.flatMap(s => s.lokasiRaw || []).find(x => +x.id_kabupaten === +l.id_kabupaten && x.detil);
                const detil = (satker && +satker.id_kabupaten === +l.id_kabupaten && satker.detil) || (sdr && sdr.detil) || (satker && satker.detil) || ctx.namaSatker || '';
                return { lokasiRaw: [{ id: '', id_provinsi: l.id_provinsi, id_kabupaten: l.id_kabupaten, detil, prov: l.prov, kab: l.kab }], sumber: `lokasi KRO di RKK (${teks})`, teks };
            }
            // lokasi paket saudara yang sama provinsi dengan satker (lokasi janggal tidak ditiru)
            for (const s of saudara) {
                const ls = (s.lokasiRaw || []).filter(l => l.id_kabupaten && l.detil);
                if (!ls.length) continue;
                if (satker && ls.some(l => +l.id_provinsi !== +satker.id_provinsi)) continue;
                return { lokasiRaw: ls.map(l => ({ ...l, id: '' })), sumber: `ikut paket ${s.id}`, teks };
            }
            if (satker) return { lokasiRaw: [{ id: '', id_provinsi: satker.id_provinsi, id_kabupaten: satker.id_kabupaten, detil: satker.detil, prov: satker.prov, kab: satker.kab }], sumber: 'lokasi satker (Pengaturan)', teks };
            return { lokasiRaw: [], sumber: '', teks };
        }
        function ymNow() { const d = ctx.hariIni || new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
        function clampYm(y, ta) { return y < `${ta}-01` ? `${ta}-01` : y > `${ta}-12` ? `${ta}-12` : y; }

        // peringatan pemecahan paket: ≥2 paket PL sejenis di satu sub-komponen, total > batas PL
        const batasPL = j => j === 'Pekerjaan Konstruksi' ? cfg.plKonstruksi : j === 'Jasa Konsultansi' ? cfg.plKonsultansi : cfg.plBarjas;
        for (const pb of paketBaru) {
            if (pb.metode !== 'Pengadaan Langsung') continue;
            const subs = new Set(pb.anggaran.map(r => seg(r.mak, 6)));
            const sejenis = [...paketBaru.filter(x => x !== pb && x.metode === 'Pengadaan Langsung' && x.jenis === pb.jenis && x.anggaran.some(r => subs.has(seg(r.mak, 6)))).map(x => x.total),
                ...U.filter(p => /Pengadaan Langsung/.test(p.metode || '') && jenisPaket(p) === pb.jenis && rowsOf(p).some(r => subs.has(seg(r.mak, 6)))).map(p => +p.pagu)];
            const tot = pb.total + sum(sejenis);
            if (sejenis.length && tot > batasPL(pb.jenis)) pb.peringatan.push(`Ada ${sejenis.length} paket Pengadaan Langsung ${pb.jenis.toLowerCase()} lain di sub-komponen ini (total Rp${fmt(tot)} > batas PL) — pastikan bukan pemecahan paket`);
        }

        // ── 8. Titipan: paket existing yang direvisi satu ke banyak ─────────
        const maxPer = cfg.maxPaketPerRevisi || 15;
        const eligible = p => isU(p) && !dibatalkan(p.id) && !paketTertahan.has(p.id) && !rowsOf(p).some(r => SD_BELUM_DIUJI.has(r.danaApbn))
            && !(ubah.get(p.id) && ubah.get(p.id).umumkanDulu && p.status !== '3');
        const muat = new Map();   // hostId → jumlah paket baru
        const titip = new Map();  // hostId → [paketBaru]
        const tier = (p, mak) => {
            const rs = (ubah.has(p.id) ? ubah.get(p.id).rows.filter(r => r.pagu > 0) : rowsOf(p));
            const lvl = rs.some(r => r.mak.startsWith(seg(mak, 5) + '.')) ? 0 : rs.some(r => r.mak.startsWith(seg(mak, 2) + '.')) ? 2 : rs.some(r => r.mak.startsWith(seg(mak, 1) + '.')) ? 4 : 6;
            return lvl + (ubah.has(p.id) ? 0 : 1) + (/Dikecualikan/.test(p.metode || '') ? 0.5 : 0);
        };
        for (const pb of paketBaru) {
            const mak = pb.anggaran[0] ? pb.anggaran[0].mak : pb.akun[0];
            const pilihan = U.filter(eligible).filter(p => (muat.get(p.id) || 0) < maxPer)
                .map(p => ({ p, t: tier(p, mak) })).sort((x, y) => x.t - y.t || (+x.p.pagu) - (+y.p.pagu));
            const o = (atur[pb.id] || {}).host;
            const host = (o && pilihan.find(x => x.p.id === o)) || pilihan[0];
            pb.kandidatHost = pilihan.slice(0, 8).map(x => ({ paketId: x.p.id, nama: x.p.nama, tier: x.t }));
            if (!host) { pb.hostId = null; pb.pilih = false; pb.peringatan.push('Tidak ada paket terumumkan yang bisa dititipi — minta PPK membuat satu paket dulu'); continue; }
            pb.hostId = host.p.id;
            pb.hostKet = host.t < 2 ? 'komponen yang sama' : host.t < 4 ? 'kegiatan yang sama' : host.t < 6 ? 'program yang sama' : 'komponen lain';
            muat.set(host.p.id, (muat.get(host.p.id) || 0) + 1);
            if (!titip.has(host.p.id)) titip.set(host.p.id, []);
            titip.get(host.p.id).push(pb);
        }

        // ── 9. Susun daftar perubahan ────────────────────────────────────
        const ALASAN = { np: 'mengeluarkan belanja non-pengadaan', pindah: 'penyesuaian MAK dengan DIPA revisi terakhir', lebih: 'penyesuaian pagu dengan pagu pengadaan DIPA',
            tambah: 'penambahan pagu sesuai DIPA revisi terakhir', susun: 'penyusunan ulang paket sesuai DIPA revisi terakhir', dana: 'penyesuaian sumber dana dengan DIPA' };
        const perubahan = [];
        for (const u of ubah.values()) {
            const p = u.paket;
            const sesudah = u.rows.filter(r => r.pagu > 0);
            const asal = rowsOf(p);
            const sig = rs => rs.map(r => `${r.mak}|${Math.round(r.pagu)}|${r.danaApbn || 'A'}`).sort().join(';');
            const tetap = sig(sesudah) === sig(asal.map(r => ({ mak: r.mak, pagu: +r.pagu, danaApbn: r.danaApbn || 'A' })));
            if (tetap && !u.sumber.has('susun') && !Object.keys(u.override).length) continue;
            const batal = !sesudah.length;
            if (batal && p.status === '2') { if (!batalFD.some(x => x.paketId === p.id)) batalFD.push({ paketId: p.id, nama: p.nama, pagu: +p.pagu, alasan: 'Tidak ada MAK DIPA yang tersisa', sumber: 'susun' }); continue; }
            const label = [...u.sumber].map(s => ({ np: 'keluarkan non-pengadaan', pindah: 'pindah MAK', lebih: 'potong kelebihan', tambah: 'tambah pagu', susun: 'susun ulang', dana: 'sumber dana' }[s]));
            const pk = batal ? null : Object.assign(pkDari(p, sesudah, cfg), u.override);
            const ch = {
                id: 'p:' + p.id, paketId: p.id, nama: p.nama, status: p.status, jenis: batal ? 'batal' : 'ubah', umumkanDulu: p.status === '2',
                label: batal ? ['batalkan', ...label] : label, catatan: u.catatan, sebelum: +p.pagu, sesudah: sum(sesudah, r => r.pagu),
                rowsSebelum: asal.map(r => ({ mak: r.mak, pagu: +r.pagu, danaApbn: r.danaApbn })), rowsSesudah: sesudah.map(r => ({ mak: r.mak, pagu: r.pagu, danaApbn: r.danaApbn, dari: r.dari })),
                alasan: 'Revisi: ' + [...u.sumber].map(s => ALASAN[s]).filter(Boolean).join('; '),
                pk, pilih: true, peringatan: [], titipanHost: titip.has(p.id),
            };
            if (asal.some(r => SD_BELUM_DIUJI.has(r.danaApbn))) { ch.pilih = false; ch.peringatan.push('Memuat sumber dana PLN/SBSN — belum pernah diuji lewat tool ini'); }
            if (pk) {
                if (pk.umkm && ch.sesudah > 15e9) { pk.umkm = false; ch.peringatan.push('Pagu > Rp15 M: penanda usaha kecil dilepas'); }
                const bj = batasPL(pk.jenis);
                if (/Pengadaan Langsung/.test(pk.metode) && ch.sesudah > bj && ch.sebelum <= bj) ch.peringatan.push(`Pagu naik melewati batas Pengadaan Langsung (Rp${fmt(bj)}) — cek metode`);
                if (!pk.jadwal) ch.peringatan.push('Jadwal paket tidak terbaca — isi manual');
                if ((p.jenisRaw || []).length > 1 && !pk.jenisList) ch.peringatan.push('Paket ini punya lebih dari satu jenis pengadaan; setelah pagu berubah dikirim sebagai satu jenis — cek');
                if (ctx.lokasiSatker && ctx.lokasiSatker.id_provinsi && (pk.lokasiRaw || []).length && pk.lokasiRaw.every(l => +l.id_provinsi !== +ctx.lokasiSatker.id_provinsi))
                    ch.lokasiLain = true;
            }
            perubahan.push(ch);
        }
        perubahan.sort((a, b) => a.paketId.localeCompare(b.paketId));

        const titipan = [...titip.entries()].map(([hostId, pbs]) => {
            const host = byId.get(hostId);
            const ch = perubahan.find(c => c.paketId === hostId && c.jenis === 'ubah');
            return { id: 't:' + hostId, hostId, nama: host.nama, pagu: +host.pagu, draft1: ch ? 'koreksi' : 'tetap', perubahanId: ch ? ch.id : null,
                paketBaru: pbs.map(x => x.id), pk1: Object.assign(pkDari(host, rowsOf(host).map(r => ({ idLama: r.id || '', mak: r.mak, pagu: +r.pagu, danaApbn: r.danaApbn || 'A', sumber: r.sumber, ta: r.ta, idKomponen: r.idKomponen,
                    asal: r.asal, asalSatker: r.asalSatker, kodeInstansi: r.kodeInstansi, kodeEselon: r.kodeEselon, kodeSatker: r.kodeSatker })), cfg), { pertahankan: true }), pilih: true };
        });

        if (U.some(p => rowsOf(p).some(r => r.danaApbn && r.danaApbn !== 'A')) && ![...akunMap.values()].some(a => (a.sd || []).length))
            peringatan.push('Satker ini memakai sumber dana selain RM, tetapi data DIPA tidak memuat sumber dana per akun (FA Detail). Unggah juga RKK supaya paket baru mendapat sumber dana yang benar; tanpa itu paket baru diisi RM.');

        const r = { kartu, perubahan, paketBaru, titipan, umumkan, batalFD, kekurangan, sisaKecil, tertahan, peringatan,
            target: sum([...akunMap.values()], a => a.P), sekarang: sum(U, p => +p.pagu), rupSetelah: Object.fromEntries(rup) };
        r.proyeksi = proyeksi(r);
        return r;
    }

    // Satu kelompok MAK lama → bagian (bucket) pembanding: per akun tujuan bila tujuannya >1;
    // bila tujuannya 1, per jenis pengadaan item DIPA, lalu dipadankan ke item lewat nama paket.
    function bucketize(rows, targets, rupNow) {
        const rupT = t => (rupNow ? rupNow(t.key) : t.rupU);
        const tokN = s => tokens(s);
        if (targets.length > 1) {
            const bs = targets.map((t, i) => ({ id: 'b' + i, label: t.key, jenis: '', target: t, items: t.items.filter(x => x.kelas === 'P'), dipa: t.P, sisa: Math.max(0, t.P - rupT(t)), rows: [] }));
            const isi = new Map(bs.map(b => [b, 0]));
            for (const x of rows.slice().sort((a, b) => b.r.pagu - a.r.pagu)) {
                const b = bs.slice().sort((p, q) => (q.sisa - isi.get(q)) - (p.sisa - isi.get(p)))[0];
                b.rows.push(x); isi.set(b, isi.get(b) + +x.r.pagu);
            }
            return bs;
        }
        const t = targets[0];
        const items = t.items.filter(i => i.kelas === 'P');
        const jenisItem = i => Classify.saranJenis(t.akun, `${i.grup || ''} ${i.uraian}`);
        const byJ = new Map();
        for (const i of items) { const j = jenisItem(i); if (!byJ.has(j)) byJ.set(j, { items: [], rows: [] }); byJ.get(j).items.push(i); }
        const semua = () => [{ id: 'b0', label: bersih(t.nama) || t.key, jenis: '', target: t, items, dipa: t.P, rows: rows.slice() }];
        let buckets;
        if (!rows.every(x => byJ.has(jenisPaket(x.p)))) buckets = semua();
        else {
            for (const x of rows) byJ.get(jenisPaket(x.p)).rows.push(x);
            buckets = [];
            for (const [j, g] of byJ) {
                if (g.items.length === 1 || !g.rows.length) { buckets.push({ jenis: j, items: g.items, rows: g.rows }); continue; }
                // Padankan paket ke item: kata yang membedakan antar-item (IDF antar-item), diberi bobot
                // menurut posisi di nama paket — kata jenis pekerjaan ada di depan ("Konsultan Pengawas …").
                const itemTok = g.items.map(i => tokN(`${i.grup || ''} ${i.uraian}`));
                const dfI = new Map(); for (const d of itemTok) for (const tk of d) dfI.set(tk, (dfI.get(tk) || 0) + 1);
                const idf = tk => Math.log((g.items.length + 1) / ((dfI.get(tk) || 0) + 0.5));
                const sub = new Map(g.items.map(i => [i.iid, { jenis: j, items: [i], rows: [] }]));
                const lepas = [];
                for (const x of g.rows) {
                    const urut = [...tokN(x.p.nama)];
                    const skor = g.items.map((i, n) => urut.reduce((s2, tk, pos) => s2 + (itemTok[n].has(tk) ? idf(tk) / (1 + pos) : 0), 0));
                    const order = skor.map((v, n) => [v, n]).sort((a, b) => b[0] - a[0]);
                    const [b1, b2] = [order[0], order[1] || [0, -1]];
                    if (b1[0] > 0 && b1[0] >= 1.5 * b2[0]) sub.get(g.items[b1[1]].iid).rows.push(x); else lepas.push(x);
                }
                if (lepas.length) buckets.push({ jenis: j, items: g.items, rows: g.rows }); // tak bisa dipadankan → satu bagian per jenis
                else buckets.push(...sub.values());
            }
        }
        const totalDipa = sum(buckets, b => sum(b.items, i => i.pagu));
        return buckets.map((b, i) => {
            const dipa = b.dipa != null ? b.dipa : sum(b.items, x => x.pagu);
            const ada = totalDipa ? rupT(t) * dipa / totalDipa : 0; // RUP yang sudah ada di akun tujuan, dibagi sebanding
            return { id: b.id || 'b' + i, label: b.label || (b.items.length === 1 ? bersih(b.items[0].uraian) : b.jenis), jenis: b.jenis, target: t, items: b.items, dipa, sisa: Math.max(0, dipa - ada), rows: b.rows };
        });
    }
    function paketGrup(rows) {
        const m = new Map();
        for (const x of rows) {
            const o = m.get(x.p.id) || { paketId: x.p.id, nama: x.p.nama, status: x.p.status, jenis: jenisPaket(x.p), metode: x.p.metode || '', pagu: +x.p.pagu, diGrup: 0 };
            o.diGrup += +x.r.pagu; m.set(x.p.id, o);
        }
        return [...m.values()].sort((a, b) => b.diGrup - a.diGrup);
    }

    // Proyeksi RUP terumumkan untuk pilihan saat ini (pilih = Map id→bool, default dari rencana)
    function proyeksi(r, pilih) {
        const on = x => (pilih && pilih.has(x.id)) ? pilih.get(x.id) : x.pilih !== false;
        let v = r.sekarang;
        const rinci = { ubah: 0, batal: 0, baru: 0, umumkan: 0 };
        for (const c of r.perubahan) {
            if (!on(c)) continue;
            if (c.jenis === 'batal') { v -= c.sebelum; rinci.batal -= c.sebelum; }
            else { const d = c.sesudah - (c.umumkanDulu ? 0 : c.sebelum); v += d; rinci.ubah += d; }
        }
        for (const pb of r.paketBaru) if (on(pb) && pb.hostId && (!pilih || !pilih.has('t:' + pb.hostId) || pilih.get('t:' + pb.hostId))) { v += pb.total; rinci.baru += pb.total; }
        for (const u of r.umumkan) if (on(u)) { v += u.pagu; rinci.umumkan += u.pagu; }
        return { sekarang: r.sekarang, setelah: v, target: r.target, rinci };
    }

    // Pemeriksaan isian sebelum dikirim (aturan form paket SiRUP)
    function periksa(pk, ctx) {
        const err = [];
        if (pk.pertahankan) return err;
        const ymOk = s => /^\d{4}-\d{2}$/.test(s || '');
        if (!pk.nama || !pk.nama.trim()) err.push('nama paket kosong');
        else if (pk.baru && pk.nama.trim().length < 5) err.push('nama paket terlalu pendek');
        const tot = sum(pk.anggaran, a => +a.pagu || 0);
        if (tot <= 0) err.push('pagu 0');
        for (const a of pk.anggaran) {
            if (!/^[A-Z]{2}\.\d{4}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\.\d{3}\.[A-Z0-9]{1,2}\.\d{6}$/.test(a.mak)) err.push(`MAK ${a.mak} tidak 7 segmen`);
            if (!(+a.pagu > 0)) err.push(`pagu baris ${a.mak} kosong`);
            if (ctx && ctx.komponenId && !(a.idKomponen || ctx.komponenId(a.mak))) err.push(`komponen ${seg(a.mak, 5)} belum ada di PKKR`);
        }
        if (!pk.lokasiRaw || !pk.lokasiRaw.length) err.push('lokasi belum diisi');
        else if (pk.lokasiRaw.some(l => !l.id_provinsi || !l.id_kabupaten)) err.push('provinsi/kabupaten lokasi belum dipilih');
        else if (pk.lokasiRaw.some(l => !String(l.detil || '').trim())) err.push('detail lokasi kosong');
        else if (pk.lokasiRaw.some(l => String(l.detil || '').length > 1000)) err.push('detail lokasi > 1000 karakter');
        const j = pk.jadwal || {};
        const K = ['awalPengadaan', 'akhirPengadaan', 'awalPekerjaan', 'akhirPekerjaan', 'awalKebutuhan', 'kebutuhan'];
        if (K.some(k => !ymOk(j[k]))) err.push('jadwal belum lengkap');
        else {
            if (j.akhirPengadaan < j.awalPengadaan) err.push('akhir pemilihan sebelum awal pemilihan');
            if (j.awalPekerjaan < j.akhirPengadaan) err.push('awal kontrak sebelum akhir pemilihan');
            if (j.akhirPekerjaan < j.awalPekerjaan) err.push('akhir kontrak sebelum awal kontrak');
            if (j.kebutuhan < j.awalKebutuhan) err.push('akhir pemanfaatan sebelum awal pemanfaatan');
        }
        if (!String(pk.spesifikasi || '').trim()) err.push('spesifikasi kosong');
        else if (String(pk.spesifikasi).length > 1000) err.push(`spesifikasi ${String(pk.spesifikasi).length} karakter (maks. 1000)`);
        if (!String(pk.volume || '').trim()) err.push('volume kosong');
        if (!pk.metode) err.push('metode kosong');
        if (pk.metode === 'Seleksi' && pk.jenis !== 'Jasa Konsultansi') err.push('metode Seleksi hanya untuk jasa konsultansi');
        if (/^Tender/.test(pk.metode) && pk.jenis === 'Jasa Konsultansi') err.push('jasa konsultansi memakai Seleksi, bukan Tender');
        if (pk.umkm && tot > 15e9) err.push('paket > Rp15 M tidak bisa ditandai usaha kecil');
        if (pk.jenisList && Math.abs(sum(pk.jenisList, x => +x.pagu) - tot) > 1) err.push('jumlah pagu per jenis tidak sama dengan total');
        return err;
    }

    return { susun, proyeksi, periksa, isUmum, tokens, jaccard, bagi, ym, rapikanJadwal, jadwalPaket, pkDari, bucketize, SD_BELUM_DIUJI, TOL };
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
    // SiRUP membalas simpan/umumkan dengan 302 ke "http://…" (bukan https). fetch() yang mengikuti
    // redirect itu diblokir browser sebagai mixed content → "Failed to fetch", padahal server sudah
    // memproses. Karena itu POST non-JSON memakai redirect:'manual' dan hasilnya diverifikasi terpisah.
    async function post(url, body, { json = false } = {}) {
        let r;
        try {
            r = await fetch(url, {
                method: 'POST', credentials: 'same-origin', redirect: json ? 'follow' : 'manual',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', ...(json ? { 'X-Requested-With': 'XMLHttpRequest' } : {}) },
                body: body instanceof URLSearchParams ? body.toString() : body,
            });
        } catch (e) { throw new Error(`POST ${url.replace(BASE, '')} gagal di jaringan/browser (${e.message}). Cek apakah sesi SiRUP masih login.`); }
        if (json) {
            if (!r.ok) throw new Error(`POST ${url} → HTTP ${r.status}`);
            return r.json();
        }
        if (r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400)) return { redirected: true, status: 302, text: async () => '' };
        if (!r.ok) throw new Error(`POST ${url.replace(BASE, '')} → HTTP ${r.status}`);
        return { redirected: false, status: r.status, text: () => r.text() };
    }
    // GET yang tidak mengikuti redirect (mis. kajiulangpaket → 302 ke form di http://)
    async function getManual(url) {
        try { return await fetch(url, { credentials: 'same-origin', redirect: 'manual' }); }
        catch (e) { throw new Error(`GET ${url.replace(BASE, '')} gagal (${e.message}).`); }
    }
    // pesan flash SiRUP (kotak alert) pada halaman berikutnya — dipakai untuk membaca alasan penolakan
    async function bacaFlash(url) {
        try {
            const h = await getText(url);
            const d = new DOMParser().parseFromString(h, 'text/html');
            // modal "Syarat dan Ketentuan" ada di setiap halaman → bukan pesan error
            return [...d.querySelectorAll('#alert, .alert-danger, .alert-warning, .alert-success, .alert-info, label.error, span.error, .help-block')]
                .filter(e => !e.closest('#popup, #overlay, .modal'))
                .map(e => e.textContent.replace(/\s+/g, ' ').replace(/^×\s*/, '').trim())
                .filter(t => t && !/Syarat dan Ketentuan|Kebijakan Privasi|Geser Ke Bawah/i.test(t)).join(' | ');
        } catch (e) { return ''; }
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
        // nama peran berbeda antar-instalasi ("PAKPA", "KPA", "PA/KPA", "Kuasa Pengguna Anggaran"); PPK/PP bukan KPA
        ctx.isKPA = /KPA|^PA$|pengguna anggaran/i.test(ctx.role) && !/^(PPK|PP|ADMIN)/i.test(ctx.role);
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
                // Rantai PKKR Manual paralel (cara BPPP Tegal) memakai kode yang sama dengan node
                // Integrasi. Map menyimpan node Integrasi sebagai utama dan salinan Manual di .manualTwin.
                const ada = map.get(node.key);
                if (!ada) map.set(node.key, node);
                else if (ada.manual && !node.manual) { node.manualTwin = ada; map.set(node.key, node); }
                else if (!ada.manualTwin) ada.manualTwin = node;
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
        const rows = (await dt(url)).filter(x => String(x[2]).trim() === kode);
        if (!rows.length) return null;
        const manual = rows.filter(x => { const c = x[x.length - 1]; return !c || c === 'N/A'; });
        const pick = (manual.length ? manual : rows).sort((a, b) => Number(b[0]) - Number(a[0]))[0];
        return String(pick[0]);
    }
    // daftar PPK diambil dari form sub komponen; idKomponen harus id nyata (0 → HTTP 500)
    async function daftarPpk(idKomponen) {
        if (!idKomponen) return [];
        const h = await getText(`${BASE}/programctr/formsubkomponen?idKomponen=${idKomponen}`).catch(() => '');
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
            uraianRaw: j.keterangan || '', spesifikasiRaw: j.spesifikasi || '',
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
    // "KOTA JAKARTA PUSAT" / "KAB. BOGOR" (lokasi KRO di RKK) → {id_provinsi, id_kabupaten, prov, kab} SiRUP.
    // Provinsi petunjuk dicoba lebih dulu; bila tidak ketemu semua provinsi dicari (hasilnya di-cache).
    async function cariKabupaten(teks, provPetunjuk = []) {
        const t = String(teks || '').toUpperCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!t) return null;
        const m = t.match(/^(KOTA ADM(?:INISTRASI)?|KOTA|KABUPATEN ADM(?:INISTRASI)?|KABUPATEN|KAB)\s+(.*)$/);
        const jenis = m ? (/^KOTA/.test(m[1]) ? 'kota' : 'kab') : '';
        const inti = (m ? m[2] : t).toLowerCase();
        const cocok = nama => {
            const n = nama.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
            const mm = n.match(/^(.*?)\s*\((kota|kab)\s*\)?\s*$/);
            const nInti = mm ? mm[1].trim() : n, nJenis = mm ? mm[2] : '';
            return nInti === inti && (!jenis || !nJenis || nJenis === jenis);
        };
        const urut = [...new Set([...provPetunjuk.map(Number).filter(Boolean), ...PROVINSI.map((_, i) => i).filter(Boolean)])];
        for (const pv of urut) {
            const k = (await kabupaten(pv)).find(x => cocok(x.nama));
            if (k) return { id_provinsi: pv, id_kabupaten: k.id, prov: PROVINSI[pv], kab: k.nama };
        }
        return null;
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
        const r = await post(`${BASE}/strukturanggaranctr/simpanstrukturanggaranpusat`, f);
        if (!r.redirected) throw new Error('Struktur anggaran ditolak: ' + (await pesanError(r)));
        const cek = await strukturAnggaran();
        const beda = ['barjas', 'modal', 'sosial', 'hibah', 'lainnya'].filter(k => Math.abs(cek[k] - Math.round(val[k])) > 1);
        if (beda.length) throw new Error('Struktur anggaran tidak berubah sesuai isian (' + beda.join(', ') + '). ' + (await bacaFlash(`${BASE}/strukturanggaranctr/strukturanggarannew`)));
        return cek;
    }

    // ── Umumkan / batal ─────────────────────────────────────────────────
    async function umumkan(ids, jenis = 'penyedia') {
        const f = new URLSearchParams();
        f.append('sData', ids.map(id => `${id}=on`).join('&'));
        f.append('penyediaAtauSwakelola', jenis);
        const r = await post(`${BASE}/rup/umumkan`, f);
        if (!r.redirected) throw new Error('SiRUP tidak menerima permintaan umumkan: ' + (await pesanError(r)));
        return r;
    }
    async function batalFinalDraft(id, alasan, jenis = 'penyedia') {
        const f = new URLSearchParams({ alasan, idPaket: id, penyediaAtauSwakelola: jenis });
        const r = await post(`${BASE}/rup/submitbatalkanfinaldraft`, f);
        if (!r.redirected) throw new Error(`Batal final draft ${id} ditolak: ` + (await pesanError(r)));
        return r;
    }
    async function batalkanPaket(id, alasan, jenis = 'penyedia') {
        await getManual(`${BASE}/rup/kajiulangpaket?id=${id}&penyediaAtauSwakelola=${jenis}&jenisMtl=&jenis=batal`);
        const form = await getText(`${BASE}/rup/formkajiulangbatal?penyediaAtauSwakelola=${jenis}&id=${id}`);
        if (!/simpanrevisi/i.test(form)) throw new Error(`Form pembatalan paket ${id} tidak terbuka (paket mungkin bukan status Terumumkan).`);
        const f = new URLSearchParams({ alasan, id, penyediaAtauSwakelola: jenis });
        const r = await post(`${BASE}/revisictr/simpanrevisi${jenis}batal`, f);
        if (!r.redirected) throw new Error(`Pembatalan paket ${id} ditolak: ` + (await pesanError(r)));
        return r;
    }
    async function pesanError(r) {
        const body = await r.text();
        const d = new DOMParser().parseFromString(body, 'text/html');
        const t = [...d.querySelectorAll('.alert, .error, label.error')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | ');
        return t || `HTTP ${r.status}, halaman tanpa pesan`;
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
        if (pk.praDipa) { add('isPraDipa', 'on'); add('paket.no_renja', ''); } // no_renja hanya ada di form bila Pra-DIPA dicentang
        let total = 0;
        pk.anggaran.forEach((a, i) => {
            const parts = a.mak.split('.');
            const mak1 = a.kodeInstansi && a.kodeEselon && a.kodeSatker ? `${a.kodeInstansi}.${a.kodeEselon}.${a.kodeSatker}` : `${ctx.kodeBA}.${ctx.kodeEselon}.${ctx.kodeSatker}`;
            add(`paketAnggaran[${i}].id`, pk.baru ? '' : (a.idLama || ''));
            add(`paketAnggaran[${i}].tahun_anggaran_dana`, a.ta || ctx.tahun); add(`paketAnggaran[${i}].sumber_dana`, a.sumber || 2);
            add(`paketAnggaran[${i}].asal_dana`, a.asal || ctx.kodeKldi || 'K8'); add(`paketAnggaran[${i}].asal_dana_satker`, a.asalSatker || ctx.idSatker);
            add(`paketAnggaran[${i}].id_dana_apbn`, a.danaApbn || 'A');
            add(`paketAnggaran[${i}].mak1`, mak1);
            add(`paketAnggaran[${i}].mak`, parts.slice(5).join('.'));          // SUB.AKUN
            add(`paketAnggaran[${i}].id_komponen`, a.idKomponen);               // id Komponen PKKR
            add(`paketAnggaran[${i}].pagu`, Math.round(a.pagu));
            total += Math.round(a.pagu);
        });
        add('totalPaguBersih', total);
        let jenis = pk.jenisList && pk.jenisList.length ? pk.jenisList : [{ jenisid: JENIS_ID[pk.jenis] || 1, pagu: total }];
        if (jenis.length === 1) jenis = [{ ...jenis[0], jenisid: JENIS_ID[pk.jenis] || jenis[0].jenisid, pagu: total }];
        jenis.forEach((j, i) => { add(`paketJenis[${i}].id`, pk.baru ? '' : (j.id || (i === 0 ? pk.jenisIdLama : '') || '')); add(`paketJenis[${i}].jenisid`, j.jenisid); add(`paketJenis[${i}].jumlah_pagu`, Math.round(j.pagu)); });
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

    // Lengkapi konteks dari form SiRUP bila kode BA/eselon/satker/KLDI belum diketahui (satker tanpa data paket lengkap)
    function lengkapiKonteks(ctx, tpl) {
        if (!tpl) return;
        const v = k => (tpl.entries.find(([n]) => n === k) || [])[1];
        const mak1 = v('paketAnggaran[0].mak1');
        if (mak1 && (!ctx.kodeBA || !ctx.kodeEselon || !ctx.kodeSatker)) { const [ba, es, sk] = mak1.split('.'); ctx.kodeBA = ctx.kodeBA || ba; ctx.kodeEselon = ctx.kodeEselon || es; ctx.kodeSatker = ctx.kodeSatker || sk; }
        if (!ctx.kodeKldi && v('paket.kode_kldi')) ctx.kodeKldi = v('paket.kode_kldi');
    }
    const konteksLengkap = ctx => !!(ctx.kodeBA && ctx.kodeEselon && ctx.kodeSatker && ctx.idSatker && ctx.tahun);

    // Serialisasi form revisi SiRUP persis seperti browser mengirimnya (field bernama, tidak disabled,
    // checkbox/radio hanya yang tercentang, select = opsi terpilih). Form ini sudah terisi otomatis
    // dengan data paket existing, sehingga bisa dipakai apa adanya ("dibiarkan saja") atau sebagai template.
    function serializeForm(html) {
        const d = new DOMParser().parseFromString(html, 'text/html');
        const form = [...d.querySelectorAll('form')].find(f => /simpankajiulang/i.test(f.getAttribute('action') || ''));
        if (!form) return null;
        const entries = [];
        for (const el of form.querySelectorAll('input, select, textarea')) {
            const name = el.getAttribute('name');
            if (!name || el.hasAttribute('disabled')) continue;
            const tag = el.tagName.toLowerCase(), type = (el.getAttribute('type') || 'text').toLowerCase();
            if (tag === 'input' && ['submit', 'button', 'file', 'image', 'reset'].includes(type)) continue;
            if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
                if (el.hasAttribute('checked')) entries.push([name, el.getAttribute('value') ?? 'on']);
                continue;
            }
            if (tag === 'select') {
                const opts = [...el.querySelectorAll('option')];
                const sel = el.hasAttribute('multiple') ? opts.filter(o => o.hasAttribute('selected')) : [opts.find(o => o.hasAttribute('selected')) || opts[0]].filter(Boolean);
                for (const o of sel) entries.push([name, o.getAttribute('value') ?? o.textContent.trim()]);
                continue;
            }
            entries.push([name, tag === 'textarea' ? el.textContent : (el.getAttribute('value') ?? '')]);
        }
        return { action: form.getAttribute('action'), entries };
    }
    const ARRAY_FIELD = /^(paketLokasi|paketAnggaran|paketJenis|paketKbki)\[\d+\]/;
    const KONTROL = ['count', 'isSelesai', 'alasan', 'idTerkaji', 'idAwal'];

    // Gabungkan template form dengan payload kita.
    //  - pk.pertahankan (paket #1 = paket existing): kirim isi form apa adanya, hanya kontrol alur yang diisi.
    //  - paket baru: pakai payload kita, lalu tambahkan field template yang tidak kita kenal (bukan larik).
    function gabungPayload(tpl, ours, pk) {
        const f = new URLSearchParams();
        const kita = new Map();
        for (const [k, v] of ours) if (!kita.has(k)) kita.set(k, v);
        if (pk.pertahankan && tpl) {
            const adaAnggaran = tpl.entries.some(([k]) => /^paketAnggaran\[0\]\.mak$/.test(k));
            // buang baris larik "cetakan" yang seluruh nilainya kosong (baris tambah lokasi/dana di form)
            const grup = {};
            for (const [k, v] of tpl.entries) { const m = k.match(ARRAY_FIELD); if (m) { grup[m[0]] = grup[m[0]] || []; if (!/\.id$/.test(k)) grup[m[0]].push(v); } }
            const kosong = new Set(Object.entries(grup).filter(([, vs]) => vs.every(v => !String(v).trim())).map(([g]) => g));
            for (const [k, v] of tpl.entries) {
                const m = k.match(ARRAY_FIELD);
                if (m && kosong.has(m[0])) continue;
                if (KONTROL.includes(k)) continue;
                if (!adaAnggaran && ARRAY_FIELD.test(k)) continue;
                f.append(k, v);
            }
            if (!adaAnggaran) for (const [k, v] of ours) if (ARRAY_FIELD.test(k)) f.append(k, v); // larik diisi JS di browser → pakai data paket existing
            for (const k of KONTROL) f.set(k, kita.get(k) ?? '');
            return f;
        }
        const tplMap = new Map(tpl ? tpl.entries : []);
        for (const [k, v] of ours) f.append(k, !v && /^(paketLokasi|paketAnggaran|paketJenis)\[\d+\]\.id$/.test(k) && tplMap.get(k) ? tplMap.get(k) : v);
        if (tpl) for (const [k, v] of tpl.entries) if (!kita.has(k) && !ARRAY_FIELD.test(k) && !KONTROL.includes(k)) f.append(k, v);
        return f;
    }

    // Trik KPA membuat paket tanpa akun PPK: revisi satu-ke-banyak atas paket existing.
    // Paket #1 = paket existing dibiarkan apa adanya; paket #2 dst. = paket baru.
    async function revisiSatuKeBanyak(ctx, donor, pakets, alasan, { onStep, dryRun } = {}) {
        if (dryRun) return { payloads: pakets.map((pk, i) => gabungPayload(null, payloadPaket(ctx, donor, pk, i + 1, i === pakets.length - 1, alasan), pk)) };
        const before = new Set((await daftarPaket(ctx.tahun)).map(p => p.id));
        const formUrl = n => `${BASE}/revisictr/formkajiulangsatukebanyak?count=${n}&penyediaAtauSwakelola=penyedia&id=${donor.id}&ispecah=false`;
        await getManual(`${BASE}/rup/kajiulangpaket?id=${donor.id}&penyediaAtauSwakelola=penyedia&jenisMtl=&jenis=satukebanyak`);
        const h0 = await getText(formUrl(1));
        let tpl = serializeForm(h0);
        if (!tpl) throw new Error(`Form revisi satu ke banyak paket ${donor.id} tidak terbuka (paket mungkin bukan status Terumumkan).`);
        lengkapiKonteks(ctx, tpl);
        if (!konteksLengkap(ctx)) throw new Error('Kode BA/eselon/satker tidak diketahui — baca ulang paket RUP (langkah 3) sebelum menjalankan revisi.');
        const ours = pakets.map((pk, i) => payloadPaket(ctx, donor, pk, i + 1, i === pakets.length - 1, alasan));
        const terkirim = [];
        for (let i = 0; i < ours.length; i++) {
            const body = gabungPayload(tpl, ours[i], pakets[i]);
            terkirim.push(body);
            const r = await post(`${BASE}/revisictr/simpankajiulangonetomanypenyedia`, body);
            if (!r.redirected) throw new Error(`Paket #${i + 1} ditolak SiRUP: ${await pesanError(r)}. Paket #1–#${i} sudah tersimpan; cek daftar paket sebelum mengulang.`);
            if (i < ours.length - 1) {
                const h = await getText(formUrl(i + 2));
                tpl = serializeForm(h) || tpl; // form berikutnya (count+1) jadi template
            }
            if (onStep) onStep(i + 1, ours.length);
            await sleep(400);
        }
        const after = await daftarPaket(ctx.tahun);
        const baru = after.filter(p => !before.has(p.id));
        return { baru, donorHilang: !after.some(p => p.id === donor.id), terkirim };
    }

    // Revisi satu ke satu: satu POST ke simpankajiulangonetoonepenyedia (payload = 1→N tanpa count/isSelesai).
    // Paket asal digantikan paket berkode baru berstatus Final Draft; KPA harus mengumumkannya lagi.
    async function revisiSatuKeSatu(ctx, paketAsal, pk, alasan, { dryRun } = {}) {
        const buat = () => { const o = payloadPaket(ctx, paketAsal, pk, 1, true, alasan); o.delete('count'); o.delete('isSelesai'); return o; };
        if (dryRun) return { payloads: [gabungPayload(null, buat(), pk)] };
        const before = new Set((await daftarPaket(ctx.tahun)).map(p => p.id));
        await getManual(`${BASE}/rup/kajiulangpaket?id=${paketAsal.id}&penyediaAtauSwakelola=penyedia&jenisMtl=&jenis=satukesatu`);
        const tpl = serializeForm(await getText(`${BASE}/revisictr/formkajiulangsatukesatu?penyediaAtauSwakelola=penyedia&id=${paketAsal.id}`));
        if (!tpl) throw new Error(`Form revisi satu ke satu paket ${paketAsal.id} tidak terbuka (paket mungkin bukan status Terumumkan).`);
        lengkapiKonteks(ctx, tpl);
        if (!konteksLengkap(ctx)) throw new Error('Kode BA/eselon/satker tidak diketahui — baca ulang paket RUP (langkah 3) sebelum menjalankan revisi.');
        const ours = buat();
        const body = gabungPayload(tpl, ours, pk);
        body.delete('count'); body.delete('isSelesai');
        const r = await post(`${BASE}/revisictr/simpankajiulangonetoonepenyedia`, body);
        if (!r.redirected) throw new Error(`Revisi 1→1 paket ${paketAsal.id} ditolak SiRUP: ${await pesanError(r)}`);
        const after = await daftarPaket(ctx.tahun);
        const baru = after.filter(p => !before.has(p.id));
        return { baru, donorHilang: !after.some(p => p.id === paketAsal.id), terkirim: [body] };
    }

    return {
        context, crawlPkkr, tambahPkkr, cariNodeBaru, daftarPpk, daftarPaket, detailPaket, denorm, kabupaten, alasanUmkm, lengkapiKonteks, konteksLengkap, cariKabupaten,
        strukturAnggaran, simpanStrukturAnggaran, umumkan, batalFinalDraft, batalkanPaket, revisiSatuKeBanyak, revisiSatuKeSatu, payloadPaket, serializeForm, gabungPayload,
        bacaFlash, getManual, setLogger, JENIS_ID, METODE_ID, PROVINSI, isLoginPage, sleep,
    };
})();


// ───────────────────────────────────────────────────────────────────── UI ──
const UI = (() => {
    const APP = 'Sanding DIPA ↔ RUP';
    const fmt = n => (n == null || isNaN(n)) ? '–' : Math.round(n).toLocaleString('id-ID');
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const store = {
        get(k, def) { try { const v = localStorage.getItem('sdr:' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
        set(k, v) { try { localStorage.setItem('sdr:' + k, JSON.stringify(v)); } catch (e) { /* storage penuh/diblokir */ } },
    };

    const S = {
        step: 0, ctx: null, dipa: null, dipaFile: '', overrides: {}, pkkr: null, ppk: [], pakets: null, swakelola: [],
        an: null, ren: null, sa: null, busy: false, stop: false,
        // keputusan kartu, cara menutup kekurangan, isian yang diubah, centang — disimpan per satker + tahun
        kep: {}, atur: {}, edit: {}, pilih: new Map(), lokasiSatker: null, lokRkk: null, antre: null, alasanUmkmList: null,
        cfg: Object.assign({
            plBarjas: 200e6, plKonstruksi: 400e6, plKonsultansi: 100e6, metodeEO: 'Tender', cekSebagai: 'CEK', maxPaketPerRevisi: 15,
            ambangSelisih: 1e6, ambangKeputusan: 100e6, grupPaketBaru: 'sub', jeda: 500,
        }, store.get('cfg', {})),
    };
    const STEPS = ['1. Data & Login', '2. Struktur PKKR', '3. Sanding RUP', '4. Rekap & Eksekusi', '5. Struktur Anggaran'];
    let root, body, foot, stepsEl, ctxEl, actEl;

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
    let logBody, logLast, logCount, logN = 0;
    function log(msg, cls) {
        if (!logBody) return;
        const t = new Date().toTimeString().slice(0, 8);
        logBody.append(h('div', { class: cls || '' }, `[${t}] ${msg}`));
        logBody.scrollTop = logBody.scrollHeight;
        logLast.textContent = `[${t}] ${msg}`;
        logLast.className = 'last ' + (cls || '');
        logCount.textContent = `Log aktivitas (${++logN})`;
        if (cls === 'e') foot.classList.add('open');
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
        ctxEl = h('div', { class: 'sdr-ctx' }, h('span', {}, 'memeriksa login…'));
        stepsEl = h('div', { class: 'sdr-steps' });
        body = h('div', { class: 'sdr-body' });
        logCount = h('b', {}, 'Log aktivitas (0)');
        logLast = h('span', { class: 'last' }, 'belum ada aktivitas');
        logBody = h('div', { class: 'sdr-log-body' });
        foot = h('div', { class: 'sdr-log' },
            h('div', { class: 'sdr-log-bar', onclick: () => foot.classList.toggle('open'), title: 'Klik untuk membuka/menutup log' }, logCount, logLast, h('span', {}, '▴▾')), logBody);
        win.append(h('div', { class: 'sdr-hd' }, h('h2', {}, APP), ctxEl,
            h('button', { class: 'btn sm', onclick: exportExcel, title: 'Unduh kertas kerja Excel' }, '⬇ Excel'),
            h('button', { class: 'btn sm', onclick: settings }, '⚙'),
            h('button', { class: 'sdr-x', title: 'Tutup', onclick: () => { root.style.display = 'none'; } }, '×')), stepsEl, body, actEl = h('div', { class: 'sdr-act' }), foot);
        root.append(win);
        document.body.append(root);
        Sirup.setLogger(log);
        renderSteps();
        go(0);
    }
    function renderSteps() {
        stepsEl.innerHTML = '';
        const done = [!!S.dipa && !!S.ctx && S.ctx.login, !!S.pkkr, !!S.an, false, false];
        STEPS.forEach((s, i) => stepsEl.append(h('button', { class: `sdr-step${i === S.step ? ' on' : ''}${done[i] ? ' done' : ''}`, onclick: () => go(i) },
            h('span', { class: 'no' }, done[i] && i !== S.step ? '✓' : String(i + 1)), s.replace(/^\d+\.\s*/, ''))));
    }
    function go(i) {
        S.step = i; renderSteps(); body.innerHTML = ''; if (actEl) actEl.innerHTML = '';
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
                ctxEl.innerHTML = ''; ctxEl.append(h('span', {}, 'belum login'));
                return;
            }
            ctxEl.innerHTML = '';
            ctxEl.append(...[S.ctx.username, S.ctx.role, 'Satker ' + S.ctx.kodeSatker, 'TA ' + S.ctx.tahun].filter(Boolean).map(t => h('span', {}, t)));
            ctxCard.append(h('div', { class: 'kpis' },
                kpi(S.ctx.nama || '–', 'Nama pengguna'), kpi(S.ctx.role || '–', 'Role'), kpi(S.ctx.kodeSatker || '–', 'Kode satker'), kpi(String(S.ctx.tahun), 'Tahun anggaran')),
                h('div', {}, S.ctx.satkerNama),
                S.ctx.isKPA ? h('div', { class: 'okbox' }, 'Login sebagai KPA — fitur tambah PKKR, revisi, umumkan, dan struktur anggaran tersedia.')
                    : h('div', { class: 'warnbox' }, `Role "${S.ctx.role}" bukan KPA. Sanding tetap bisa dilihat, tetapi eksekusi (PKKR, revisi, umumkan) hanya bisa oleh akun KPA.`));
            const saved = store.get('ov:' + S.ctx.kodeSatker, null);
            if (saved) S.overrides = saved;
            muatKeadaan();
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
                const thPdf = +(String(res.meta.periode || '').match(/(20\d\d)/) || [])[1];
                if (thPdf && S.ctx && S.ctx.tahun && thPdf !== S.ctx.tahun) throw new Error(`PDF ini DIPA tahun ${thPdf}, sedangkan tahun anggaran SiRUP ${S.ctx.tahun}. Ganti tahun di SiRUP atau unggah DIPA tahun yang sama.`);
                // RKK ikut diunggah? pakai untuk melengkapi nama node & lokasi KRO yang tidak ada di FA
                const pendamping = cand.find(x => x !== f && /FA_Detail/i.test(x.name) !== /FA_Detail/i.test(f.name));
                if (pendamping) {
                    const r2 = await DipaParser.parse(pdfjsLib, new Uint8Array(await pendamping.arrayBuffer()));
                    if (r2.meta.satker && res.meta.satker && r2.meta.satker !== res.meta.satker) throw new Error(`${pendamping.name} milik satker ${r2.meta.satker}, bukan ${res.meta.satker}.`);
                    const g = Analysis.gabungDipa(res, r2);
                    log(`${pendamping.name} dipakai untuk melengkapi ${g.node} nama node, lokasi KRO, sumber dana, serta volume & harga ${g.item} item.`, 'o');
                }
                S.dipa = res; S.dipaFile = f.name; S.an = null; S.ren = null;
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
                    h('p', { class: 'note' }, 'Default: hanya cabang yang memuat belanja pengadaan yang dicentang (cabang gaji/non-pengadaan dilewati). SiRUP menolak cabang Manual di bawah node Integrasi, jadi cabang dibuat dalam rantai PKKR Manual paralel dari level Program (nama Program/Kegiatan diberi akhiran "(Manual)", kode tetap sama). Rincian node yang akan dibuat ditampilkan sebelum dijalankan.'),
                    h('div', { class: 'tbl' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Level'), h('th', {}, 'Kode'), h('th', {}, 'Uraian'), h('th', { class: 'n' }, 'Pagu DIPA'), h('th', { class: 'n' }, 'Pagu pengadaan'))), h('tbody', {}, rows))),
                    h('div', { class: 'row', style: { marginTop: '8px' } }, h('span', {}, 'Delegasikan ke PPK:'), ppkSel,
                        h('button', { class: 'btn go', disabled: !S.ctx.isKPA, onclick: () => guard(() => runPkkr(diff.baru, ppkSel.value)) }, 'Tambahkan cabang terpilih ke PKKR (rantai Manual)')));
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
        if (!S.ppk.length) S.ppk = await Sirup.daftarPpk(([...S.pkkr.values()].find(n => n.level === 'komp') || {}).id);
        log(`PKKR terbaca: ${S.pkkr.size} node.`, 'o');
        S.an = null;
    }
    // Cara BPPP Tegal: SiRUP menolak cabang Manual di bawah node Integrasi (pagu integrasi beku di
    // nilai lama). Cabang baru dibuat dalam rantai PKKR Manual paralel mulai dari Program, dengan kode
    // sama (MAK paket tetap identik) dan pagu tiap salinan = jumlah pagu cabang baru di bawahnya.
    function rencanaManual(nodes) {
        const pilih = nodes.filter(n => n.pilih);
        const keys = new Set(pilih.map(n => n.key));
        const LVN = ['prog', 'keg', 'kro', 'ro', 'komp', 'sub'];
        const plan = new Map();
        // puncak cabang baru: node terpilih yang induknya tidak ikut dipilih
        const puncak = pilih.filter(n => !keys.has(n.parentKey));
        for (const top of puncak) {
            const parts = top.key.split('.');
            for (let i = 1; i < parts.length; i++) {
                const k = parts.slice(0, i).join('.');
                const ada = S.pkkr.get(k);
                const sudahManual = ada && (ada.manual || ada.manualTwin);
                if (sudahManual) continue;                       // rantai Manual sudah ada di level ini
                const d = S.dipa.nodes.get(k) || {};
                const x = plan.get(k) || { key: k, level: LVN[i - 1], kode: parts[i - 1], parentKey: parts.slice(0, i - 1).join('.'),
                    nama: ((ada && ada.nama) || d.uraian || '').replace(/\s*\(Manual\)$/, '') + (i <= 2 ? ' (Manual)' : ''), pagu: 0, salinan: true };
                x.pagu += top.pagu || 0;
                plan.set(k, x);
            }
        }
        for (const n of pilih) plan.set(n.key, { ...n, salinan: false });
        return [...plan.values()].sort((a, b) => a.key.split('.').length - b.key.split('.').length || a.key.localeCompare(b.key));
    }
    // id induk di rantai Manual (salinan terbaru), atau node Manual yang sudah ada
    function indukManual(key) {
        const n = key && S.pkkr.get(key);
        if (!n) return null;
        if (n.manual) return n;
        return n.manualTwin || null;
    }
    async function runPkkr(nodes, idPpk) {
        const rencana = rencanaManual(nodes);
        if (!rencana.length) return;
        const lv = { prog: 'Program', keg: 'Kegiatan', kro: 'KRO', ro: 'RO', komp: 'Komponen', sub: 'Sub Komponen' };
        const ok = await confirmBox('Tambah cabang PKKR (rantai Manual paralel)', `<p>SiRUP menolak cabang Manual di bawah node Integrasi, jadi cabang baru dibuat di <b>rantai PKKR Manual paralel</b> mulai dari Program (cara BPPP Tegal). Kode sama dengan DIPA, sehingga MAK paket tetap sama.</p>
            <div class="tbl"><table class="t"><tr><th>Level</th><th>Kode</th><th>Nama</th><th class="n">Pagu</th><th></th></tr>${rencana.map(n => `<tr><td>${lv[n.level]}</td><td class="mono">${esc(n.key)}</td><td>${esc(n.nama)}</td><td class="n">${fmt(n.pagu)}</td><td>${n.salinan ? '<span class="pill p-info">salinan induk</span>' : '<span class="pill p-ok">cabang baru</span>'}</td></tr>`).join('')}</table></div>
            <p class="note">${rencana.length} node akan dibuat. Tindakan ini mengubah data SiRUP; hapus manual lewat Kelola PKKR bila salah.</p>`);
        if (!ok) return;
        for (const n of rencana) {
            if (S.stop) break;
            const parent = n.level === 'prog' ? null : indukManual(n.parentKey);
            if (n.level !== 'prog' && !parent) throw new Error(`Induk Manual ${n.parentKey} belum ada — proses dihentikan.`);
            if (!n.nama) throw new Error(`Nama ${n.key} kosong — isi dulu di tabel.`);
            const rs = await Sirup.tambahPkkr(S.ctx, n, parent && parent.id, idPpk);
            const id = await Sirup.cariNodeBaru(S.ctx, n.level, parent && parent.id, n.kode);
            const lama = S.pkkr.get(n.key);
            if (!id || (lama && !lama.manual && lama.id === id) || (lama && lama.manualTwin && lama.manualTwin.id === id && n.salinan === false)) {
                const form = { prog: 'formprogram', keg: `formkegiatan?idProgram=${parent && parent.id}`, kro: `formoutput?idKegiatan=${parent && parent.id}`, ro: `formsuboutput?idOutput=${parent && parent.id}`, komp: `formkomponen?idSubOutput=${parent && parent.id}`, sub: `formsubkomponen?idKomponen=${parent && parent.id}` }[n.level];
                const flash = await Sirup.bacaFlash(`/sirup/programctr/${form}`);
                const isiHal = rs && !rs.redirected ? ' ' + (await rs.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200) : '';
                throw new Error(`SiRUP tidak menyimpan ${lv[n.level]} ${n.key}${parent ? ` di bawah ${parent.key} (id ${parent.id})` : ''}. ${flash ? 'Pesan SiRUP: ' + flash : 'SiRUP tidak memberi pesan.'}${isiHal}`);
            }
            const node = { id, level: n.level, kode: n.kode, nama: n.nama, pagu: n.pagu, key: n.key, manual: true, parentId: parent && parent.id };
            if (lama && !lama.manual) lama.manualTwin = node; else S.pkkr.set(n.key, node);
            log(`PKKR Manual + ${lv[n.level]} ${n.key} (id ${id})`, 'o');
            await Sirup.sleep(S.cfg.jeda);
        }
        log('Rantai PKKR Manual selesai. Membaca ulang PKKR…', 'o');
        await loadPkkr(true);
        S.an = null;
        go(1);
    }

    // ── 3. Sanding ─────────────────────────────────────────────────────
    function ensureAnalysis() {
        if (S.an) return;
        const cekKeputusan = {};
        for (const [k, v] of Object.entries(S.kep || {})) if (k.startsWith('cek:') && v && v.opsi) cekKeputusan[k.slice(4)] = v.opsi;
        const { nodes, akun } = Analysis.buildDipa(S.dipa, S.overrides, { cekSebagai: S.cfg.cekSebagai, cekKeputusan });
        S.an = { nodes, akun, orphans: [] };
        if (S.pakets) {
            const r = Analysis.sanding(akun, S.pakets);
            S.an.orphans = r.orphans;
            for (const p of S.pakets) Object.assign(p, Analysis.verdictPaket(p, akun));
            susunRencana();
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
        // kode BA/eselon/satker/KLDI diambil dari data paket satker ini sendiri (bukan diasumsikan)
        const mode = xs => Object.entries(xs.filter(Boolean).reduce((o, v) => (o[v] = (o[v] || 0) + 1, o), {})).sort((a, b) => b[1] - a[1]).map(([v]) => v)[0] || '';
        const rows = list.flatMap(p => p.sumberDana || []);
        const kodePaket = mode(rows.map(r => r.kodeSatker));
        if (kodePaket && S.ctx.kodeSatker && kodePaket !== S.ctx.kodeSatker) throw new Error(`Paket RUP yang terbaca milik satker ${kodePaket}, sedangkan login terbaca satker ${S.ctx.kodeSatker}. Muat ulang halaman SiRUP lalu coba lagi.`);
        if (kodePaket && S.dipa && S.dipa.meta.satker && kodePaket !== S.dipa.meta.satker) throw new Error(`PDF DIPA milik satker ${S.dipa.meta.satker}, sedangkan paket RUP akun ini milik satker ${kodePaket}. Unggah DIPA satker yang sedang login.`);
        if (!S.ctx.kodeSatker && kodePaket) { S.ctx.kodeSatker = kodePaket; muatKeadaan(); log(`Kode satker ${kodePaket} diambil dari data paket.`, 'w'); }
        Object.assign(S.ctx, { kodeBA: mode(rows.map(r => r.kodeInstansi)) || S.ctx.kodeBA || '', kodeEselon: mode(rows.map(r => r.kodeEselon)) || S.ctx.kodeEselon || '', kodeKldi: mode(rows.map(r => r.asal)) || S.ctx.kodeKldi || '' });
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
                    const tr = h('tr', { style: { cursor: 'pointer' } }, h('td', {}, h('div', { class: 'mono' }, a.key), h('div', { class: 'muted', style: { fontSize: '12.5px' } }, a.nama)), h('td', {}, pill(st, cls)),
                        h('td', { class: 'n' }, fmt(a.pagu)), h('td', { class: 'n' }, fmt(a.P)), h('td', { class: 'n' }, fmt(a.NP + a.CEK)),
                        h('td', { class: 'n' }, fmt(a.rupU)), h('td', { class: 'n' }, a.rupFD ? fmt(a.rupFD) : '–'), h('td', { class: 'n', style: { color: a.selisih > 1000 ? '#b45309' : a.selisih < -1000 ? '#b91c1c' : '' } }, fmt(a.selisih)));
                    const sub = h('tr', { class: 'sub', style: { display: 'none' } }, h('td', { colspan: 8 }, detailAkun(a)));
                    tr.addEventListener('click', () => { sub.style.display = sub.style.display === 'none' ? '' : 'none'; });
                    tb.append(tr, sub);
                }
            };
            flt.addEventListener('change', draw); q.addEventListener('input', draw);
            box.append(h('h3', {}, 'Sanding per akun (MAK 7 segmen)'),
                h('p', { class: 'note' }, 'Klik baris untuk melihat item DIPA dan paket RUP-nya. Klasifikasi item bisa diubah; rencana aksi dihitung ulang otomatis.'),
                h('div', { class: 'row' }, flt, q), h('div', { class: 'tbl', style: { marginTop: '6px' } }, h('table', { class: 't' },
                    h('thead', {}, h('tr', {}, ...['MAK / akun', 'Status', 'Pagu DIPA', 'Pengadaan', 'Non / cek', 'RUP terumumkan', 'RUP final draft', 'Selisih'].map((t, i) => h('th', { class: i >= 2 ? 'n' : '' }, t)))), tb)));
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
    // Alur: (1) Putuskan kartu kebijakan → (2) periksa perubahan per paket → (3) paket baru →
    // (4) jalankan antrean. Keputusan, centang, dan isian disimpan per satker + tahun.
    const kunci = k => `${k}:${S.ctx.kodeSatker || 'x'}:${S.ctx.tahun}`;
    function muatKeadaan() {
        S.kep = store.get(kunci('kep'), {}); S.atur = store.get(kunci('atur'), {}); S.edit = store.get(kunci('edit'), {});
        S.pilih = new Map(Object.entries(store.get(kunci('pilih'), {})));
        S.lokasiSatker = store.get('lok:' + (S.ctx.kodeSatker || 'x'), null);
        S.antre = store.get(kunci('antre'), null);
    }
    function simpanKeadaan() { store.set(kunci('kep'), S.kep); store.set(kunci('atur'), S.atur); store.set(kunci('edit'), S.edit); store.set(kunci('pilih'), Object.fromEntries(S.pilih)); }
    const simpanAntre = () => store.set(kunci('antre'), S.antre);
    function komponenId(mak) {
        if (!S.pkkr) return null;
        const parts = mak.split('.');
        // sub-komponen ada di PKKR → komponen induknya (Integrasi atau rantai Manual)
        const sub = S.pkkr.get(parts.slice(0, 6).join('.'));
        if (sub && sub.parentId) return sub.parentId;
        const k = S.pkkr.get(parts.slice(0, 5).join('.'));
        return k ? ((k.manualTwin && k.manualTwin.id) || k.id) : null;
    }
    function susunRencana() {
        S.ren = Rencana.susun({ akunMap: S.an.akun, pakets: S.pakets, dipaNodes: S.an.nodes, cfg: S.cfg, tahun: S.ctx.tahun, hariIni: new Date(),
            keputusan: S.kep, atur: S.atur, lokasiSatker: S.lokasiSatker, lokasiRkk: S.lokRkk, komponenId, namaSatker: S.ctx.satkerNama || '' });
        terapkanEdit();
    }
    const FIELD_EDIT = ['nama', 'jenis', 'jenisList', 'metode', 'jadwal', 'lokasiRaw', 'uraian', 'spesifikasi', 'volume', 'praDipa', 'pdn', 'umkm', 'alasanUmkm', 'spp'];
    const salin = v => JSON.parse(JSON.stringify(v));
    function pkDariId(id) {
        if (!S.ren) return null;
        if (id.startsWith('b:')) return S.ren.paketBaru.find(b => b.id === id);
        const c = S.ren.perubahan.find(x => x.id === id);
        return c && c.pk;
    }
    function terapkanEdit() {
        for (const [id, e] of Object.entries(S.edit || {})) {
            const pk = pkDariId(id);
            if (!pk) continue;
            for (const k of FIELD_EDIT) if (e[k] !== undefined) pk[k] = salin(e[k]);
            if (e.anggaran && pk.baru) {
                if (e.anggaran.map(a => a.mak).join() === pk.anggaran.map(a => a.mak).join()) { pk.anggaran = salin(e.anggaran); pk.total = pk.anggaran.reduce((s, a) => s + (+a.pagu || 0), 0); }
                else delete e.anggaran; // kelompok paket berubah → isian pagu lama tidak berlaku
            }
        }
    }
    function catatEdit(id, pk, k) {
        S.edit[id] = S.edit[id] || {};
        S.edit[id][k] = salin(pk[k]);
        if (k === 'anggaran' && pk.baru) pk.total = pk.anggaran.reduce((s, a) => s + (+a.pagu || 0), 0);
        simpanKeadaan(); segarkanHeader();
    }
    const dipilih = x => S.pilih.has(x.id) ? S.pilih.get(x.id) : x.pilih !== false;
    function setPilih(id, v) { S.pilih.set(id, v); simpanKeadaan(); segarkanHeader(); }
    function hitungUlang() { const y = body.scrollTop; S.an = null; ensureAnalysis(); gambarRekap(); body.scrollTop = y; }
    function ubahKeputusan(id, patch) { S.kep[id] = Object.assign({}, S.kep[id] || {}, patch); simpanKeadaan(); hitungUlang(); }
    const fmtM = n => { const a = Math.abs(n); return a >= 1e9 ? (n / 1e9).toFixed(2).replace('.', ',') + ' M' : a >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' jt' : fmt(n); };
    const namaNode = k => ((S.an && S.an.nodes.get(k)) || {}).uraian || '';

    // lokasi KRO di RKK ("KOTA JAKARTA PUSAT") → id provinsi/kabupaten SiRUP (disimpan di cache peramban)
    async function siapkanLokasi() {
        S.lokRkk = S.lokRkk || store.get('lokrkk', {});
        const teks = [...new Set([...S.dipa.nodes.values()].map(n => n.lokasi).filter(Boolean))].filter(t => !(t in S.lokRkk));
        if (!teks.length) return;
        const petunjuk = [S.lokasiSatker && S.lokasiSatker.id_provinsi, ...Object.entries((S.pakets || []).flatMap(p => (p.lokasiRaw || []).map(l => l.id_provinsi))
            .reduce((o, v) => (o[v] = (o[v] || 0) + 1, o), {})).sort((a, b) => b[1] - a[1]).map(([v]) => v)].filter(Boolean);
        for (const t of teks) {
            const r = await Sirup.cariKabupaten(t, petunjuk).catch(() => null);
            S.lokRkk[t] = r;
            log(r ? `Lokasi RKK "${t}" = ${r.kab}, ${r.prov}` : `Lokasi RKK "${t}" tidak ditemukan di daftar kabupaten SiRUP`, r ? 'o' : 'w');
        }
        store.set('lokrkk', S.lokRkk);
    }

    let rekapTab = 'putuskan', headEl = null;
    function stepRekap() {
        if (needDipa()) return;
        if (!S.pakets) { body.append(h('div', { class: 'warnbox' }, 'Jalankan langkah 3 (sanding RUP) dulu.')); return; }
        guard(async () => {
            await siapkanLokasi();
            if (!S.sa) S.sa = await Sirup.strukturAnggaran().catch(() => null);
            if (!S.alasanUmkmList) S.alasanUmkmList = await Sirup.alasanUmkm(S.ctx.tahun).catch(() => []);
            S.an = null; ensureAnalysis();
            gambarRekap();
        });
    }
    function gambarRekap() {
        if (S.step !== 3) return;
        body.innerHTML = ''; actEl.innerHTML = '';
        const r = S.ren;
        body.append(headerProyeksi());
        for (const w of r.peringatan) body.append(h('div', { class: 'warnbox' }, w));
        if (S.swakelola && S.swakelola.length) body.append(h('div', { class: 'infobox' }, `Satker ini punya ${S.swakelola.length} paket swakelola (Rp${fmt(S.swakelola.reduce((s, p) => s + p.pagu, 0))}) yang belum ikut disandingkan. Bila kekurangan sebuah akun sudah ditutup paket swakelola, pilih "abaikan" untuk akun itu di langkah 2.`));
        const belum = r.kartu.filter(k => !k.diputuskan).length;
        const nUbah = r.perubahan.length + r.umumkan.length + r.batalFD.length;
        const nAntre = S.antre ? S.antre.langkah.filter(x => x.status === 'menunggu').length : null;
        const TABS = [['putuskan', '1. Putuskan', belum ? `${belum} belum` : '✓'], ['ubah', '2. Perubahan paket', nUbah], ['baru', '3. Paket baru', r.paketBaru.length], ['jalankan', '4. Jalankan', nAntre == null ? '' : `${nAntre} antre`]];
        body.append(h('div', { class: 'seg' }, ...TABS.map(([k, l, n]) => h('button', { class: rekapTab === k ? 'on' : '', onclick: () => { rekapTab = k; gambarRekap(); body.scrollTop = 0; } }, l, n === '' ? null : h('span', { class: 'cnt' }, String(n))))));
        const el = h('div', {});
        body.append(el);
        ({ putuskan: tabPutuskan, ubah: tabPerubahan, baru: tabPaketBaru, jalankan: tabJalankan })[rekapTab](el);
    }
    function headerProyeksi() { headEl = h('div', { class: 'kpis proj' }); segarkanHeader(); return headEl; }
    function segarkanHeader() {
        if (!headEl || !S.ren) return;
        const p = Rencana.proyeksi(S.ren, S.pilih);
        const saTot = S.sa ? ['barjas', 'modal', 'sosial', 'hibah', 'lainnya'].reduce((s, k) => s + (S.sa[k] || 0), 0) : null;
        const dekat = Math.abs(p.setelah - p.target) <= Math.max(10 * (S.cfg.ambangSelisih || 1e6), 0.001 * p.target);
        const k = (v, l, cls, ket) => h('div', { class: 'kpi' + (cls ? ' ' + cls : '') }, h('b', {}, v), h('span', {}, l), ket ? h('span', { class: 'ket' }, ket) : null);
        headEl.innerHTML = '';
        headEl.append(k('Rp' + fmtM(p.sekarang), 'RUP terumumkan sekarang'),
            k('Rp' + fmtM(p.setelah), 'Setelah rencana (yang dicentang)', dekat ? 'ok' : 'warn', `${p.setelah >= p.sekarang ? '+' : '−'}Rp${fmtM(Math.abs(p.setelah - p.sekarang))} dari sekarang`),
            k('Rp' + fmtM(p.target), 'Target: pagu pengadaan DIPA', '', dekat ? 'sudah sejalan' : `selisih ${p.setelah > p.target ? '+' : '−'}Rp${fmtM(Math.abs(p.setelah - p.target))}`),
            k(saTot == null ? '–' : 'Rp' + fmtM(saTot), 'Struktur anggaran di SiRUP', '', 'disamakan di langkah 5'));
    }
    const kosong = t => h('div', { class: 'empty' }, t);
    function barLanjut(label, tab) {
        return h('div', { class: 'actionbar' }, h('span', { class: 'sum' }, ringkasPilihan()), h('button', { class: 'btn pri', onclick: () => { rekapTab = tab; gambarRekap(); body.scrollTop = 0; } }, label));
    }
    function ringkasPilihan() {
        const r = S.ren;
        const n = f => r.perubahan.filter(c => dipilih(c) && f(c)).length;
        const parts = [[n(c => c.jenis === 'ubah'), 'revisi'], [n(c => c.jenis === 'batal'), 'pembatalan'], [r.paketBaru.filter(b => dipilih(b) && b.hostId).length, 'paket baru'],
            [r.umumkan.filter(dipilih).length, 'umumkan'], [r.batalFD.length, 'kembali ke PPK']].filter(([x]) => x);
        const belum = r.kartu.filter(k => !k.diputuskan).length;
        return (parts.length ? 'Dipilih: ' + parts.map(([x, l]) => `${x} ${l}`).join(' · ') : 'Belum ada aksi yang dipilih.') + (belum ? ` · ${belum} kartu belum diputuskan (tidak dijalankan)` : '');
    }

    // ── 4.1 Putuskan ────────────────────────────────────────────────────
    function tabPutuskan(el) {
        const r = S.ren;
        el.append(h('p', { class: 'note' }, 'Hanya hal yang butuh kebijakan Anda. Satu kartu mewakili satu kelompok paket. Kartu yang belum diputuskan tidak dijalankan, dan akun tujuannya tidak dibuatkan paket baru supaya tidak dobel.'));
        el.append(kartuLokasiSatker());
        const nilai = k => Math.abs(k.lebih || k.total || 0);
        const belum = r.kartu.filter(k => !k.diputuskan).sort((a, b) => nilai(b) - nilai(a));
        const manual = r.kartu.filter(k => k.diputuskan && !k.otomatis), oto = r.kartu.filter(k => k.otomatis);
        const kecil = belum.filter(k => k.jenis === 'PINDAH' && k.saran && Math.abs(k.lebih) < (S.cfg.ambangKeputusan || 100e6));
        if (kecil.length) el.append(h('div', { class: 'row', style: { marginBottom: '12px' } },
            h('button', { class: 'btn sm', onclick: () => { for (const k of kecil) S.kep[k.id] = { ...(S.kep[k.id] || {}), opsi: k.saran, target: k.target[0] }; simpanKeadaan(); hitungUlang(); } },
                `Pakai saran untuk ${kecil.length} kartu pindah MAK bernilai kecil`),
            h('span', { class: 'muted', style: { fontSize: '12.5px' } }, 'tujuan hanya sama kegiatan — tetap periksa tujuannya')));
        if (belum.length) el.append(h('h3', {}, `Perlu keputusan (${belum.length})`), ...belum.map(kartuEl));
        if (manual.length) el.append(h('h3', { style: { marginTop: '20px' } }, `Sudah diputuskan (${manual.length})`), ...manual.map(kartuEl));
        if (oto.length) el.append(h('details', { style: { marginTop: '18px' } }, h('summary', {}, `Diputuskan otomatis sesuai aturan (${oto.length}) — klik untuk melihat atau mengubah`), ...oto.map(kartuEl)));
        if (!r.kartu.length) el.append(kosong('Tidak ada yang perlu diputuskan.'));
        actEl.append(barLanjut('Lanjut: periksa perubahan paket →', 'ubah'));
    }
    function kartuEl(k) {
        const badge = !k.diputuskan ? pill('Belum diputuskan', 'p-warn') : k.otomatis ? pill('Otomatis', 'p-mut') : pill('Diputuskan', 'p-ok');
        const box = h('div', { class: 'kartu' + (!k.diputuskan ? ' belum' : '') });
        box.append(h('div', { class: 'kartu-hd' }, h('div', {}, h('div', { class: 'item-title' }, k.judul), h('div', { class: 'muted', style: { fontSize: '13px', marginTop: '3px' } }, k.ringkas)), badge));
        if (k.jenis === 'PINDAH') { box.append(tabelBagian(k)); if (k.kandidatTujuan && k.kandidatTujuan.length > 1) box.append(pilihTujuan(k)); }
        if (k.jenis === 'LEBIH' || k.jenis === 'TANPA_PADANAN') box.append(tabelPaket(k.paket, k.ganda));
        if (k.jenis === 'NP') box.append(h('details', {}, h('summary', {}, `Lihat ${k.daftar.length} paket`), h('div', { class: 'tbl' }, h('table', { class: 't' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Paket'), h('th', {}, 'Nama'), h('th', { class: 'n' }, 'Non-pengadaan'), h('th', {}, 'Tindakan'), h('th', {}, 'Alasan'))),
            h('tbody', {}, k.daftar.map(x => h('tr', {}, h('td', { class: 'mono' }, x.paketId), h('td', {}, x.nama), h('td', { class: 'n' }, fmt(x.np)), h('td', {}, x.semua ? 'dibatalkan' : 'baris dikeluarkan'), h('td', { class: 'muted' }, x.alasan))))))));
        if (k.jenis === 'FD') { box.append(daftarFD(k)); return box; }
        const opsi = h('div', { class: 'opsi' });
        for (const o of k.opsi) {
            const on = k.pilihan === o.id;
            opsi.append(h('label', { class: 'op' + (on ? ' on' : '') },
                h('input', { type: 'radio', name: 'k-' + k.id, checked: on, onchange: () => ubahKeputusan(k.id, { opsi: o.id }) }),
                h('span', {}, h('b', {}, o.label), o.ket ? h('small', {}, o.ket) : null,
                    o.dampak ? h('small', { class: 'dampak' }, `Dampak ke RUP: ${o.dampak > 0 ? '+' : '−'}Rp${fmt(Math.abs(o.dampak))}`) : null)));
        }
        box.append(opsi);
        if (k.opsiFD) {
            const fd = h('div', { class: 'opsi fd' });
            for (const o of k.opsiFD) fd.append(h('label', { class: 'op' + (k.pilihanFD === o.id ? ' on' : '') },
                h('input', { type: 'radio', name: 'fd-' + k.id, checked: k.pilihanFD === o.id, onchange: () => ubahKeputusan(k.id, { fd: o.id }) }),
                h('span', {}, h('b', {}, o.label), h('small', {}, o.ket))));
            box.append(h('div', { class: 'sublabel' }, 'Final draft di kelompok ini'), fd);
        }
        if (k.jenis === 'PINDAH' && k.pilihan === 'susun' && k.susun) box.append(editorSusun(k));
        if (k.diputuskan && !k.otomatis) box.append(h('div', { style: { marginTop: '8px' } }, h('button', { class: 'btn sm ghost', onclick: () => { delete S.kep[k.id]; simpanKeadaan(); hitungUlang(); } }, 'Batalkan keputusan')));
        return box;
    }
    function tabelBagian(k) {
        const tb = h('tbody', {});
        for (const b of k.bucket) {
            const tr = h('tr', {}, h('td', {}, h('b', {}, b.label), b.jenis && b.jenis !== b.label ? h('div', { class: 'muted', style: { fontSize: '12px' } }, b.jenis) : null),
                h('td', { class: 'n' }, b.paket.length ? `${b.paket.length} paket` : h('span', { class: 'muted' }, 'belum ada paket')),
                h('td', { class: 'n' }, fmt(b.rup)), h('td', { class: 'n' }, b.fd ? fmt(b.fd) : '–'), h('td', { class: 'n' }, fmt(b.dipa)), h('td', { class: 'n' }, fmt(b.sisa)));
            tb.append(tr);
            if (b.paket.length) tb.append(h('tr', { class: 'sub' }, h('td', { colspan: 6 }, h('details', {}, h('summary', { style: { fontWeight: 400, fontSize: '12.5px' } }, 'daftar paket'),
                h('div', { class: 'muted', style: { fontSize: '12.5px' } }, ...b.paket.map(p => h('div', {}, `${p.paketId} · ${p.nama} · ${p.jenis} · ${p.metode || '-'} · Rp${fmt(p.diGrup)}${p.status === '2' ? ' · final draft' : ''}`)))))));
        }
        return h('div', { class: 'tbl', style: { maxHeight: 'none', margin: '8px 0' } }, h('table', { class: 't' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Bagian (item DIPA)'), h('th', { class: 'n' }, 'Paket'), h('th', { class: 'n' }, 'RUP terumumkan'), h('th', { class: 'n' }, 'Final draft'), h('th', { class: 'n' }, 'DIPA 2026'), h('th', { class: 'n' }, 'Sisa DIPA'))), tb));
    }
    function pilihTujuan(k) {
        const sel = h('select', {}, ...k.kandidatTujuan.map(c => h('option', { value: c.mak, selected: c.mak === k.target[0] }, `${c.mak} · ${c.nama} · sisa Rp${fmt(c.sisa)}`)));
        sel.addEventListener('change', () => ubahKeputusan(k.id, { target: sel.value }));
        return h('div', { class: 'row', style: { margin: '4px 0 6px' } }, h('span', { class: k.lemah ? '' : 'muted' }, k.lemah ? 'Tujuan (periksa):' : 'Tujuan:'), sel);
    }
    function tabelPaket(list, ganda) {
        const g = new Set((ganda || []).flat());
        return h('div', { class: 'tbl', style: { maxHeight: 'none', margin: '8px 0' } }, h('table', { class: 't' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Paket'), h('th', {}, 'Nama'), h('th', { class: 'n' }, 'Di MAK ini'), h('th', { class: 'n' }, 'Pagu paket'), h('th', {}, ''))),
            h('tbody', {}, list.map(p => h('tr', {}, h('td', { class: 'mono' }, p.paketId), h('td', {}, p.nama), h('td', { class: 'n' }, fmt(p.diMak != null ? p.diMak : p.diGrup)), h('td', { class: 'n' }, fmt(p.pagu)),
                h('td', {}, g.has(p.paketId) ? pill('kemungkinan ganda', 'p-warn') : p.umum ? pill('paket umum', 'p-mut') : null))))));
    }
    function daftarFD(k) {
        return h('div', { class: 'tbl', style: { maxHeight: 'none', margin: '8px 0' } }, h('table', { class: 't' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Final draft'), h('th', {}, 'Nama'), h('th', { class: 'n' }, 'Pagu'), h('th', {}, 'Masalah'), h('th', {}, 'Tindakan'))),
            h('tbody', {}, k.daftar.map(x => {
                const sel = h('select', {}, ...k.opsi.map(o => h('option', { value: o.id, selected: x.pilihan === o.id }, o.label)));
                sel.addEventListener('change', () => { const d = S.kep.fd || {}; d.pilih = { ...(d.pilih || {}), [x.paketId]: sel.value }; S.kep.fd = d; simpanKeadaan(); hitungUlang(); });
                return h('tr', {}, h('td', { class: 'mono' }, x.paketId), h('td', {}, x.nama), h('td', { class: 'n' }, fmt(x.pagu)), h('td', { class: 'muted' }, x.masalah.join('; ')), h('td', {}, sel));
            }))));
    }
    function editorSusun(k) {
        const box = h('div', { class: 'fs', style: { marginTop: '10px' } }, h('h4', {}, 'Susun ulang per bagian'),
            h('p', { class: 'note', style: { marginBottom: '8px' } }, 'Centang paket yang dipertahankan dan isi pagunya. Paket lain di bagian itu dibatalkan (final draft mengikuti pilihan final draft di atas). Metode bisa diubah, mis. Penunjukan Langsung.'));
        const METODE_S = ['', ...Object.keys(Sirup.METODE_ID), 'Dikecualikan'];
        for (const b of k.bucket) {
            if (!b.paket.length) continue;
            const st = k.susun[b.id] || { simpan: [], pagu: {} };
            const simpanKep = patch => { const d = S.kep[k.id] || {}; d.susun = { ...(d.susun || {}), [b.id]: { ...st, ...patch } }; S.kep[k.id] = d; simpanKeadaan(); hitungUlang(); };
            const mt = h('select', {}, ...METODE_S.map(m => h('option', { value: m, selected: (st.metode || '') === m }, m || '— metode tetap —')));
            mt.addEventListener('change', () => simpanKep({ metode: mt.value }));
            const rows = b.paket.map(p => {
                const on = st.simpan.includes(p.paketId);
                const cb = chk(on, v => simpanKep({ simpan: v ? [...st.simpan, p.paketId] : st.simpan.filter(i => i !== p.paketId), pagu: {} }));
                const pg = h('input', { type: 'number', value: on ? Math.round(st.pagu[p.paketId] || 0) : '', disabled: !on, style: { width: '170px' } });
                pg.addEventListener('change', () => simpanKep({ pagu: { ...Object.fromEntries(st.simpan.map(i => [i, st.pagu[i]])), [p.paketId]: +pg.value || 0 } }));
                return h('tr', {}, h('td', {}, cb), h('td', { class: 'mono' }, p.paketId), h('td', {}, p.nama, p.status === '2' ? pill('final draft', 'p-info') : null), h('td', { class: 'n' }, fmt(p.diGrup)), h('td', {}, pg));
            });
            const tot = st.simpan.reduce((s, i) => s + (+st.pagu[i] || 0), 0);
            box.append(h('div', { style: { margin: '10px 0' } }, h('div', { class: 'row' }, h('b', {}, b.label), h('span', { class: 'muted' }, `DIPA Rp${fmt(b.dipa)} · dipertahankan Rp${fmt(tot)}`), h('span', { style: { flex: 1 } }), h('span', { class: 'muted' }, 'Metode:'), mt),
                h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, 'Pertahankan'), h('th', {}, 'Paket'), h('th', {}, 'Nama'), h('th', { class: 'n' }, 'Pagu di kelompok'), h('th', {}, 'Pagu baru (Rp)'))), h('tbody', {}, rows))));
        }
        return box;
    }
    function saranLokasiSatker() {
        const out = [], seen = new Set();
        const tambah = (l, ket) => { const k = `${l.id_provinsi}|${l.id_kabupaten}`; if (!l.id_kabupaten || seen.has(k)) return; seen.add(k); out.push({ ...l, ket }); };
        for (const [t, l] of Object.entries(S.lokRkk || {})) if (l) tambah({ ...l, detil: '' }, `lokasi KRO di RKK (${t})`);
        const c = {};
        for (const p of S.pakets || []) for (const l of p.lokasiRaw || []) { const k = `${l.id_provinsi}|${l.id_kabupaten}|${l.detil}`; c[k] = c[k] || { l, n: 0 }; c[k].n++; }
        for (const { l, n } of Object.values(c).sort((a, b) => b.n - a.n).slice(0, 4)) tambah(l, `${n} paket existing`);
        return out;
    }
    function kartuLokasiSatker() {
        const L = S.lokasiSatker;
        const box = h('div', { class: 'kartu' + (L ? '' : ' belum') });
        box.append(h('div', { class: 'kartu-hd' }, h('div', {}, h('div', { class: 'item-title' }, 'Lokasi satker'),
            h('div', { class: 'muted', style: { fontSize: '13px', marginTop: '3px' } }, L ? `${L.kab}, ${L.prov} — ${L.detil}` : 'Dipakai untuk paket baru bila lokasi KRO di RKK dan paket satu komponen tidak tersedia. Diatur sekali per satker.')),
            L ? pill('Sudah diatur', 'p-ok') : pill('Belum diatur', 'p-warn')));
        const saran = saranLokasiSatker();
        const temp = { lokasiRaw: [L ? { ...L } : { id_provinsi: '', id_kabupaten: '', detil: '' }] };
        const ed = h('details', { open: !L }, h('summary', {}, L ? 'Ubah lokasi satker' : 'Atur lokasi satker'),
            saran.length ? h('div', { class: 'row', style: { margin: '6px 0 10px' } }, h('span', { class: 'muted' }, 'Saran:'),
                ...saran.map(s => h('button', { class: 'btn sm', onclick: () => { temp.lokasiRaw = [{ id_provinsi: s.id_provinsi, id_kabupaten: s.id_kabupaten, detil: s.detil || (L && L.detil) || S.ctx.satkerNama || '' }]; lokBox.innerHTML = ''; lokBox.append(lokasiEditor(temp, null, 1)); } },
                    `${s.kab || s.id_kabupaten}${s.detil ? ' – ' + s.detil.slice(0, 40) : ''} · ${s.ket}`))) : null);
        const lokBox = h('div', {}, lokasiEditor(temp, null, 1));
        ed.append(lokBox, h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn pri sm', onclick: async () => {
            const l = temp.lokasiRaw[0];
            if (!l || !l.id_provinsi || !l.id_kabupaten || !String(l.detil || '').trim()) { log('Lengkapi provinsi, kabupaten/kota, dan detail lokasi satker.', 'w'); return; }
            const kab = (await Sirup.kabupaten(+l.id_provinsi)).find(x => +x.id === +l.id_kabupaten);
            S.lokasiSatker = { id_provinsi: +l.id_provinsi, id_kabupaten: +l.id_kabupaten, detil: l.detil.trim(), prov: Sirup.PROVINSI[+l.id_provinsi], kab: kab ? kab.nama : '' };
            store.set('lok:' + S.ctx.kodeSatker, S.lokasiSatker); log('Lokasi satker disimpan.', 'o'); hitungUlang();
        } }, 'Simpan lokasi satker')));
        box.append(ed);
        return box;
    }

    // ── 4.2 Perubahan paket ─────────────────────────────────────────────
    function tabPerubahan(el) {
        const r = S.ren;
        el.append(h('p', { class: 'note' }, 'Satu baris = satu paket = satu revisi. Paket hasil revisi mendapat kode RUP baru berstatus Final Draft, lalu langsung diumumkan ulang oleh tool.'));
        el.append(sekKekurangan());
        if (!r.perubahan.length && !r.umumkan.length && !r.batalFD.length) el.append(kosong('Tidak ada paket existing yang perlu diubah.'));
        const byKomp = new Map();
        for (const c of r.perubahan) {
            const mak = (c.rowsSesudah[0] || c.rowsSebelum[0] || {}).mak || '';
            const k = mak.split('.').slice(0, 5).join('.');
            if (!byKomp.has(k)) byKomp.set(k, []);
            byKomp.get(k).push(c);
        }
        for (const [k, list] of [...byKomp.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            el.append(h('div', { class: 'grp-hd' }, h('span', { class: 'mono' }, k), h('span', {}, namaNode(k))));
            el.append(h('div', { class: 'list' }, ...list.map(barisPerubahan)));
        }
        if (r.umumkan.length) {
            el.append(h('h3', { style: { marginTop: '20px' } }, `Final draft siap diumumkan (${r.umumkan.length})`));
            el.append(h('div', { class: 'list' }, ...r.umumkan.map(u => baris({ id: u.id, pilih: dipilih(u), title: u.nama, sub: [h('span', { class: 'mono' }, u.paketId), pill('umumkan', 'p-ok')], side: [h('b', {}, 'Rp' + fmt(u.pagu))] }))));
        }
        if (r.batalFD.length) {
            el.append(h('h3', { style: { marginTop: '20px' } }, `Final draft dikembalikan ke PPK (${r.batalFD.length})`), h('p', { class: 'note' }, 'Dari keputusan di langkah 1.'));
            el.append(h('div', { class: 'list' }, ...r.batalFD.map(f => h('div', { class: 'item' }, h('div', { class: 'item-hd' }, h('span', {}, '↩'), h('div', {}, h('div', { class: 'item-title' }, f.nama), h('div', { class: 'item-sub' }, h('span', { class: 'mono' }, f.paketId), h('span', {}, f.alasan))), h('div', { class: 'item-side' }, h('b', {}, 'Rp' + fmt(f.pagu))))))));
        }
        actEl.append(barLanjut('Lanjut: paket baru →', 'baru'));
    }
    function baris({ id, pilih, title, sub, side, cls, onPilih }) {
        const it = h('div', { class: 'item' + (cls ? ' ' + cls : '') + (pilih ? '' : ' off') });
        const cb = chk(pilih, v => { it.classList.toggle('off', !v); setPilih(id, v); if (onPilih) onPilih(v); });
        it.append(h('div', { class: 'item-hd' }, cb, h('div', {}, h('div', { class: 'item-title' }, title), sub ? h('div', { class: 'item-sub' }, ...[].concat(sub)) : null), h('div', { class: 'item-side' }, ...[].concat(side || []))));
        return it;
    }
    function chk(v, fn) { const c = h('input', { type: 'checkbox', checked: v }); c.addEventListener('change', () => fn(c.checked)); return c; }
    const LABEL_CLS = { 'tambah pagu': 'p-ok', 'pindah MAK': 'p-info', 'keluarkan non-pengadaan': 'p-np', 'potong kelebihan': 'p-warn', 'batalkan': 'p-bad', 'susun ulang': 'p-info', 'sumber dana': 'p-mut' };
    function barisPerubahan(c) {
        const delta = c.jenis === 'batal' ? -c.sebelum : c.sesudah - c.sebelum;
        const it = baris({ id: c.id, pilih: dipilih(c), cls: c.peringatan.length ? 'warn' : '', title: c.nama,
            sub: [h('span', { class: 'mono' }, c.paketId), ...c.label.map(l => pill(l, LABEL_CLS[l] || 'p-mut')), c.umumkanDulu ? pill('final draft: umumkan dulu', 'p-info') : null, c.titipanHost ? pill('juga dititipi paket baru', 'p-mut') : null],
            side: [h('b', {}, c.jenis === 'batal' ? 'dibatalkan' : 'Rp' + fmt(c.sesudah)), delta === 0 ? h('span', { class: 'delta' }, 'pagu tetap')
                : h('span', { class: 'delta ' + (delta > 0 ? 'up' : 'down') }, `${delta > 0 ? '+' : '−'}Rp${fmt(Math.abs(delta))} (semula Rp${fmt(c.sebelum)})`)] });
        const rinci = h('div', { class: 'rinci' });
        const tb = h('tbody', {});
        const lama = new Map(); for (const x of c.rowsSebelum) lama.set(x.mak, (lama.get(x.mak) || 0) + x.pagu);
        const baru = new Map(); for (const x of c.rowsSesudah) baru.set(x.mak, (baru.get(x.mak) || 0) + x.pagu);
        for (const mak of [...new Set([...lama.keys(), ...baru.keys()])]) {
            const a = lama.get(mak) || 0, b = baru.get(mak) || 0;
            tb.append(h('tr', {}, h('td', { class: 'mono' }, mak), h('td', { class: 'n' }, a ? fmt(a) : '–'), h('td', { class: 'n' }, b ? fmt(b) : '–'), h('td', { class: 'n' }, a === b ? '' : h('span', { class: 'delta ' + (b >= a ? 'up' : 'down') }, `${b >= a ? '+' : '−'}${fmt(Math.abs(b - a))}`))));
        }
        rinci.append(h('table', { class: 't diff' }, h('thead', {}, h('tr', {}, h('th', {}, 'MAK'), h('th', { class: 'n' }, 'Sebelum'), h('th', { class: 'n' }, 'Sesudah'), h('th', { class: 'n' }, 'Perubahan'))), tb));
        if (c.catatan.length) rinci.append(h('div', { class: 'notes', style: { margin: '10px 0 0' } }, ...c.catatan.map(t => h('div', {}, '• ' + t))));
        if (c.peringatan.length) rinci.append(h('div', { class: 'warnbox', style: { margin: '10px 0 0' } }, ...c.peringatan.map(t => h('div', {}, t))));
        if (c.lokasiLain && c.pk && S.lokasiSatker) rinci.append(h('div', { class: 'row', style: { marginTop: '10px' } }, h('span', { class: 'muted' }, `Lokasi paket (${c.pk.lokasiRaw.map(l => l.kab || l.id_kabupaten).join(', ')}) di luar provinsi satker.`),
            h('button', { class: 'btn sm', onclick: () => { c.pk.lokasiRaw = [{ id: '', id_provinsi: S.lokasiSatker.id_provinsi, id_kabupaten: S.lokasiSatker.id_kabupaten, detil: S.lokasiSatker.detil }]; catatEdit(c.id, c.pk, 'lokasiRaw'); hitungUlang(); } }, 'Ganti ke lokasi satker')));
        const tog = h('button', { class: 'btn sm' }, 'Rincian');
        rinci.style.display = 'none';
        tog.addEventListener('click', () => { const s = rinci.style.display === 'none'; rinci.style.display = s ? '' : 'none'; tog.textContent = s ? 'Tutup rincian' : 'Rincian'; });
        const bar = h('div', { class: 'row', style: { padding: '0 16px 12px 47px' } }, tog);
        if (c.pk) { const ed = editorIsian(c.id, c.pk, false); bar.append(ed.tombol, ed.status); it.append(bar, h('div', { style: { padding: '0 16px 12px 47px' } }, rinci), ed.body); }
        else it.append(bar, h('div', { style: { padding: '0 16px 12px 47px' } }, rinci));
        return it;
    }
    function sekKekurangan() {
        const r = S.ren;
        const aktif = r.kekurangan.filter(k => k.cara !== 'abaikan' || (S.atur[k.mak] || {}).cara === 'abaikan');
        const box = h('div', { class: 'card' }, h('h3', {}, 'Cara menutup kekurangan pagu'),
            h('p', { class: 'note' }, `Default: bila MAK sudah punya paket umum (mis. "Belanja Bahan"), pagunya ditambah; bila belum atau paketnya spesifik, dibuat paket baru. Selisih ≤ Rp${fmt(S.cfg.ambangSelisih)} diabaikan.`));
        if (!aktif.length) box.append(h('div', { class: 'muted' }, 'Tidak ada kekurangan di atas ambang.'));
        else box.append(h('div', { class: 'tbl', style: { maxHeight: '340px' } }, h('table', { class: 't' },
            h('thead', {}, h('tr', {}, h('th', {}, 'MAK'), h('th', { class: 'n' }, 'Kurang'), h('th', { class: 'n' }, 'Realisasi'), h('th', {}, 'Ditutup dengan'))),
            h('tbody', {}, aktif.map(k => {
                const sel = h('select', { style: { maxWidth: '460px' } },
                    ...k.kandidat.map(c => h('option', { value: 'tambah:' + c.paketId, selected: k.cara === 'tambah' && k.paketId === c.paketId }, `Tambah pagu ${c.paketId} · ${c.nama.slice(0, 50)}${c.umum ? '' : ' (spesifik)'}`)),
                    h('option', { value: 'baru', selected: k.cara === 'baru' }, 'Paket baru'), h('option', { value: 'abaikan', selected: k.cara === 'abaikan' }, 'Abaikan (mis. sudah swakelola)'));
                sel.addEventListener('change', () => { const [cara, pid] = sel.value.split(':'); S.atur[k.mak] = { cara, paketId: pid }; simpanKeadaan(); hitungUlang(); });
                return h('tr', {}, h('td', {}, h('div', { class: 'mono' }, k.mak), h('div', { class: 'muted', style: { fontSize: '12px' } }, k.nama)), h('td', { class: 'n' }, fmt(k.sisa)),
                    h('td', { class: 'n' }, k.realisasi ? Math.round(k.realisasi * 100) + '%' : '–'), h('td', {}, sel));
            })))));
        if (r.sisaKecil.length) box.append(h('details', { style: { marginTop: '8px' } }, h('summary', {}, `Selisih kecil diabaikan (${r.sisaKecil.length} akun, Rp${fmt(r.sisaKecil.reduce((s, x) => s + x.sisa, 0))})`),
            h('div', { class: 'muted', style: { fontSize: '12.5px' } }, ...r.sisaKecil.map(x => h('div', {}, `${x.mak} · Rp${fmt(x.sisa)} · ${x.alasan}`)))));
        if (r.tertahan.length) box.append(h('div', { class: 'infobox', style: { marginTop: '10px' } }, `${r.tertahan.length} akun (kurang Rp${fmt(r.tertahan.reduce((s, x) => s + x.sisa, 0))}) menunggu keputusan kartu di langkah 1: ${r.tertahan.map(x => x.mak).join(', ')}`));
        return box;
    }

    // ── 4.3 Paket baru ──────────────────────────────────────────────────
    function tabPaketBaru(el) {
        const r = S.ren;
        el.append(h('p', { class: 'note' }, 'KPA tidak bisa membuat paket dari nol, jadi paket baru "dititipkan" lewat Revisi → Satu ke Banyak atas paket terumumkan di komponen yang sama. Draft #1 = paket yang dititipi (tetap atau sekalian dikoreksi), draft #2 dst. = paket baru. Tiap isian menunjukkan asalnya.'));
        if (!r.paketBaru.length) { el.append(kosong('Tidak ada paket baru yang perlu dibuat.')); actEl.append(barLanjut('Lanjut: jalankan →', 'jalankan')); return; }
        el.append(bulkBaru());
        const tanpa = r.paketBaru.filter(b => !b.hostId);
        for (const t of r.titipan) {
            const anak = r.paketBaru.filter(b => b.hostId === t.hostId);
            const grp = h('div', { class: 'item' + (dipilih(t) ? '' : ' off'), style: { marginBottom: '14px' } });
            grp.append(h('div', { class: 'item-hd' }, chk(dipilih(t), v => { grp.classList.toggle('off', !v); setPilih(t.id, v); }),
                h('div', {}, h('div', { class: 'item-title' }, `Dititipkan ke ${t.hostId} · ${t.nama}`),
                    h('div', { class: 'item-sub' }, pill(t.draft1 === 'koreksi' ? 'draft #1 = paket ini setelah dikoreksi' : 'draft #1 = paket ini tanpa perubahan', 'p-mut'), h('span', {}, `kode RUP paket ini ikut berganti`))),
                h('div', { class: 'item-side' }, h('b', {}, `${anak.length} paket baru`), h('span', { class: 'muted', style: { fontSize: '12px' } }, 'Rp' + fmt(anak.reduce((s, b) => s + b.total, 0))))));
            grp.append(h('div', { class: 'sub-items' }, ...anak.map(kartuPaketBaru)));
            el.append(grp);
        }
        if (tanpa.length) el.append(h('div', { class: 'errbox' }, `${tanpa.length} paket baru tidak punya paket terumumkan yang bisa dititipi. Minta PPK membuat satu paket di komponen itu, umumkan, lalu baca ulang.`), ...tanpa.map(kartuPaketBaru));
        actEl.append(barLanjut('Lanjut: jalankan →', 'jalankan'));
    }
    function kartuPaketBaru(b) {
        const err = Rencana.periksa(b, { komponenId });
        const sel = h('input', { type: 'checkbox', class: 'sdr-bulk-sel', title: 'Pilih untuk isian massal' }); sel._pk = b; sel._id = b.id;
        sel.addEventListener('change', () => bulkHitung && bulkHitung());
        const on = chk(dipilih(b), v => { el.classList.toggle('off', !v); setPilih(b.id, v); });
        on.title = 'Ikut dijalankan';
        const nama = h('input', { type: 'text', value: b.nama, style: { width: '100%' } }); nama.addEventListener('change', () => { b.nama = nama.value; catatEdit(b.id, b, 'nama'); });
        const hostSel = b.kandidatHost && b.kandidatHost.length > 1 ? (() => {
            const s = h('select', { style: { maxWidth: '360px' } }, ...b.kandidatHost.map(c => h('option', { value: c.paketId, selected: c.paketId === b.hostId }, `${c.paketId} · ${c.nama.slice(0, 44)}`)));
            s.addEventListener('change', () => { S.atur[b.id] = { ...(S.atur[b.id] || {}), host: s.value }; simpanKeadaan(); hitungUlang(); });
            return s;
        })() : null;
        const ed = editorIsian(b.id, b, true);
        const el = h('div', { class: 'sub-item' + (dipilih(b) ? '' : ' off') },
            h('div', { class: 'item-hd' }, h('div', { class: 'cb2' }, h('label', {}, on, h('span', {}, 'jalankan')), h('label', {}, sel, h('span', {}, 'massal'))),
                h('div', {}, nama,
                    h('div', { class: 'item-sub' }, pill(b.jenis, 'p-info'), h('span', {}, b.metode), h('span', { class: 'mono' }, b.anggaran.map(a => a.mak.split('.').slice(-2).join('.')).join(', '))),
                    h('div', { class: 'sumber' }, `Lokasi: ${b.lokasiRaw.map(l => l.kab || l.id_kabupaten).join(', ') || '—'}${b.lokasiSumber ? ' (' + b.lokasiSumber + ')' : ''} · Jadwal: ${b.jadwal.awalPengadaan} s.d. ${b.jadwal.kebutuhan} (${b.jadwalSumber})${b.realisasi ? ` · realisasi ${Math.round(b.realisasi * 100)}%` : ''}`),
                    hostSel ? h('div', { class: 'row', style: { marginTop: '6px' } }, h('span', { class: 'muted', style: { fontSize: '12.5px' } }, `Dititipkan (${b.hostKet}):`), hostSel) : null,
                    b.peringatan.length ? h('div', { class: 'notes', style: { margin: '8px 0 0' } }, ...b.peringatan.map(t => h('div', {}, '• ' + t))) : null,
                    err.length ? h('div', { class: 'errbox', style: { margin: '8px 0 0', padding: '8px 12px' } }, 'Perlu diperbaiki: ' + err.join('; ')) : null),
                h('div', { class: 'item-side' }, h('b', {}, 'Rp' + fmt(b.total)), ed.tombol)), ed.body);
        return el;
    }
    let bulkHitung = null;
    function bulkBaru() {
        const JN = Object.keys(Sirup.JENIS_ID), MT = [...Object.keys(Sirup.METODE_ID), 'Dikecualikan'];
        const f = {};
        const js = h('select', {}, h('option', { value: '' }, '— tidak diubah —'), ...JN.map(j => h('option', {}, j)));
        const mt = h('select', {}, h('option', { value: '' }, '— tidak diubah —'), ...MT.map(j => h('option', {}, j)));
        const pd = h('select', {}, h('option', { value: '' }, '— tidak diubah —'), h('option', { value: '1' }, 'Ya'), h('option', { value: '0' }, 'Tidak'));
        const mon = k => { const i = h('input', { type: 'month' }); f[k] = i; return i; };
        const rng = (a, b) => h('div', { class: 'range' }, mon(a), h('span', {}, 's.d.'), mon(b));
        const field = (label, input) => h('div', { class: 'field' }, h('label', {}, label), input);
        const sel = () => [...document.querySelectorAll('.sdr-bulk-sel')].filter(c => c.checked).map(c => c._pk);
        const info = h('b', {}, '0 paket dipilih');
        bulkHitung = () => { info.textContent = `${sel().length} dari ${S.ren.paketBaru.length} paket baru dipilih`; };
        const apply = h('button', { class: 'btn pri' }, 'Terapkan ke paket terpilih');
        apply.addEventListener('click', () => {
            const ps = sel(); if (!ps.length) { log('Pilih paket dulu (kotak kecil kedua di kiri tiap paket).', 'w'); return; }
            for (const pk of ps) {
                if (js.value) { pk.jenis = js.value; pk.jenisList = null; catatEdit(pk.id, pk, 'jenis'); }
                if (mt.value) { pk.metode = mt.value; catatEdit(pk.id, pk, 'metode'); }
                if (pd.value) { pk.praDipa = pd.value === '1'; catatEdit(pk.id, pk, 'praDipa'); }
                let j = false; for (const [k, i] of Object.entries(f)) if (i.value) { pk.jadwal[k] = i.value; j = true; }
                if (j) catatEdit(pk.id, pk, 'jadwal');
            }
            log(`Isian massal diterapkan ke ${ps.length} paket.`, 'o'); hitungUlang();
        });
        const copyLok = h('button', { class: 'btn' }, 'Samakan lokasi');
        copyLok.addEventListener('click', () => {
            const ps = sel(); if (ps.length < 2) { log('Pilih minimal 2 paket; lokasi paket pertama disalin ke yang lain.', 'w'); return; }
            for (const pk of ps.slice(1)) { pk.lokasiRaw = ps[0].lokasiRaw.map(l => ({ ...l, id: '' })); catatEdit(pk.id, pk, 'lokasiRaw'); }
            log(`Lokasi disalin ke ${ps.length - 1} paket.`, 'o'); hitungUlang();
        });
        setTimeout(bulkHitung, 0);
        return h('details', { class: 'bulk' }, h('summary', {}, 'Isian massal untuk paket baru'),
            h('div', { class: 'formgrid' }, field('Jenis pengadaan', js), field('Metode pemilihan', mt), field('Pra-DIPA', pd)),
            h('div', { class: 'rangegrid' }, field('Pemilihan penyedia', rng('awalPengadaan', 'akhirPengadaan')), field('Pelaksanaan kontrak', rng('awalPekerjaan', 'akhirPekerjaan')), field('Pemanfaatan barang/jasa', rng('awalKebutuhan', 'kebutuhan'))),
            h('div', { class: 'row' }, info,
                h('button', { class: 'btn sm', onclick: () => { document.querySelectorAll('.sdr-bulk-sel').forEach(c => { c.checked = true; }); bulkHitung(); } }, 'Pilih semua'),
                h('button', { class: 'btn sm', onclick: () => { document.querySelectorAll('.sdr-bulk-sel').forEach(c => { c.checked = false; }); bulkHitung(); } }, 'Kosongkan'),
                h('span', { style: { flex: 1 } }), copyLok, apply));
    }

    // Editor isian satu paket (baru atau hasil revisi). Perubahan langsung dicatat per id rencana.
    const JENIS = Object.keys(Sirup.JENIS_ID);
    const METODE = [...Object.keys(Sirup.METODE_ID), 'Dikecualikan'];
    function editorIsian(id, pk, baru) {
        const tombol = h('button', { class: 'btn sm' }, '✎ Ubah isian');
        const status = h('span', { class: 'muted', style: { fontSize: '12.5px' } });
        const bd = h('div', { class: 'editor', style: { display: 'none' } });
        let built = false;
        const ringkas = () => { status.textContent = `${pk.jenis} · ${pk.metode} · pemilihan ${(pk.jadwal || {}).awalPengadaan || '?'} · ${(pk.lokasiRaw || []).length} lokasi`; };
        ringkas();
        tombol.addEventListener('click', () => { if (!built) { isi(); built = true; } const s = bd.style.display === 'none'; bd.style.display = s ? '' : 'none'; tombol.textContent = s ? '▴ Tutup isian' : '✎ Ubah isian'; });
        return { tombol, status, body: bd };
        function isi() {
            const fs = (judul, ...x) => h('div', { class: 'fs' }, h('h4', {}, judul), ...x);
            const field = (label, input, hint) => h('div', { class: 'field' }, h('label', {}, label), input, hint ? h('div', { class: 'hint' }, hint) : null);
            const ubah = k => { catatEdit(id, pk, k); ringkas(); };
            if (!baru) { const t = h('input', { type: 'text', value: pk.nama, style: { width: '100%' } }); t.addEventListener('change', () => { pk.nama = t.value; ubah('nama'); }); bd.append(fs('Nama paket', t)); }
            // anggaran: paket baru → pagu per baris bisa diubah; paket existing → hasil keputusan (baca saja)
            const tb = h('tbody', {});
            pk.anggaran.forEach(a => {
                const pg = h('input', { type: 'number', value: Math.round(a.pagu), style: { width: '170px' }, disabled: !baru });
                pg.addEventListener('change', () => { a.pagu = +pg.value || 0; ubah('anggaran'); });
                const dana = h('select', { disabled: !baru }, ...[['A', 'RM'], ['D', 'PNBP'], ['F', 'BLU'], ['T', 'SBSN'], ['B', 'PLN']].map(([v, t]) => h('option', { value: v, selected: (a.danaApbn || 'A') === v }, t)));
                dana.addEventListener('change', () => { a.danaApbn = dana.value; ubah('anggaran'); });
                const kid = a.idKomponen || komponenId(a.mak);
                tb.append(h('tr', {}, h('td', { class: 'mono' }, a.mak), h('td', {}, dana), h('td', {}, pg), h('td', {}, kid ? pill('komponen PKKR ' + kid, 'p-mut') : pill('komponen belum ada di PKKR (langkah 2)', 'p-bad'))));
            });
            bd.append(fs('Anggaran', h('table', { class: 'mak-t' }, h('thead', {}, h('tr', {}, h('th', {}, 'MAK'), h('th', {}, 'Dana'), h('th', {}, 'Pagu (Rp)'), h('th', {}, 'PKKR'))), tb),
                baru ? null : h('div', { class: 'hint muted', style: { fontSize: '12px', marginTop: '6px' } }, 'Baris anggaran paket existing mengikuti keputusan di langkah 1–2.')));
            const js = h('select', {}, ...JENIS.map(j => h('option', { selected: j === pk.jenis }, j))); js.addEventListener('change', () => { pk.jenis = js.value; pk.jenisList = null; ubah('jenis'); ubah('jenisList'); });
            const mt = h('select', {}, ...METODE.map(m => h('option', { selected: m === pk.metode }, m))); mt.addEventListener('change', () => { pk.metode = mt.value; ubah('metode'); });
            const cbx = (label, k) => h('label', {}, chk(!!pk[k], v => { pk[k] = v; ubah(k); if (k === 'umkm') umkmBox.style.display = v ? 'none' : ''; }), label);
            const alasan = h('select', { style: { width: '100%' } }, h('option', { value: '' }, '— pilih alasan —'), ...(S.alasanUmkmList || []).map(a => h('option', { selected: a === pk.alasanUmkm }, a)));
            alasan.addEventListener('change', () => { pk.alasanUmkm = alasan.value; ubah('alasanUmkm'); });
            const umkmBox = h('div', { style: { display: pk.umkm ? 'none' : '' } }, field('Alasan bukan usaha kecil', alasan));
            pk.spp = pk.spp || { ekonomi: true, sosial: true, lingkungan: false };
            const spp = (label, k) => h('label', {}, chk(!!pk.spp[k], v => { pk.spp[k] = v; ubah('spp'); }), label);
            bd.append(fs('Pengadaan', h('div', { class: 'formgrid' },
                field('Jenis pengadaan', js), field('Metode pemilihan', mt, 'Paket meeting/penginapan hotel: Dikecualikan'),
                field('Penanda', h('div', { class: 'checks' }, cbx('Pra-DIPA', 'praDipa'), cbx('Produk dalam negeri', 'pdn'), cbx('Usaha kecil/koperasi', 'umkm'))),
                field('Pengadaan berkelanjutan (SPP)', h('div', { class: 'checks' }, spp('Ekonomi', 'ekonomi'), spp('Sosial', 'sosial'), spp('Lingkungan', 'lingkungan')))), umkmBox));
            pk.jadwal = pk.jadwal || {};
            const mon = k => { const i = h('input', { type: 'month', value: pk.jadwal[k] || '' }); i.addEventListener('change', () => { pk.jadwal[k] = i.value; ubah('jadwal'); }); return i; };
            const rng = (a, b) => h('div', { class: 'range' }, mon(a), h('span', {}, 's.d.'), mon(b));
            bd.append(fs('Jadwal', h('div', { class: 'rangegrid' },
                field('Pemilihan penyedia', rng('awalPengadaan', 'akhirPengadaan')),
                field('Pelaksanaan kontrak', rng('awalPekerjaan', 'akhirPekerjaan'), 'Awal kontrak tidak boleh sebelum akhir pemilihan'),
                field('Pemanfaatan barang/jasa', rng('awalKebutuhan', 'kebutuhan')))));
            bd.append(fs('Lokasi pekerjaan', lokasiEditor(pk, () => ubah('lokasiRaw'))));
            const ur = h('textarea', {}, pk.uraian || ''); ur.addEventListener('change', () => { pk.uraian = ur.value; ubah('uraian'); });
            const sp = h('textarea', { maxlength: 1000 }, pk.spesifikasi || ''); sp.addEventListener('change', () => { pk.spesifikasi = sp.value; ubah('spesifikasi'); });
            const vol = h('input', { type: 'text', value: pk.volume || '1 Paket' }); vol.addEventListener('change', () => { pk.volume = vol.value; ubah('volume'); });
            bd.append(fs('Uraian & spesifikasi', h('div', { class: 'formgrid', style: { gridTemplateColumns: '1fr' } }, field('Volume pekerjaan', vol)),
                h('div', { class: 'grid2', style: { marginTop: '12px' } }, field('Uraian pekerjaan', ur, baru ? 'Disusun dari item DIPA' : ''), field('Spesifikasi pekerjaan', sp, 'Maksimal 1.000 karakter (aturan SiRUP)'))));
        }
    }
    function lokasiEditor(pk, onChange, maks) {
        const box = h('div', {});
        const ubah = () => { if (onChange) onChange(); };
        const draw = () => {
            box.innerHTML = '';
            box.append(h('div', { class: 'lok', style: { marginBottom: '4px' } }, ...['Provinsi', 'Kabupaten/Kota', 'Detail lokasi', ''].map(t => h('span', { class: 'muted', style: { fontSize: '12px', fontWeight: 600 } }, t))));
            pk.lokasiRaw.forEach((l, j) => {
                const pv = h('select', {}, h('option', { value: '' }, '— pilih provinsi —'), ...Sirup.PROVINSI.map((n, i) => n ? h('option', { value: i, selected: +l.id_provinsi === i }, n) : null));
                const kb = h('select', {}, h('option', { value: '' }, '— pilih kab/kota —'));
                const fillKab = async () => {
                    kb.innerHTML = ''; kb.append(h('option', { value: '' }, '— pilih kab/kota —'));
                    if (!pv.value) return;
                    for (const k of await Sirup.kabupaten(+pv.value)) kb.append(h('option', { value: k.id, selected: +l.id_kabupaten === k.id }, k.nama));
                };
                pv.addEventListener('change', () => { l.id_provinsi = +pv.value; l.id_kabupaten = ''; l.prov = Sirup.PROVINSI[+pv.value]; fillKab(); ubah(); });
                kb.addEventListener('change', () => { l.id_kabupaten = +kb.value; l.kab = kb.options[kb.selectedIndex] ? kb.options[kb.selectedIndex].textContent : ''; ubah(); });
                const dt = h('input', { type: 'text', value: l.detil || '', placeholder: 'mis. nama kampus / alamat' }); dt.addEventListener('change', () => { l.detil = dt.value; ubah(); });
                fillKab();
                box.append(h('div', { class: 'lok' }, pv, kb, dt, pk.lokasiRaw.length > 1 ? h('button', { class: 'btn sm ghost', onclick: () => { pk.lokasiRaw.splice(j, 1); ubah(); draw(); } }, 'Hapus') : h('span', {})));
            });
            if (!maks || pk.lokasiRaw.length < maks) box.append(h('button', { class: 'btn sm', onclick: () => { pk.lokasiRaw.push({ id: '', id_provinsi: '', id_kabupaten: '', detil: '' }); ubah(); draw(); } }, '+ Tambah lokasi'));
        };
        draw();
        return box;
    }

    // ── 4.4 Jalankan ────────────────────────────────────────────────────
    function tahunDipa() { const m = String((S.dipa.meta || {}).periode || '').match(/(20\d\d)/); return m ? +m[1] : null; }
    function kesiapan() {
        const r = S.ren, out = [];
        const add = (ok, teks, fatal) => out.push({ ok, teks, fatal: !ok && fatal });
        add(S.ctx.isKPA, S.ctx.isKPA ? `Login KPA (${S.ctx.role})` : `Role "${S.ctx.role}" bukan KPA — eksekusi tidak tersedia`, true);
        add(!S.dipa.meta.satker || S.dipa.meta.satker === S.ctx.kodeSatker, `PDF DIPA milik satker ${S.dipa.meta.satker || '?'}, login satker ${S.ctx.kodeSatker || '?'}`, true);
        const th = tahunDipa();
        add(!th || th === S.ctx.tahun, th ? `Tahun DIPA ${th}, tahun SiRUP ${S.ctx.tahun}` : `Tahun DIPA tidak tertulis di PDF (RKK); tahun SiRUP ${S.ctx.tahun}`, true);
        add(!!(S.ctx.kodeBA && S.ctx.kodeEselon && S.ctx.kodeSatker), `Kode BA.eselon.satker: ${S.ctx.kodeBA || '?'}.${S.ctx.kodeEselon || '?'}.${S.ctx.kodeSatker || '?'}`, true);
        const pks = [...r.perubahan.filter(c => dipilih(c) && c.pk).map(c => [c.paketId, c.pk]), ...r.paketBaru.filter(b => dipilih(b) && b.hostId).map(b => [b.nama.slice(0, 50), b])];
        const salah = pks.map(([n, pk]) => [n, Rencana.periksa(pk, { komponenId })]).filter(([, e]) => e.length);
        const pkkr = salah.filter(([, e]) => e.some(x => /PKKR/.test(x)));
        add(!pkkr.length, pkkr.length ? `${pkkr.length} paket memakai komponen yang belum ada di PKKR — selesaikan langkah 2 dulu` : 'Semua komponen PKKR tersedia', false);
        add(!salah.length, salah.length ? `${salah.length} paket isiannya belum lengkap: ${salah.slice(0, 4).map(([n, e]) => `${n} (${e.join(', ')})`).join('; ')}` : 'Isian semua paket lengkap', false);
        const belum = r.kartu.filter(k => !k.diputuskan).length;
        add(true, belum ? `${belum} kartu belum diputuskan — tidak ikut dijalankan` : 'Semua kartu sudah diputuskan', false);
        return { out, salah };
    }
    function siapkanPk(pk) {
        const x = salin(pk);
        for (const a of x.anggaran || []) a.idKomponen = a.idKomponen || komponenId(a.mak);
        if (!x.pertahankan && !x.umkm && !x.alasanUmkm) {
            const L = S.alasanUmkmList || [];
            const tot = (x.anggaran || []).reduce((s, a) => s + (+a.pagu || 0), 0);
            x.alasanUmkm = (tot > 15e9 && L.find(a => /15/.test(a))) || L[0] || '';
        }
        delete x.items; delete x.kandidatHost; delete x.peringatan;
        return x;
    }
    // Urutan aman: revisi 1→1 dan titipan 1→N lebih dulu, lalu umumkan final draft, pembatalan paling akhir.
    // Bila satu revisi gagal proses berhenti, sehingga paket yang akan digantikan belum terlanjur dibatalkan.
    function susunAntrean() {
        const r = S.ren, q = [];
        const snap = id => { const p = S.pakets.find(x => x.id === id); return p ? { status: p.status, pagu: +p.pagu } : null; };
        const titipOn = new Set(r.titipan.filter(t => dipilih(t) && r.paketBaru.some(b => b.hostId === t.hostId && dipilih(b))).map(t => t.hostId));
        const ubahList = r.perubahan.filter(c => dipilih(c) && c.jenis === 'ubah' && !titipOn.has(c.paketId));
        for (const c of ubahList.filter(c => !c.umumkanDulu).concat(ubahList.filter(c => c.umumkanDulu)))
            q.push({ id: c.id, jenis: 'ubah', paketId: c.paketId, nama: c.nama, alasan: c.alasan, umumkanDulu: c.umumkanDulu, pk: siapkanPk(c.pk), snap: snap(c.paketId), sebelum: c.sebelum, sesudah: c.sesudah });
        for (const t of r.titipan.filter(t => titipOn.has(t.hostId))) {
            const ch = r.perubahan.find(c => c.paketId === t.hostId && c.jenis === 'ubah' && dipilih(c));
            const d1 = ch ? siapkanPk(ch.pk) : siapkanPk(t.pk1);
            const baru = r.paketBaru.filter(b => b.hostId === t.hostId && dipilih(b)).map(siapkanPk);
            q.push({ id: t.id, jenis: 'titip', paketId: t.hostId, nama: t.nama, draft1: ch ? 'koreksi' : 'tetap', snap: snap(t.hostId),
                alasan: (ch ? ch.alasan + '; ' : '') + 'penambahan paket sesuai DIPA revisi terakhir', pks: [d1, ...baru], sebelum: t.pagu, sesudah: (ch ? ch.sesudah : t.pagu) + baru.reduce((s2, x) => s2 + x.total, 0) });
        }
        const ids = r.umumkan.filter(dipilih).map(u => u.paketId);
        if (ids.length) q.push({ id: 'umumkan', jenis: 'umumkan', ids, nama: `${ids.length} final draft`, snap: Object.fromEntries(ids.map(i => [i, snap(i)])), sebelum: 0, sesudah: r.umumkan.filter(dipilih).reduce((s2, u) => s2 + u.pagu, 0) });
        for (const c of r.perubahan.filter(c => dipilih(c) && c.jenis === 'batal')) q.push({ id: c.id, jenis: 'batal', paketId: c.paketId, nama: c.nama, alasan: c.alasan, snap: snap(c.paketId), sebelum: c.sebelum, sesudah: 0 });
        for (const f of r.batalFD) q.push({ id: 'f:' + f.paketId, jenis: 'batalFD', paketId: f.paketId, nama: f.nama, alasan: 'Dikembalikan ke PPK: ' + f.alasan, snap: snap(f.paketId) });
        return { dibuat: new Date().toISOString(), satker: S.ctx.kodeSatker, tahun: S.ctx.tahun, langkah: q.map(x => ({ ...x, status: 'menunggu' })) };
    }
    const JENIS_LANGKAH = { batalFD: 'Kembalikan final draft ke PPK', batal: 'Batalkan paket', ubah: 'Revisi satu ke satu', titip: 'Revisi satu ke banyak', umumkan: 'Umumkan final draft' };
    const ST_LANGKAH = { menunggu: ['menunggu', 'p-mut'], berjalan: ['berjalan…', 'p-info'], selesai: ['selesai', 'p-ok'], gagal: ['gagal', 'p-bad'], dilewati: ['dilewati', 'p-warn'] };
    function uraianLangkah(L) {
        if (L.jenis === 'titip') return `${L.paketId} · draft #1 ${L.draft1 === 'koreksi' ? 'dikoreksi' : 'tetap'} + ${L.pks.length - 1} paket baru`;
        if (L.jenis === 'umumkan') return L.ids.join(', ');
        return `${L.paketId} · ${L.nama}${L.umumkanDulu ? ' (umumkan dulu)' : ''}`;
    }
    function tabJalankan(el) {
        const { out, salah } = kesiapan();
        const fatal = out.some(x => x.fatal);
        el.append(h('div', { class: 'card' }, h('h3', {}, 'Pemeriksaan sebelum menjalankan'),
            h('div', { class: 'cek' }, ...out.map(x => h('div', { class: x.ok ? 'ok' : x.fatal ? 'bad' : 'warn' }, (x.ok ? '✓ ' : x.fatal ? '✕ ' : '! ') + x.teks)))));
        const A = S.antre;
        if (!A || A.langkah.every(x => x.status !== 'menunggu' && x.status !== 'berjalan') && !A.langkah.some(x => x.status === 'gagal')) {
            if (A) el.append(laporanAntre(A));
            el.append(h('div', { class: 'card' }, h('h3', {}, 'Antrean eksekusi'),
                h('p', { class: 'note' }, 'Antrean disusun dari pilihan saat ini. Tiap langkah memeriksa ulang status dan pagu paket di SiRUP sebelum dikirim; bila berubah sejak dibaca, langkah itu dihentikan.'),
                h('button', { class: 'btn pri', disabled: fatal, onclick: () => { S.antre = susunAntrean(); simpanAntre(); log(`Antrean disusun: ${S.antre.langkah.length} langkah.`, 'o'); gambarRekap(); } }, A ? 'Susun antrean baru dari pilihan saat ini' : 'Susun antrean dari pilihan saat ini'),
                salah.length ? h('div', { class: 'muted', style: { marginTop: '8px', fontSize: '12.5px' } }, 'Paket yang isiannya belum lengkap tetap masuk antrean tetapi akan ditolak saat dijalankan — lengkapi dulu.') : null));
            actEl.append(h('div', { class: 'actionbar' }, h('span', { class: 'sum' }, ringkasPilihan())));
            return;
        }
        el.append(daftarAntre(A));
        const sisa = A.langkah.filter(x => x.status === 'menunggu').length;
        actEl.append(h('div', { class: 'actionbar' }, h('span', { class: 'sum' }, `${sisa} langkah menunggu · ${A.langkah.filter(x => x.status === 'selesai').length} selesai`),
            h('button', { class: 'btn danger', onclick: () => { S.stop = true; log('Permintaan berhenti diterima; proses berhenti setelah langkah berjalan selesai.', 'w'); } }, '■ Hentikan'),
            h('button', { class: 'btn', disabled: fatal || !sisa || !S.ctx.isKPA, onclick: () => guard(() => jalankanAntrean(true)) }, '▶ Jalankan 1 langkah'),
            h('button', { class: 'btn go', disabled: fatal || !sisa || !S.ctx.isKPA, onclick: () => guard(() => jalankanAntrean(false)) }, '▶▶ Jalankan semua')));
    }
    function daftarAntre(A) {
        const tb = h('tbody', {});
        A.langkah.forEach((L, i) => {
            const [st, cls] = ST_LANGKAH[L.status] || [L.status, 'p-mut'];
            const aksi = h('div', { class: 'row' });
            if (L.jenis === 'ubah' || L.jenis === 'titip') aksi.append(h('button', { class: 'btn sm ghost', onclick: () => lihatData(L) }, 'Lihat data'));
            if (L.status === 'gagal') aksi.append(h('button', { class: 'btn sm', onclick: () => { L.status = 'selesai'; L.pesan = (L.pesan || '') + ' · ditandai selesai manual'; simpanAntre(); gambarRekap(); } }, 'Tandai selesai'),
                h('button', { class: 'btn sm', onclick: () => { L.status = 'dilewati'; simpanAntre(); gambarRekap(); } }, 'Lewati'));
            tb.append(h('tr', {}, h('td', {}, String(i + 1)), h('td', {}, JENIS_LANGKAH[L.jenis]), h('td', {}, uraianLangkah(L)), h('td', { class: 'n' }, L.sebelum != null ? `${fmt(L.sebelum)} → ${fmt(L.sesudah)}` : ''),
                h('td', {}, pill(st, cls), L.hasil ? h('div', { class: 'muted', style: { fontSize: '12px' } }, L.hasil) : null, L.pesan ? h('div', { style: { fontSize: '12px', color: '#b91c1c' } }, L.pesan) : null), h('td', {}, aksi)));
        });
        return h('div', { class: 'card' }, h('div', { class: 'row' }, h('h3', { style: { margin: 0 } }, 'Antrean eksekusi'), h('span', { class: 'muted' }, `disusun ${new Date(A.dibuat).toLocaleString('id-ID')}`), h('span', { style: { flex: 1 } }),
            h('button', { class: 'btn sm ghost', onclick: async () => { if (await confirmBox('Hapus antrean', '<p>Antrean dihapus dari peramban ini. Langkah yang sudah selesai di SiRUP tidak dibatalkan.</p>', 'Hapus')) { S.antre = null; simpanAntre(); gambarRekap(); } } }, 'Hapus antrean')),
            h('div', { class: 'tbl', style: { marginTop: '10px' } }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Langkah'), h('th', {}, 'Paket'), h('th', { class: 'n' }, 'Pagu'), h('th', {}, 'Status'), h('th', {}, ''))), tb)));
    }
    function laporanAntre(A) {
        const selesai = A.langkah.filter(x => x.status === 'selesai');
        return h('div', { class: 'card' }, h('h3', {}, 'Hasil eksekusi terakhir'),
            h('p', { class: 'note' }, `${selesai.length} dari ${A.langkah.length} langkah selesai. Baca ulang RUP untuk memastikan rencana sudah tidak menyisakan perubahan, lalu samakan Struktur Anggaran.`),
            daftarAntre(A),
            h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => guard(async () => { await loadPakets(true); S.an = null; ensureAnalysis(); rekapTab = 'putuskan'; gambarRekap(); }) }, '↻ Baca ulang RUP'),
                h('button', { class: 'btn', onclick: exportExcel }, '⬇ Laporan Excel'), h('button', { class: 'btn pri', onclick: () => go(4) }, 'Lanjut: Struktur Anggaran →')));
    }
    async function lihatData(L) {
        const pay = L.jenis === 'ubah' ? await Sirup.revisiSatuKeSatu(S.ctx, { id: L.paketId }, L.pk, L.alasan, { dryRun: true })
            : await Sirup.revisiSatuKeBanyak(S.ctx, { id: L.paketId }, L.pks, L.alasan, { dryRun: true });
        await modal(`Data yang dikirim — ${JENIS_LANGKAH[L.jenis]} ${L.paketId} (belum dikirim)`, h('div', {},
            h('p', { class: 'note' }, 'Isian ini digabung dengan form revisi SiRUP saat dijalankan (id baris dan isian lain diambil dari form).'),
            ...pay.payloads.map((f, i) => h('details', { open: i === 0 }, h('summary', {}, `Draft #${i + 1}${L.jenis === 'titip' && i === 0 ? (L.draft1 === 'koreksi' ? ' (paket ini, dikoreksi)' : ' (paket ini, tanpa perubahan)') : ''}`),
                h('pre', { class: 'mono', style: { whiteSpace: 'pre-wrap' } }, [...f.entries()].map(([k, v]) => `${k} = ${v}`).join('\n'))))), [['Tutup', false, 'pri']]);
    }
    function salahIsiLangkah(L) {
        const pks = L.jenis === 'ubah' ? [L.pk] : L.jenis === 'titip' ? L.pks : [];
        for (const pk of pks) for (const a of pk.anggaran || []) a.idKomponen = a.idKomponen || komponenId(a.mak);
        return pks.map((pk, i) => [i, Rencana.periksa(pk, { komponenId })]).filter(([, e]) => e.length)
            .map(([i, e]) => `${L.jenis === 'titip' ? `draft #${i + 1}: ` : ''}${e.join(', ')}`);
    }
    async function daftarKini() { return new Map((await Sirup.daftarPaket(S.ctx.tahun)).map(p => [p.id, p])); }
    async function jalankanAntrean(satu) {
        const A = S.antre;
        const todo = A.langkah.filter(x => x.status === 'menunggu');
        if (!todo.length) return;
        if (!satu) {
            const salah = todo.map(L => [L, salahIsiLangkah(L)]).filter(([, e]) => e.length);
            if (salah.length) {
                const lewati = await modal('Ada langkah yang isiannya belum lengkap', h('div', {},
                    h('p', { class: 'note' }, `${salah.length} langkah tidak bisa dikirim ke SiRUP. Lengkapi dulu (mis. tambah cabang PKKR di langkah 2, atur lokasi satker), atau lewati langkah itu dan jalankan sisanya.`),
                    h('div', { class: 'errbox' }, ...salah.slice(0, 20).map(([L, e]) => h('div', {}, `${JENIS_LANGKAH[L.jenis]} ${uraianLangkah(L)}: ${e.join('; ')}`)))),
                    [['Batal', false, ''], ['Lewati yang belum lengkap', true, 'go']]);
                if (!lewati) return;
                for (const [L, e] of salah) { L.status = 'dilewati'; L.pesan = 'isian belum lengkap: ' + e.join('; '); }
                simpanAntre(); gambarRekap();
                return jalankanAntrean(false);
            }
        }
        const daftar = (satu ? [todo[0]] : todo);
        const ok = await confirmBox(satu ? 'Jalankan 1 langkah di SiRUP' : `Jalankan ${todo.length} langkah di SiRUP`,
            `<ol>${daftar.map(L => `<li><b>${JENIS_LANGKAH[L.jenis]}</b> — ${esc(uraianLangkah(L))}</li>`).join('')}</ol>
            <p class="note">Semua langkah mengubah data SiRUP atas nama akun KPA ini. Hasil revisi (Final Draft) langsung diumumkan. Bila satu langkah gagal, proses berhenti dan langkah berikutnya tidak dijalankan.</p>`);
        if (!ok) return;
        let tersentuh = 0;
        try {
            for (const L of daftar) {
                if (S.stop) { log('Dihentikan.', 'w'); break; }
                L.status = 'berjalan'; L.pesan = ''; simpanAntre(); gambarRekap();
                log(`${JENIS_LANGKAH[L.jenis]}: ${uraianLangkah(L)}`);
                tersentuh++;
                try { await jalankanLangkah(L); L.status = 'selesai'; log(`  selesai${L.hasil ? ' — ' + L.hasil : ''}`, 'o'); }
                catch (e) { L.status = 'gagal'; L.pesan = e.message; simpanAntre(); gambarRekap(); throw e; }
                simpanAntre(); gambarRekap();
                await Sirup.sleep(S.cfg.jeda);
            }
        } finally {
            // SiRUP sudah berubah → data paket lama tidak boleh dipakai lagi (rencana, struktur anggaran, Excel)
            if (tersentuh) await segarkanSetelahEksekusi();
        }
    }
    async function segarkanSetelahEksekusi() {
        try {
            log('Membaca ulang paket RUP setelah eksekusi…');
            await loadPakets(true);
            S.an = null; ensureAnalysis();
            log('Paket RUP sudah dibaca ulang; rencana dihitung dari data terbaru.', 'o');
        } catch (e) { log(`Gagal membaca ulang paket setelah eksekusi (${e.message}). Klik "Baca ulang RUP" sebelum lanjut.`, 'e'); }
        gambarRekap();
    }
    async function jalankanLangkah(L) {
        const salahIsi = salahIsiLangkah(L);
        if (salahIsi.length) throw new Error('Isian belum lengkap, tidak dikirim ke SiRUP: ' + salahIsi.join('; '));
        if (!Sirup.konteksLengkap(S.ctx)) throw new Error('Kode BA/eselon/satker belum terbaca — baca ulang paket (langkah 3).');
        const kini = await daftarKini();
        const cek = (id, s) => {
            const p = kini.get(id);
            if (!p || !s || p.status !== s.status || Math.abs(+p.pagu - s.pagu) > 1)
                throw new Error(`Paket ${id} berubah sejak dibaca (sekarang ${p ? `status ${Analysis.ST[p.status] || p.status}, pagu ${fmt(p.pagu)}` : 'tidak ada di daftar'}; semula ${s ? `status ${Analysis.ST[s.status] || s.status}, pagu ${fmt(s.pagu)}` : '-'}). Baca ulang paket di langkah 3, lalu susun antrean baru.`);
        };
        if (L.jenis === 'batalFD') {
            cek(L.paketId, L.snap);
            await Sirup.batalFinalDraft(L.paketId, L.alasan);
            const p = (await daftarKini()).get(L.paketId);
            if (p && p.status === '2') throw new Error('Status final draft tidak berubah.');
            L.hasil = p ? `status ${Analysis.ST[p.status] || p.status}` : 'tidak lagi di daftar';
            return;
        }
        if (L.jenis === 'batal') {
            cek(L.paketId, L.snap);
            await Sirup.batalkanPaket(L.paketId, L.alasan);
            const p = (await daftarKini()).get(L.paketId);
            if (p && p.status === '3' && p.aktif !== 'false') throw new Error('Paket masih berstatus Terumumkan setelah pembatalan.');
            L.hasil = p ? `status ${Analysis.ST[p.status] || p.status}` : 'dibatalkan';
            return;
        }
        if (L.jenis === 'umumkan') {
            for (const id of L.ids) cek(id, L.snap[id]);
            await Sirup.umumkan(L.ids);
            const k2 = await daftarKini();
            const belum = L.ids.filter(i => (k2.get(i) || {}).status !== '3');
            if (belum.length) throw new Error('Belum terumumkan: ' + belum.join(', '));
            L.hasil = 'terumumkan';
            return;
        }
        if (L.jenis === 'ubah') {
            cek(L.paketId, L.snap);
            if (L.umumkanDulu) {
                await Sirup.umumkan([L.paketId]);
                const p = (await daftarKini()).get(L.paketId);
                if (!p || p.status !== '3') throw new Error('Final draft gagal diumumkan sebelum direvisi.');
                log(`  ${L.paketId} diumumkan dulu`, 'o');
            }
            const res = await Sirup.revisiSatuKeSatu(S.ctx, { id: L.paketId }, L.pk, L.alasan);
            await umumkanHasil(L, res, 1);
            return;
        }
        if (L.jenis === 'titip') {
            cek(L.paketId, L.snap);
            const res = await Sirup.revisiSatuKeBanyak(S.ctx, { id: L.paketId }, L.pks, L.alasan, { onStep: (i, n) => log(`  simpan draft ${i}/${n}`) });
            await umumkanHasil(L, res, L.pks.length);
        }
    }
    async function umumkanHasil(L, res, harap) {
        L.kodeBaru = res.baru.map(p => p.id);
        if (!res.donorHilang) log(`  PERHATIAN: paket asal ${L.paketId} masih ada di daftar`, 'w');
        if (res.baru.length !== harap) log(`  PERHATIAN: diharapkan ${harap} paket hasil, terbaca ${res.baru.length}`, 'w');
        const fd = res.baru.filter(p => p.status === '2').map(p => p.id);
        if (fd.length) await Sirup.umumkan(fd);
        const k2 = await daftarKini();
        const belum = L.kodeBaru.filter(i => (k2.get(i) || {}).status !== '3');
        L.hasil = `${L.kodeBaru.length} paket hasil: ${L.kodeBaru.join(', ') || '-'}${belum.length ? ` · belum terumumkan: ${belum.join(', ')}` : ' (terumumkan)'}`;
        if (!L.kodeBaru.length) throw new Error('SiRUP tidak menghasilkan paket baru. Cek daftar paket sebelum mengulang.');
        if (belum.length) throw new Error(`Revisi tersimpan, tetapi ${belum.join(', ')} belum terumumkan. Umumkan manual di SiRUP, lalu klik "Tandai selesai".`);
    }

    // ── 5. Struktur anggaran ───────────────────────────────────────────
    // RUP terumumkan per jenis belanja dibaca langsung dari SiRUP, bukan dari data paket langkah 3
    // (data itu bisa usang setelah eksekusi; struktur anggaran 653526 pernah tersimpan dari data sebelum revisi).
    async function bacaRupSegar(onProgress) {
        const list = await Sirup.daftarPaket(S.ctx.tahun, 'penyedia');
        const sw = await Sirup.daftarPaket(S.ctx.tahun, 'swakelola').catch(() => []);
        const U = list.filter(p => p.status === '3' && p.aktif !== 'false');
        const per = { barjas: 0, modal: 0, sosial: 0, hibah: 0, lainnya: 0, lain: 0 };
        let total = 0, tanpaBaris = 0, i = 0;
        for (const p of U) {
            const j = await Sirup.denorm(p.id, S.ctx.tahun).catch(() => null);
            const rows = (j && j.paket_anggaran_json) || [];
            if (!rows.length) { tanpaBaris++; per.lain += +p.pagu || 0; total += +p.pagu || 0; }
            for (const r of rows) {
                const g = Classify.jenisBelanja(String(r.mak || '').split('.').pop());
                per[g in per ? g : 'lain'] += +r.pagu || 0;
                total += +r.pagu || 0;
            }
            if (onProgress) onProgress(++i, U.length);
        }
        const swU = sw.filter(p => p.status === '3' && p.aktif !== 'false');
        return { per, total, paket: U.length, tanpaBaris, swakelola: { n: swU.length, pagu: swU.reduce((s2, p) => s2 + (+p.pagu || 0), 0) },
            waktu: new Date(), sig: U.map(p => `${p.id}:${p.pagu}`).sort().join(',') };
    }
    function stepStruktur() {
        if (needDipa()) return;
        guard(async () => {
            ensureAnalysis();
            const info = h('div', {}, h('div', { class: 'muted' }, 'Membaca RUP terumumkan dan struktur anggaran terkini dari SiRUP…'));
            const pg = progress(); info.append(pg); body.append(info);
            S.rupSegar = await bacaRupSegar((x, n) => pg.set(x, n));
            S.sa = await Sirup.strukturAnggaran();
            info.remove();
            gambarStruktur();
        });
    }
    function gambarStruktur() {
        if (S.step !== 4) return;
        body.innerHTML = ''; if (actEl) actEl.innerHTML = '';
        const R = S.rupSegar, rup = R.per;
        const dipa = { barjas: 0, modal: 0, sosial: 0, hibah: 0, lainnya: 0 };
        for (const a of S.an.akun.values()) { const g = Classify.jenisBelanja(a.akun); if (g in dipa) dipa[g] += a.P; }
        const rows = [['barjas', 'Barang/Jasa (52)'], ['modal', 'Modal (53)'], ['sosial', 'Bantuan Sosial (57)'], ['hibah', 'Hibah (56)'], ['lainnya', 'Lainnya (54,55,58)']];
        const tot = o => rows.reduce((s2, [k]) => s2 + (o[k] || 0), 0);
        const pct = (a, b) => b ? (a / b * 100).toFixed(2).replace('.', ',') + '%' : '–';
        const sama = Math.abs(tot(rup) - tot(dipa)) <= 1000;
        const target = Object.fromEntries(rows.map(([k]) => [k, rup[k]]));
        const mode = h('select', {}, h('option', { value: 'rup' }, 'Samakan dengan RUP terumumkan (target IKU 100%)'), h('option', { value: 'dipa' }, 'Samakan dengan pagu pengadaan DIPA'), h('option', { value: 'manual' }, 'Isi manual'));
        const tb = h('tbody', {});
        const draw = () => {
            tb.innerHTML = '';
            for (const [k, l] of rows) {
                if (mode.value !== 'manual') target[k] = mode.value === 'rup' ? rup[k] : dipa[k];
                const inp = h('input', { type: 'number', value: Math.round(target[k]), style: { width: '170px' }, disabled: mode.value !== 'manual' });
                inp.addEventListener('input', () => { target[k] = +inp.value || 0; });
                tb.append(h('tr', {}, h('td', {}, l), h('td', { class: 'n' }, fmt(S.sa[k])), h('td', { class: 'n' }, fmt(rup[k])), h('td', { class: 'n' }, fmt(dipa[k])), h('td', { class: 'n' }, inp),
                    h('td', {}, rup[k] > dipa[k] + 1000 ? pill('RUP > pagu pengadaan DIPA', 'p-warn') : Math.abs(S.sa[k] - rup[k]) <= 1000 ? pill('sudah sama', 'p-ok') : pill(`beda ${fmt(S.sa[k] - rup[k])}`, 'p-bad'))));
            }
            tb.append(h('tr', {}, h('td', {}, h('b', {}, 'Total belanja pengadaan')), h('td', { class: 'n' }, h('b', {}, fmt(tot(S.sa)))), h('td', { class: 'n' }, h('b', {}, fmt(tot(rup)))), h('td', { class: 'n' }, h('b', {}, fmt(tot(dipa)))),
                h('td', { class: 'n' }, h('b', {}, fmt(tot(target)))), h('td', {}, h('b', {}, `IKU sekarang ${pct(R.total, tot(S.sa))} → setelah disimpan ${pct(R.total, tot(target))}`))));
        };
        mode.addEventListener('change', draw);
        draw();
        const jam = R.waktu.toLocaleTimeString('id-ID');
        const pesan = [];
        const antre = S.antre ? S.antre.langkah.filter(x => x.status === 'menunggu' || x.status === 'berjalan').length : 0;
        if (antre) pesan.push(h('div', { class: 'warnbox' }, `Masih ada ${antre} langkah antrean yang belum dijalankan. Samakan Struktur Anggaran setelah antrean selesai, supaya angkanya tidak berubah lagi.`));
        if (R.swakelola.n) pesan.push(h('div', { class: 'warnbox' }, `Ada ${R.swakelola.n} paket swakelola terumumkan (Rp${fmt(R.swakelola.pagu)}) yang belum ikut dihitung per jenis belanja. Bila penilaian juga menghitung swakelola, tambahkan nilainya lewat "Isi manual".`));
        if (R.per.lain) pesan.push(h('div', { class: 'warnbox' }, `Rp${fmt(R.per.lain)} RUP terumumkan berada di akun di luar belanja barang/modal/bansos/hibah/lainnya${R.tanpaBaris ? ` (${R.tanpaBaris} paket tanpa baris anggaran)` : ''}. Nilai ini tidak masuk struktur anggaran, jadi IKU tidak bisa tepat 100% sebelum paketnya dikoreksi.`));
        if (S.pakets && S.pakets.length) {
            const lama = S.pakets.filter(p => p.status === '3' && p.aktif !== 'false').map(p => `${p.id}:${p.pagu}`).sort().join(',');
            if (lama !== R.sig) pesan.push(h('div', { class: 'infobox' }, 'Data paket di langkah 3–4 sudah berbeda dari SiRUP saat ini (ada paket yang berubah). Angka di bawah memakai data terbaru; baca ulang paket bila ingin rencana di langkah 4 ikut diperbarui.'));
        }
        if (sama) pesan.push(h('div', { class: 'okbox' }, `RUP terumumkan sudah sama dengan pagu pengadaan DIPA (Rp${fmt(tot(dipa))}). Kedua pilihan rekomendasi memberi angka yang sama.`));
        body.append(h('div', { class: 'card' }, h('h3', {}, 'Struktur Anggaran (penyebut IKU RUP terumumkan)'),
            h('p', { class: 'note' }, `RUP terumumkan dibaca langsung dari SiRUP pukul ${jam} (${R.paket} paket penyedia, Rp${fmt(R.total)}). Struktur anggaran terakhir diperbarui di SiRUP: ${S.sa.diperbarui || '–'}.`),
            ...pesan,
            h('div', { class: 'row' }, h('span', {}, 'Rekomendasi:'), mode),
            h('div', { class: 'tbl', style: { marginTop: '8px' } }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, ...['Jenis belanja', 'Saat ini di SiRUP', `RUP terumumkan (${jam})`, 'Pagu pengadaan DIPA', 'Akan disimpan', ''].map((t, i) => h('th', { class: i && i < 5 ? 'n' : '' }, t)))), tb)),
            h('div', { class: 'warnbox' }, 'Struktur anggaran seharusnya mencerminkan pagu belanja pengadaan DIPA. Bila RUP terumumkan melebihi DIPA (mis. paket tahun jamak dicatat nilai kontrak penuh), menyamakan dengan RUP akan membuat struktur anggaran lebih besar dari DIPA — pastikan ini sesuai arahan pembina.'),
            h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => go(4) }, '↻ Baca ulang dari SiRUP'),
                h('button', { class: 'btn go', disabled: !S.ctx.isKPA, onclick: () => guard(async () => {
                    // RUP bisa berubah sejak tabel ditampilkan (mis. PPK mengumumkan paket) → baca lagi sebelum menyimpan
                    const cek = await bacaRupSegar();
                    if (cek.sig !== R.sig) { S.rupSegar = cek; log('RUP terumumkan berubah sejak tabel ditampilkan. Angka sudah diperbarui; periksa lalu simpan lagi.', 'w'); gambarStruktur(); return; }
                    const ok = await confirmBox('Perbarui Struktur Anggaran', `<table class="t">${rows.map(([k, l]) => `<tr><td>${l}</td><td class="n">${fmt(S.sa[k])} → <b>${fmt(target[k])}</b></td></tr>`).join('')}</table>
                        <p class="note">IKU setelah disimpan: ${pct(R.total, tot(target))} (RUP terumumkan Rp${fmt(R.total)} dibaca pukul ${cek.waktu.toLocaleTimeString('id-ID')}).</p>`, 'Simpan ke SiRUP');
                    if (!ok) return;
                    S.sa = await Sirup.simpanStrukturAnggaran(S.sa, target, S.ctx.tahun);
                    log(`Struktur anggaran disimpan. IKU = ${pct(R.total, tot(S.sa))}.`, 'o');
                    gambarStruktur();
                }) }, 'Simpan ke Struktur Anggaran'))));
    }

    // ── pengaturan & ekspor ─────────────────────────────────────────────
    async function settings() {
        const c = S.cfg;
        const num = (k, l, hint) => { const i = h('input', { type: 'number', value: c[k] }); i.addEventListener('input', () => { c[k] = +i.value; }); return h('div', { class: 'field' }, h('label', {}, l), i, hint ? h('div', { class: 'hint' }, hint) : null); };
        const pilih = (k, l, opts) => { const sl = h('select', {}, ...opts.map(([v, t]) => h('option', { value: v, selected: c[k] === v }, t))); sl.addEventListener('change', () => { c[k] = sl.value; }); return h('div', { class: 'field' }, h('label', {}, l), sl); };
        await modal('Pengaturan', h('div', {},
            h('div', { class: 'formgrid' },
                num('ambangSelisih', 'Ambang selisih yang diabaikan (Rp)', 'Kekurangan/kelebihan sekecil ini tidak dibuatkan revisi'),
                num('ambangKeputusan', 'Ambang kartu keputusan (Rp)', 'Kelebihan di atas ini wajib diputuskan manual'),
                pilih('grupPaketBaru', 'Pengelompokan paket baru', [['sub', 'Per sub-komponen + jenis pengadaan'], ['komp', 'Per komponen + jenis pengadaan'], ['akun', 'Per akun (MAK)']]),
                num('maxPaketPerRevisi', 'Maks. paket baru per revisi satu ke banyak'),
                num('plBarjas', 'Batas PL barang/jasa lainnya (Rp)'), num('plKonstruksi', 'Batas PL konstruksi (Rp)'), num('plKonsultansi', 'Batas PL konsultansi (Rp)'),
                pilih('metodeEO', 'Metode paket EO di atas batas PL', [['Tender', 'Tender'], ['Seleksi', 'Seleksi'], ['Tender Cepat', 'Tender Cepat'], ['E-Purchasing', 'E-Purchasing']]),
                num('jeda', 'Jeda antar-permintaan (ms)')),
            h('p', { class: 'note', style: { marginTop: '12px' } }, `Lokasi satker: ${S.lokasiSatker ? `${S.lokasiSatker.kab}, ${S.lokasiSatker.prov} — ${S.lokasiSatker.detil}` : 'belum diatur'} (atur di langkah 4 → Putuskan).`)), [['Simpan', true, 'pri']]);
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
        if (S.ren) {
            add('Keputusan', [['Kartu', 'judul', 50], ['Jenis', 'jenis', 14], ['Ringkasan', 'ringkas', 90], ['Pilihan', 'pilihan', 16], ['Status', 'st', 16]],
                S.ren.kartu.map(k => ({ judul: k.judul, jenis: k.jenis, ringkas: k.ringkas, pilihan: k.pilihan || '', st: !k.diputuskan ? 'belum' : k.otomatis ? 'otomatis' : 'diputuskan' })));
            add('Perubahan Paket', [['Kode RUP', 'id', 11], ['Nama', 'nama', 50], ['Tindakan', 'label', 34], ['Pagu sebelum', 'a', 16, N], ['Pagu sesudah', 'b', 16, N], ['MAK sesudah', 'mak', 60], ['Catatan', 'ket', 70], ['Dipilih', 'pilih', 8]],
                S.ren.perubahan.map(c => ({ id: c.paketId, nama: c.nama, label: c.label.join(', '), a: c.sebelum, b: c.jenis === 'batal' ? 0 : c.sesudah, mak: c.rowsSesudah.map(x => `${x.mak}=${fmt(x.pagu)}`).join('; '), ket: [...c.catatan, ...c.peringatan].join(' | '), pilih: dipilih(c) ? 'ya' : 'tidak' })));
            add('Paket Baru', [['Nama', 'nama', 60], ['Jenis', 'jenis', 18], ['Metode', 'metode', 18], ['Pagu', 'total', 16, N], ['MAK', 'mak', 60], ['Dititipkan ke', 'host', 12], ['Lokasi', 'lok', 30], ['Jadwal', 'jd', 24], ['Peringatan', 'pr', 60], ['Dipilih', 'pilih', 8]],
                S.ren.paketBaru.map(b => ({ nama: b.nama, jenis: b.jenis, metode: b.metode, total: b.total, mak: b.anggaran.map(x => `${x.mak}=${fmt(x.pagu)}`).join('; '), host: b.hostId || '-', lok: b.lokasiRaw.map(l => l.kab || l.id_kabupaten).join(', '), jd: `${b.jadwal.awalPengadaan} s.d. ${b.jadwal.kebutuhan}`, pr: b.peringatan.join(' | '), pilih: dipilih(b) ? 'ya' : 'tidak' })));
        }
        if (S.antre) add('Hasil Eksekusi', [['#', 'no', 5], ['Langkah', 'jenis', 26], ['Paket', 'paket', 50], ['Status', 'status', 12], ['Kode RUP baru', 'baru', 40], ['Hasil / pesan', 'hasil', 80]],
            S.antre.langkah.map((L, i) => ({ no: i + 1, jenis: JENIS_LANGKAH[L.jenis], paket: uraianLangkah(L), status: L.status, baru: (L.kodeBaru || []).join(', '), hasil: [L.hasil, L.pesan].filter(Boolean).join(' · ') })));
        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = h('a', { href: URL.createObjectURL(blob), download: `Sanding_DIPA_RUP_${S.ctx.kodeSatker}_${new Date().toISOString().slice(0, 10)}.xlsx` });
        document.body.append(a); a.click(); a.remove();
        log('Kertas kerja Excel diunduh.', 'o');
    }

    function mount() {
        if (document.querySelector('.sdr-fab')) return;
        document.querySelectorAll('style[data-sdr]').forEach(e => e.remove()); // CSS versi lama (upgrade tanpa muat ulang)
        const style = document.createElement('style'); style.dataset.sdr = APP_VERSION; style.textContent = CSS; document.head.append(style);
        document.body.append(h('button', { class: 'sdr-fab', onclick: open, title: APP }, '⇄ ', APP));
    }
    return { mount, open, S };
})();


window.__sdrDebug = { Sirup, Analysis, Rencana, Classify, DipaParser, UI }; // diagnostik lewat DevTools

if (/\/sirup\//.test(location.pathname) && !/loginctr|public\//.test(location.pathname)) UI.mount();
})();
