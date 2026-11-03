import { state, save } from '../store.js';
import { t, fmtNum, fmtDur, fmtTime, fmtDate } from '../i18n.js';
import { esc, $ } from '../ui.js';
import { todayStr, hm2min, addDays, ymd, parseYmd } from '../time.js';
import { rerender } from '../router.js';
import { openItemForm } from '../itemform.js';
import { itemRow, bindRows } from './tasks.js';
import { occursOn } from '../schedule.js';

export function render(el) {
  const s = state.settings, td = todayStr();
  const water = state.logs.water[td] || 0, goal = Number(s.waterGoal) || 8;
  const bed = hm2min(s.sleep.bed), wake = hm2min(s.sleep.wake);
  const planned = (wake - bed + 1440) % 1440;
  const slept = state.logs.sleep[td];
  const week = Array.from({ length: 7 }, (_, i) => ymd(addDays(new Date(), i - 6)));
  const workouts = state.items.filter((it) => it.cat === 'sport' && (occursOn(it, td) || (it.date && it.date >= td))).slice(0, 12);

  el.innerHTML = `
    <div class="page-head"><h1>${esc(t('nav_health'))}</h1></div>
    <section class="card">
      <h2>💧 ${esc(t('water'))}</h2>
      <div class="glasses" aria-label="${esc(t('water_count', { a: fmtNum(water), b: fmtNum(goal) }))}">${Array.from({ length: Math.max(goal, water) }, (_, i) => `<span class="glass ${i < water ? 'full' : ''}"></span>`).join('')}</div>
      <div class="row center gap"><button class="btn ghost" data-w="-1" aria-label="−">−</button><b class="big">${esc(t('water_count', { a: fmtNum(water), b: fmtNum(goal) }))}</b><button class="btn primary" data-w="1">＋ ${esc(t('glass'))}</button></div>
      <div class="bars7">${week.map((d) => { const v = state.logs.water[d] || 0; return `<div class="bar" title="${esc(d)}"><span style="height:${Math.min(100, (v / goal) * 100)}%"></span><small>${esc(fmtDate(parseYmd(d), { weekday: 'narrow' }))}</small></div>`; }).join('')}</div>
    </section>
    <section class="card">
      <div class="row between"><h2>🏃 ${esc(t('workouts'))}</h2><button class="btn soft small" data-add>＋ ${esc(t('add_workout'))}</button></div>
      ${workouts.length ? `<ul class="list">${workouts.map((it) => itemRow(it, occursOn(it, td) ? td : null)).join('')}</ul>` : `<p class="muted">${esc(t('no_workouts'))}</p>`}
    </section>
    <section class="card">
      <h2>😴 ${esc(t('sleep'))}</h2>
      <p>${esc(t('sleep_plan', { bed: fmtTime(bed), wake: fmtTime(wake), d: fmtDur(planned) }))} — <a href="#/settings">${esc(t('change'))}</a></p>
      <label class="inline">${esc(t('slept_last_night'))} <input type="number" step="0.5" min="0" max="16" id="slept" value="${slept ?? ''}" placeholder="${fmtNum(planned / 60)}"> ${esc(t('hours'))}</label>
      ${planned < 420 ? `<p class="warn-text small">${esc(t('sleep_short'))}</p>` : ''}
    </section>`;
  el.onclick = (e) => {
    const w = e.target.closest('[data-w]');
    if (w) { state.logs.water[td] = Math.max(0, water + Number(w.dataset.w)); save(); rerender(); }
    if (e.target.closest('[data-add]')) openItemForm({ preset: { cat: 'sport', dur: 45 }, title: t('add_workout') });
  };
  $('#slept', el).onchange = (e) => { const v = parseFloat(e.target.value); if (isNaN(v)) delete state.logs.sleep[td]; else state.logs.sleep[td] = v; save(); };
  bindRows(el);
}
