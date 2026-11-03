export const LANGS = [
  ['ar', 'العربية', 'rtl'], ['en', 'English'], ['fr', 'Français'], ['es', 'Español'],
  ['pt', 'Português'], ['de', 'Deutsch'], ['it', 'Italiano'], ['nl', 'Nederlands'],
  ['ru', 'Русский'], ['uk', 'Українська'], ['pl', 'Polski'], ['tr', 'Türkçe'],
  ['el', 'Ελληνικά'], ['fa', 'فارسی', 'rtl'], ['ur', 'اردو', 'rtl'], ['he', 'עברית', 'rtl'],
  ['hi', 'हिन्दी'], ['bn', 'বাংলা'], ['ta', 'தமிழ்'], ['zh', '中文'], ['ja', '日本語'],
  ['ko', '한국어'], ['id', 'Bahasa Indonesia'], ['ms', 'Bahasa Melayu'], ['vi', 'Tiếng Việt'],
  ['th', 'ไทย'], ['tl', 'Filipino'], ['sw', 'Kiswahili'],
];

let dict = {};
let fallback = {};
export let lang = 'en';
export const isRtl = (l = lang) => (LANGS.find((x) => x[0] === l) || [])[2] === 'rtl';

async function fetchJson(l) {
  try { const r = await fetch(`i18n/${l}.json`); if (r.ok) return await r.json(); } catch (e) {}
  return {};
}

export async function setLang(l) {
  if (!LANGS.some((x) => x[0] === l)) l = 'en';
  lang = l;
  if (!Object.keys(fallback).length) fallback = await fetchJson('en');
  dict = l === 'en' ? fallback : await fetchJson(l);
  document.documentElement.lang = l;
  document.documentElement.dir = isRtl(l) ? 'rtl' : 'ltr';
}

export function t(key, vars) {
  let s = dict[key] ?? fallback[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(vars[k]);
  return s;
}

export function guessLang() {
  for (const l of navigator.languages || [navigator.language || 'en']) {
    const c = l.toLowerCase().split('-')[0];
    const code = c === 'fil' ? 'tl' : c === 'iw' ? 'he' : c;
    if (LANGS.some((x) => x[0] === code)) return code;
  }
  return 'en';
}

// تنسيقات حسب اللغة
const loc = () => (lang === 'tl' ? 'fil' : lang);
export function fmtTime(min) {
  const d = new Date(2000, 0, 1, 0, 0); d.setMinutes(Math.round(min));
  return new Intl.DateTimeFormat(loc(), { hour: 'numeric', minute: '2-digit' }).format(d);
}
export const fmtClock = (date) => new Intl.DateTimeFormat(loc(), { hour: 'numeric', minute: '2-digit' }).format(date);
export const fmtDate = (date, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => new Intl.DateTimeFormat(loc(), opts).format(date);
export const fmtNum = (n, o) => new Intl.NumberFormat(loc(), o).format(n);
export const weekdayName = (i, style = 'long') => fmtDate(new Date(2024, 0, 7 + i), { weekday: style }); // 7/1/2024 = أحد
export function fmtDur(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60), m = min % 60;
  if (h && m) return t('dur_hm', { h: fmtNum(h), m: fmtNum(m) });
  if (h) return t('dur_h', { h: fmtNum(h) });
  return t('dur_m', { m: fmtNum(m) });
}
export function hijri(date, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  try { return new Intl.DateTimeFormat(`${loc()}-u-ca-islamic-umalqura`, opts).format(date); }
  catch (e) { return ''; }
}
