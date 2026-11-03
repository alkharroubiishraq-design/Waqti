import { state, catById } from './store.js';
import { prayerTimes, PRAYERS, isRamadan } from './worship.js';
import { parseYmd, hm2min, dateMin, ymd, nowMin, todayStr } from './time.js';
import { t } from './i18n.js';

const PRAYER_DUR = { fajr: 20, dhuhr: 15, asr: 15, maghrib: 15, isha: 15 };

// هل يقع العنصر في هذا اليوم؟ (مع التكرار)
export function occursOn(item, dateStr) {
  if (!item.date) return false;
  if (item.date === dateStr) return true;
  if (dateStr < item.date && item.rec !== 'yearly') return false;
  if (item.until && dateStr > item.until) return false;
  const a = parseYmd(item.date), b = parseYmd(dateStr);
  switch (item.rec) {
    case 'daily': return true;
    case 'weekdays': return b.getDay() !== 0 && b.getDay() !== 6;
    case 'weekly': return a.getDay() === b.getDay();
    case 'monthly': return a.getDate() === b.getDate();
    case 'yearly': return a.getDate() === b.getDate() && a.getMonth() === b.getMonth();
    default: return false;
  }
}
export const isDone = (item, dateStr) => !!(item.doneOn && item.doneOn[item.rec && item.rec !== 'none' ? dateStr : 'x']);
export function setDone(item, dateStr, v) {
  item.doneOn = item.doneOn || {};
  const k = item.rec && item.rec !== 'none' ? dateStr : 'x';
  if (v) item.doneOn[k] = dateStr; else delete item.doneOn[k];
}

export function itemsOn(dateStr) {
  return state.items.filter((it) => occursOn(it, dateStr));
}

// المواعيد الثابتة (صلاة، قداس، دوام، نوم)
export function fixedBlocks(dateStr) {
  const s = state.settings, d = parseYmd(dateStr), wd = d.getDay(), out = [];
  if (s.religion === 'islam' && s.city) {
    const pt = prayerTimes(d, s);
    for (const k of PRAYERS) {
      const fri = k === 'dhuhr' && wd === 5 && s.jumuah;
      out.push({ id: `p-${k}`, type: 'prayer', prayer: k, title: fri ? t('jumuah') : t(`pr_${k}`), start: dateMin(pt[k]), dur: fri ? 60 : PRAYER_DUR[k], color: '#0d9488', icon: fri ? '🕌' : '🤲' });
    }
    if (isRamadan(d)) {
      out.push({ id: 'suhoor', type: 'suhoor', title: t('suhoor'), start: dateMin(pt.fajr) - 40, dur: 30, color: '#6366f1', icon: '🌙' });
      out.push({ id: 'iftar', type: 'iftar', title: t('iftar'), start: dateMin(pt.maghrib) + 15, dur: 30, color: '#f59e0b', icon: '🍽️' });
    }
  }
  if (s.religion === 'christian' && wd === Number(s.massDay)) {
    out.push({ id: 'mass', type: 'mass', title: t('mass'), start: hm2min(s.massTime), dur: Number(s.massDur) || 60, color: '#0d9488', icon: '⛪' });
  }
  if (s.work.on && s.work.days.includes(wd)) {
    const a = hm2min(s.work.start), b = hm2min(s.work.end);
    out.push({ id: 'work', type: 'work', title: t('work_hours'), start: a, dur: (b - a + 1440) % 1440 || 480, color: '#3b82f6', icon: '💼', soft: true });
  }
  const bed = hm2min(s.sleep.bed), wake = hm2min(s.sleep.wake);
  if (wake > 0) out.push({ id: 'sleep-am', type: 'sleep', title: t('sleep'), start: bed < wake ? bed : 0, dur: bed < wake ? wake - bed : wake, color: '#475569', icon: '😴' });
  if (bed > wake) out.push({ id: 'sleep-pm', type: 'sleep', title: t('sleep'), start: bed, dur: 1440 - bed, color: '#475569', icon: '😴' });
  return out.sort((a, b) => a.start - b.start);
}

// كل ما يظهر على الخط الزمني
export function dayBlocks(dateStr) {
  const fixed = fixedBlocks(dateStr).map((b) => ({ ...b, fixed: true }));
  const items = itemsOn(dateStr).filter((it) => it.start).map((it) => {
    const c = catById(it.cat);
    return { id: it.id, item: it, title: it.title, start: hm2min(it.start), dur: Number(it.dur) || 30, color: it.color || c.color, icon: c.icon, done: isDone(it, dateStr) };
  });
  return [...fixed, ...items].sort((a, b) => a.start - b.start);
}

// الفترات المشغولة — الصلاة والقداس والنوم والدوام مواعيد لا تُلمس
function busy(dateStr, ignoreId, { allowWork = false } = {}) {
  return dayBlocks(dateStr)
    .filter((b) => b.id !== ignoreId && !(allowWork && b.type === 'work'))
    .map((b) => [b.start, b.start + b.dur]);
}

export function conflictsAt(dateStr, start, dur, ignoreId) {
  return dayBlocks(dateStr).filter((b) => b.id !== ignoreId && b.start < start + dur && start < b.start + b.dur);
}

// الجدولة الذكية: أنسب أوقات بدون تعارض
export function suggestSlots(dateStr, dur, { ignoreId, count = 3, from, cat } = {}) {
  dur = Number(dur) || 30;
  const s = state.settings, buffer = 5;
  // مهام العمل مسموحة داخل الدوام
  const allowWork = cat === 'work';
  const iv = busy(dateStr, ignoreId, { allowWork }).sort((a, b) => a[0] - b[0]);
  let cursor = from ?? 0;
  if (dateStr === todayStr()) cursor = Math.max(cursor, Math.ceil((nowMin() + 5) / 5) * 5);
  else if (dateStr < todayStr()) return [];
  const wake = hm2min(s.sleep.wake), bed = hm2min(s.sleep.bed);
  cursor = Math.max(cursor, wake);
  const end = bed > wake ? bed : 1440;
  const out = [];
  while (cursor + dur <= end && out.length < count) {
    const hit = iv.find(([a, b]) => a < cursor + dur + buffer && cursor < b + buffer);
    if (!hit) {
      out.push(cursor);
      cursor += Math.max(dur + buffer, 60); // تنويع الاقتراحات
      cursor = Math.ceil(cursor / 5) * 5;
    } else cursor = Math.ceil((hit[1] + buffer) / 5) * 5;
  }
  // مهام العمل: نفضّل وقت الدوام إن وجد
  return out;
}

// ترتيب تلقائي لمهام اليوم غير المجدولة حسب الأولوية
export function autoPlan(dateStr) {
  const pending = itemsOn(dateStr).filter((it) => !it.start && !isDone(it, dateStr))
    .sort((a, b) => (b.prio || 2) - (a.prio || 2));
  let placed = 0;
  for (const it of pending) {
    const [slot] = suggestSlots(dateStr, it.dur || 30, { ignoreId: it.id, cat: it.cat });
    if (slot == null) continue;
    if (it.rec && it.rec !== 'none' && it.date !== dateStr) continue;
    it.start = `${String(Math.floor(slot / 60)).padStart(2, '0')}:${String(slot % 60).padStart(2, '0')}`;
    it.date = it.date || dateStr;
    placed++;
  }
  return placed;
}

export const dateOfToday = () => ymd(new Date());
