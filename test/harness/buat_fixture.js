// Membuat test/harness/fixture.js (data 626402 untuk halaman uji UI; tidak ikut git).
const D = require('../data626402.js');
const fs = require('fs');
const dipa = D.dipa();
const pkkr = [...D.pkkr().entries()].map(([key, n]) => ({ ...n, key }));
const pakets = D.pakets();
const out = { dipa: { meta: { ...dipa.meta, periode: dipa.meta.periode || 'September 2026' }, check: dipa.check || { itemTotal: dipa.items.reduce((s, i) => s + (i.pagu || 0), 0), mismatches: [], ok: true },
    nodes: [...dipa.nodes.values()], items: dipa.items }, pkkr, pakets };
fs.writeFileSync(__dirname + '/fixture.js', 'window.FIX = ' + JSON.stringify(out) + ';\n');
console.log('fixture.js', (JSON.stringify(out).length / 1e6).toFixed(2), 'MB', 'items', dipa.items.length, 'pakets', pakets.length);
