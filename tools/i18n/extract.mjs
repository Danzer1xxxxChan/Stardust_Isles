// Lists every t('...') key in src/ and data-i18n key in index.html; reports keys missing from en.js.
// Usage: node tools/i18n/extract.mjs [--json out.json]
import fs from 'node:fs';
import path from 'node:path';
import { parseAst } from 'rolldown/parseAst';

const keys = new Map();
const add = (k, where) => { if (!keys.has(k)) keys.set(k, where); };
const walkDir = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkDir(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
function walk(n, f) {
  if (!n || typeof n.type !== 'string') return;
  f(n);
  for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach((c) => walk(c, f)); else if (v && typeof v.type === 'string') walk(v, f); }
}
for (const file of walkDir('src')) {
  if (file.startsWith('src/i18n')) continue;
  const code = fs.readFileSync(file, 'utf8');
  walk(parseAst(code, { lang: 'js' }), (n) => {
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && (n.callee.name === 't' || n.callee.name === 'tr')) {
      const a = n.arguments[0];
      if (a && a.type === 'Literal' && typeof a.value === 'string') add(a.value, file);
      else if (a && a.type === 'Identifier') { /* t(x): runtime value, must be a key elsewhere */ }
    }
  });
}
for (const m of fs.readFileSync('index.html', 'utf8').matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)) add(m[1], 'index.html');
const { EN } = await import(path.resolve('src/i18n/en.js'));
const missing = [...keys.keys()].filter((k) => !(k in EN));
const unused = Object.keys(EN).filter((k) => !keys.has(k));
console.log(`keys: ${keys.size}, translated: ${keys.size - missing.length}, missing: ${missing.length}, unused: ${unused.length}`);
const i = process.argv.indexOf('--json');
if (i > 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify(missing.map((k) => ({ k, f: keys.get(k) })), null, 1));
if (process.argv.includes('--list')) for (const k of missing) console.log(JSON.stringify(k));
