export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const todayStr = () => ymd(new Date());
export const hm2min = (s) => { if (!s) return 0; const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); };
export const min2hm = (m) => { m = Math.round(m); m = ((m % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
export const dateMin = (d) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
export const nowMin = () => dateMin(new Date());
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
export function weekStartOf(d, ws = 1) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (x.getDay() - ws + 7) % 7;
  return addDays(x, -diff);
}
export function atMin(dateStr, min) {
  const d = parseYmd(dateStr); d.setMinutes(min); return d;
}
