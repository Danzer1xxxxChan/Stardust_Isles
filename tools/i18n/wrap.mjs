// One-off codemod: wraps every string literal / template literal containing Chinese in t(...).
// Template literals become t('前缀{0}后缀', [expr]). Already-wrapped strings are left alone.
// Usage: node tools/i18n/wrap.mjs [--write] file...
import fs from 'node:fs';
import path from 'node:path';
import { parseAst } from 'rolldown/parseAst';

const write = process.argv.includes('--write');
const files = process.argv.slice(2).filter((f) => !f.startsWith('--'));
const CJK = /[一-鿿　-〿！-｠]/;
const I18N = path.resolve('src/i18n.js');

function walk(node, parent, visit) {
  if (!node || typeof node.type !== 'string') return;
  if (visit(node, parent) === false) return;
  for (const k of Object.keys(node)) {
    if (k === 'parent') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && walk(c, node, visit));
    else if (v && typeof v.type === 'string') walk(v, node, visit);
  }
}

const isT = (n) => n && n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 't';

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  const ast = parseAst(code, { lang: 'js' });
  const targets = [];
  walk(ast, null, (n, p) => {
    if (n.type === 'ImportDeclaration') return false;
    if (isT(n)) return false;
    if (n.type === 'TaggedTemplateExpression') return false;
    if (n.type === 'Literal' && typeof n.value === 'string' && CJK.test(n.value)) {
      if (p && p.type === 'Property' && p.key === n && !p.computed) return;
      targets.push(n);
    }
    if (n.type === 'TemplateLiteral' && n.quasis.some((q) => CJK.test(q.value.cooked))) targets.push(n);
  });
  // Rewrite a source range, applying nested target rewrites inside it.
  const rewrite = (start, end) => {
    const inner = targets.filter((x) => x.start >= start && x.end <= end && !(x.start === start && x.end === end));
    const top = inner.filter((x) => !inner.some((y) => y !== x && y.start <= x.start && y.end >= x.end));
    top.sort((a, b) => a.start - b.start);
    let out = '', pos = start;
    for (const x of top) { out += code.slice(pos, x.start) + render(x); pos = x.end; }
    return out + code.slice(pos, end);
  };
  const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
  const render = (n) => {
    if (n.type === 'Literal') return `t(${q(n.value)})`;
    if (!n.expressions.length) return `t(${q(n.quasis[0].value.cooked)})`;
    let key = '';
    n.quasis.forEach((qq, i) => { key += qq.value.cooked.replace(/\{/g, '{{').replace(/\}/g, '}}'); if (i < n.expressions.length) key += `{${i}}`; });
    const args = n.expressions.map((e) => rewrite(e.start, e.end));
    return `t(${q(key)}, [${args.join(', ')}])`;
  };
  if (!targets.length) continue;
  let out = rewrite(0, code.length);
  if (!/import \{ t \} from/.test(out)) {
    let rel = path.relative(path.dirname(path.resolve(file)), I18N).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    const imports = ast.body.filter((b) => b.type === 'ImportDeclaration');
    const at = imports.length ? imports[imports.length - 1].end : 0;
    out = out.slice(0, at) + (at ? '\n' : '') + `import { t } from '${rel}';` + (at ? '' : '\n') + out.slice(at);
  }
  console.log(`${file}: ${targets.length} strings`);
  if (write) fs.writeFileSync(file, out);
}
