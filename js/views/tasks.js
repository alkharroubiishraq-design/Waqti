import { state, save, catById } from '../store.js';
import { t, fmtTime, fmtDate, fmtDur } from '../i18n.js';
import { esc } from '../ui.js';
import { isDone, setDone, occursOn } from '../schedule.js';
import { todayStr, parseYmd, hm2min, addDays, ymd } from '../time.js';
import { go, rerender } from '../router.js';
import { openItemForm } from '../itemform.js';

const TABS = ['today', 'upcoming', 'nodate', 'repeat', 'done'];

export function itemRow(it, dateStr, { showDate = true } = {}) {
  const c = catById(it.cat), done = isDone(it, dateStr || it.date || 'x');
  const when = [showDate && it.date ? fmtDate(parseYmd(it.date), { weekday: 'short', day: 'numeric', month: 'short' }) : '', it.start ? fmtTime(hm2min(it.start)) : '', fmtDur(it.dur || 30)].filter(Boolean).join(' · ');
  return `<li class="row-item ${done ? 'done' : ''}" style="--c:${c.color}">
    <button class="check" data-toggle="${it.id}" data-day="${esc(dateStr || '')}" aria-pressed="${done}" aria-label="${esc(t('mark_done'))}">${done ? '✓' : ''}</button>
    <div class="grow" data-open="${it.id}">
      <div class="ri-title">${c.icon} ${esc(it.title)} ${it.prio === 3 ? `<span class="flag" title="${esc(t('prio_3'))}">●</span>` : ''}</div>
      <div class="muted small">${esc(when)}${it.rec && it.rec !== 'none' ? ` · 🔁 ${esc(t(`rec_${it.rec}`))}` : ''}</div>
    </div>
  </li>`;
}

export function bindRows(el) {
  el.addEventListener('click', (e) => {
    const tg = e.target.closest('[data-toggle]');
    if (tg) {
      const it = state.items.find((x) => x.id === tg.dataset.toggle);
      const day = tg.dataset.day || it.date || todayStr();
      setDone(it, day, !isDone(it, day)); save(); return rerender();
    }
    const op = e.target.closest('[data-open]');
    if (op) { const it = state.items.find((x) => x.id === op.dataset.open); if (it) openItemForm({ item: it }); }
  });
}

export function render(el, q) {
  const tab = TABS.includes(q.get('tab')) ? q.get('tab') : 'today';
  const td = todayStr();
  const sortFn = (a, b) => (b.prio || 2) - (a.prio || 2) || (a.date || '9').localeCompare(b.date || '9') || (a.start || '99').localeCompare(b.start || '99');
  let list = [], dayFor = () => null;
  if (tab === 'today') { list = state.items.filter((it) => occursOn(it, td)); dayFor = () => td; }
  if (tab === 'upcoming') {
    const end = ymd(addDays(new Date(), 14));
    list = state.items.filter((it) => it.date && it.date > td && it.date <= end && (!it.rec || it.rec === 'none') && !isDone(it, it.date));
  }
  if (tab === 'nodate') list = state.items.filter((it) => !it.date && !isDone(it, 'x'));
  if (tab === 'repeat') list = state.items.filter((it) => it.rec && it.rec !== 'none');
  if (tab === 'done') list = state.items.filter((it) => (!it.rec || it.rec === 'none') && isDone(it, 'x')).slice(-50).reverse();
  if (tab !== 'done') list.sort(sortFn);

  el.innerHTML = `
    <div class="page-head"><h1>${esc(t('nav_tasks'))}</h1><button class="btn primary" data-add>＋ ${esc(t('add'))}</button></div>
    <div class="tabs" role="tablist">${TABS.map((x) => `<a role="tab" href="#/tasks?tab=${x}" class="${x === tab ? 'active' : ''}" aria-selected="${x === tab}">${esc(t(`tab_${x}`))}</a>`).join('')}</div>
    ${list.length ? `<ul class="list card">${list.map((it) => itemRow(it, dayFor(it))).join('')}</ul>` : `<div class="empty card">🌿 ${esc(t('empty_tasks'))}</div>`}
  `;
  el.querySelector('[data-add]').onclick = () => openItemForm({ preset: tab === 'nodate' ? { date: null } : {} });
  bindRows(el);
}
