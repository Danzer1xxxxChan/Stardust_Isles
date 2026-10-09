// Minimal i18n: Chinese source strings are the keys; t() looks up the active language's table.
// The language is fixed at page load (switching saves and reloads), so module-level data that
// calls t() at import time is translated too.
import { EN } from './i18n/en.js';

const KEY = 'stardust-isles-lang';
const TABLES = { en: EN };
export const LANGS = { zh: '中文', en: 'English' };

function detect() {
  try {
    const s = localStorage.getItem(KEY);
    if (s && (s === 'zh' || TABLES[s])) return s;
  } catch { /* ignore */ }
  return 'zh';
}

export const LANG = detect();
const table = TABLES[LANG] || null;
const missing = new Set();

// t('现在有 {0} 颗星屑', [n]) — {n} placeholders, {{ / }} for literal braces.
export function t(s, args) {
  let out = s;
  if (table) {
    const tr = table[s];
    if (tr !== undefined) out = tr;
    else if (!missing.has(s)) { missing.add(s); if (typeof window !== 'undefined') (window.__i18nMissing ||= []).push(s); }
  }
  if (args || out.includes('{{')) out = out.replace(/\{\{|\}\}|\{(\d+)\}/g, (m, i) => (m === '{{' ? '{' : m === '}}' ? '}' : String(args?.[+i] ?? '')));
  return out;
}

export function setLang(lang) {
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
}

// Static DOM text: elements with data-i18n="原文" get their text replaced.
export function translateDom(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-CN';
}
