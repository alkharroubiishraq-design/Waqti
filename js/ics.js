// تصدير المواعيد لتقويم الجهاز (للتذكير حتى والتطبيق مسكّر)
import { state } from './store.js';
import { dayBlocks } from './schedule.js';
import { addDays, ymd, pad } from './time.js';
import { t } from './i18n.js';

const fmt = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const escI = (s) => String(s).replace(/[\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');

export function buildIcs(days = 30, { prayers = true, items = true } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Waqti//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${escI(t('app_name'))}`];
  const now = new Date(), stamp = fmt(now);
  for (let i = 0; i < days; i++) {
    const day = addDays(now, i), ds = ymd(day);
    for (const b of dayBlocks(ds)) {
      if (b.type === 'sleep' || b.type === 'work') continue;
      if (b.fixed && !prayers) continue;
      if (!b.fixed && !items) continue;
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, Math.round(b.start));
      const end = new Date(start.getTime() + b.dur * 60000);
      const before = b.item ? b.item.remind : state.settings.remindMin;
      lines.push('BEGIN:VEVENT', `UID:${b.id}-${ds}@waqti`, `DTSTAMP:${stamp}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`, `SUMMARY:${escI(b.title)}`);
      if (before !== '' && before != null) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escI(b.title)}`, `TRIGGER:-PT${Number(before) || 0}M`, 'END:VALARM');
      lines.push('END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
