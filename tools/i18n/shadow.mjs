// Reports t('...') calls where `t` is shadowed by a local binding (param, variable, catch, loop var).
import fs from 'node:fs';
import path from 'node:path';
import { parseAst } from 'rolldown/parseAst';

const walkDir = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkDir(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
const names = (p, out = []) => {
  if (!p) return out;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'AssignmentPattern') names(p.left, out);
  else if (p.type === 'RestElement') names(p.argument, out);
  else if (p.type === 'ArrayPattern') p.elements.forEach((e) => names(e, out));
  else if (p.type === 'ObjectPattern') p.properties.forEach((q) => names(q.type === 'RestElement' ? q.argument : q.value, out));
  return out;
};
let bad = 0;
for (const file of walkDir('src')) {
  const code = fs.readFileSync(file, 'utf8');
  const lineOf = (pos) => code.slice(0, pos).split('\n').length;
  const alias = (code.match(/import \{ t(?: as (\w+))? \} from '[^']*i18n\.js'/) || [])[1] || 't';
  const visit = (n, scope) => {
    if (!n || typeof n.type !== 'string') return;
    let sc = scope;
    const isFn = /Function/.test(n.type);
    if (isFn || n.type === 'BlockStatement' || n.type === 'ForOfStatement' || n.type === 'ForStatement' || n.type === 'ForInStatement' || n.type === 'CatchClause' || n.type === 'Program') {
      const own = new Set();
      if (isFn) n.params.forEach((p) => names(p).forEach((x) => own.add(x)));
      if (n.type === 'CatchClause') names(n.param).forEach((x) => own.add(x));
      const decls = n.type === 'BlockStatement' || n.type === 'Program' ? n.body : n.type.startsWith('For') ? [n.init || n.left] : [];
      for (const d of decls || []) if (d && d.type === 'VariableDeclaration') d.declarations.forEach((v) => names(v.id).forEach((x) => own.add(x)));
      if (n.type === 'Program') own.delete(alias);
      sc = own.size ? [...scope, own] : scope;
    }
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === alias && sc.some((s) => s.has(alias))) {
      bad++; console.log(`${file}:${lineOf(n.start)}  t(...) shadowed by a local 't'`);
    }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach((c) => visit(c, sc)); else if (v && typeof v.type === 'string') visit(v, sc); }
  };
  visit(parseAst(code, { lang: 'js' }), []);
}
console.log(bad ? `${bad} shadowed call(s)` : 'no shadowed t() calls');
process.exit(bad ? 1 : 0);
