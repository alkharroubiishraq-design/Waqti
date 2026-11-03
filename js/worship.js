import { Coordinates, CalculationMethod, PrayerTimes, Madhab, Qibla, HighLatitudeRule } from '../vendor/adhan.js';
import { addDays, ymd, parseYmd } from './time.js';

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const CALC_METHODS = ['MuslimWorldLeague', 'Egyptian', 'Karachi', 'UmmAlQura', 'Dubai', 'MoonsightingCommittee', 'NorthAmerica', 'Kuwait', 'Qatar', 'Singapore', 'Tehran', 'Turkey'];

// طريقة الحساب الافتراضية حسب الدولة
const METHOD_BY_CC = {
  SA: 'UmmAlQura', YE: 'UmmAlQura', EG: 'Egyptian', SY: 'Egyptian', LB: 'Egyptian', JO: 'Egyptian', PS: 'Egyptian', IQ: 'Egyptian',
  SD: 'Egyptian', LY: 'Egyptian', DZ: 'MuslimWorldLeague', MA: 'MuslimWorldLeague', TN: 'MuslimWorldLeague',
  AE: 'Dubai', OM: 'Dubai', BH: 'Dubai', KW: 'Kuwait', QA: 'Qatar', PK: 'Karachi', IN: 'Karachi', BD: 'Karachi', AF: 'Karachi',
  MY: 'Singapore', SG: 'Singapore', ID: 'Singapore', BN: 'Singapore', IR: 'Tehran', TR: 'Turkey', AZ: 'Turkey',
  US: 'NorthAmerica', CA: 'NorthAmerica', GB: 'MoonsightingCommittee',
};
export const methodForCountry = (cc) => METHOD_BY_CC[cc] || 'MuslimWorldLeague';

function params(s) {
  const p = (CalculationMethod[s.calc] || CalculationMethod.MuslimWorldLeague)();
  p.madhab = s.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  return p;
}

export function prayerTimes(date, s) {
  if (!s.city) return null;
  const c = new Coordinates(s.city.lat, s.city.lng);
  const p = params(s);
  try { p.highLatitudeRule = HighLatitudeRule.recommended(c); } catch (e) {}
  const pt = new PrayerTimes(c, date, p);
  return { fajr: pt.fajr, sunrise: pt.sunrise, dhuhr: pt.dhuhr, asr: pt.asr, maghrib: pt.maghrib, isha: pt.isha };
}

export function nextPrayer(s, now = new Date()) {
  for (let i = 0; i < 2; i++) {
    const day = addDays(now, i);
    const pt = prayerTimes(day, s);
    if (!pt) return null;
    for (const k of PRAYERS) if (pt[k] > now) return { key: k, time: pt[k] };
  }
  return null;
}

export const qibla = (s) => (s.city ? Qibla(new Coordinates(s.city.lat, s.city.lng)) : null);

// ===== التقويم الهجري (أم القرى — قد يختلف يوماً عن رؤية الهلال) =====
const hfmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
export function hijriParts(date) {
  try {
    const p = Object.fromEntries(hfmt.formatToParts(date).map((x) => [x.type, x.value]));
    return { d: +p.day, m: +p.month, y: parseInt(p.year, 10) };
  } catch (e) { return null; }
}
export const isRamadan = (date) => hijriParts(date)?.m === 9;

const ISLAMIC_DAYS = [
  { key: 'ev_hijri_new_year', m: 1, d: 1 }, { key: 'ev_ashura', m: 1, d: 10 },
  { key: 'ev_ramadan_start', m: 9, d: 1 }, { key: 'ev_laylat_qadr', m: 9, d: 27 },
  { key: 'ev_eid_fitr', m: 10, d: 1 }, { key: 'ev_arafah', m: 12, d: 9 }, { key: 'ev_eid_adha', m: 12, d: 10 },
];
export function islamicOccasions(from = new Date(), days = 400) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i), h = hijriParts(d);
    if (!h) break;
    const ev = ISLAMIC_DAYS.find((e) => e.m === h.m && e.d === h.d);
    if (ev) out.push({ key: ev.key, date: ymd(d) });
  }
  return out;
}

// ===== الأعياد المسيحية =====
export function westernEaster(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
// الفرق بين التقويم اليولياني والغريغوري (13 يوماً بين 1900 و 2099)
const julianOffset = (y) => Math.floor(y / 100) - Math.floor(y / 400) - 2;
export function orthodoxEaster(y) {
  const a = y % 4, b = y % 7, c = y % 19;
  const d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
  return new Date(y, month - 1, day + julianOffset(y));
}

export function christianFeasts(year, s) {
  const eastern = s.church === 'eastern';
  const E = eastern ? orthodoxEaster(year) : westernEaster(year);
  const jul = eastern && s.fixedFeasts === 'julian' ? julianOffset(year) : 0;
  const fixed = (m, d) => new Date(year, m - 1, d + jul);
  const list = [
    { key: 'ev_christmas', date: fixed(12, 25) },
    { key: 'ev_epiphany', date: fixed(1, 6) },
    { key: 'ev_annunciation', date: fixed(3, 25) },
    { key: eastern ? 'ev_clean_monday' : 'ev_ash_wednesday', date: addDays(E, eastern ? -48 : -46) },
    { key: 'ev_palm_sunday', date: addDays(E, -7) },
    { key: 'ev_good_friday', date: addDays(E, -2) },
    { key: 'ev_easter', date: E },
    { key: 'ev_ascension', date: addDays(E, 39) },
    { key: 'ev_pentecost', date: addDays(E, 49) },
    { key: eastern ? 'ev_dormition' : 'ev_assumption', date: fixed(8, 15) },
    { key: 'ev_holy_cross', date: fixed(9, 14) },
  ];
  // عيد الميلاد اليولياني (7 كانون الثاني) يقع في السنة نفسها مبكراً
  if (jul) list.push({ key: 'ev_christmas', date: new Date(year - 1, 11, 25 + jul) });
  return list.map((f) => ({ key: f.key, date: ymd(f.date) }));
}

export function upcomingFeasts(s, from = new Date(), days = 400) {
  const start = ymd(from), end = ymd(addDays(from, days));
  let list = [];
  if (s.religion === 'christian') {
    const y = from.getFullYear();
    list = [...christianFeasts(y, s), ...christianFeasts(y + 1, s)];
  } else if (s.religion === 'islam') list = islamicOccasions(from, days);
  const seen = new Set();
  return list.filter((f) => f.date >= start && f.date <= end && !seen.has(f.key + f.date) && seen.add(f.key + f.date))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function feastsOn(dateStr, s) {
  const d = parseYmd(dateStr);
  if (s.religion === 'christian') return christianFeasts(d.getFullYear(), s).concat(christianFeasts(d.getFullYear() + 1, s)).filter((f) => f.date === dateStr);
  if (s.religion === 'islam') return islamicOccasions(d, 1);
  return [];
}
