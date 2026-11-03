import { state, catById } from '../store.js';
import { t, fmtDate, fmtNum, fmtDur } from '../i18n.js';
import { esc } from '../ui.js';
import { dayBlocks, itemsOn, isDone } from '../schedule.js';
import { weekStartOf, addDays, ymd, todayStr, nowMin } from '../time.js';
import { catName } from '../itemform.js';
import { PRAYERS } from '../worship.js';

export function weekStats(offset = 0) {
  const s = state.settings, ws = addDays(weekStartOf(new Date(), s.weekStart), offset * 7), td = todayStr();
  const buckets = {}; // دقائق حسب الفئة
  const add = (k, m) => { buckets[k] = (buckets[k] || 0) + m; };
  let due = 0, done = 0, prayDue = 0, prayDone = 0, habitDue = 0, habitDone = 0, waterOk = 0, waterDays = 0, focus = 0;
  const daily = [];
  for (let i = 0; i < 7; i++) {
    const d = ymd(addDays(ws, i));
    let dayDone = 0;
    for (const b of dayBlocks(d)) {
      if (b.type === 'sleep') add('sleep', b.dur);
      else if (b.type === 'work') add('work_fixed', b.dur);
      else if (b.fixed) add('worship', b.dur);
      else add(b.item.cat, b.dur);
    }
    const items = itemsOn(d);
    if (d <= td) {
      for (const it of items) { due++; if (isDone(it, d)) { done++; dayDone += Number(it.dur) || 30; } }
      if (s.religion === 'islam' && s.city) {
        const blocks = dayBlocks(d).filter((b) => b.type === 'prayer' && (d < td || b.start <= nowMin()));
        prayDue += blocks.length; prayDone += blocks.filter((b) => state.logs.prayed[d]?.[b.prayer]).length;
      }
      for (const h of state.habits) { habitDue++; if (h.log[d]) habitDone++; }
      waterDays++; if ((state.logs.water[d] || 0) >= (Number(s.waterGoal) || 8)) waterOk++;
    }
    const f = state.logs.pomo[d]?.m || 0; focus += f;
    daily.push({ d, min: dayDone + f });
  }
  const total = 7 * 1440, used = Object.values(buckets).reduce((a, b) => a + b, 0);
  buckets.free = Math.max(0, total - used);
  return { ws, buckets, due, done, prayDue, prayDone, habitDue, habitDone, waterOk, waterDays, focus, daily };
}

const LABEL = (k) => (k === 'sleep' ? t('sleep') : k === 'work_fixed' ? t('work_hours') : k === 'worship' ? t('cat_worship') : k === 'free' ? t('free_time') : catName(catById(k)));
const COLOR = (k) => ({ sleep: '#475569', work_fixed: '#3b82f6', worship: '#0d9488', free: '#cbd5e1' }[k] || catById(k).color);
const ICON = (k) => ({ sleep: '😴', work_fixed: '💼', worship: '🕊️', free: '☁️' }[k] || catById(k).icon);

export function render(el, q) {
  const off = Number(q.get('w') || 0);
  const st = weekStats(off);
  const entries = Object.entries(st.buckets).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = 7 * 1440;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  const top = entries.find(([k]) => k !== 'sleep' && k !== 'free');
  const maxDay = Math.max(60, ...st.daily.map((x) => x.min));
  const meters = [
    ['✅', t('commit_tasks'), pct(st.done, st.due), `${fmtNum(st.done)}/${fmtNum(st.due)}`],
    state.settings.religion === 'islam' ? ['🤲', t('commit_prayers'), pct(st.prayDone, st.prayDue), `${fmtNum(st.prayDone)}/${fmtNum(st.prayDue)}`] : null,
    state.habits.length ? ['🔁', t('commit_habits'), pct(st.habitDone, st.habitDue), `${fmtNum(st.habitDone)}/${fmtNum(st.habitDue)}`] : null,
    ['💧', t('commit_water'), pct(st.waterOk, st.waterDays), `${fmtNum(st.waterOk)}/${fmtNum(st.waterDays)}`],
  ].filter(Boolean);

  el.innerHTML = `
    <div class="page-head"><h1>${esc(t('nav_stats'))}</h1></div>
    <div class="row between week-nav">
      <a class="icon-btn" href="#/stats?w=${off - 1}" aria-label="${esc(t('prev_week'))}">‹</a>
      <b>${esc(fmtDate(st.ws, { day: 'numeric', month: 'short' }))} – ${esc(fmtDate(addDays(st.ws, 6), { day: 'numeric', month: 'short' }))}</b>
      <a class="icon-btn ${off >= 0 ? 'disabled' : ''}" href="#/stats?w=${Math.min(0, off + 1)}" aria-label="${esc(t('next_week'))}">›</a>
    </div>
    <section class="card">
      <h2>⏳ ${esc(t('where_time'))}</h2>
      ${top ? `<p class="insight">${esc(t('insight_top', { x: LABEL(top[0]), p: fmtNum(pct(top[1], total - (st.buckets.sleep || 0) - (st.buckets.free || 0)) || 0) }))}</p>` : ''}
      <div class="stack" role="img" aria-label="${esc(t('where_time'))}">${entries.map(([k, v]) => `<span style="flex:${v};background:${COLOR(k)}" title="${esc(LABEL(k))}"></span>`).join('')}</div>
      <ul class="legend">${entries.map(([k, v]) => `<li><span class="dot" style="background:${COLOR(k)}"></span>${ICON(k)} ${esc(LABEL(k))}<span class="grow"></span><b>${esc(fmtDur(v))}</b><span class="muted small">&nbsp;${esc(fmtNum(pct(v, total)))}%</span></li>`).join('')}</ul>
    </section>
    <section class="card">
      <h2>🎯 ${esc(t('commitment'))}</h2>
      ${meters.map(([ic, label, p, frac]) => `<div class="meter"><div class="row between"><span>${ic} ${esc(label)}</span><span><b>${p == null ? '—' : esc(fmtNum(p)) + '%'}</b> <span class="muted small">${esc(frac)}</span></span></div><div class="track"><span style="width:${p || 0}%"></span></div></div>`).join('')}
    </section>
    <section class="card">
      <h2>📈 ${esc(t('productive_daily'))}</h2>
      <div class="bars7 tall">${st.daily.map((x) => `<div class="bar" title="${esc(fmtDur(x.min))}"><span style="height:${(x.min / maxDay) * 100}%"></span><small>${esc(fmtDate(new Date(x.d + 'T12:00'), { weekday: 'short' }))}</small></div>`).join('')}</div>
      <p class="muted small">🍅 ${esc(t('focus_week', { a: fmtDur(st.focus) }))}</p>
    </section>`;
}
