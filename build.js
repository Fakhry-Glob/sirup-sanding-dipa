// Menggabungkan modul src/ menjadi satu userscript Tampermonkey.
// node build.js  →  dist/sirup_sanding_dipa.user.js
const fs = require('fs');
const path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/\nif \(typeof module !== 'undefined'\)[^\n]*\n?/g, '\n');
const header = src('header.js');
const version = (header.match(/@version\s+(\S+)/) || [])[1];
const body = [
    `const APP_VERSION = '${version}';`,
    `const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';`,
    src('ui_css.js'), src('dipa_parser.js'), src('classify.js'), src('analysis.js'), src('sirup_api.js'), src('ui.js'),
    `if (/\\/sirup\\//.test(location.pathname) && !/loginctr|public\\//.test(location.pathname)) UI.mount();`,
].join('\n\n');
const out = `${header}\n(function () {\n'use strict';\n${body}\n})();\n`;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'sirup_sanding_dipa.user.js'), out);
console.log('dist/sirup_sanding_dipa.user.js', out.length, 'bytes, versi', version);
