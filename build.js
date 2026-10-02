// Menggabungkan modul src/ menjadi satu userscript Tampermonkey.
// node build.js  →  dist/sirup_sanding_dipa.user.js (skrip lengkap, @downloadURL)
//                   dist/sirup_sanding_dipa.meta.js (blok metadata saja, @updateURL → cek versi ringan)
const fs = require('fs');
const path = require('path');
// akhir baris diseragamkan ke LF (checkout Windows memakai CRLF)
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/\r\n/g, '\n').replace(/\nif \(typeof module !== 'undefined'\)[^\n]*\n?/g, '\n');
const header = src('header.js');
const version = (header.match(/@version\s+(\S+)/) || [])[1];
const body = [
    `const APP_VERSION = '${version}';`,
    `const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';`,
    src('ui_css.js'), src('dipa_parser.js'), src('classify.js'), src('analysis.js'), src('rencana.js'), src('sirup_api.js'), src('ui.js'),
    `window.__sdrDebug = { Sirup, Analysis, Rencana, Classify, DipaParser, UI }; // diagnostik lewat DevTools`,
    `if (/\\/sirup\\//.test(location.pathname) && !/loginctr|public\\//.test(location.pathname)) UI.mount();`,
].join('\n\n');
const out = `${header}\n(function () {\n'use strict';\n${body}\n})();\n`;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'sirup_sanding_dipa.user.js'), out);
// Tampermonkey mengunduh @updateURL setiap pemeriksaan pembaruan; cukup blok metadata (±1 KB, bukan ±260 KB).
// Skrip lengkap baru diunduh dari @downloadURL bila @version di sini lebih tinggi dari yang terpasang.
const meta = header.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
if (!meta) throw new Error('Blok metadata tidak ditemukan di src/header.js');
fs.writeFileSync(path.join(__dirname, 'dist', 'sirup_sanding_dipa.meta.js'), meta[0] + '\n');
console.log('dist/sirup_sanding_dipa.user.js', out.length, 'bytes, versi', version);
console.log('dist/sirup_sanding_dipa.meta.js', meta[0].length + 1, 'bytes');
